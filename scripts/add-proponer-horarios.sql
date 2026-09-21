-- add-proponer-horarios.sql — M16.
--
-- **Si el que no puede es el PROFESIONAL, propone horarios y el cliente elige.**
-- Nunca se le impone un horario nuevo. Decisión de Andre, 21/09/2026, y sale de
-- la queja más furiosa contra Selia (`competencia-selia.md` §24.3): el
-- especialista reagenda a un horario que el paciente no puede, y el paciente
-- pierde igual.
--
-- Reusa `reschedule_requests` de `add-reagendar.sql`: `pedida_por = 'profesional'`
-- y varias filas pendientes son las OPCIONES.
--
-- 🔴 **La parte de plata, que es la que hay que leer dos veces.** Si el cliente
--    no puede con ninguna opción, cancela y **se le devuelve todo, aunque falten
--    menos de 24hs**. Eso ya funciona sin tocar el trigger: `mark_refund_on_cancel`
--    solo retiene el reembolso cuando `cancelled_by = 'usuario'` Y es tardía, así
--    que la cancelación se escribe con **`cancelled_by = 'coach'`**, que es la
--    verdad de lo que pasó: el que movió fue el profesional. Sin eso, alguien que
--    pierde su horario porque el otro no puede pagaría por decir que no.
--
-- 📌 Elegir una opción **no gasta** la ficha de `movida_tarde` del cliente. Esa
--    ficha es para cuando el que no puede es él.

-- ── El profesional propone ───────────────────────────────────────────────────
create or replace function public.proponer_horarios(
  p_booking uuid,
  p_fechas  date[],
  p_horas   text[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   public.bookings%rowtype;
  v_n   int;
  i     int;
  v_h   text;
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

  return jsonb_build_object('resultado', 'propuestas', 'cuantas', v_n);
end $$;

-- ── El cliente elige una ─────────────────────────────────────────────────────
create or replace function public.elegir_horario(p_solicitud uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s   public.reschedule_requests%rowtype;
  v_b   public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_s from public.reschedule_requests where id = p_solicitud for update;
  if not found or v_s.estado <> 'pendiente' or v_s.pedida_por <> 'profesional' then
    raise exception 'solicitud_no_pendiente' using errcode = 'P0001';
  end if;

  select * into v_b from public.bookings where id = v_s.booking_id for update;
  if v_b.user_id is distinct from v_uid then
    raise exception 'no es tu reserva' using errcode = '42501';
  end if;

  -- El horario pudo ocuparse entre la propuesta y la elección: las opciones no
  -- bloquean nada, por el mismo motivo que un pedido del cliente tampoco.
  if exists (
    select 1 from public.bookings o
    where o.coach_id = v_b.coach_id and o.scheduled_date = v_s.fecha
      and left(o.scheduled_time, 5) = v_s.hora and o.status <> 'cancelada' and o.id <> v_b.id
  ) then
    update public.reschedule_requests set estado = 'vencida', resolved_at = now() where id = v_s.id;
    raise exception 'ocupado' using errcode = 'P0001';
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

  return jsonb_build_object('resultado', 'elegida', 'fecha', v_s.fecha, 'hora', v_s.hora);
end $$;

-- ── El cliente no puede con ninguna: cancela y le vuelve la plata ────────────
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
  if not exists (
    select 1 from public.reschedule_requests r
    where r.booking_id = v_b.id and r.estado = 'pendiente' and r.pedida_por = 'profesional'
  ) then
    raise exception 'sin_propuestas' using errcode = 'P0001';
  end if;

  update public.reschedule_requests
     set estado = 'rechazada', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and pedida_por = 'profesional';

  -- 🔴 `cancelled_by = 'coach'` y no 'usuario'. No es una etiqueta: es lo que
  -- hace que `mark_refund_on_cancel` devuelva la plata aunque falten menos de
  -- 24hs. Y es la verdad de lo que pasó: el que movió la sesión fue él.
  update public.bookings
     set status = 'cancelada', cancelled_by = 'coach'
   where id = v_b.id;

  return jsonb_build_object('resultado', 'cancelada');
end $$;

revoke all on function public.proponer_horarios(uuid, date[], text[]) from public, anon;
revoke all on function public.elegir_horario(uuid) from public, anon;
revoke all on function public.rechazar_horarios(uuid) from public, anon;
grant execute on function public.proponer_horarios(uuid, date[], text[]) to authenticated;
grant execute on function public.elegir_horario(uuid) to authenticated;
grant execute on function public.rechazar_horarios(uuid) to authenticated;
