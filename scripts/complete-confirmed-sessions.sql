-- ============================================================
-- Vita — Auto-completado de sesiones + invitación a review
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
--
-- Creada 2026-07-01. **REESCRITA el 2026-09-13** — ver abajo.
-- ============================================================
--
-- ── POR QUÉ SE REESCRIBIÓ (13/09/2026, ver docs/no-show.md) ──────────────────
--
-- 🔴 La versión anterior marcaba `completada` **20 minutos después del horario,
-- mirando SOLO el reloj**. O sea que una sesión donde el profesional no apareció
-- quedaba registrada como cumplida, con cuatro consecuencias y ninguna visible:
--
--   1. le disparaba la notificación `invitacion_review` al cliente plantado
--      — el peor mail posible, y salía solo;
--   2. contaba para el tramo de comisión reducida en `mp-create-payment`,
--      que cuenta `status = 'completada'`;
--   3. habilitaba el pago al coach en el riel internacional: `admin-actions →
--      mark_coach_paid` exige `status = 'completada'`, así que ese guard
--      **parecía** verificar que la sesión ocurrió cuando verificaba que pasó
--      la hora;
--   4. habilitaba dejar una reseña (`harden-reviews-insert.sql` exige una
--      sesión propia y `completada`) sobre una sesión que no pasó.
--
-- Es el mismo patrón que ya había mordido con los checkouts abandonados: 16
-- reservas nunca pagadas llegaron a `completada` por esta misma función (ver
-- `scripts/expire-unpaid-checkouts.sql`).
--
-- ── LOS DOS CAMBIOS ─────────────────────────────────────────────────────────
--
-- **(1) Corre después del FIN de la sesión, no a los 20 minutos del inicio.**
-- Con la tolerancia de llegada del cliente en 20 minutos (docs/no-show.md), a
-- los 20 minutos una sesión con alguien demorado **recién está empezando**.
-- Ahora el corte es `inicio + duration_minutes`.
--
-- **(2) Exige EVIDENCIA de que hubo dos personas en la sala.** `max_simultaneous
-- >= 2` sobre `session_attendance`, que ya se puebla desde el 25/08 y que hasta
-- hoy no consumía nadie.
--
-- 📌 **Por qué `max_simultaneous` y no el solapamiento real de 10 minutos**, que
-- es lo que dice la regla: el solapamiento exige identificar QUIÉN es cada
-- participante (`user_id` por participante dentro de `raw`), y **eso todavía no
-- se verificó contra una respuesta real de Daily** — es la medición 1 de
-- docs/no-show.md. Escribir esa lógica ahora sería colgarla de un campo que
-- puede no venir. `max_simultaneous` sale del resumen que la edge function YA
-- deriva y guarda, así que no asume nada nuevo.
--   → Cuando esa medición esté, este `where` pasa a leer la vista derivada del
--     veredicto y esta función no vuelve a cambiar.
--
-- ── LO QUE ESTA FUNCIÓN A PROPÓSITO **NO** HACE ─────────────────────────────
--
-- 🔴 **No inventa un estado nuevo** tipo `no_realizada`. `bookings.status` **no
-- tiene CHECK** (los únicos CHECK de la tabla son sobre `payment_status`), y hay
-- 31 lugares en 17 archivos filtrando por `'completada'` o por
-- `in ('pendiente','confirmada')`. Un quinto valor se colaría en silencio por
-- todos ellos. La sesión sin evidencia simplemente **no se marca**: se queda en
-- `confirmada` y la levanta el panel. Crear el estado es una decisión aparte,
-- deliberada, y con los 31 call sites revisados.
--
-- ⚠️ **Consecuencia conocida y aceptada:** una sesión que ocurrió de verdad pero
-- cuya fila de asistencia todavía no llegó **no se completa hasta que llegue**.
-- `session-attendance` corre cada hora, así que el retraso normal es < 1h. Es el
-- lado correcto en el que equivocarse: demorar una invitación a reseñar es
-- barato, y afirmar que una sesión ocurrió cuando no hay prueba es lo que
-- rompía las cuatro cosas de arriba.
--
-- ⚠️ Y si `session-attendance` se cae del todo, **nada se completa**. Es
-- deliberado —sin evidencia no se afirma— pero es un modo de falla nuevo que
-- antes no existía: mirarlo si aparecen reservas viejas en `confirmada`.
--
-- No manda push real (pg_net/Edge Function), igual que antes: solo inserta la
-- fila en `notifications` que la UI in-app lee.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_confirmed_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  WITH completed AS (
    UPDATE public.bookings b
    SET status = 'completada'
    WHERE b.status = 'confirmada'
      -- (1) La sesión TERMINÓ. `duration_minutes` es nullable: 60 es el mismo
      -- default que usa `create-meeting-room` para la ventana de la sala.
      AND (
        (b.scheduled_date::text || ' ' || b.scheduled_time)::timestamp
          AT TIME ZONE 'America/Argentina/Buenos_Aires'
      ) + make_interval(mins => coalesce(b.duration_minutes, 60)) < now()
      -- (2) Y hay PRUEBA de que hubo dos personas en la sala.
      AND EXISTS (
        SELECT 1
        FROM public.session_attendance sa
        WHERE sa.booking_id = b.id
          AND coalesce(sa.max_simultaneous, 0) >= 2
      )
    RETURNING b.id, b.user_id, b.coach_name
  )
  INSERT INTO public.notifications (recipient_id, type, booking_id, title, body)
  SELECT
    user_id,
    'invitacion_review',
    id,
    '¿Cómo estuvo tu sesión?',
    'Contanos cómo te fue con ' || coalesce(coach_name, 'tu coach') || ' — tu reseña ayuda a otros a elegir mejor.'
  FROM completed;
