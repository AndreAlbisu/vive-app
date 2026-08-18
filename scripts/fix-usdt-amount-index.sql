-- El índice de montos USDT no liberaba el lugar de las reservas canceladas
-- ------------------------------------------------------------------------
-- 🔴 `bookings_usdt_pending_amount_uniq` reserva el monto mientras
-- `payment_status = 'pendiente'`. Pero `expire_unpaid_checkouts()` cancela por
-- el OTRO campo: pone `status = 'cancelada'` y deja `payment_status` intacto en
-- 'pendiente' (a propósito — no se pagó, así que ese sigue siendo su estado).
--
-- Resultado: la reserva cancelada seguía dentro del índice y su combinación de
-- centavos quedaba tomada para siempre. Exactamente la fuga que la expiración
-- venía a resolver, un paso más adentro. Visible en los datos de prueba del
-- 18/08: una reserva `status='cancelada'` / `payment_status='pendiente'` con su
-- monto todavía reservado.
--
-- El índice ahora excluye las canceladas. Una reserva cancelada no espera
-- ningún pago, así que su monto no identifica nada y puede reusarse.

drop index if exists bookings_usdt_pending_amount_uniq;

create unique index bookings_usdt_pending_amount_uniq
  on public.bookings (usdt_amount)
  where payment_provider = 'usdt'
    and usdt_amount is not null
    and payment_status = 'pendiente'
    and status <> 'cancelada';

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Montos realmente ocupados (esperando pago de verdad):
--   select usdt_amount, count(*) from public.bookings
--    where payment_provider='usdt' and payment_status='pendiente'
--      and status <> 'cancelada'
--    group by 1 order by 1;
--
-- Las canceladas ya no deberían contar:
--   select id, usdt_amount, status, payment_status from public.bookings
--    where payment_provider='usdt' and status='cancelada';
