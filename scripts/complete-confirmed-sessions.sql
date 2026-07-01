-- ============================================================
-- Vita — Auto-completado de sesiones + invitación a review
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-01 (creada), corrida en Supabase el 01/07/2026
--
-- HALLAZGO IMPORTANTE (01/07/2026): esta función se documentó en su
-- momento (23/06/2026, ver Notion "Decisiones estratégicas") como
-- "✅ Completado y verificado en Supabase", junto con el cron job
-- `complete-sessions` (pg_cron, cada 5 minutos, ya agendado y activo
-- llamando a `complete_confirmed_sessions()`). Pero la función en sí
-- NUNCA quedó persistida en la base — confirmado con
-- `pg_get_functiondef` (no existe), búsqueda por nombre en `pg_proc`
-- (no existe) y búsqueda por contenido `'invitacion_review'` en el
-- body de cualquier función (no existe en ningún lado). Mismo patrón
-- que el incidente ya documentado del 19/06 (código/schema
-- documentado como corrido que en realidad nunca se ejecutó contra
-- producción).
--
-- Consecuencia real: desde que se agendó el cron job, cada corrida
-- (cada 5 minutos) fallaba en silencio — ningún booking se marcó
-- 'completada' automáticamente nunca, y no se generó ninguna
-- notificación 'invitacion_review' para nadie (ni usuario ni coach).
-- El CHECK constraint de `notifications.type` sí incluye
-- 'invitacion_review' (confirmado con `pg_get_constraintdef`) — esa
-- parte del trabajo del 23/06 sí quedó persistida, solo la función
-- faltaba.
--
-- Esta versión ya nace unidireccional (usuario → coach), por decisión
-- de producto del 01/07/2026 (ver Notion, sección "Reviews:
-- unidireccionales"): solo inserta la notificación para
-- `bookings.user_id`, nunca para el coach. No hubo que "sacar" un
-- INSERT del lado coach — nunca existió tal INSERT porque la función
-- nunca corrió.
--
-- No manda push real (pg_net/Edge Function) — mismo alcance que
-- expire_pending_bookings() (ver scripts/expire-pending-bookings.sql),
-- solo inserta la fila en `notifications` que la UI in-app lee.
--
-- No hace falta tocar `cron.job` — el job `complete-sessions` ya
-- estaba agendado y activo, llamando a `complete_confirmed_sessions()`
-- sin prefijo de schema (resuelve por `search_path`, que incluye
-- `public` por default). Apenas la función existe, la próxima corrida
-- (máximo 5 min después) empieza a funcionar por primera vez.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_confirmed_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  WITH completed AS (
    UPDATE public.bookings
    SET status = 'completada'
    WHERE status = 'confirmada'
      AND (
        (scheduled_date::text || ' ' || scheduled_time)::timestamp
          AT TIME ZONE 'America/Argentina/Buenos_Aires'
      ) + interval '20 minutes' < now()
    RETURNING id, user_id, coach_name
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

-- El cron job ya existe y está activo — se deja documentado acá por
-- las dudas (cron.schedule() con el mismo nombre es idempotente, así
-- que re-correr esto no duplica ni rompe nada si hiciera falta):
-- SELECT cron.schedule(
--   'complete-sessions',
--   '*/5 * * * *',
--   $$SELECT public.complete_confirmed_sessions();$$
-- );

-- Para revertir si hace falta:
-- DROP FUNCTION IF EXISTS public.complete_confirmed_sessions();
-- (el cron job seguiría agendado y volvería a fallar en silencio cada
-- 5 minutos, igual que antes de este fix — considerar
-- `SELECT cron.unschedule('complete-sessions');` también)
