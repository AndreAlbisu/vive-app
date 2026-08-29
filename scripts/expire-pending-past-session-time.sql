-- ============================================================
-- Vita — una reserva pendiente no puede sobrevivir a su propio horario
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE ANTES DE CORRER
-- Fecha: 2026-08-28
--
-- EL DEFECTO
-- `expire_pending_bookings()` tenía un solo criterio de vencimiento, y no era
-- el horario de la sesión:
--
--     where status = 'pendiente' and created_at < now() - interval '24 hours'
--
-- O sea que vencía por ANTIGÜEDAD DE LA SOLICITUD, no por si la sesión ya pasó.
-- Una reserva pedida para dentro de 3 horas que el coach nunca acepta cruza el
-- horario de la sesión y se queda `pendiente` otras 21 horas.
--
-- Lo que eso significa para cada uno:
--   · La persona ve "esperando confirmación" para una sesión que ya pasó, y si
--     pagó, la plata sigue retenida sin que nada la libere.
--   · El slot del coach sigue ocupado por una reserva que ya no puede ocurrir.
--   · El coach puede ACEPTAR una sesión cuyo horario ya pasó — la pantalla se
--     lo sigue ofreciendo.
--
-- LA CORRECCIÓN
-- Se suma el segundo criterio con un OR. La antigüedad de 24hs se queda: son
-- dos vencimientos distintos y ninguno cubre al otro (una reserva pedida para
-- dentro de dos semanas necesita el de 24hs; una pedida para hoy a la tarde
-- necesita el del horario).
--
-- 🔴 EL REEMBOLSO NO SE TOCA ACÁ, Y ESO ES A PROPÓSITO. `trg_mark_refund_on_cancel`
-- (add-refund-on-cancel-trigger.sql) es un BEFORE UPDATE OF status que ya marca
-- 'reembolso_pendiente' en cualquier camino que lleve a 'cancelada' — se creó
-- justo para que un camino nuevo no se olvide de la plata. El `case` que esta
-- función tiene en su propio update queda igual y sigue siendo el que gana; el
-- trigger es el piso, no la regla.
--
-- ⚠️ NO se pone `cancelled_by`. Se deja null a propósito, como ya hacía el
-- vencimiento de 24hs: null significa "lo canceló el sistema", y el trigger de
-- reembolso depende de eso — con `cancelled_by = 'usuario'` una cancelación
-- tardía pierde el reembolso, y esto no es culpa de la persona.
-- ============================================================

