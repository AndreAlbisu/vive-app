-- add-session-notes.sql
--
-- Notas de sesión del coach (medida anti-fuga #4: sesión pegajosa — le da al
-- usuario una razón para volver a la app entre sesiones).
--
-- Dos visibilidades por sesión: privada (solo el coach, su registro del cliente)
-- y compartida (la ve el usuario). Va en tabla aparte, NO como columna de
-- bookings, porque el RLS de Postgres es por FILA, no por columna: el usuario ya
-- puede leer su booking, así que una columna de nota privada le quedaría visible.
-- Acá el RLS filtra la nota privada por completo.

create table if not exists public.session_notes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  coach_id    uuid not null references public.profiles(id) on delete cascade,  -- autor (= coaches.profile_id / auth.uid del coach)
  user_id     uuid not null references public.profiles(id) on delete cascade,  -- el cliente (para el RLS de la compartida)
  content     text not null,
  shared      boolean not null default false,  -- false: privada (solo coach) · true: la ve el usuario
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (booking_id, shared)   -- 1 privada + 1 compartida por sesión, editables (upsert)
);

create index if not exists session_notes_booking_idx on public.session_notes (booking_id);

alter table public.session_notes enable row level security;

-- Coach (autor): gestiona TODAS sus notas (privadas y compartidas).
-- USING (lectura/update/delete de lo suyo): basta con ser el autor.
-- WITH CHECK (insert/update): además exige que el coach sea DUEÑO del booking y
-- que user_id sea el cliente real de esa reserva — si no, un coach podría escribir
-- notas sobre reservas ajenas o marcar una nota compartida para un usuario que no
-- es su cliente. Cierra ese agujero.
drop policy if exists session_notes_coach_all on public.session_notes;
create policy session_notes_coach_all on public.session_notes
  for all to authenticated
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      join public.coaches c on c.id = b.coach_id
      where b.id = session_notes.booking_id
        and c.profile_id = auth.uid()
        and b.user_id = session_notes.user_id
    )
  );

-- Usuario: SOLO lee las compartidas de sus propias sesiones. La nota privada
-- nunca entra en este filtro → el usuario no la ve ni sabe que existe.
drop policy if exists session_notes_user_read_shared on public.session_notes;
create policy session_notes_user_read_shared on public.session_notes
  for select to authenticated
  using (user_id = auth.uid() and shared = true);
