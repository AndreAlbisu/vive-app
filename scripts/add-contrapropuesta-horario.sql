-- add-contrapropuesta-horario.sql
--
-- M16 bis (23/09/2026). Cuando el profesional no puede y propone hasta 3
-- horarios, el cliente tenía **dos salidas y las dos malas** si ninguno le
-- servía pero igual quería la sesión: tomar uno que no puede, o cancelar y que
-- le devuelvan la plata. Para seguir con ese profesional tenía que reservar
-- todo de nuevo.
--
-- Ahora hay una tercera: **contraproponer** un horario de la agenda real del
-- profesional. Observación de Andre: *"el coach al proponer un horario debería
-- poder permitir al usuario solicitarle otro, uno que tenga disponible"*.
--
-- Dos decisiones:
--
--  1. 🔴 **El profesional la ACEPTA** (decisión de Andre). No se mueve sola,
--     aunque el horario esté libre: la agenda es suya y ya dijo que ese día
--     tenía un problema. Es el mismo camino que un pedido de reagendado del
--     cliente (`reschedule_requests` con `pedida_por = 'cliente'`), así que
--     aparece donde el profesional ya mira los pedidos y se responde con
--     `responder_reagendado`, sin pantalla nueva.
--
--  2. 🔴 **NO gasta la ficha de las 24 horas** (`bookings.movida_tarde`). Esa
--     ficha existe para que el cliente no mueva una sesión a último momento una
--     y otra vez. Acá el que no puede es el profesional: cobrarle al cliente el
--     único cambio que tenía sería cobrarle un problema ajeno. Por eso esta
--     función existe aparte de `pedir_reagendado` y no como un parámetro suyo:
--     las reglas de M15 quedan intactas.
--
-- 📌 Las propuestas del profesional **siguen vivas** mientras la contrapropuesta
-- espera respuesta. Si él dice que no, el cliente todavía puede tomar una de las
-- suyas o pedir la plata. Cerrarlas antes lo dejaría sin salida.
--
-- Fecha: 2026-09-23

begin;

create or replace function public.contraproponer_horario(
  p_booking uuid,
  p_fecha   date,
  p_hora    text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_b     public.bookings%rowtype;
  v_hora  text := left(p_hora, 5);
  v_id    uuid;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.user_id is distinct from v_uid then
    raise exception 'no es tu reserva' using errcode = '42501';
  end if;
  if v_b.status <> 'confirmada' then raise exception 'no_confirmada' using errcode = 'P0001'; end if;
  if now() >= public.inicio_de_sesion(v_b.scheduled_date, v_b.scheduled_time) then
    raise exception 'ya_empezo' using errcode = 'P0001';
  end if;

  -- 🔴 Solo se contraproponer cuando hay una propuesta del profesional sobre la
  -- mesa. Sin esto sería un segundo camino para mover una sesión, en paralelo a
  -- `pedir_reagendado` y sin su regla de las 24 horas.
  if not exists (
    select 1 from public.reschedule_requests r
     where r.booking_id = v_b.id and r.estado = 'pendiente' and r.pedida_por = 'profesional'
  ) then
    raise exception 'sin_propuesta' using errcode = 'P0001';
  end if;

  if p_fecha = v_b.scheduled_date and v_hora = left(v_b.scheduled_time, 5) then
    raise exception 'mismo_horario' using errcode = 'P0001';
  end if;
  if public.inicio_de_sesion(p_fecha, v_hora) <= now() then
    raise exception 'destino_en_el_pasado' using errcode = 'P0001';
  end if;

  -- El horario tiene que existir en la agenda del profesional y estar libre.
  -- Mismas dos comprobaciones que `pedir_reagendado`: que exista y que nadie lo
  -- haya tomado. No se reserva nada todavía — el pedido no bloquea la agenda,
  -- misma decisión que en M15.
  if not exists (
    select 1 from public.coach_availability a
     where a.coach_id = v_b.coach_id and a.date = p_fecha
       and left(a.time, 5) = v_hora and coalesce(a.blocked, false) = false
  ) then
    raise exception 'sin_agenda' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings o
     where o.coach_id = v_b.coach_id and o.scheduled_date = p_fecha
       and left(o.scheduled_time, 5) = v_hora
       and o.status <> 'cancelada' and o.id <> v_b.id
  ) then
    raise exception 'ocupado' using errcode = 'P0001';
  end if;

  -- Cambiar de idea reemplaza la contrapropuesta anterior en vez de sumar una.
  -- Lo que hay que cuidar es la atención del profesional: una sola pendiente.
  update public.reschedule_requests
     set estado = 'vencida', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and pedida_por = 'cliente';

  insert into public.reschedule_requests (booking_id, pedida_por, fecha, hora)
  values (v_b.id, 'cliente', p_fecha, v_hora)
  returning id into v_id;

  perform public.avisar(
    (select c.profile_id from public.coaches c where c.id = v_b.coach_id),
    'cambio_pedido', v_b.id,
    'Te contraproponen un horario',
    'Ninguno de los horarios que ofreciste le sirve, y te propone otro de tu agenda. Miralo en Reservas.');

  return jsonb_build_object('resultado', 'pedida', 'id', v_id);
