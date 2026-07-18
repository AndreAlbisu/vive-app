-- add-resource-events-stats-functions.sql
--
-- Funciones SECURITY DEFINER para que un coach lea stats agregadas de sus
-- propios coach_resources sin acceso directo a resource_events/resource_saves
-- (ninguna de las dos tiene SELECT para authenticated — mismo criterio que
-- resource_feedback / get_my_resource_feedback_summary: agregado sí,
-- fila-por-fila no). Alimentan el tab F4 "Tus recursos" (CoachResourcesScreen).

-- Contadores por recurso (▶ reproducciones / ◈ guardados), todo el histórico.
create or replace function public.get_my_resource_counts()
returns table (resource_id uuid, plays bigint, saves bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    cr.id as resource_id,
    coalesce(pe.plays, 0) as plays,
    coalesce(sv.saves, 0) as saves
  from public.coach_resources cr
  left join (
    select resource_id, count(*) as plays
    from public.resource_events
    where event = 'play'
    group by resource_id
  ) pe on pe.resource_id = cr.id
  left join (
    select resource_id, count(*) as saves
    from public.resource_saves
    group by resource_id
  ) sv on sv.resource_id = cr.id
  where cr.coach_id in (select id from public.coaches where profile_id = auth.uid());
$$;

revoke all on function public.get_my_resource_counts() from public;
revoke execute on function public.get_my_resource_counts() from anon;
grant execute on function public.get_my_resource_counts() to authenticated;

-- Card "Este mes" (reproducciones / guardados / visitas a tu perfil), mes calendario en curso.
create or replace function public.get_my_resource_stats_month()
returns table (plays bigint, saves bigint, profile_visits bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.resource_events e
       where e.event = 'play'
         and e.created_at >= date_trunc('month', now())
         and e.resource_id in (
           select id from public.coach_resources
           where coach_id in (select id from public.coaches where profile_id = auth.uid())
         )) as plays,
    (select count(*) from public.resource_saves s
       where s.created_at >= date_trunc('month', now())
         and s.resource_id in (
           select id from public.coach_resources
           where coach_id in (select id from public.coaches where profile_id = auth.uid())
         )) as saves,
    (select count(*) from public.resource_events e
       where e.event = 'coach_profile_visit'
         and e.created_at >= date_trunc('month', now())
         and e.resource_id in (
           select id from public.coach_resources
           where coach_id in (select id from public.coaches where profile_id = auth.uid())
         )) as profile_visits;
$$;

revoke all on function public.get_my_resource_stats_month() from public;
revoke execute on function public.get_my_resource_stats_month() from anon;
grant execute on function public.get_my_resource_stats_month() to authenticated;
