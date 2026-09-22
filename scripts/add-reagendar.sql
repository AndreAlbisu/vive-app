-- add-reagendar.sql — M15 y la mitad de M16.
--
-- Mover una sesión en vez de perderla. La regla la decidió Andre el 21/09/2026 y
-- vive también en `lib/reagendar.ts` (15 tests), que es lo que usa la pantalla
-- para saber qué ofrecer. **Acá está la única que manda.**
--
--   · Con más de 24hs: el cliente mueve a un horario libre. No pide permiso.
--   · Dentro de las 24hs: lo pide UNA vez por reserva y el profesional decide.
--
-- 🔴 **Por qué funciones y no policies.** El cliente no puede escribir
--    `scheduled_date`: `authenticated` tiene UPDATE sobre 5 columnas de
--    `bookings` y esa no está. Abrirla sería dejar que cualquiera se mude a
--    cualquier horario, ocupado o no. Estas funciones son `security definer`:
--    el permiso lo tienen ellas, no la persona.
--
-- 🔴 **Y por qué SQL y no una edge function.** Dos personas pueden pedir el
--    mismo horario en el mismo segundo. Acá el chequeo de "está libre" y el
--    movimiento pasan en la misma transacción, con la reserva lockeada: no hay
--    ventana entre mirar y escribir.
--
-- 📌 **Mover no toca la plata.** Es la misma reserva con otra fecha: ni el pago,
--    ni la comisión, ni el tramo se recalculan, y `trg_mark_refund_on_cancel` ni
--    se entera porque nadie cancela nada.
--
-- 📌 La hora guardada es hora de ARGENTINA (`scheduled_time` es text 'HH:MM').
--    Las 24hs se miden convirtiendo con esa zona, igual que `scheduledAtMs` del
--    lado del cliente. Si se midiera en UTC, alguien cancelando con 27hs de
--    anticipación caería del lado equivocado de la frontera.

-- ── La ficha de la movida de último momento ──────────────────────────────────
-- Una por RESERVA, no por persona: mover tres sesiones distintas no es abusar,
-- mover la misma tres veces sí.
alter table public.bookings
  add column if not exists movida_tarde boolean not null default false;

comment on column public.bookings.movida_tarde is
  'M15: ya usó su única oportunidad de mover esta sesión dentro de las 24hs. Se marca al PEDIRLA, no al aceptarla, y un rechazo no la devuelve. Solo la escriben las funciones de reagendado.';

-- ── Las solicitudes ──────────────────────────────────────────────────────────
-- 📌 La misma tabla sirve para los dos lados: `pedida_por = cliente` es M15
--    dentro de las 24hs, y `pedida_por = profesional` es M16 (el profesional
--    PROPONE horarios y el cliente elige, nunca se le impone uno). Por eso una
--    reserva puede tener varias filas pendientes: son opciones.
create table if not exists public.reschedule_requests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  pedida_por  text not null check (pedida_por in ('cliente', 'profesional')),
  fecha       date not null,
  hora        text not null,
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'aceptada', 'rechazada', 'vencida')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reschedule_pendientes_idx
  on public.reschedule_requests (booking_id, estado);

alter table public.reschedule_requests enable row level security;

-- Las dos partes LEEN sus solicitudes. Nadie las escribe a mano: eso es lo que
-- hacen las funciones de abajo, con el permiso de ellas y no el de la persona.
drop policy if exists reschedule_select_partes on public.reschedule_requests;
create policy reschedule_select_partes on public.reschedule_requests
  for select using (
    booking_id in (
      select b.id from public.bookings b
      where b.user_id = auth.uid()
         or b.coach_id in (select c.id from public.coaches c where c.profile_id = auth.uid())
    )
  );

grant select on public.reschedule_requests to authenticated;

-- ── Cuándo empieza una sesión, en serio ──────────────────────────────────────
create or replace function public.inicio_de_sesion(p_fecha date, p_hora text)
returns timestamptz language sql immutable as $$
  select ((p_fecha::text || ' ' || left(p_hora, 5))::timestamp
          at time zone 'America/Argentina/Cordoba');
$$;

