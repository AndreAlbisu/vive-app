-- Cobro en USDT (TRC20) — columnas y garantías de unicidad
-- --------------------------------------------------------
-- En una transferencia de cripto no existe una referencia externa como el
-- `external_reference` de Mercado Pago: llega plata a una dirección y hay que
-- decidir a qué reserva corresponde. Se resuelve con un MONTO ÚNICO por
-- reserva: el precio (entero, en USDT) más una fracción irrepetible entre las
-- reservas pendientes. Ver `supabase/functions/_shared/usdt.ts`.
--
-- Las dos garantías de abajo son las que impiden los dos errores caros:
-- acreditar dos reservas con la misma transferencia, y no poder distinguir
-- cuál de dos reservas pagó alguien.

alter table public.bookings
  add column if not exists usdt_amount numeric(18,6);

comment on column public.bookings.usdt_amount is
  'Monto exacto en USDT que identifica esta reserva. Los ultimos 4 decimales son el identificador; el entero es el precio.';

-- 🔴 GARANTÍA 1 — una transferencia acredita UNA sola reserva.
-- Sin esto, un reintento del cron (o dos corridas solapadas) podría marcar dos
-- reservas como pagadas con el mismo hash. La base lo impide, no el código.
create unique index if not exists bookings_usdt_payment_id_uniq
  on public.bookings (payment_id)
  where payment_provider = 'usdt' and payment_id is not null;

-- 🔴 GARANTÍA 2 — dos reservas esperando cobro nunca comparten monto.
-- Es la que hace que el monto sirva como identificador. Solo aplica mientras
-- el pago está pendiente: una vez cobrada, el monto puede repetirse sin riesgo
-- (y de hecho se va a repetir, porque los precios son pocos).
create unique index if not exists bookings_usdt_pending_amount_uniq
  on public.bookings (usdt_amount)
  where payment_provider = 'usdt'
    and usdt_amount is not null
    and payment_status = 'pendiente';

-- Índice de trabajo del cron de verificación.
create index if not exists bookings_usdt_pending_idx
  on public.bookings (payment_status)
  where payment_provider = 'usdt';


-- ── Verificación ─────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_name='bookings' and column_name='usdt_amount';
--
-- select indexname from pg_indexes
--  where tablename='bookings' and indexname like 'bookings_usdt%';
--
-- Debe FALLAR con "duplicate key" (dos pendientes con el mismo monto):
-- begin;
--   update public.bookings set payment_provider='usdt', payment_status='pendiente',
--          usdt_amount = 50.0001 where id = (select id from public.bookings limit 1);
--   update public.bookings set payment_provider='usdt', payment_status='pendiente',
--          usdt_amount = 50.0001 where id = (select id from public.bookings offset 1 limit 1);
-- rollback;
