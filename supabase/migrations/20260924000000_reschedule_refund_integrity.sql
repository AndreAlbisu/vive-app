-- Prepared only: requires explicit approval before production deployment.
-- Preserve strict paid-booking rules while honoring professional reschedule refunds.
begin;
revoke insert, update, delete on public.reschedule_requests from public, anon, authenticated;


create or replace function public.guard_booking_security() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c public.coaches%rowtype;
  actor uuid := auth.uid();
begin
  select * into c from public.coaches where id=new.coach_id;

  if tg_op='INSERT' then
    if c.id is null or not coalesce(c.verified,false) then
      raise exception 'profesional_no_disponible' using errcode='23514';
    end if;
    if not exists(select 1 from public.salas s where s.id=new.sala_id
       and s.user_id=new.user_id and s.coach_id=c.profile_id) then
      raise exception 'sala_invalida' using errcode='23514';
    end if;
    new.requires_payment := true;
    if current_setting('role',true) = 'authenticated' then
      if new.user_id is distinct from actor then raise exception 'usuario_invalido' using errcode='42501'; end if;
      new.status := 'pendiente';
      new.amount := coalesce(c.price_per_session,c.price_usd);
      new.coach_name := coalesce((select name from public.profiles where id=c.profile_id),'Profesional');
      new.coach_specialty := coalesce(c.specialty,'');
      new.created_at := now();
    end if;
  else
    -- Also covers old pending rows that were created with requires_payment=false.
    new.requires_payment := true;
    if new.status='confirmada' and old.status <> 'confirmada'
       and new.payment_status is distinct from 'aprobado' then
      raise exception 'pago_no_acreditado' using errcode='23514';
    end if;
    if old.status in ('cancelada','completada') and new.status is distinct from old.status then
      raise exception 'reserva_finalizada' using errcode='23514';
    end if;
    if actor is not null then
      if new.status='cancelada' and old.status <> 'cancelada' then
        if actor=old.user_id then
          -- Only server-owned proposals establish professional responsibility.
          -- Never trust cancelled_by supplied by the caller.
          if old.status = 'confirmada' and exists (
            select 1 from public.reschedule_requests r
            where r.booking_id=old.id and r.pedida_por='profesional'
              and r.estado='pendiente'
          ) then new.cancelled_by := 'coach';
          else new.cancelled_by := 'usuario'; end if;
        elsif actor=c.profile_id then new.cancelled_by := 'coach';
        elsif not public.is_admin() then raise exception 'no_autorizado' using errcode='42501';
        end if;
      else
        new.cancelled_by := old.cancelled_by;
        new.cancelled_late := old.cancelled_late;
      end if;
    end if;
  end if;
  return new;
end $$;


