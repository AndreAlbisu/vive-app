-- `bookings.payment_provider` — qué procesador cobró esa reserva
-- --------------------------------------------------------------
-- Hoy hay uno solo (Mercado Pago) y por eso nada lo distingue. En cuanto
-- exista un segundo rail para cobrar del exterior (PayPal, USDT), esta
-- columna deja de ser informativa y pasa a ser una guarda:
--
-- `mp-process-refunds` selecciona TODA reserva en 'reembolso_pendiente' con
-- `payment_id` no nulo, sin mirar quién cobró. La primera reserva de PayPal
-- cancelada haría que ese cron le pida a Mercado Pago reembolsar un pago que
-- no existe: falla, incrementa `refund_attempts` cinco veces, y la manda al
-- dead-letter. El usuario se queda sin su plata y sin ningún error visible
-- — el mismo modo de falla silenciosa que el webhook muerto de julio.
--
-- Default 'mp' y NOT NULL: todas las reservas existentes fueron cobradas por
-- Mercado Pago, así que el backfill es correcto por construcción y no hay
-- ventana en la que el cron vea NULL y no matchee.
--
-- ⚠️ ORDEN OBLIGATORIO: correr este script ANTES de deployar la versión de
-- `mp-process-refunds` que filtra por esta columna. Al revés, el cron
-- consulta una columna inexistente y los reembolsos dejan de procesarse.

alter table public.bookings
  add column if not exists payment_provider text not null default 'mp';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_payment_provider_check'
  ) then
    alter table public.bookings
      add constraint bookings_payment_provider_check
      check (payment_provider in ('mp', 'paypal', 'usdt'));
  end if;
end $$;

-- Índice parcial: es exactamente la consulta del cron de reembolsos.
create index if not exists bookings_refund_pending_idx
  on public.bookings (payment_provider)
  where payment_status = 'reembolso_pendiente';

-- Verificación
-- select payment_provider, count(*) from public.bookings group by 1;
