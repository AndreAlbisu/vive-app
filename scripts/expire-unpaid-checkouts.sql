-- ============================================================
-- Vita — Barrido de checkouts abandonados
-- Correr en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-08-09
--
-- PROBLEMA (medido el 09/08/2026, no hipotético): la reserva se crea ANTES de
-- abrir Checkout Pro, así que cerrar la pestaña de MP sin pagar deja la reserva
-- viva. Al sondear la base había 27 reservas con `preference_id` puesto y
-- `payment_status = 'pendiente'` sin `payment_id` — checkout abierto y nunca
-- completado — y **16 de ellas habían llegado a `status = 'completada'`**:
-- complete_confirmed_sessions() las marcó como sesiones cumplidas al pasar el
-- horario y el usuario recibió la invitación a reseñar. Nadie pagó ninguna.
--
-- Por qué se escapaban de expire_pending_bookings(): esa función filtra
-- `status = 'pendiente' AND created_at < now() - 24h`. Si el coach acepta la
-- solicitud antes de las 24h pasa a 'confirmada' y deja de ser candidata; y con
-- instant_booking la reserva nace 'confirmada', así que nunca la mira.
--
-- EL DISCRIMINADOR es `preference_id is not null`: significa que el checkout
-- arrancó, y por lo tanto que el coach tiene MP conectado. Eso separa el abandono
-- del caso legítimo "coach sin MP → reserva sin cobro" (ahí preference_id es
-- null), sin tener que esperar a que el pago sea obligatorio para todos.
--
-- La ventana de 30 min es holgada a propósito: MP acredita en segundos, pero
-- Checkout Pro permite reintentar con otro medio de pago dentro del mismo flujo
-- tras un rechazo. Cancelar antes mataría una reserva que se está por pagar.
-- ============================================================

-- ── 1) La función ────────────────────────────────────────────────────────────
create or replace function expire_unpaid_checkouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
begin
  for v_booking in
    select id, user_id
    from bookings
    where preference_id is not null
      and payment_status = 'pendiente'
      -- Solo estados vivos. 'completada' y 'cancelada' quedan afuera a propósito:
      -- no se reescribe historia, esto previene casos nuevos.
      and status in ('pendiente', 'confirmada')
      and created_at < now() - interval '30 minutes'
  loop
    update bookings
       set status = 'cancelada'
     where id = v_booking.id;

    insert into notifications (recipient_id, type, booking_id, title, body)
    values (
      v_booking.user_id,
      'reserva_cancelada',
      v_booking.id,
      'Reserva cancelada',
      'No se completó el pago, así que liberamos ese horario. Podés reservarlo de nuevo cuando quieras.'
    );
  end loop;
end;
$$;

-- ── 2) Agendar (cada 5 min, SQL puro — no necesita pg_net) ───────────────────
-- Idempotente: cron.schedule con el mismo nombre reemplaza el job existente.
select cron.schedule(
  'expire-unpaid-checkouts',
  '*/5 * * * *',
  $$ select expire_unpaid_checkouts(); $$
);

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Candidatos ahora mismo:
--   select id, created_at, status, payment_status from bookings
--    where preference_id is not null and payment_status = 'pendiente'
--      and status in ('pendiente','confirmada');
-- Que el job quedó:
--   select jobname, schedule, active from cron.job where jobname = 'expire-unpaid-checkouts';

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- select cron.unschedule('expire-unpaid-checkouts');
-- drop function if exists expire_unpaid_checkouts();