create or replace function public.rechazar_horarios(p_booking uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.user_id is distinct from v_uid then
    raise exception 'no es tu reserva' using errcode = '42501';
  end if;
  if v_b.status <> 'confirmada' then raise exception 'no_confirmada'; end if;
  if not exists (
    select 1 from public.reschedule_requests r
    where r.booking_id = v_b.id and r.estado = 'pendiente' and r.pedida_por = 'profesional'
  ) then
    raise exception 'sin_propuestas' using errcode = 'P0001';
  end if;

  -- 🔴 `cancelled_by = 'coach'` y no 'usuario'. No es una etiqueta: es lo que
  -- hace que `mark_refund_on_cancel` devuelva la plata aunque falten menos de
  -- 24hs. Y es la verdad de lo que pasó: el que movió la sesión fue él.
  update public.bookings
     set status = 'cancelada', cancelled_by = 'coach'
   where id = v_b.id;

  -- Close proposals only after the guard has derived responsibility.
  update public.reschedule_requests
     set estado = 'rechazada', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente';

  perform public.avisar(
    (select c.profile_id from public.coaches c where c.id = v_b.coach_id),
    'cambio_resuelto', v_b.id,
    'No pudieron con ninguno de tus horarios',
    'La sesión se canceló y la devolución quedó pendiente de procesamiento.');

  return jsonb_build_object('resultado', 'cancelada');
end $$;



create or replace function public.elegir_horario(p_solicitud uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s   public.reschedule_requests%rowtype;
  v_b   public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_s from public.reschedule_requests where id = p_solicitud;
  if not found then raise exception 'solicitud_no_pendiente'; end if;
  select * into v_b from public.bookings where id = v_s.booking_id for update;
  select * into v_s from public.reschedule_requests where id = p_solicitud for update;
  if not found or v_s.estado <> 'pendiente' or v_s.pedida_por <> 'profesional' then
    raise exception 'solicitud_no_pendiente' using errcode = 'P0001';
  end if;

  if v_b.user_id is distinct from v_uid then
    raise exception 'no es tu reserva' using errcode = '42501';
  end if;

  if v_b.status <> 'confirmada' then raise exception 'no_confirmada'; end if;
  if v_b.payment_status is distinct from 'aprobado' then raise exception 'pago_no_acreditado'; end if;
  if now() >= public.inicio_de_sesion(v_b.scheduled_date, v_b.scheduled_time) then
    raise exception 'ya_empezo';
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

  -- El horario pudo ocuparse entre la propuesta y la elección: las opciones no
  -- bloquean nada, por el mismo motivo que un pedido del cliente tampoco.
  if exists (
    select 1 from public.bookings o
    where o.coach_id = v_b.coach_id and o.scheduled_date = v_s.fecha
      and left(o.scheduled_time, 5) = v_s.hora and o.status <> 'cancelada' and o.id <> v_b.id
  ) then
    update public.reschedule_requests set estado = 'vencida', resolved_at = now() where id = v_s.id;
    -- Mismo motivo que arriba: se devuelve, no se lanza, o el `update` se pierde.
    return jsonb_build_object('resultado', 'ocupado');
  end if;

  -- 📌 No se toca `movida_tarde`: esa ficha es para cuando el que no puede es el
  -- cliente. Acá el que movió fue el profesional.
  update public.bookings
     set scheduled_date = v_s.fecha, scheduled_time = v_s.hora
   where id = v_b.id;

  update public.reschedule_requests set estado = 'aceptada', resolved_at = now() where id = v_s.id;
  -- Las hermanas se retiran solas.
  update public.reschedule_requests
     set estado = 'vencida', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente';

  perform public.avisar(
    (select c.profile_id from public.coaches c where c.id = v_b.coach_id),
    'cambio_resuelto', v_b.id,
    'Eligieron horario',
    'La sesión quedó para el ' || to_char(v_s.fecha, 'DD/MM') || ' a las ' || v_s.hora || ' hs.');

  return jsonb_build_object('resultado', 'elegida', 'fecha', v_s.fecha, 'hora', v_s.hora);
end $$;


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

  select * into v_s from public.reschedule_requests where id = p_solicitud;
  if not found then raise exception 'solicitud_no_pendiente'; end if;
  select * into v_b from public.bookings where id = v_s.booking_id for update;
  select * into v_s from public.reschedule_requests where id = p_solicitud for update;
  if not found or v_s.estado <> 'pendiente' or v_s.pedida_por <> 'cliente' then
    raise exception 'solicitud_no_pendiente' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.coaches c where c.id = v_b.coach_id and c.profile_id = v_uid
  ) then
    raise exception 'no es tu sesion' using errcode = '42501';
  end if;

  if v_b.status <> 'confirmada' then raise exception 'no_confirmada'; end if;
  if v_b.payment_status is distinct from 'aprobado' then raise exception 'pago_no_acreditado'; end if;
  if now() >= public.inicio_de_sesion(v_b.scheduled_date, v_b.scheduled_time) then
    raise exception 'ya_empezo';
  end if;

  if p_acepta is null then raise exception 'respuesta_invalida'; end if;
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
