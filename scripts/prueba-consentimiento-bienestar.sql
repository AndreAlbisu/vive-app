-- PRUEBA de supabase/migrations/20261001010000_wellbeing_writes_require_consent.sql
-- (01/10/2026). NO APLICA NADA: termina con un error a propósito ("RESULTADOS…"),
-- y ese error revierte la migración y las filas de prueba.
--
-- Esperado:
--   CON fn=true  y mood/journal/grat/quiz/rev/rcomp = OK
--   SIN fn=false y las seis = 42501 (rechazado por la policy), y lee_* sin error
--
-- Correr: supabase db query --linked -f scripts/prueba-consentimiento-bienestar.sql

begin;

create or replace function public.tiene_consentimiento_bienestar()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    (select c.granted
       from public.user_consents_current c
      where c.user_id = auth.uid()
        and c.consent_type = 'datos_sensibles_bienestar'),
    false
  );
$$;

revoke all on function public.tiene_consentimiento_bienestar() from public, anon;
grant execute on function public.tiene_consentimiento_bienestar() to authenticated;

drop policy if exists mood_insert_own on public.mood_entries;
create policy mood_insert_own on public.mood_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists mood_update_own on public.mood_entries;
create policy mood_update_own on public.mood_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

drop policy if exists "Users can manage their journal entries" on public.journal_entries;
create policy journal_select_own on public.journal_entries
  for select to authenticated using (user_id = auth.uid());
create policy journal_delete_own on public.journal_entries
  for delete to authenticated using (user_id = auth.uid());
create policy journal_insert_own on public.journal_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
create policy journal_update_own on public.journal_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

drop policy if exists "gratitude: insert propio" on public.gratitude_entries;
create policy "gratitude: insert propio" on public.gratitude_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists "gratitude: update propio" on public.gratitude_entries;
create policy "gratitude: update propio" on public.gratitude_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

drop policy if exists quiz_insert_own on public.user_quiz_answers;
create policy quiz_insert_own on public.user_quiz_answers
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists quiz_update_own on public.user_quiz_answers;
create policy quiz_update_own on public.user_quiz_answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

drop policy if exists resource_events_insert on public.resource_events;
create policy resource_events_insert on public.resource_events
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

drop policy if exists resource_completions_insert_own on public.resource_completions;
create policy resource_completions_insert_own on public.resource_completions
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists resource_completions_update_own on public.resource_completions;
create policy resource_completions_update_own on public.resource_completions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

do $$
declare
  si uuid := '3f033627-9c69-49ba-b8fb-ce5493c00ae9';   -- cuenta de prueba CON consentimiento
  no uuid := '384a9f51-d19f-47e6-adbb-c6b64aa640f7';   -- cuenta de prueba SIN consentimiento
  rid uuid := 'f392e1da-004e-4545-9cbd-53ff94e826dd';  -- un coach_resources cualquiera
  u uuid; quien text; res text := ''; n int;
begin
  foreach u in array array[si, no] loop
    quien := case when u = si then 'CON' else 'SIN' end;
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    res := res || quien || ' fn=' || public.tiene_consentimiento_bienestar()::text || '; ';
    begin insert into public.mood_entries(user_id, mood_id, mood_label, entry_date) values (u, 3, 'Normal', '1999-01-01'); res := res || quien || ' mood=OK; ';
      exception when others then res := res || quien || ' mood=' || sqlstate || '; '; end;
    begin insert into public.journal_entries(user_id, content) values (u, 'prueba'); res := res || quien || ' journal=OK; ';
      exception when others then res := res || quien || ' journal=' || sqlstate || '; '; end;
    begin insert into public.gratitude_entries(user_id, item_1) values (u, 'prueba'); res := res || quien || ' grat=OK; ';
      exception when others then res := res || quien || ' grat=' || sqlstate || '; '; end;
    begin insert into public.user_quiz_answers(user_id, topic) values (u, 'emocion') on conflict (user_id) do update set topic = excluded.topic; res := res || quien || ' quiz=OK; ';
      exception when others then res := res || quien || ' quiz=' || sqlstate || ':' || left(sqlerrm, 60) || '; '; end;
    begin insert into public.resource_events(user_id, resource_id, event) values (u, rid, 'view'); res := res || quien || ' rev=OK; ';
      exception when others then res := res || quien || ' rev=' || sqlstate || '; '; end;
    begin insert into public.resource_completions(user_id, resource_id) values (u, 'diario'); res := res || quien || ' rcomp=OK; ';
      exception when others then res := res || quien || ' rcomp=' || sqlstate || '; '; end;
    select count(*) into n from public.mood_entries where user_id = u; res := res || quien || ' lee_mood=' || n || '; ';
    select count(*) into n from public.journal_entries where user_id = u; res := res || quien || ' lee_journal=' || n || '; ';
    execute 'reset role';
  end loop;
  raise exception 'RESULTADOS (todo se revierte): %', res;
end $$;

rollback;
