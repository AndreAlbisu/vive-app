-- Reembolsos de cobros en USDT
-- -----------------------------
-- `trg_mark_refund_on_cancel` marca `payment_status = 'reembolso_pendiente'`
-- venga de donde venga el pago, y `mp-process-refunds` solo procesa los de
-- Mercado Pago (filtra por `payment_provider`). Los de USDT quedaban marcados y
-- nadie los procesaba: el usuario sin su plata y sin ningún error visible.
--
-- 🔴 POR QUÉ NO SE AUTOMATIZA EL ENVÍO. Mandar USDT desde una edge function
-- exige la clave privada de la wallet en un secret del backend, y quien acceda a
-- ese secret vacía la billetera entera — no solo el monto de un reembolso. Con
-- el volumen actual (unidades por mes) el riesgo no se justifica. El circuito es
-- asistido: se le pide la dirección al usuario, el panel de admin lista lo que
-- hay que devolver, y quien paga marca la transacción. Cuando el volumen lo
-- justifique se automatiza, y ahí se decide dónde vive esa clave.

alter table public.bookings
  add column if not exists refund_address text,
  add column if not exists refund_network text,
  add column if not exists refund_tx_id   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_refund_network_check') then
    alter table public.bookings
      add constraint bookings_refund_network_check
      check (refund_network is null or refund_network in ('TRC20', 'ERC20', 'POLYGON'));
  end if;

  -- Mismo criterio que `coach_payout_accounts`: la dirección se valida CONTRA la
  -- red. Una dirección de Ethereum es válida en sí misma, y mandarle USDT por
  -- Tron pierde los fondos para siempre. Acá el error sería peor que en el
  -- payout: le estaríamos perdiendo la plata a alguien que ya pagó y canceló.
  if not exists (select 1 from pg_constraint where conname = 'bookings_refund_address_check') then
    alter table public.bookings
      add constraint bookings_refund_address_check
      check (
        refund_address is null
        or (refund_network = 'TRC20' and refund_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
        or (refund_network in ('ERC20','POLYGON') and refund_address ~ '^0x[0-9a-fA-F]{40}$')
      );
  end if;
end $$;

comment on column public.bookings.refund_address is
  'Direccion que dio el USUARIO para recibir el reembolso. NUNCA se reusa la del pago: si pago desde un exchange, esa es una wallet caliente y el deposito no se le acredita a el.';
comment on column public.bookings.refund_tx_id is
  'Hash de la transaccion de devolucion. Su presencia es la prueba de que se pago.';

-- El usuario puede cargar SU dirección de reembolso, y solo eso, y solo en sus
-- propias reservas. `refund_tx_id` queda fuera a propósito: lo escribe el panel
-- con service role — si el usuario pudiera escribirlo, marcaría como reembolsada
-- una reserva que nadie pagó.
grant update (refund_address, refund_network) on public.bookings to authenticated;

-- Lista de trabajo del panel.
create index if not exists bookings_refund_pendiente_usdt_idx
  on public.bookings (payment_status)
  where payment_provider = 'usdt' and payment_status = 'reembolso_pendiente';

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Lo que hay que devolver hoy:
--   select id, user_id, usdt_amount, refund_address, refund_network, refund_tx_id
--     from public.bookings
--    where payment_provider = 'usdt' and payment_status = 'reembolso_pendiente';
--
-- Debe FALLAR (dirección EVM declarada como Tron):
-- begin;
--   update public.bookings
--      set refund_network = 'TRC20',
--          refund_address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
--    where id = (select id from public.bookings limit 1);
-- rollback;
