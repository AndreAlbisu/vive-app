-- Una postulación aún no aprobada no es un perfil público. El catálogo ya
-- filtra `verified`, pero las dos tablas podían leerse directamente por API.
-- El titular conserva acceso a su fila; admin-actions usa service_role y la
-- política coaches_select_admin preexistente sigue vigente.

drop policy if exists "Coaches are viewable by everyone" on public.coaches;
drop policy if exists "Coaches públicos para todos" on public.coaches;
drop policy if exists coaches_select_verified on public.coaches;
create policy coaches_select_verified on public.coaches
  for select to anon, authenticated
  using (verified is true);

drop policy if exists coaches_select_own_application on public.coaches;
create policy coaches_select_own_application on public.coaches
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "coach_topics_public_read" on public.coach_topics;
drop policy if exists coach_topics_select_verified on public.coach_topics;
create policy coach_topics_select_verified on public.coach_topics
  for select to anon, authenticated
  using (exists (
    select 1 from public.coaches c
     where c.id = coach_id and c.verified is true
  ));

-- Evita declarar resuelta la privacidad si otro script dejó una política
-- SELECT incondicional. Las políticas administrativas/propias son condicionales.
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename in ('coaches', 'coach_topics')
       and cmd in ('SELECT', 'ALL') and qual = 'true'
  ) then
    raise exception 'lectura_publica_incondicional_persiste';
  end if;
end;
$$;
