-- add-account-deletion.sql
--
-- Soporte de base para la baja de cuenta (edge function `delete-account`),
-- exigida por Apple (guideline 5.1.1(v)) para poder publicar en iOS.
--
-- Modelo: borrado + anonimización. La fila de `profiles` NO se borra: queda como
-- LÁPIDA vaciada de datos personales, porque reservas, reseñas, mensajes y salas
-- la referencian (varias con NO ACTION, o sea que ni siquiera podría borrarse).
--
-- ⚠️ Este script cambia 3 foreign keys de tablas vivas. Está basado en el mapa
-- real de FKs de prod, consultado el 06/08/2026 contra pg_constraint.

-- ── 1. Marca de baja ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'No nulo = cuenta dada de baja por el usuario. La fila sobrevive como lápida anonimizada porque reservas, reseñas y mensajes la referencian. La cuenta de auth.users ya no existe.';

create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at) where deleted_at is not null;


-- ── 2. profiles.id ya NO cuelga de auth.users ────────────────────────────────
-- Hoy es `profiles.id → auth.users(id) ON DELETE CASCADE`: borrar la cuenta de
-- auth se lleva puesta la fila de profiles, y sin ella la lápida es imposible
-- (y además reventarían las FKs NO ACTION de reviews/messages/salas).
-- Se dropea la FK. La integridad pasa a sostenerla la app: la fila la sigue
-- creando el trigger de alta sobre auth.users, y el id sigue siendo el mismo.
do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.profiles'::regclass
    and con.confrelid = 'auth.users'::regclass
    and con.contype = 'f'
  limit 1;

  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
    raise notice 'profiles: FK a auth.users dropeada (%)', cname;
  else
    raise notice 'profiles: no había FK a auth.users (ya estaba aplicado)';
  end if;
end $$;


-- ── 3. bookings.user_id pasa a apuntar a profiles ────────────────────────────
-- Hoy es `bookings.user_id → auth.users(id) ON DELETE CASCADE`: al borrar la
-- cuenta se irían TODAS las reservas de esa persona — el respaldo fiscal de los
-- pagos y el historial del coach. Se repunta a profiles(id), que sobrevive como
-- lápida, con NO ACTION para que nadie las borre por cascada nunca más.
do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.bookings'::regclass
    and con.confrelid = 'auth.users'::regclass
    and con.contype = 'f'
  limit 1;

  if cname is not null then
    execute format('alter table public.bookings drop constraint %I', cname);
    raise notice 'bookings: FK a auth.users dropeada (%)', cname;
  end if;
end $$;

-- Idempotente: si ya existe la FK a profiles, no se agrega de nuevo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and confrelid = 'public.profiles'::regclass
      and contype = 'f'
  ) then
    alter table public.bookings
      add constraint bookings_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete no action;
    raise notice 'bookings: FK a profiles creada';
  end if;
end $$;


-- ── 4. analytics_events.user_id → SET NULL ───────────────────────────────────
-- Hoy es NO ACTION contra auth.users, así que BLOQUEA el borrado de la cuenta
-- con un error de FK. Con SET NULL la métrica se conserva y pierde la identidad,
-- que es exactamente lo que se quiere.
do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.analytics_events'::regclass
    and con.confrelid = 'auth.users'::regclass
    and con.contype = 'f'
  limit 1;

  if cname is not null then
    execute format('alter table public.analytics_events drop constraint %I', cname);
  end if;

  alter table public.analytics_events
    add constraint analytics_events_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
  raise notice 'analytics_events: FK ahora ON DELETE SET NULL';
exception when duplicate_object then
  raise notice 'analytics_events: FK ya estaba aplicada';
end $$;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- Después de correr, esto NO debe devolver ni profiles ni bookings, y
-- analytics_events debe figurar como SET NULL:
--
-- select con.conrelid::regclass::text as tabla, a.attname as columna,
--        case con.confdeltype when 'a' then 'NO ACTION' when 'c' then 'CASCADE'
--          when 'n' then 'SET NULL' end as al_borrar
-- from pg_constraint con
-- join unnest(con.conkey) with ordinality as k(attnum, ord) on true
-- join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
-- where con.contype = 'f' and con.confrelid = 'auth.users'::regclass
--   and con.conrelid::regclass::text not like 'auth.%'
-- order by tabla;
