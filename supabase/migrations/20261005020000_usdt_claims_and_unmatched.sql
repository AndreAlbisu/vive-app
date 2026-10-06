-- USDT, paso 2 de la reactivación (05/10/2026).
-- No reactiva nada: el riel sigue cerrado por `USDT_LEDGER_WALLET`.

begin;

-- ── 1. Los centavos no se repiten entre cobros pendientes, sin importar el precio ──
-- Los precios en dólares son enteros y los exchanges descuentan su comisión en
-- dólares enteros: quien manda 29,63 puede hacer llegar 28,63, que es el monto
-- EXACTO de una reserva de USD 29 con los mismos centavos. Con este índice eso
-- no puede coincidir con otra reserva en espera: se detecta como "llegó de
-- menos" y va a revisión. Costo: 100 cobros en USDT pendientes a la vez en todo
-- Vita (cada uno espera como mucho 60 minutos).
create unique index if not exists bookings_usdt_pending_cents_uniq
  on public.bookings (((round(usdt_amount * 100))::int % 100))
  where payment_provider = 'usdt' and usdt_amount is not null
    and payment_status = 'pendiente' and status <> 'cancelada';

-- ── 2. Transferencias que llegaron a la billetera y no se acreditaron solas ──────
create table if not exists public.usdt_transfers (
  tx_id            text primary key check (tx_id ~ '^[0-9a-f]{64}$'),
  from_address     text not null,
  amount           numeric not null,
  block_time       timestamptz not null,
  estado           text not null default 'sin_dueno'
                     check (estado in ('sin_dueno', 'monto_menor', 'acreditada', 'descartada')),
  -- Si los centavos coinciden con una reserva en espera pero llegó de menos.
  booking_sugerida uuid references public.bookings(id) on delete set null,
  seen_at          timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  nota             text check (nota is null or char_length(nota) <= 500)
);
alter table public.usdt_transfers enable row level security;
revoke all on public.usdt_transfers from public, anon, authenticated;
grant select, insert, update on public.usdt_transfers to service_role;

-- ── 3. Comprobantes: "pagué y no se acreditó" ───────────────────────────────────
-- El cliente pega el hash de su transferencia. No se acredita solo: las
-- transferencias son públicas y alguien podría adjudicarse la de otro. Lo
-- aprueba una persona desde el panel.
create table if not exists public.usdt_claims (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  tx_id        text not null check (tx_id ~ '^[0-9a-f]{64}$'),
  -- Lo que se vio en la red al recibir el comprobante.
  amount       numeric not null,
  from_address text not null,
  block_time   timestamptz not null,
  estado       text not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobado', 'rechazado')),
  -- Qué se hizo al aprobar: acreditar la sesión o dejarla para reintegro.
  resultado    text check (resultado is null or resultado in ('acreditada', 'reintegro')),
  motivo       text check (motivo is null or char_length(motivo) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null
);
-- Una transferencia respalda un solo comprobante vivo, y una reserva tiene uno en espera.
create unique index if not exists usdt_claims_tx_vivo on public.usdt_claims (tx_id) where estado <> 'rechazado';
create unique index if not exists usdt_claims_booking_pendiente on public.usdt_claims (booking_id) where estado = 'pendiente';

alter table public.usdt_claims enable row level security;
revoke all on public.usdt_claims from public, anon, authenticated;
-- El cliente ve el estado del suyo; no el motivo interno ni quién lo resolvió.
grant select (id, booking_id, user_id, tx_id, estado, resultado, created_at, resolved_at) on public.usdt_claims to authenticated;
drop policy if exists usdt_claims_select_own on public.usdt_claims;
create policy usdt_claims_select_own on public.usdt_claims
  for select to authenticated using (user_id = auth.uid());
grant select, insert, update on public.usdt_claims to service_role;

commit;
