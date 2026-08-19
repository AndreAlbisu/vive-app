-- Pagos a coaches — `bookings.paid_out_at` + `payout_reference` + lectura de admin
-- ------------------------------------------------------------------------------
-- En el riel de Mercado Pago esto no hace falta: el split reparte la plata en el
-- momento del cobro y el coach ya la tiene. En el riel internacional NO — el
-- pago entra entero a la wallet de VIVE y se le transfiere al coach después,
-- semanalmente y solo por sesiones ya realizadas (decisión de la sesión 102: así
-- siempre hay con qué reembolsar).
--
-- Hoy no hay ninguna fila que diga a quién se le debe, cuánto, ni si ya se pagó.
-- Mientras no hubo una sesión internacional real no se notó; con la primera, la
-- plata queda en la billetera sin registro de la deuda. Estas dos columnas son
-- ese registro.
--
-- ⚠️ NO se agrega grant de UPDATE para `authenticated`. `harden-bookings-update.sql`
-- hace `revoke update` y otorga columna por columna; estas dos quedan fuera a
-- propósito, así que solo el service role (la edge function `admin-actions`) las
-- escribe. Marcarse a uno mismo como cobrado no puede ser una acción del cliente.

alter table public.bookings
  add column if not exists paid_out_at timestamptz;

-- Comprobante de la transferencia: hash de la tx si fue cripto, número de
-- operación si fue por banco. Texto libre porque los dos formatos conviven —
-- una transferencia bancaria no tiene hash, así que exigir 64 hex como en
-- `mark_usdt_refunded` dejaría sin poder registrar el método más común.
alter table public.bookings
  add column if not exists payout_reference text;

comment on column public.bookings.paid_out_at is
  'Cuándo se le transfiró al coach su parte de esta sesión. NULL = pendiente de pago. Solo aplica a los rieles donde cobra VIVE (payment_provider <> ''mp''): con MP el split ya le pagó.';


-- ─────────────────────────────────────────────────────────────────────────────
-- LECTURA para el panel.
--
-- 🔴 Esto además arregla algo que ya estaba roto. `add-admin-flag.sql` agregó
-- políticas de SELECT de admin sobre `reports`, `guarantee_claims`, `coaches` y
-- `profiles` — pero NO sobre `bookings`. La pestaña de Reembolsos (sesión 104)
-- consulta `bookings` con la sesión del admin, así que bajo RLS solo ve las
-- reservas propias: cualquier reembolso de USDT de otra persona le sale como
-- lista vacía, sin error. Nunca se notó porque el único reembolso probado con
-- plata real fue por Mercado Pago, que no pasa por esa pestaña.
--
-- Como todas las de admin: SELECT y nada más. Escribir sigue siendo exclusivo de
-- `admin-actions`, que revalida contra el JWT.

drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings
  for select to authenticated
  using (public.is_admin());


-- Índice parcial: es exactamente la consulta del panel de pagos.
-- `payment_provider <> 'mp'` y no `= 'usdt'` a propósito — la condición real es
-- "rieles donde la plata la retiene VIVE", y el día que se sume PayPal entra
-- solo, sin que nadie tenga que acordarse de tocar este índice.
create index if not exists bookings_payout_pending_idx
  on public.bookings (coach_id)
  where paid_out_at is null
    and status = 'completada'
    and payment_status = 'aprobado'
    and payment_provider <> 'mp';


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
--
-- 1) Las columnas existen:
--    select column_name, data_type from information_schema.columns
--     where table_name = 'bookings' and column_name in ('paid_out_at','payout_reference');
--
-- 2) La policy quedó (y no hay ninguna de UPDATE para admin):
--    select policyname, cmd from pg_policies
--     where tablename = 'bookings' and policyname like '%admin%';
--
-- 3) El cliente NO puede escribirlas — tienen que devolver 0 filas:
--    select column_name from information_schema.column_privileges
--     where table_name = 'bookings' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE' and column_name in ('paid_out_at','payout_reference');
--
-- 4) Qué hay pendiente de pagar hoy:
--    select coach_name, count(*), sum(amount) from public.bookings
--     where paid_out_at is null and status = 'completada'
--       and payment_status = 'aprobado' and payment_provider <> 'mp'
--     group by 1;
