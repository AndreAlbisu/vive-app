-- ============================================================
-- Vita — Pagos v1 (MercadoPago Marketplace / split payments)
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️ REVISAR ANTES DE CORRER. Aditivo y no destructivo (IF NOT EXISTS).
-- Fecha: 2026-07-11
--
-- Modelo decidido (ver memoria project_vive_payments):
--   - Split payments: cada coach conecta su cuenta MP (OAuth). MP reparte:
--     comisión VITA (marketplace_fee) + resto al coach.
--   - Comisión: 0% promo fundador (fin TBD) · 20% las primeras 3 sesiones
--     COMPLETADAS del par coach-usuario · 15% de la 4ta en adelante.
--     Calculada server-side en mp-create-payment (COUNT completadas del par) y
--     snapshoteada en bookings.platform_fee_pct. El cliente nunca la calcula.
--     (IVA según figura fiscal de VITA — monotributo/RI, TBD — NO vive acá.)
--   - Checkout Pro, COBRO AL RESERVAR, reembolso automático si el coach rechaza
--     o si la solicitud pendiente vence (24hs sin respuesta).
--   - Money release del coach DEMORADO hasta post-sesión (crítico en promo 0%).
--   - Pre-autorización DESCARTADA para v1.
--
-- Este script: schema. Las llamadas reales a MP viven en edge functions
-- (supabase/functions/mp-*), que leen las credenciales de Supabase secrets.
-- ============================================================

-- ── 1) bookings: estado de pago ──────────────────────────────────────────────
-- `amount` (integer) ya existe. Sumamos el ciclo de pago.
alter table public.bookings
  add column if not exists currency         text        not null default 'ARS',
  add column if not exists payment_status    text        not null default 'no_iniciado',
  add column if not exists payment_id        text,          -- MP payment.id (cuando se aprueba)
  add column if not exists preference_id     text,          -- MP Checkout Pro preference.id
  add column if not exists platform_fee_pct  numeric       not null default 20,  -- snapshot comisión (%) calculada server-side por reserva (0/20/15, ver mp-create-payment)
  add column if not exists paid_at           timestamptz,
  add column if not exists refunded_at       timestamptz;

-- Estados de payment_status:
--   no_iniciado         → reserva creada, todavía no pasó por checkout
--   pendiente           → checkout abierto / MP procesando (pending)
--   aprobado            → pago acreditado (MP approved)
--   rechazado           → MP rejected / cancelado por el usuario
--   reembolso_pendiente → hay que devolver (coach rechazó o venció) — lo procesa un edge function
--   reembolsado         → MP refunded ok
alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in
    ('no_iniciado','pendiente','aprobado','rechazado','reembolso_pendiente','reembolsado'));

-- ── 2) Cuenta MP del coach — TOKENS SECRETOS, tabla bloqueada ─────────────────
-- Los tokens del coach NUNCA tocan el cliente. Tabla con RLS habilitado y SIN
-- políticas → ni anon ni authenticated pueden leer/escribir. Solo el service role
-- (edge functions con SUPABASE_SERVICE_ROLE_KEY) bypassa RLS.
create table if not exists public.coach_mp_accounts (
  coach_id       uuid primary key references public.coaches(id) on delete cascade,
  mp_user_id     text        not null,   -- collector_id del coach en MP
  access_token   text        not null,   -- token OAuth del coach (secreto)
  refresh_token  text,
  public_key     text,
  expires_at     timestamptz,            -- vencimiento del access_token (refresh antes)
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.coach_mp_accounts enable row level security;
-- Intencional: NO se crea ninguna política. Acceso solo vía service role.

-- ── 3) Flag NO secreto para la UI (¿el coach conectó MP?) ────────────────────
-- El coach no puede recibir reservas pagas hasta conectar. Este bool lo lee el
-- cliente para mostrar el estado; el token real vive en coach_mp_accounts.
alter table public.coaches
  add column if not exists mp_connected boolean not null default false;

-- ── 4) Expiry + reembolso automático de pendientes vencidas ──────────────────
-- Extiende expire_pending_bookings (ya existía, cancela pendientes >24hs y
-- notifica). Ahora, si la reserva vencida estaba PAGADA, la marca para reembolso.
-- El refund real lo hace el edge function mp-process-refunds (SQL no puede llamar
-- a la API de MP) — ver nota de pg_net al final.
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
      and created_at < now() - interval '24 hours'
    returning id, user_id, coach_name, payment_status
  )
  insert into public.notifications (recipient_id, type, booking_id, title, body)
  select
    user_id,
    'reserva_rechazada',
    id,
    'Sesión no disponible',
    coalesce(coach_name, 'Tu coach')
      || ' no respondió a tiempo y la solicitud venció.'
      || case when payment_status = 'reembolso_pendiente'
              then ' Te devolvemos el pago automáticamente.'
              else ' Buscá otro profesional.' end
  from expired;
end;
$$;

-- El cron 'expire-pending-bookings' (cada 5 min) YA está agendado — este script
-- solo reemplaza el cuerpo de la función, no re-agenda nada.

-- ── 5) (PENDIENTE, requiere creds) procesar reembolsos vía pg_net ────────────
-- Cuando estén las edge functions + secrets, agendar el procesador de reembolsos:
--
-- select cron.schedule(
--   'mp-process-refunds',
--   '*/5 * * * *',
--   $$ select net.http_post(
--        url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/mp-process-refunds',
--        headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
--      ); $$
-- );
-- (Requiere extensión pg_net. El edge function toma los bookings en
--  'reembolso_pendiente', llama al refund de MP y los pasa a 'reembolsado'.)
