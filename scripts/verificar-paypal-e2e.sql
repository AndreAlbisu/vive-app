-- Prueba de punta a punta del riel de PayPal — SOLO LECTURA
-- ---------------------------------------------------------
-- El riel se construyó entre el 19 y el 20/08/2026 y **nunca ejecutó una sola
-- vez**. Lo verificado hasta ahora es que las funciones arrancan, que las
-- credenciales sirven y que el webhook rechaza lo que tiene que rechazar. Nada
-- de eso prueba que un pago llegue a acreditarse.
--
-- Son dos bloques: el de ARRIBA se corre ANTES de reservar (lo que hace fallar
-- el cobro con un 409 y un cartel genérico), el de ABAJO DESPUÉS de pagar.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOQUE A — ANTES de reservar
--
-- `paypal-create-payment` corta con 409 en tres condiciones, y las tres le
-- llegan al cliente como el mismo cartel ("No pudimos iniciar el pago"). Vale
-- más mirarlas acá que deducirlas del log.
-- ═══════════════════════════════════════════════════════════════════════════
select
  c.id,
  c.accepts_international                              as internacional_ok,
  c.price_usd                                          as precio_usd,
  c.instant_booking,
  -- 🔴 La que más fácil se pasa por alto: sin datos de cobro la función corta
  -- ANTES de crear la orden. Es deliberado — mejor frenar acá que cobrarle al
  -- cliente y descubrir el día de la transferencia que no hay adónde mandarla.
  exists (select 1 from coach_payout_accounts p where p.coach_id = c.id)
                                                       as tiene_datos_de_cobro,
  -- Con instant_booking = true la reserva pasa sola a 'confirmada' al
  -- acreditarse. Con false el resultado correcto es que se quede en
  -- 'pendiente' esperando al coach — no es un fallo, pero cambia qué mirar.
  (select count(*) from bookings b
    where b.coach_id = c.id and b.payment_provider = 'paypal')
                                                       as reservas_paypal_previas
from coaches c
where c.price_usd is not null;
-- Esperado: internacional_ok = true, precio_usd no nulo, tiene_datos_de_cobro = true.
-- Si tiene_datos_de_cobro = false → el cobro va a fallar con 409 y el cartel no
-- lo va a decir. Se completa desde la pantalla de cobro del coach.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOQUE B — DESPUÉS de pagar
-- ═══════════════════════════════════════════════════════════════════════════
select
  b.created_at,
  b.coach_name,
  c.instant_booking,
  b.payment_provider,
  b.amount,
  b.charged_amount,
  b.currency,
  b.payment_status,
  b.paid_at,
  b.status,
  b.platform_fee_pct,
  b.preference_id                                      as order_id,
  b.payment_id                                         as capture_id,
  b.refund_attempts,
  -- El mensaje de sistema que deja `applyPaidBookingEffects` en la sala.
  -- El techo (la reserva SIGUIENTE de la misma sala) es obligatorio: la sala es
  -- una sola por par usuario-coach y la comparten todas sus reservas, así que
  -- sin él cada fila se cuenta los mensajes de las posteriores y dos pruebas
  -- seguidas dan 2 — que se lee como "los efectos corrieron dos veces", justo
  -- la conclusión que esto existe para descartar. (Pasó el 21/08/2026.)
  (select count(*) from messages m
    where m.sala_id = b.sala_id
      and m.sender_type = 'system_confirmed'
      and m.created_at >= b.created_at
      and m.created_at < coalesce(
            (select min(b2.created_at) from bookings b2
              where b2.sala_id = b.sala_id and b2.created_at > b.created_at),
            'infinity'::timestamptz))                  as msg_confirmacion,
  (select count(*) from notifications n
    where n.booking_id = b.id
      and n.type = 'reserva_confirmada')               as notif_usuario
from bookings b
left join coaches c on c.id = b.coach_id
where b.payment_provider = 'paypal'
order by b.created_at desc
limit 5;


-- ── CÓMO LEER LA FILA DE LA RESERVA QUE ACABÁS DE PAGAR ──────────────────────
--
-- ✅ ANDA (con instant_booking = true):
--    payment_status='aprobado', status='confirmada', capture_id no nulo,
--    paid_at con hora, amount=charged_amount=30, platform_fee_pct=25,
--    msg_confirmacion=1, notif_usuario=1.
--
-- Cada forma de fallar dice algo distinto, y conviene no confundirlas:
--
-- 🔴 order_id NULO → la orden nunca se registró: el cobro falló antes de abrir
--    el checkout. Mirar el log de `paypal-create-payment` (409 = alguna de las
--    tres condiciones del bloque A; 502 = PayPal no contestó o las credenciales
--    no sirven para ese modo).
--
-- 🔴 order_id con valor y payment_status='pendiente' → la orden se creó y el
--    pago no volvió. Es el caso más informativo, y son dos escenarios que se
--    distinguen en el log de `paypal-webhook`:
--      · No llegó NINGUNA notificación → el webhook no está registrado en el
--        dashboard de PayPal, o apunta a otra URL. La plata no se capturó.
--      · Llegó y dice `verification_status: FAILURE` → PAYPAL_WEBHOOK_ID no es
--        el del webhook registrado. Se rechaza con 401 y no se captura nada.
--      · Llegó CHECKOUT.ORDER.APPROVED pero nunca PAYMENT.CAPTURE.COMPLETED →
--        falta suscribir ese evento. ⚠️ Este es el peor: la plata quedó
--        APROBADA Y CAPTURADA del lado de PayPal y la reserva no se enteró.
--
-- 🔴 payment_status='aprobado' y status='pendiente' con instant_booking=true →
--    el pago entró y los efectos no corrieron. Con instant_booking=false esto
--    NO es un fallo: ahí confirmar es decisión del coach.
--
-- 🟡 payment_status='reembolso_pendiente' → la captura cayó sobre una reserva
--    ya cancelada y el webhook encoló el reembolso (rama agregada el 24/08).
--    Es el comportamiento correcto, no un fallo: pasa si tardaste más de 30 min
--    (`expire_unpaid_checkouts`) o si saliste de la pantalla antes de pagar
--    (`soltarReserva`). El cron `paypal-process-refunds` lo devuelve en ≤5 min
--    y la fila pasa a 'reembolsado'. Si querés probar el camino feliz,
--    reservá de nuevo sin demorarte.
--
-- 🔴 msg_confirmacion=2 → los efectos corrieron dos veces. No debería poder
--    pasar en este riel: el cliente nunca los aplica con PayPal (`if (!initPoint)`).
