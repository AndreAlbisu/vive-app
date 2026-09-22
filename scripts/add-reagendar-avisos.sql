-- add-reagendar-avisos.sql — los avisos que le faltaban a M15 y M16.
--
-- 🔴 **Encontrado revisando lo construido el 21/09/2026, y sin esto las dos
--    features estaban a medias.** Un pedido de cambio de horario dentro de las
--    24hs solo se veía si el profesional abría la pantalla de Reservas por su
--    cuenta, y las opciones que él proponía solo si el cliente abría la Sala.
--    O sea: alguien pedía un cambio urgente y del otro lado no pasaba nada.
--    Justamente el caso donde el reloj corre.
--
-- 📌 El aviso se escribe **en la misma transacción** que el cambio de estado, y
--    por eso va acá y no en la app: si lo insertara la pantalla, un pedido
--    guardado con la app cerrándose dejaría al otro sin enterarse nunca.
--
-- 📌 Los tipos son los que ya existen en el CHECK de `notifications`. No se
--    agregan tipos nuevos: `reserva_confirmada` para lo que se movió y quedó
--    firme, `reserva_nueva` para lo que espera una respuesta. Sumar dos tipos
--    obligaría a tocar el CHECK, `mail-notificaciones` y el ícono de cada fila,
--    y el texto ya dice lo que pasó.

create or replace function public.avisar(
  p_para    uuid,
  p_tipo    text,
  p_booking uuid,
  p_titulo  text,
  p_cuerpo  text
) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, type, booking_id, title, body)
  values (p_para, p_tipo, p_booking, p_titulo, p_cuerpo);
$$;

revoke all on function public.avisar(uuid, text, uuid, text, text) from public, anon, authenticated;
