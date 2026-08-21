-- Verificación del test "matar la app mientras se paga" (sesión 117).
-- Correr en: Supabase Dashboard → SQL Editor. Solo lee, no escribe nada.
--
-- Qué se está probando: que `applyPaidBookingEffects` haya corrido desde
-- `mp-webhook`, SIN ayuda del cliente. Si el pago se acreditó pero los efectos
-- no corrieron, no hay ningún error visible — la reserva simplemente se queda
-- en 'pendiente' y el coach nunca se entera.

select
  b.created_at,
  b.coach_name,
  c.instant_booking,
  b.payment_status,
  b.paid_at,
  b.status,
  -- El mensaje de sistema que deja el helper en la sala.
  --
  -- 🔴 La ventana de arriba (`>= b.created_at`) y la de abajo (< la reserva
  -- SIGUIENTE de la misma sala) son las dos necesarias. La sala es una sola por
  -- par usuario-coach y la comparten TODAS sus reservas, así que sin el techo
  -- cada fila se cuenta también los mensajes de las reservas posteriores. Con
  -- dos pruebas seguidas eso da 2 y se lee como "los efectos corrieron dos
  -- veces", que es justo la conclusión que este script existe para evitar.
  -- (Pasó en la primera corrida, el 21/08/2026.)
  (select count(*) from messages m
    where m.sala_id = b.sala_id
      and m.sender_type = 'system_confirmed'
      and m.created_at >= b.created_at
      and m.created_at < coalesce(
            (select min(b2.created_at) from bookings b2
              where b2.sala_id = b.sala_id and b2.created_at > b.created_at),
            'infinity'::timestamptz))                         as msg_confirmacion,
  -- La notificación al usuario.
  (select count(*) from notifications n
    where n.booking_id = b.id
      and n.type = 'reserva_confirmada')                      as notif_usuario
from bookings b
left join coaches c on c.id = b.coach_id
order by b.created_at desc
limit 5;

-- CÓMO LEERLO, para la fila de la reserva que acabás de pagar:
--
--   payment_status = 'aprobado'  → el webhook recibió el pago. Si esto está en
--     'pendiente', el problema es anterior y no tiene nada que ver con los
--     efectos: no llegó la notificación de MP.
--
--   Con instant_booking = true (el caso que se está probando):
--     status = 'confirmada' + msg_confirmacion = 1 + notif_usuario = 1
--       → ✅ ANDA. El servidor confirmó la reserva sin el cliente.
--     status = 'pendiente' con payment_status = 'aprobado'
--       → 🔴 FALLA. El pago entró y los efectos no corrieron.
--
--   Con instant_booking = false, el resultado correcto es OTRO:
--     status = 'pendiente', msg_confirmacion = 0, notif_usuario = 0.
--     Ahí el helper solo le avisa al coach de la solicitud; confirmar es
--     decisión suya desde CoachReservasScreen. No es un fallo.
--
--   msg_confirmacion = 2 → los efectos corrieron DOS veces (cliente + servidor).
--     Pasaría con un build viejo, de antes de la sesión 117. Ojo: antes de que
--     la subconsulta tuviera techo, un 2 acá era un artefacto de la query y no
--     un problema real — ver el comentario largo arriba.