-- ── El cliente pide mover ────────────────────────────────────────────────────
create or replace function public.pedir_reagendado(
  p_booking uuid,
  p_fecha   date,
  p_hora    text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_b       public.bookings%rowtype;
  v_inicio  timestamptz;
  v_tarde   boolean;
  v_hora    text := left(p_hora, 5);
  v_id      uuid;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  -- El lock es el punto del ejercicio: sin él, dos pedidos simultáneos sobre la
  -- misma reserva podrían gastar la misma ficha dos veces.
  select * into v_b from public.bookings where id = p_booking for update;

  if not found or v_b.user_id is distinct from v_uid then
    raise exception 'no es tu reserva' using errcode = '42501';
  end if;
  if v_b.status <> 'confirmada' then
    raise exception 'no_confirmada' using errcode = 'P0001';
  end if;

  v_inicio := public.inicio_de_sesion(v_b.scheduled_date, v_b.scheduled_time);
  if now() >= v_inicio then raise exception 'ya_empezo' using errcode = 'P0001'; end if;

  if p_fecha = v_b.scheduled_date and v_hora = left(v_b.scheduled_time, 5) then
    raise exception 'mismo_horario' using errcode = 'P0001';
  end if;
  if public.inicio_de_sesion(p_fecha, v_hora) <= now() then
    raise exception 'destino_en_el_pasado' using errcode = 'P0001';
  end if;

  -- El horario tiene que existir en la agenda del profesional y estar libre.
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

  v_tarde := now() > v_inicio - interval '24 hours';

  if not v_tarde then
    update public.bookings
       set scheduled_date = p_fecha, scheduled_time = v_hora
     where id = v_b.id;

    -- El profesional se entera aunque no haya tenido que aprobarlo: es su
    -- agenda, y enterarse al llegar sería peor que enterarse ahora.
    perform public.avisar(
      (select c.profile_id from public.coaches c where c.id = v_b.coach_id),
      'cambio_resuelto', v_b.id,
      'Movieron una sesión',
      'La sesión pasó al ' || to_char(p_fecha, 'DD/MM') || ' a las ' || v_hora || ' hs.');

    return jsonb_build_object('resultado', 'movida', 'fecha', p_fecha, 'hora', v_hora);
  end if;

  if v_b.movida_tarde then raise exception 'ya_la_movio' using errcode = 'P0001'; end if;

  -- 🔴 La ficha se gasta acá, al PEDIR, y no cuando el profesional acepta.
  -- La primera versión la gastaba al aceptar, y un test con rollback mostró el
  -- agujero: con la solicitud pendiente, el cliente podía mandar otra, y otra.
  -- "Se puede pedir una vez" tiene que contar el PEDIDO, porque lo que hay que
  -- cuidar es la atención del profesional, no la escritura de la fila. Un
  -- rechazo tampoco la devuelve: si no, alcanzaba con que le dijeran que no
  -- para volver a empezar.
  update public.bookings set movida_tarde = true where id = v_b.id;

  insert into public.reschedule_requests (booking_id, pedida_por, fecha, hora)
  values (v_b.id, 'cliente', p_fecha, v_hora)
  returning id into v_id;

  -- 🔴 Sin este aviso la solicitud solo se veía si el profesional abría Reservas
  -- por su cuenta, y es el caso donde el reloj corre: falta menos de un día.
  perform public.avisar(
    (select c.profile_id from public.coaches c where c.id = v_b.coach_id),
    'cambio_pedido', v_b.id,
    'Te piden cambiar un horario',
    'Alguien no puede a la hora que habían quedado y te propone otra. Miralo en Reservas.');

  return jsonb_build_object('resultado', 'pedida', 'id', v_id);
end $$;

-- ── El profesional responde ──────────────────────────────────────────────────
create or replace function public.responder_reagendado(
  p_solicitud uuid,
  p_acepta    boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
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

  perform public.avisar(v_b.user_id, 'cambio_resuelto', v_b.id,
    'Te aceptaron el cambio',
    'Tu sesión quedó para el ' || to_char(v_s.fecha, 'DD/MM') || ' a las ' || v_s.hora || ' hs.');

  return jsonb_build_object('resultado', 'aceptada', 'fecha', v_s.fecha, 'hora', v_s.hora);
end $$;

revoke all on function public.pedir_reagendado(uuid, date, text) from public, anon;
revoke all on function public.responder_reagendado(uuid, boolean) from public, anon;
grant execute on function public.pedir_reagendado(uuid, date, text) to authenticated;
grant execute on function public.responder_reagendado(uuid, boolean) to authenticated;
