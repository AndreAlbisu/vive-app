-- add-next-session-suggestion.sql
--
-- M6 (docs/problemas-abiertos.md): "próxima sesión sugerida por el profesional".
-- Sale de la comparación con Selia ("Próxima sesión sugerida", "La terapia
-- funciona mejor cuando hay continuidad"). En Vita, al terminar la sesión el
-- cliente ya ve "¿Querés reservar tu próxima sesión?"; lo que faltaba es que el
-- PROFESIONAL diga cuándo le conviene, porque es quien sabe el ritmo del proceso.
-- Refuerza la medida anti-fuga n.º 1 (re-reserva en un toque).
--
-- Tabla aparte y no columna en `bookings`: el UPDATE de `bookings` se otorga por
-- rol, y el cliente también tiene una policy de UPDATE sobre su reserva. Con una
-- columna, el propio cliente podría escribirse la "sugerencia del profesional".
--
-- Fecha: 2026-09-17

begin;

create table if not exists public.next_session_suggestions (
  booking_id  uuid primary key references public.bookings(id) on delete cascade,
  cuando      text not null check (cuando in ('1_semana', '2_semanas', '3_semanas', '1_mes', 'cuando_lo_necesite')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_next_session_suggestion()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.booking_id := old.booking_id;
  return new;
end $$;

drop trigger if exists trg_touch_next_session_suggestion on public.next_session_suggestions;
create trigger trg_touch_next_session_suggestion
  before update on public.next_session_suggestions
  for each row execute function public.touch_next_session_suggestion();

alter table public.next_session_suggestions enable row level security;

-- La ven las dos partes de la sesión.
drop policy if exists nss_select_parties on public.next_session_suggestions;
create policy nss_select_parties on public.next_session_suggestions
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    join public.coaches c on c.id = b.coach_id
    where b.id = next_session_suggestions.booking_id
      and (b.user_id = auth.uid() or c.profile_id = auth.uid())
  ));

-- La escribe solo el profesional de ESA sesión, y solo si la sesión se confirmó.
drop policy if exists nss_insert_coach on public.next_session_suggestions;
create policy nss_insert_coach on public.next_session_suggestions
  for insert to authenticated
  with check (exists (
    select 1 from public.bookings b
    join public.coaches c on c.id = b.coach_id
    where b.id = next_session_suggestions.booking_id
      and c.profile_id = auth.uid()
      and b.status in ('confirmada', 'completada')
  ));

drop policy if exists nss_update_coach on public.next_session_suggestions;
create policy nss_update_coach on public.next_session_suggestions
  for update to authenticated
  using (exists (
    select 1 from public.bookings b
    join public.coaches c on c.id = b.coach_id
    where b.id = next_session_suggestions.booking_id
      and c.profile_id = auth.uid()
  ))
  with check (true);

revoke all on public.next_session_suggestions from anon, authenticated;
grant select on public.next_session_suggestions to authenticated;
grant insert (booking_id, cuando) on public.next_session_suggestions to authenticated;
grant update (cuando) on public.next_session_suggestions to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v_pol int; v_anon int; v_ins text; v_upd text;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;
  select count(*) into v_pol from pg_policy where polrelid = 'public.next_session_suggestions'::regclass;
  insert into _res values ('policies (esperado 3)', v_pol::text, v_pol = 3);
  select count(*) into v_anon from information_schema.table_privileges
   where table_schema='public' and table_name='next_session_suggestions' and grantee='anon';
  insert into _res values ('privilegios de anon (esperado 0)', v_anon::text, v_anon = 0);
  select string_agg(column_name, ',' order by column_name) into v_ins from information_schema.column_privileges
   where table_schema='public' and table_name='next_session_suggestions' and grantee='authenticated' and privilege_type='INSERT';
  insert into _res values ('columnas INSERT', v_ins, v_ins = 'booking_id,cuando');
  select string_agg(column_name, ',' order by column_name) into v_upd from information_schema.column_privileges
   where table_schema='public' and table_name='next_session_suggestions' and grantee='authenticated' and privilege_type='UPDATE';
  insert into _res values ('columnas UPDATE', v_upd, v_upd = 'cuando');
end $$;
select * from _res;
