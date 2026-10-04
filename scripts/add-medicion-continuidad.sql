-- Medición de continuidad y fuga (02/10/2026, pedido de Andre).
--
-- Antes de construir más contra la fuga (paquetes, re-reservar sin volver a
-- pagar desde cero) hay que saber si pasa. La señal: una persona que tuvo
-- sesiones con un profesional, sigue abriendo Vita, no reservó con nadie más y
-- hace rato que no reserva con él. No prueba nada (pudo terminar el proceso);
-- es una lista para mirar a mano, igual que las señales de contacto.
--
-- "Sesión hecha" = `completada` y con la plata adentro: mismo criterio que
-- `coach_rebooking_stats` (sin reembolsos ni contracargos; no exige 'aprobado'
-- porque hay sesiones reales sin cobro, de profesionales sin Mercado Pago).
--
-- Solo admins (`is_admin()`), por función y no por vista: lee reservas y
-- eventos de toda la plataforma. Sin escrituras. Idempotente.

begin;

-- Una fila por persona + profesional con al menos una sesión hecha que hace
-- `dias` o más que no tiene sesión ni reserva abierta con ese profesional.
-- Quedan afuera: garantía aprobada (se fue por la vía prevista) y bloqueo
-- entre los dos (se fue por algo). El resto se muestra, con las columnas que
-- ayudan a leerlo.
create or replace function public.pares_que_dejaron_de_reservar(dias int default 30)
returns table (
  user_id uuid,
  coach_id uuid,
  profesional text,
  sesiones int,
  primera_sesion date,
  ultima_sesion date,
  dias_desde_la_ultima int,
  sugerencia_del_profesional text,  -- next_session_suggestions de la última
  sigue_usando_vita boolean,        -- algún evento suyo en los últimos 30 días
  reservo_con_otro boolean,         -- reservó con otro profesional después
  avisos_de_contacto int            -- mensaje_contacto_detectado del par
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admins' using errcode = '42501';
  end if;

  return query
  with hechas as (
    select b.id, b.user_id, b.coach_id, b.scheduled_date
      from bookings b
     where b.status = 'completada'
       and coalesce(b.payment_status, '') not in ('reembolsado', 'contracargo', 'reembolso_pendiente')
  ),
  pares as (
    select h.user_id, h.coach_id,
           count(*)::int as sesiones,
           min(h.scheduled_date) as primera,
           max(h.scheduled_date) as ultima,
           (array_agg(h.id order by h.scheduled_date desc))[1] as ultima_id
      from hechas h
     group by h.user_id, h.coach_id
  )
  select p.user_id,
         p.coach_id,
         pr.name::text,
         p.sesiones,
         p.primera,
         p.ultima,
         (current_date - p.ultima)::int,
         (select s.cuando::text from next_session_suggestions s where s.booking_id = p.ultima_id),
         exists (select 1 from analytics_events e
                  where e.user_id = p.user_id
                    and e.created_at > now() - interval '30 days'
                    and e.created_at::date > p.ultima),
         exists (select 1 from bookings o
                  where o.user_id = p.user_id and o.coach_id <> p.coach_id
                    and o.status <> 'cancelada' and o.created_at::date >= p.ultima),
         (select count(*)::int from analytics_events e
           where e.event_name = 'mensaje_contacto_detectado'
             and e.properties->>'user_id' = p.user_id::text
             and e.properties->>'coach_id' = c.profile_id::text)
    from pares p
    join coaches c on c.id = p.coach_id
    left join profiles pr on pr.id = c.profile_id
   where current_date - p.ultima >= dias
     -- Nada abierto con ese profesional (una reserva por venir no es fuga).
     and not exists (select 1 from bookings f
                      where f.user_id = p.user_id and f.coach_id = p.coach_id
                        and f.status not in ('cancelada', 'completada'))
     and not exists (select 1 from guarantee_claims g
                       join bookings gb on gb.id = g.booking_id
                      where gb.user_id = p.user_id and gb.coach_id = p.coach_id
                        and g.status = 'aprobada')
     and not public.are_blocked(p.user_id, c.profile_id)
   order by 9 desc, 4 desc, 6 desc;
end $$;

-- El resumen: de las parejas con una sesión hecha, cuántas volvieron a
-- reservar y cuántas quedaron cortadas.
create or replace function public.continuidad_resumen(dias int default 30)
returns table (
  parejas_con_sesion int,
  volvieron int,            -- 2 o más sesiones hechas, o una reserva abierta después de la primera
  porcentaje_que_volvio numeric,
  cortadas int,             -- pares_que_dejaron_de_reservar(dias)
  cortadas_y_siguen_en_vita int,
  cortadas_sin_otro_profesional int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total int; vuelta int; cort int; cort_activas int; cort_solas int;
begin
  if not public.is_admin() then
    raise exception 'solo admins' using errcode = '42501';
  end if;

  with hechas as (
    select b.user_id, b.coach_id, b.scheduled_date
      from bookings b
     where b.status = 'completada'
       and coalesce(b.payment_status, '') not in ('reembolsado', 'contracargo', 'reembolso_pendiente')
  ),
  pares as (
    select h.user_id, h.coach_id, count(*) as n, min(h.scheduled_date) as primera
      from hechas h group by 1, 2
  )
  select count(*)::int,
         count(*) filter (where p.n >= 2 or exists (
           select 1 from bookings f
            where f.user_id = p.user_id and f.coach_id = p.coach_id
              and f.status not in ('cancelada', 'completada')
              and f.created_at::date >= p.primera))::int
    into total, vuelta
    from pares p;

  select count(*)::int,
         count(*) filter (where x.sigue_usando_vita)::int,
         count(*) filter (where x.sigue_usando_vita and not x.reservo_con_otro)::int
    into cort, cort_activas, cort_solas
    from public.pares_que_dejaron_de_reservar(dias) x;

  return query select total, vuelta,
    case when total > 0 then round(100.0 * vuelta / total, 1) end,
    cort, cort_activas, cort_solas;
end $$;

revoke all on function public.pares_que_dejaron_de_reservar(int) from public, anon;
revoke all on function public.continuidad_resumen(int) from public, anon;
grant execute on function public.pares_que_dejaron_de_reservar(int) to authenticated;
grant execute on function public.continuidad_resumen(int) to authenticated;

commit;

-- ── VERIFICACIÓN
-- Desde el CLI no hay sesión de admin: se simula el JWT de un admin (y después
-- el de un no admin) solo para esta transacción, con set_config local. Las dos
-- funciones son de solo lectura.
create temp table _res(chequeo text, resultado text);
do $$
declare
  admin_id uuid;
  otro_id uuid;
  r text;
begin
  select id into admin_id from profiles where is_admin limit 1;
  select id into otro_id from profiles where not is_admin limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select row_to_json(x)::text into r from public.continuidad_resumen(30) x;
  insert into _res values ('resumen como admin', r);
  select count(*)::text into r from public.pares_que_dejaron_de_reservar(30);
  insert into _res values ('pares cortados como admin (30 días)', r);

  perform set_config('request.jwt.claims', json_build_object('sub', otro_id, 'role', 'authenticated')::text, true);
  begin
    perform * from public.continuidad_resumen(30);
    insert into _res values ('no admin (esperado rechazo)', 'PASÓ');
  exception when insufficient_privilege then
    insert into _res values ('no admin (esperado rechazo)', 'rechazado: ' || sqlerrm);
  end;
end $$;
insert into _res select 'anon sin execute (esperado false)',
  has_function_privilege('anon', 'public.continuidad_resumen(int)', 'execute')::text;
select * from _res;
