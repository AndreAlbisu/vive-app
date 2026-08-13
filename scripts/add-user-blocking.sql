-- add-user-blocking.sql
--
-- Bloqueo de usuarios (guideline 1.2 de Apple: una app con contenido generado
-- por usuarios necesita reportes Y bloqueo; `reports` ya existe, esto es la
-- otra mitad).
--
-- Modelo: DIRECCIONAL en la tabla, SIMÉTRICO en el efecto.
-- Se guarda quién bloqueó a quién (una fila por dirección), pero cualquier
-- bloqueo en cualquier sentido corta el vínculo para los dos: no se pueden
-- mandar mensajes ni reservar entre ellos. Es a propósito — si el efecto fuera
-- unidireccional, la persona bloqueada seguiría pudiendo escribirle a quien la
-- bloqueó, que es exactamente lo que la guideline pide impedir.
--
-- Lo que el bloqueo NO hace: no borra la conversación ni el historial de
-- sesiones (son datos de los dos, y `bookings` tiene respaldo fiscal), no
-- cancela sesiones ya agendadas (eso se cancela aparte, con su reembolso), y no
-- le avisa nada a la persona bloqueada — solo ve que no puede escribir.

create table if not exists public.blocked_users (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  reason      text,           -- slug opcional, reusa REPORT_REASONS si vino junto a un reporte
  created_at  timestamptz not null default now(),
  constraint blocked_users_unique unique (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

-- La query caliente es "a quién bloqueé yo" (se corre al abrir la app).
create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_id);
-- La inversa la usa are_blocked() para el lado bloqueado.
create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- SELECT: solo mis propios bloqueos. Nadie puede consultar quién lo bloqueó —
-- si pudiera, el bloqueo se convertiría en una notificación.
drop policy if exists blocked_users_select_own on public.blocked_users;
create policy blocked_users_select_own on public.blocked_users
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists blocked_users_insert_own on public.blocked_users;
create policy blocked_users_insert_own on public.blocked_users
  for insert to authenticated
  with check (blocker_id = auth.uid());

-- DELETE = desbloquear. Solo el que bloqueó puede deshacerlo.
drop policy if exists blocked_users_delete_own on public.blocked_users;
create policy blocked_users_delete_own on public.blocked_users
  for delete to authenticated
  using (blocker_id = auth.uid());

-- Sin UPDATE a propósito: un bloqueo no se edita, se borra y se vuelve a crear.


-- ─────────────────────────────────────────────────────────────────────────────
-- are_blocked(a, b) — ¿hay bloqueo entre estos dos, en cualquier dirección?
--
-- SECURITY DEFINER porque tiene que ver las DOS direcciones y el RLS de arriba
-- solo deja ver la propia. Sin esto, el lado bloqueado consultaría la tabla,
-- no vería nada, y concluiría que puede escribir.
--
-- No filtra información: devuelve un booleano sobre un par que el que llama ya
-- conoce, y los triggers de abajo son los únicos que la usan para decidir.
create or replace function public.are_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Ver regla crítica 18 de SCHEMA.md: revocar de PUBLIC no alcanza en Supabase,
-- los grants a anon/authenticated son directos por default privileges.
revoke all on function public.are_blocked(uuid, uuid) from public;
revoke all on function public.are_blocked(uuid, uuid) from anon;
grant execute on function public.are_blocked(uuid, uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Enforcement server-side.
--
-- Se hace con TRIGGERS y no tocando las policies existentes de `messages` /
-- `bookings` a propósito: esas policies se crearon a mano en el panel de
-- Supabase y no están versionadas en ningún script, así que reescribirlas desde
-- acá es reescribir algo que no podemos leer. Un BEFORE INSERT es aditivo —
-- no puede romper lo que ya funciona — y aplica igual venga de donde venga el
-- insert (cliente, edge function con service role, SQL a mano).

create or replace function public.tg_block_messages_between_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s_user  uuid;
  s_coach uuid;
begin
  -- El par de la conversación sale de la sala, no del sender: así da igual quién
  -- de los dos escriba y no hay que resolver "el otro" acá adentro.
  select user_id, coach_id into s_user, s_coach
  from public.salas where id = new.sala_id;

  if s_user is not null and s_coach is not null
     and public.are_blocked(s_user, s_coach) then
    raise exception 'blocked: no se pueden enviar mensajes en esta conversación'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_messages_between_blocked on public.messages;
create trigger trg_block_messages_between_blocked
  before insert on public.messages
  for each row execute function public.tg_block_messages_between_blocked();


create or replace function public.tg_block_bookings_between_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_profile uuid;
begin
  -- ⚠️ bookings.coach_id es coaches.id, NO profiles.id (regla crítica 1 y 2 de
  -- SCHEMA.md). Hay que pasar por coaches.profile_id para comparar contra
  -- blocked_users, que trabaja siempre con profiles.id.
  select profile_id into coach_profile
  from public.coaches where id = new.coach_id;

  if coach_profile is not null
     and public.are_blocked(new.user_id, coach_profile) then
    raise exception 'blocked: no se puede reservar con esta persona'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_bookings_between_blocked on public.bookings;
create trigger trg_block_bookings_between_blocked
  before insert on public.bookings
  for each row execute function public.tg_block_bookings_between_blocked();


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor):
--
--   select tgname, tgrelid::regclass from pg_trigger
--   where tgname in ('trg_block_messages_between_blocked',
--                    'trg_block_bookings_between_blocked');
--   -- esperado: 2 filas (messages, bookings)
--
--   select pg_get_functiondef('public.are_blocked(uuid,uuid)'::regprocedure);
--   -- esperado: la definición, no un error de "does not exist"
--
-- Mismo criterio que la regla crítica 10 de SCHEMA.md: no dar por corrido nada
-- que no se haya confirmado con una query directa a pg_proc/pg_trigger.
