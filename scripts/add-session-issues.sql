-- "Tengo un problema con esta sesión" (punto 2 de docs/investigacion-producto-2026-09-23.md).
--
-- 🔴 Hasta hoy, quien no podía entrar a la llamada no tenía dónde decirlo: el
-- aviso de error solo ofrecía reintentar, la reseña exigía estrellas antes de
-- guardar, y el lado del cliente no tenía ningún acceso a soporte. Ahora
-- cualquiera de las dos partes de una reserva abre un caso atado a esa reserva,
-- el equipo recibe un mail, responde desde el panel y la respuesta le llega a
-- la persona (campana, push y mail) y queda visible en la Sala.
--
-- Decisiones de Andre (23/09/2026): plazo prometido de 24 horas hábiles, y
-- pueden reportar el cliente Y el profesional.
--
-- Qué NO se guarda: el chat, el diario ni nada del contenido de la sesión. Solo
-- el motivo, lo que la persona quiera escribir, y un contexto técnico chico
-- (plataforma, versión, estado de la sesión) que arma la app.
--
-- Idempotente: se puede correr de nuevo.

create table if not exists public.session_issues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  rol text not null check (rol in ('cliente', 'profesional')),
  motivo text not null check (motivo in ('no_puedo_entrar', 'audio_video', 'otro_no_llego', 'cobro', 'otro')),
  detalle text check (detalle is null or char_length(detalle) <= 500),
  contexto_tecnico jsonb check (contexto_tecnico is null or pg_column_size(contexto_tecnico) <= 2000),
  estado text not null default 'recibido' check (estado in ('recibido', 'en_revision', 'resuelto')),
  respuesta text check (respuesta is null or char_length(respuesta) <= 2000),
  respondido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un caso abierto por persona y reserva: si ya reportó, ve el suyo en vez de
-- abrir otro. Cerrado, puede volver a reportar.
create unique index if not exists session_issues_abierto_uidx
  on public.session_issues (booking_id, reporter_id) where estado <> 'resuelto';
create index if not exists session_issues_estado_idx
  on public.session_issues (estado, created_at);

-- ── Quién reporta y en qué rol lo decide la base, no la app ──────────────────
create or replace function public.tg_session_issue_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  -- Desde el cliente, el autor es siempre quien está logueado.
  if auth.uid() is not null then
    new.reporter_id := auth.uid();
  end if;

  select bk.user_id, c.profile_id as coach_profile_id into b
  from bookings bk left join coaches c on c.id = bk.coach_id
  where bk.id = new.booking_id;

  if b is null then
    raise exception 'reserva_invalida' using errcode = '42501';
  elsif new.reporter_id = b.user_id then
    new.rol := 'cliente';
  elsif new.reporter_id = b.coach_profile_id then
    new.rol := 'profesional';
  else
    raise exception 'no_es_parte_de_la_reserva' using errcode = '42501';
  end if;

  -- Lo que responde el equipo no lo puede escribir quien reporta.
  new.estado := 'recibido';
  new.respuesta := null;
  new.respondido_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_session_issue_before_insert on public.session_issues;
create trigger trg_session_issue_before_insert
  before insert on public.session_issues
  for each row execute function public.tg_session_issue_before_insert();

-- ── Aviso al equipo ──────────────────────────────────────────────────────────
-- Una notificación por admin; `mail-notificaciones` la manda por mail (tipo en
-- su lista blanca). Sin `booking_id`: tocarla abriría un chat del que el admin
-- no es parte. El cuerpo no lleva lo que escribió la persona: se lee en el panel.
create or replace function public.tg_session_issue_notify_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, type, title, body)
  select p.id, 'problema_sesion_nuevo',
         'Problema con una sesión',
         'Un ' || new.rol || ' reportó: ' || case new.motivo
           when 'no_puedo_entrar' then 'no puede entrar a la llamada'
           when 'audio_video' then 'problemas de audio o video'
           when 'otro_no_llego' then (case when new.rol = 'cliente' then 'el profesional no llegó' else 'la persona no se conectó' end)
           when 'cobro' then 'un problema con el cobro'
           else 'otra cosa' end
         || '. Respondé desde el panel (pestaña Sesiones), el plazo es de 24 horas hábiles.'
  from profiles p where p.is_admin;
  return new;
exception when others then
  -- Que falle el aviso no puede impedir que el caso quede registrado.
  raise warning 'tg_session_issue_notify_admins: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_session_issue_notify_admins on public.session_issues;
create trigger trg_session_issue_notify_admins
  after insert on public.session_issues
  for each row execute function public.tg_session_issue_notify_admins();

revoke all on function public.tg_session_issue_before_insert() from public, anon, authenticated;
revoke all on function public.tg_session_issue_notify_admins() from public, anon, authenticated;

