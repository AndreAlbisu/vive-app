-- La reserva impaga retiene el horario demasiado tiempo
-- ------------------------------------------------------
-- 🔴 La vista de disponibilidad bloquea un turno con `status in ('confirmada',
-- 'pendiente')`, **sin mirar el pago**. Un checkout abandonado deja la reserva
-- en 'pendiente' y el horario retenido hasta que `expire_unpaid_checkouts()` la
-- cancela: 30 minutos con Mercado Pago, 60 con USDT.
--
-- Retener mientras alguien está pagando es correcto — si no, dos personas pagan
-- el mismo turno. El problema es seguir reteniéndolo cuando ya no hay nadie en
-- el checkout: ni otro usuario puede tomarlo, ni la misma persona puede
-- reintentar el que acaba de abandonar.
--
-- La retención pasa a durar mientras el pago es PLAUSIBLE, no hasta que el cron
-- limpie: 15 minutos para Mercado Pago (se paga con tarjeta ahí mismo) y 30 para
-- USDT (hay que abrir otra app y confirmar en la red). La fila sigue existiendo
-- y el cron la cancela igual a los 30/60 — lo que cambia es a partir de cuándo
-- el turno vuelve a ofrecerse.
--
-- ⚠️ EL RIESGO QUE ESTO ABRE, dicho explícito: si alguien paga DESPUÉS de que su
-- retención venció y otra persona ya tomó el turno, quedan dos reservas para el
-- mismo horario. Con el volumen actual es improbable, y el modo de falla es
-- visible (dos reservas confirmadas a la misma hora) en vez de silencioso. La
-- solución completa es que `usdt-check-payments` y `mp-webhook` verifiquen que
-- el turno siga libre antes de acreditar — queda anotado, no está hecho.

create or replace view public.coach_availability_status as
select
  c.id as coach_id,
  case
    when c.availability_status = 'en_pausa' then null
    when exists (
      select 1
      from public.coach_availability a
      where a.coach_id = c.id
        and a.date >= current_date
        and a.date < current_date + interval '7 days'
        and not exists (
          select 1
          from public.bookings b
          where b.coach_id = c.id
            and b.scheduled_date = a.date
            and lpad(split_part(b.scheduled_time::text, ':', 1), 2, '0') || ':' || split_part(b.scheduled_time::text, ':', 2)
              = lpad(split_part(a.time, ':', 1), 2, '0') || ':' || split_part(a.time, ':', 2)
            and b.status in ('confirmada', 'pendiente')
            -- Solo retiene si el pago entró, si no hay nada que cobrar, o si
            -- todavía está dentro de la ventana en que es plausible que la
            -- persona esté pagando.
            and (
              b.payment_status = 'aprobado'
              or (b.preference_id is null and b.usdt_amount is null)
              or (b.preference_id is not null and b.created_at > now() - interval '15 minutes')
              or (b.usdt_amount   is not null and b.created_at > now() - interval '30 minutes')
            )
        )
    ) then 'this_week'
    when c.availability_status = 'activo' then 'responds_24h'
    else null
  end as status
from public.coaches c;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Reservas que HOY retienen un turno sin haberlo pagado:
--   select id, status, payment_status, created_at,
--          now() - created_at as hace
--     from public.bookings
--    where status in ('confirmada','pendiente')
--      and payment_status = 'pendiente'
--      and (preference_id is not null or usdt_amount is not null);
--
-- ⚠️ Esta vista es solo el semáforo del catálogo ("tiene lugar esta semana").
-- Si la pantalla de elegir horario consulta `coach_availability` por su cuenta,
-- hay que aplicarle el mismo criterio ahí — buscar el `not exists` equivalente.
