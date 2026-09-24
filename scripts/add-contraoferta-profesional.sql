-- "Te propongo otro": el profesional contesta un pedido de cambio del cliente
-- proponiendo otros horarios (24/09/2026, decisión de Andre).
--
-- Parte de la definición EN VIVO de `proponer_horarios` (leída con
-- pg_get_functiondef el 24/09, ninguna migración la había redefinido) y le
-- agrega una sola cosa: cerrar el pedido pendiente del cliente, que la
-- propuesta está contestando, y avisarlo en un único mensaje.
--
-- 📌 El pedido queda 'rechazada' y no 'vencida': el profesional lo contestó.
-- 📌 La ficha de las 24hs (`movida_tarde`) no se toca: ya se gastó al pedir, y
--    elegir una opción del profesional no la necesita.
-- 📌 Si el cliente no puede con ninguna opción, `rechazar_horarios` le devuelve
--    todo aunque falten menos de 24hs, igual que antes.

CREATE OR REPLACE FUNCTION public.proponer_horarios(p_booking uuid, p_fechas date[], p_horas text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_b   public.bookings%rowtype;
  v_n   int;
  i     int;
  v_h   text;
  v_contestaba int := 0;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_b from public.bookings where id = p_booking for update;
  if not found then raise exception 'no existe' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.coaches c where c.id = v_b.coach_id and c.profile_id = v_uid) then
    raise exception 'no es tu sesion' using errcode = '42501';
  end if;
  if v_b.status <> 'confirmada' then raise exception 'no_confirmada' using errcode = 'P0001'; end if;
  if now() >= public.inicio_de_sesion(v_b.scheduled_date, v_b.scheduled_time) then
    raise exception 'ya_empezo' using errcode = 'P0001';
  end if;

  v_n := coalesce(array_length(p_fechas, 1), 0);
  if v_n = 0 or v_n <> coalesce(array_length(p_horas, 1), 0) then
    raise exception 'sin_opciones' using errcode = 'P0001';
  end if;
  -- ⚠️ Tres es el techo, y no es arbitrario: más opciones no es más amable, es
  -- una lista que hay que leer. El cliente está recibiendo una mala noticia.
  if v_n > 3 then raise exception 'demasiadas_opciones' using errcode = 'P0001'; end if;

  -- Proponer de nuevo reemplaza lo anterior: si no, quedarían dos tandas de
  -- opciones vivas y el cliente podría elegir un horario ya retirado.
  update public.reschedule_requests
     set estado = 'vencida', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and pedida_por = 'profesional';

  -- 🔴 24/09/2026. Si el cliente había pedido un cambio (o contrapropuesto) y el
  -- profesional responde proponiendo otros horarios, esa propuesta ES la
  -- respuesta: el pedido se cierra acá. Antes quedaban las dos cosas abiertas, y
  -- el camino intuitivo ("No puedo" y después proponer) le mandaba al cliente
  -- "podés cancelarla" justo antes de ofrecerle horarios.
  update public.reschedule_requests
     set estado = 'rechazada', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and pedida_por = 'cliente';
  get diagnostics v_contestaba = row_count;

  for i in 1 .. v_n loop
    v_h := left(p_horas[i], 5);

    if public.inicio_de_sesion(p_fechas[i], v_h) <= now() then
      raise exception 'destino_en_el_pasado' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.bookings o
      where o.coach_id = v_b.coach_id and o.scheduled_date = p_fechas[i]
        and left(o.scheduled_time, 5) = v_h and o.status <> 'cancelada' and o.id <> v_b.id
    ) then
      raise exception 'ocupado' using errcode = 'P0001';
    end if;

    insert into public.reschedule_requests (booking_id, pedida_por, fecha, hora)
    values (v_b.id, 'profesional', p_fechas[i], v_h);
  end loop;

  perform public.avisar(v_b.user_id, 'cambio_pedido', v_b.id,
    case when v_contestaba > 0
      then 'Tu profesional no puede en el horario que pediste'
      else 'Tu profesional no puede a esa hora' end,
    'Te propuso ' || v_n || case when v_n = 1 then ' horario nuevo.' else ' horarios nuevos.' end
      || ' Si no podés con ninguno, te devolvemos lo que pagaste.');

  return jsonb_build_object('resultado', 'propuestas', 'cuantas', v_n, 'contesto_pedido', v_contestaba > 0);
end $function$;