-- ── Permisos ────────────────────────────────────────────────────────────────
alter table public.session_issues enable row level security;

revoke all on public.session_issues from anon, authenticated;
grant select on public.session_issues to authenticated;
grant insert (booking_id, motivo, detalle, contexto_tecnico) on public.session_issues to authenticated;
-- Sin UPDATE ni DELETE del cliente: responder y cerrar lo hace `admin-actions`.

drop policy if exists session_issues_select_own on public.session_issues;
create policy session_issues_select_own on public.session_issues
  for select to authenticated using (reporter_id = auth.uid());

drop policy if exists session_issues_select_admin on public.session_issues;
create policy session_issues_select_admin on public.session_issues
  for select to authenticated using (public.is_admin());

drop policy if exists session_issues_insert_own on public.session_issues;
create policy session_issues_insert_own on public.session_issues
  for insert to authenticated with check (reporter_id = auth.uid());

-- ── Tipos de notificación nuevos ───────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'reserva_nueva', 'reserva_confirmada', 'reserva_rechazada', 'reserva_cancelada',
  'recordatorio_sesion', 'invitacion_review', 'recurso_feedback_umbral',
  'propuesta_publicada', 'propuesta_ajustes', 'postulacion_aprobada', 'postulacion_rechazada',
  'credencial_verificada', 'credencial_rechazada', 'recurso_publicado', 'recurso_rechazado',
  'sancion_aplicada', 'sancion_levantada', 'profesional_no_disponible', 'profesional_disponible',
  'profesional_con_horarios', 'cambio_pedido', 'cambio_resuelto',
  'problema_sesion_nuevo', 'problema_sesion_respondido'
]));

-- ── VERIFICACIÓN
-- Como usuario real (rol `authenticated` + JWT simulado), todo con rollback.
create temp table _res(chequeo text, resultado text);
do $$
declare
  b record;
  extra uuid;
  n_admin int;
  paso text;
  r record;
begin
  select bk.id, bk.user_id, c.profile_id as coach_pid into b
  from bookings bk join coaches c on c.id = bk.coach_id
  order by bk.created_at desc limit 1;
  select id into extra from profiles where id not in (b.user_id, b.coach_pid) and not is_admin limit 1;

  -- 1. El cliente reporta: queda con rol cliente y estado recibido aunque mande otro.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo, detalle) values (b.id, 'no_puedo_entrar', 'prueba');
    reset role;
    select rol, estado into r from session_issues where booking_id = b.id and reporter_id = b.user_id;
    select count(*) into n_admin from notifications where type = 'problema_sesion_nuevo' and created_at > now() - interval '1 minute';
    raise exception 'ok:%:%:%', r.rol, r.estado, n_admin;
  exception when others then
    reset role;
    insert into _res values ('1 cliente reporta (esperado ok:cliente:recibido:3)', sqlerrm);
  end;

  -- 2. El profesional reporta: rol profesional.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.coach_pid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo) values (b.id, 'otro_no_llego');
    reset role;
    select rol into r from session_issues where booking_id = b.id and reporter_id = b.coach_pid;
    raise exception 'ok:%', r.rol;
  exception when others then
    reset role;
    insert into _res values ('2 profesional reporta (esperado ok:profesional)', sqlerrm);
  end;

  -- 3. Alguien ajeno a la reserva: rechazado.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', extra, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo) values (b.id, 'otro');
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('3 ajeno (esperado no_es_parte_de_la_reserva)', sqlerrm);
  end;

  -- 4. Intentar escribirse la respuesta: sin permiso de columna.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo, respuesta) values (b.id, 'otro', 'resuelto por mí');
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('4 escribir respuesta (esperado permission denied)', sqlerrm);
  end;

  -- 5. Dos casos abiertos de la misma persona en la misma reserva: rechazado.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo) values (b.id, 'otro');
    insert into session_issues (booking_id, motivo) values (b.id, 'cobro');
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('5 segundo caso abierto (esperado duplicate key)', sqlerrm);
  end;

  -- 6. Actualizar el propio caso: sin permiso.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into session_issues (booking_id, motivo) values (b.id, 'otro');
    update session_issues set estado = 'resuelto' where booking_id = b.id;
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('6 update propio (esperado permission denied)', sqlerrm);
  end;
end $$;
insert into _res select 'filas que quedaron (esperado 0)', count(*)::text from session_issues;
insert into _res select 'avisos de prueba que quedaron (esperado 0)', count(*)::text
  from notifications where type = 'problema_sesion_nuevo';
insert into _res select 'privilegios de anon (esperado 0)', count(*)::text
  from information_schema.role_table_grants where table_name = 'session_issues' and grantee = 'anon';
select * from _res;