end $$;

revoke all on function public.contraproponer_horario(uuid, date, text) from public, anon;
grant execute on function public.contraproponer_horario(uuid, date, text) to authenticated;

comment on function public.contraproponer_horario(uuid, date, text) is
  'M16 bis: el cliente propone un horario libre cuando ninguno de los del profesional le sirve. Él lo acepta con responder_reagendado. No gasta la ficha de las 24hs.';

commit;

-- ── Al aceptar, se cierra lo demás que quedó pendiente ─────────────────────
begin;

CREATE OR REPLACE FUNCTION public.responder_reagendado(p_solicitud uuid, p_acepta boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_s   public.reschedule_requests%rowtype;
  v_b   public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_s from public.reschedule_requests where id = p_solicitud for update;
  if not found or v_s.estado <> 'pendiente' then
    raise exception 'solicitud_no_pendiente' using errcode = 'P0001';
  end if;

  select * into v_b from public.bookings where id = v_s.booking_id for update;
  if not exists (
    select 1 from public.coaches c where c.id = v_b.coach_id and c.profile_id = v_uid
  ) then
    raise exception 'no es tu sesion' using errcode = '42501';
  end if;

  if not p_acepta then
    update public.reschedule_requests
       set estado = 'rechazada', resolved_at = now() where id = v_s.id;

    -- ⚠️ El aviso dice qué puede hacer ahora, no solo que le dijeron que no:
    -- la sesión sigue en pie en su horario original, y eso no es obvio.
    perform public.avisar(v_b.user_id, 'cambio_resuelto', v_b.id,
      'No pudieron con ese horario',
      'Tu sesión sigue en el horario original. Si no podés ir, podés cancelarla.');

    return jsonb_build_object('resultado', 'rechazada');
  end if;

  -- ⚠️ El horario propuesto pudo quedar EN EL PASADO mientras la solicitud
  -- esperaba respuesta. Estar libre no alcanza: un horario de ayer está
  -- libertísimo. Sin esto, aceptar tarde movía la sesión a un momento que ya
  -- pasó y la dejaba inalcanzable para las dos partes.
  -- 🔴 Devuelve en vez de `raise` A PROPÓSITO, y costó un test descubrirlo:
  -- un `raise` revierte TODA la función, incluido el `update` que acaba de
  -- retirar la solicitud. O sea que marcarla vencida y después lanzar el error
  -- dejaba la solicitud viva igual, para que alguien volviera a intentar lo
  -- mismo y volviera a fallar. Entre persistir el estado y usar el canal de
  -- errores, gana persistir: el estado es lo que la otra persona ve.
  if public.inicio_de_sesion(v_s.fecha, v_s.hora) <= now() then
    update public.reschedule_requests set estado = 'vencida', resolved_at = now() where id = v_s.id;
    return jsonb_build_object('resultado', 'destino_en_el_pasado');
  end if;

  -- ⚠️ Se vuelve a mirar si el horario sigue libre. Entre el pedido y la
  -- respuesta puede haber pasado un rato, y el pedido NO bloquea el horario
  -- (decisión de Andre, 21/09): bloquear por una solicitud que puede no
  -- prosperar le regala a un tercero la posibilidad de tapar la agenda.
  if exists (
    select 1 from public.bookings o
    where o.coach_id = v_b.coach_id and o.scheduled_date = v_s.fecha
      and left(o.scheduled_time, 5) = v_s.hora
      and o.status <> 'cancelada' and o.id <> v_b.id
  ) then
    update public.reschedule_requests
       set estado = 'vencida', resolved_at = now() where id = v_s.id;
    -- Mismo motivo que arriba: se devuelve, no se lanza, o el `update` se pierde.
    return jsonb_build_object('resultado', 'ocupado');
  end if;

  -- `movida_tarde` ya quedó en true cuando se pidió, así que acá no se toca.
  update public.bookings
     set scheduled_date = v_s.fecha, scheduled_time = v_s.hora
   where id = v_b.id;

  update public.reschedule_requests
     set estado = 'aceptada', resolved_at = now() where id = v_s.id;

  -- 🔴 M16 bis (23/09/2026): al aceptar, TODO lo demás que esté pendiente sobre
  -- esta reserva deja de tener sentido. Sin esto, aceptar la contrapropuesta del
  -- cliente dejaba vivas las propuestas del propio profesional, y el cliente
  -- seguía viendo la tarjeta de "no puede a esa hora, te propone estos horarios"
  -- sobre una sesión que ya se había movido.
  update public.reschedule_requests
     set estado = 'vencida', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and id <> v_s.id;

  perform public.avisar(v_b.user_id, 'cambio_resuelto', v_b.id,
    'Te aceptaron el cambio',
    'Tu sesión quedó para el ' || to_char(v_s.fecha, 'DD/MM') || ' a las ' || v_s.hora || ' hs.');

  return jsonb_build_object('resultado', 'aceptada', 'fecha', v_s.fecha, 'hora', v_s.hora);
end $function$
;

commit;
