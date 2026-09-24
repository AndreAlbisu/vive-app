-- Calendario del profesional por suscripción (24/09/2026, decisión de Andre).
--
-- 🔴 Antes el profesional solo podía agendar de a UNA sesión, desde el chat de
-- cada cliente, y el evento quedaba desconectado: si la sesión se movía o se
-- cancelaba, su calendario seguía mostrando el horario viejo. Ahora tiene un
-- link propio que agrega una vez a Google Calendar o al calendario del iPhone,
-- y sus sesiones aparecen y se actualizan solas (la app de calendario lo vuelve
-- a leer cada tanto).
--
-- 📌 Qué muestra el calendario: SOLO horarios. Título "Sesión · Vita", sin el
-- nombre del cliente: un calendario se sincroniza, se comparte con una
-- secretaria o con la familia, y el nombre de alguien que va a terapia no
-- tiene por qué viajar ahí. Para saber con quién es, está la app.
--
-- 📌 El link es un secreto (quien lo tiene ve los horarios de ese profesional,
-- nada más). Se guarda en una tabla que solo lee su dueño, se puede regenerar
-- (el viejo deja de funcionar) y la función que lo sirve tiene tope de lecturas.
--
-- Idempotente.

create table if not exists public.coach_calendar_feeds (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.coach_calendar_feeds enable row level security;
revoke all on public.coach_calendar_feeds from anon, authenticated;
-- Sin policies ni grants: el profesional pide su link por `mi_link_calendario()`.

create or replace function public.nuevo_token_calendario()
returns text
language sql
volatile
set search_path = public, extensions, pg_temp
as $$
  -- 32 bytes al azar en hex: 256 bits, no se adivina.
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;
revoke all on function public.nuevo_token_calendario() from public, anon, authenticated;

-- El link del profesional logueado. Lo crea la primera vez.
create or replace function public.mi_link_calendario(p_regenerar boolean default false)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach uuid;
  v_token text;
begin
  select id into v_coach from coaches where profile_id = auth.uid();
  if v_coach is null then
    raise exception 'no_es_profesional' using errcode = '42501';
  end if;

  if p_regenerar then
    insert into coach_calendar_feeds (coach_id, token) values (v_coach, nuevo_token_calendario())
    on conflict (coach_id) do update set token = excluded.token, created_at = now()
    returning token into v_token;
  else
    insert into coach_calendar_feeds (coach_id, token) values (v_coach, nuevo_token_calendario())
    on conflict (coach_id) do nothing;
    select token into v_token from coach_calendar_feeds where coach_id = v_coach;
  end if;
  return v_token;
end $$;
revoke all on function public.mi_link_calendario(boolean) from public, anon;
grant execute on function public.mi_link_calendario(boolean) to authenticated;

-- Las sesiones del dueño de un link. Solo la llama la función `calendario`
-- (service role). Ventana: 60 días atrás (para que las pasadas no desaparezcan
-- del calendario de golpe) y 120 adelante.
create or replace function public.sesiones_para_calendario(p_token text)
returns table (id uuid, inicio timestamptz, fin timestamptz, estado text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id,
         inicio_de_sesion(b.scheduled_date, b.scheduled_time),
         inicio_de_sesion(b.scheduled_date, b.scheduled_time) + make_interval(mins => coalesce(b.duration_minutes, 60)),
         b.status
  from coach_calendar_feeds f
  join bookings b on b.coach_id = f.coach_id
  where f.token = p_token
    and b.status in ('confirmada', 'completada')
    and b.scheduled_date between (current_date - 60) and (current_date + 120)
  order by 2
$$;
revoke all on function public.sesiones_para_calendario(text) from public, anon, authenticated;
grant execute on function public.sesiones_para_calendario(text) to service_role;

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
do $$
declare
  c record; t1 text; t2 text; t3 text; n int;
begin
  select co.id, co.profile_id into c from coaches co
  join bookings b on b.coach_id = co.id and b.status in ('confirmada', 'completada')
  limit 1;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', c.profile_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    t1 := mi_link_calendario();
    t2 := mi_link_calendario();
    t3 := mi_link_calendario(true);
    reset role;
    select count(*) into n from sesiones_para_calendario(t3);
    raise exception 'largo=% | estable=% | regenera=% | sesiones=% | viejo_sirve=%',
      length(t1), (t1 = t2), (t3 <> t1), n, (select count(*) from sesiones_para_calendario(t1));
  exception when others then
    reset role;
    insert into _res values ('dueño pide, repite y regenera', sqlerrm);
  end;

  -- Un cliente (no profesional) no tiene link.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',
      (select p.id from profiles p where not exists (select 1 from coaches x where x.profile_id = p.id) limit 1),
      'role', 'authenticated')::text, true);
    set local role authenticated;
    perform mi_link_calendario();
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('cliente pide link (esperado no_es_profesional)', sqlerrm);
  end;

  -- Nadie lee la tabla ni llama a la función de sesiones desde el cliente.
  begin
    set local role authenticated;
    perform count(*) from coach_calendar_feeds;
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('authenticated lee los links (esperado permission denied)', sqlerrm);
  end;
  begin
    set local role anon;
    perform count(*) from sesiones_para_calendario('x');
    reset role;
    raise exception 'ENTRÓ';
  exception when others then
    reset role;
    insert into _res values ('anon llama sesiones_para_calendario (esperado permission denied)', sqlerrm);
  end;
end $$;
insert into _res select 'links de prueba que quedaron (esperado 0)', count(*)::text from coach_calendar_feeds;
select * from _res;
