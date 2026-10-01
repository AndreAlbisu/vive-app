-- La base exige el consentimiento de datos sensibles para guardar dato de
-- bienestar (Claude, 01/10/2026, autorizado por Andre: "dale con la
-- migracion"; auditoría del 26/09, C2).
--
-- 🔴 Hasta hoy el consentimiento lo controlaba SOLO la app: el check-in, el
-- diario y gratitud preguntaban antes de escribir, y desde el 26/09 también el
-- quiz y el uso de recursos. Pero las policies solo miraban que la fila fuera
-- propia, así que cualquiera con su sesión podía escribir sin haber dado el
-- permiso (una versión vieja de la app, o la API directa). La Política §3
-- promete que sin consentimiento esto no se trata.
--
-- Qué cambia: INSERT y UPDATE de `authenticated` en las seis tablas exigen,
-- además de ser el dueño, que el último acto en `user_consents` sea un sí.
-- SELECT y DELETE no cambian: la persona puede ver y borrar lo suyo aunque
-- haya revocado (Política §3.3: revocar no borra; la supresión se pide aparte).
-- Las funciones con service role no pasan por RLS y no se tocan.

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

-- mood_entries
drop policy if exists mood_insert_own on public.mood_entries;
create policy mood_insert_own on public.mood_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists mood_update_own on public.mood_entries;
create policy mood_update_own on public.mood_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

-- journal_entries: era una sola policy ALL; se parte para poder dejar leer y
-- borrar sin consentimiento.
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

-- gratitude_entries
drop policy if exists "gratitude: insert propio" on public.gratitude_entries;
create policy "gratitude: insert propio" on public.gratitude_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists "gratitude: update propio" on public.gratitude_entries;
create policy "gratitude: update propio" on public.gratitude_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

-- user_quiz_answers (el upsert del quiz necesita las dos)
drop policy if exists quiz_insert_own on public.user_quiz_answers;
create policy quiz_insert_own on public.user_quiz_answers
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists quiz_update_own on public.user_quiz_answers;
create policy quiz_update_own on public.user_quiz_answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

-- resource_events
drop policy if exists resource_events_insert on public.resource_events;
create policy resource_events_insert on public.resource_events
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

-- resource_completions
drop policy if exists resource_completions_insert_own on public.resource_completions;
create policy resource_completions_insert_own on public.resource_completions
  for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());
drop policy if exists resource_completions_update_own on public.resource_completions;
create policy resource_completions_update_own on public.resource_completions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.tiene_consentimiento_bienestar());

commit;