END;
$$;

-- El cron job `complete-sessions` (cada 5 minutos) ya existe y está activo
-- llamando a `complete_confirmed_sessions()`. No hay que tocarlo: cambia el
-- cuerpo, no la firma.
--   SELECT cron.schedule('complete-sessions', '*/5 * * * *',
--                        $$SELECT public.complete_confirmed_sessions();$$);

-- ── VERIFICACIÓN (correr DESPUÉS, en el SQL editor) ─────────────────────────
--
-- 1. Que la función nueva quedó (tiene que aparecer `max_simultaneous`):
--      select pg_get_functiondef('public.complete_confirmed_sessions()'::regprocedure)
--             like '%max_simultaneous%' as tiene_el_guard;
--
-- 2. 🔴 Las que la versión vieja habría marcado y esta NO — o sea las que
--    estaban por convertirse en completadas falsas. Si devuelve filas, cada una
--    es una sesión terminada sin prueba de que alguien haya entrado:
--      select b.id, b.scheduled_date, b.scheduled_time, b.coach_name,
--             sa.max_simultaneous, sa.participants_count
--      from bookings b
--      left join session_attendance sa on sa.booking_id = b.id
--      where b.status = 'confirmada'
--        and ((b.scheduled_date::text || ' ' || b.scheduled_time)::timestamp
--              at time zone 'America/Argentina/Buenos_Aires')
--            + make_interval(mins => coalesce(b.duration_minutes, 60)) < now()
--      order by b.scheduled_date desc;
--
-- 3. Que no quedaron reservas viejas trabadas por falta de fila de asistencia
--    (esto es el modo de falla nuevo — ver arriba):
--      select count(*) as sin_fila_de_asistencia
--      from bookings b
--      where b.status = 'confirmada'
--        and b.scheduled_date < current_date - 2
--        and not exists (select 1 from session_attendance sa where sa.booking_id = b.id);

-- Para volver atrás: re-correr la versión anterior de este archivo
-- (git show HEAD~1:scripts/complete-confirmed-sessions.sql).
