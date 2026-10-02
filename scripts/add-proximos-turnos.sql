-- Próximo turno libre de cada profesional, de una vez (02/10/2026, pedido de
-- Andre: "ordenar primero a quien tiene horario pronto, y mostrarlo en la
-- tarjeta").
--
-- El perfil ya mostraba "Próximo turno: mañana, 18:00" con `slots_libres`, pero
-- esa función es de a un profesional (por slug). El mazo y la lista necesitan
-- el de todos juntos. Mismas reglas que `slots_libres`, para que la tarjeta y
-- el perfil digan lo mismo: profesional verificado y activo, turno no
-- bloqueado, "hoy" en hora argentina sin los turnos que ya pasaron, y sin
-- reservas `pendiente`/`confirmada` en ese horario.
--
-- Pública como `slots_libres` (el catálogo se ve sin cuenta). No expone más de
-- lo que ya expone el perfil: el primer turno libre.
--
-- `coach_availability_status` (la vista de "tiene horarios esta semana") sigue
-- para el panel del profesional.

begin;

create or replace function public.proximos_turnos(p_dias integer default 7)
returns table (coach_id uuid, fecha date, hora text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with hoy as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date            as d,
           extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') * 60
         + extract(minute from now() at time zone 'America/Argentina/Buenos_Aires') as min_ahora
  ),
  libres as (
    select a.coach_id, a.date, a.time,
           row_number() over (
             partition by a.coach_id
             order by a.date,
                      split_part(a.time, ':', 1)::int,
                      coalesce(nullif(split_part(a.time, ':', 2), ''), '0')::int
           ) as n
      from coaches c
      join coach_availability a on a.coach_id = c.id
     cross join hoy
     where c.verified
       and c.availability_status = 'activo'
       and a.blocked = false
       and a.date >= hoy.d
       and a.date <  hoy.d + least(greatest(coalesce(p_dias, 7), 1), 60)
       -- Un turno de hoy que ya pasó no es un turno libre.
       and (
         a.date > hoy.d
         or (split_part(a.time, ':', 1)::int * 60 + coalesce(nullif(split_part(a.time, ':', 2), ''), '0')::int) > hoy.min_ahora
       )
       and not exists (
         select 1
           from bookings b
          where b.coach_id = c.id
            and b.scheduled_date = a.date
            and b.status in ('pendiente', 'confirmada')
            and lpad(split_part(b.scheduled_time::text, ':', 1), 2, '0') || ':' || split_part(b.scheduled_time::text, ':', 2)
              = lpad(split_part(a.time, ':', 1), 2, '0') || ':' || split_part(a.time, ':', 2)
       )
  )
  select l.coach_id, l.date, l.time from libres l where l.n = 1;
$function$;

revoke all on function public.proximos_turnos(integer) from public;
grant execute on function public.proximos_turnos(integer) to anon, authenticated;

commit;

-- ── VERIFICACIÓN
-- Para cada profesional con turno, tiene que coincidir con el primero de
-- `slots_libres` (lo que muestra el perfil).
create temp table _res(chequeo text, resultado text);
insert into _res select 'profesionales con turno en 7 días', count(*)::text from public.proximos_turnos(7);
insert into _res select 'distintos de slots_libres (esperado 0)', count(*)::text
  from public.proximos_turnos(7) p
  join coaches c on c.id = p.coach_id
 where p.fecha::text || ' ' || p.hora is distinct from (
   select s.fecha::text || ' ' || s.hora from public.slots_libres(c.slug, 7) s limit 1);
insert into _res select 'anon puede ejecutar (esperado true)',
  has_function_privilege('anon', 'public.proximos_turnos(integer)', 'execute')::text;
select * from _res;