create or replace function public.expire_pending_bookings()
returns void
language plpgsql
security definer
as $$
begin
  with expired as (
    update public.bookings
    set status = 'cancelada',
        payment_status = case
          when payment_status = 'aprobado' then 'reembolso_pendiente'
          else payment_status
        end
    where status = 'pendiente'
      and (
        -- (1) El vencimiento viejo: la solicitud quedó sin respuesta 24hs.
        created_at < now() - interval '24 hours'

        -- (2) El nuevo: el horario de la sesión ya pasó.
        --
        -- 🔴 El guard del regex NO es defensivo de más. `scheduled_time` es
        -- `text` y el cast de abajo TIRA si el valor no parsea — y como esta
        -- función corre adentro de un cron cada 5 minutos, una sola fila con
        -- basura ahí abortaría la corrida entera y se llevaría puesto también
        -- el vencimiento de 24hs, que hoy no puede fallar. El OR de SQL no
        -- garantiza cortocircuito, así que el guard tiene que estar pegado al
        -- cast y no alcanzaría con el orden de las condiciones.
        --
        -- ⚠️ `{1,2}` en la hora, no `{2}`. La primera versión exigía dos dígitos
        -- y en la base hay filas con `'0:00'` — el cast las parsea perfecto, así
        -- que el guard quedaba MÁS ESTRICTO que el cast y salteaba en silencio
        -- casos válidos. Encontrado el 29/08/2026 mirando una fila real. La
        -- regla es que el guard tenga exactamente la forma que el cast acepta:
        -- ni más (saltea válidos) ni menos (aborta el cron).
        or (
          scheduled_time ~ '^[0-9]{1,2}:[0-9]{2}'
          and (
            (scheduled_date::text || ' ' || scheduled_time)::timestamp
              at time zone 'America/Argentina/Buenos_Aires'
          ) < now()
        )
      )
    returning
      id, user_id, coach_name, payment_status, scheduled_date, scheduled_time,
      -- Para poder decirle a la persona lo que realmente pasó. Se recalcula
      -- sobre la fila ya actualizada, que conserva fecha y hora.
      (
        scheduled_time ~ '^[0-9]{1,2}:[0-9]{2}'
        and (
          (scheduled_date::text || ' ' || scheduled_time)::timestamp
            at time zone 'America/Argentina/Buenos_Aires'
        ) < now()
      ) as paso_el_horario
  )
  insert into public.notifications (recipient_id, type, booking_id, title, body)
  select
    user_id,
    'reserva_rechazada',
    id,
    'Sesión no disponible',
    -- 📝 Dos motivos distintos, dos textos distintos. "No respondió a tiempo"
    -- sobre una sesión que era hoy a las 15:00 deja a la persona sin entender
    -- qué pasó con SU horario; y al revés, hablar del horario en una solicitud
    -- que venció por vieja nombra una fecha que todavía no llegó.
    case when paso_el_horario then
      coalesce(coach_name, 'Tu profesional')
        || ' no llegó a confirmar la sesión del '
        || to_char(scheduled_date, 'DD/MM')
        || ' a las ' || left(scheduled_time, 5) || '.'
    else
      coalesce(coach_name, 'Tu profesional')
        || ' no respondió a tiempo y la solicitud venció.'
    end
    || case when payment_status = 'reembolso_pendiente'
            then ' Te devolvemos el pago automáticamente.'
            else ' Buscá otro profesional.' end
  from expired;
end;
$$;

-- El cron 'expire-pending-bookings' (cada 5 min) ya está agendado y llama a
-- esta función — este script solo reemplaza el cuerpo, no re-agenda nada.
-- Consecuencia práctica: una pendiente se cancela dentro de los 5 minutos
-- posteriores a su horario, no en el minuto exacto.

-- ── Verificación ─────────────────────────────────────────────────────────────
--
-- 1) ANTES de correr — cuántas hay hoy en ese estado, y cuántas con plata
--    adentro (estas son las que hay que mirar de cerca después):
--
--    select count(*) as pendientes_vencidas,
--           count(*) filter (where payment_status = 'aprobado') as pagadas,
--           min(scheduled_date) as mas_vieja
--    from bookings
--    where status = 'pendiente'
--      and scheduled_time ~ '^[0-9]{1,2}:[0-9]{2}'
--      and ((scheduled_date::text || ' ' || scheduled_time)::timestamp
--            at time zone 'America/Argentina/Buenos_Aires') < now();
--
-- 2) El cuerpo nuevo quedó persistido (el fallo silencioso clásico de este
--    proyecto es dar por corrida una función que nunca se escribió):
--
--    select pg_get_functiondef(oid) like '%paso_el_horario%' as tiene_el_arreglo
--    from pg_proc where proname = 'expire_pending_bookings';
--
-- 3) 🔴 La que vale — correrla a mano y mirar que el conteo de (1) quede en 0:
--
--    select public.expire_pending_bookings();
--
-- 4) Que la plata haya quedado marcada, no perdida. Tiene que dar 0 filas:
--
--    select id, payment_status from bookings
--    where status = 'cancelada' and payment_status = 'aprobado'
--      and scheduled_time ~ '^[0-9]{1,2}:[0-9]{2}'
--      and ((scheduled_date::text || ' ' || scheduled_time)::timestamp
--            at time zone 'America/Argentina/Buenos_Aires') < now();
--
--    Las que tenían pago pasan a 'reembolso_pendiente' y de ahí las levanta el
--    cron de reembolsos del riel que corresponda (mp-process-refunds /
--    paypal-process-refunds). Ese paso ya existía y no se toca.
--
-- ── Para volver atrás ────────────────────────────────────────────────────────
-- Reponer el cuerpo anterior desde scripts/add-payments-v1.sql (sección 4).
-- No hay cambio de schema: esto es solo el cuerpo de una función.
