-- Expirar también los cobros en USDT abandonados
-- ----------------------------------------------
-- 🔴 `expire_unpaid_checkouts()` busca `preference_id is not null`, que es el
-- marcador de un checkout de Mercado Pago. Las reservas de USDT tienen ese campo
-- en NULL (no hay preferencia: hay una dirección y un monto), así que **nunca
-- expiraban**: quedaban en 'pendiente' para siempre.
--
-- No es solo una fila colgada. El monto de cada reserva pendiente ocupa una de
-- las 100 combinaciones de centavos que sirven para identificar los pagos, y el
-- índice `bookings_usdt_pending_amount_uniq` las reserva mientras siguen
-- pendientes. Cien checkouts abandonados agotaban el espacio y **nadie más
-- podía pagar con cripto**, sin ningún error visible que lo explicara.
--
-- La ventana de USDT es más larga que la de MP (60 min contra 30) porque el
-- flujo es distinto: en MP se paga con tarjeta dentro del checkout, en cripto
-- hay que abrir otra app, buscar el saldo y confirmar en la red.

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
    where payment_status = 'pendiente'
      -- Un cobro iniciado, por cualquiera de los dos rieles.
      and (
        (preference_id is not null and created_at < now() - interval '30 minutes')
        or
        (usdt_amount is not null and created_at < now() - interval '60 minutes')
      )
      -- Solo estados vivos. 'completada' y 'cancelada' quedan afuera a propósito:
      -- no se reescribe historia, esto previene casos nuevos.
      and status in ('pendiente', 'confirmada')
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

-- ⚠️ Cancelar libera el monto porque el índice único es PARCIAL: solo cubre las
-- filas con `payment_status = 'pendiente'`. Al cancelar, la reserva sale del
-- índice y su combinación de centavos vuelve a estar disponible.
--
-- El cron ya existe ('expire-unpaid-checkouts', cada 5 min) y llama a esta misma
-- función, así que no hay que reagendarlo.

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Candidatas ahora mismo:
--   select id, payment_provider, usdt_amount, preference_id, created_at
--     from bookings
--    where payment_status = 'pendiente'
--      and (preference_id is not null or usdt_amount is not null)
--      and status in ('pendiente','confirmada');
--
-- Cuántas combinaciones de centavos hay ocupadas por precio:
--   select floor(usdt_amount) as precio, count(*) as ocupadas
--     from bookings
--    where payment_provider = 'usdt' and payment_status = 'pendiente'
--    group by 1;
