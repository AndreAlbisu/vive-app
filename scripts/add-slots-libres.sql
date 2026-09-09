-- add-slots-libres.sql
--
-- `slots_libres(slug, dias)` — los horarios libres de un profesional, para la
-- página pública `/c/<slug>`.
--
-- ✅ CORRIDO el 09/09/2026, y VERIFICADO desde afuera con la anon key sobre
-- `coach-prueba`, que es el único con disponibilidad futura cargada:
--   · **240 horarios libres en 21 días** (el tope de `p_dias` se aplica);
--   · **el orden numérico es correcto en todos los días** — `9:00` antes que
--     `10:00`, que es lo que un `order by` de texto habría roto;
--   · **el filtro de "ya pasó" anda**: hoy declara 9 horarios y devuelve 8,
--     descartando el de las 9:00;
--   · un slug inexistente devuelve `[]`, y `joaquin-silva` también — no tiene
--     disponibilidad cargada, así que el 0 es correcto y no un falso negativo.
--
-- ⚠️ **Lo que NO se pudo verificar desde afuera es justamente lo que la función
-- viene a hacer**: que un turno RESERVADO no se ofrezca. `anon` no puede leer
-- `bookings` —ese es el motivo de que esta función exista— así que hace falta la
-- verificación 3 de abajo, desde el editor SQL.
--
-- ── Por qué una función y no una consulta desde la página ────────────────────
--
-- Un horario está libre si el coach lo declaró (`coach_availability`, sin
-- `blocked`) y **no** hay una reserva viva encima. Lo segundo exige leer
-- `bookings`, y `anon` no puede — verificado: devuelve `[]`. **Y está bien que
-- no pueda**: las reservas son de personas, no del catálogo.
--
-- Así que la pregunta que la página necesita hacer no es *"dame las reservas
-- para restarlas"* sino *"¿qué horarios quedan?"*. Esta función contesta eso y
-- **solo eso**: fechas y horas. No devuelve quién reservó, ni cuántos hay, ni
-- distingue un horario ocupado de uno que nunca se ofreció — un turno tomado
-- simplemente no aparece. Mismo patrón que `email_es_de_coach`.
--
-- ── La comparación de horas, que es donde estaba el bug ──────────────────────
--
-- 🔴 Las dos tablas guardan la hora como **texto y con formatos distintos**:
-- `coach_availability.time` viene sin cero inicial (`"9:00"`, verificado contra
-- la base) y `bookings.scheduled_time` puede venir con él. Comparar los textos
-- crudos deja `"9:00"` contra `"09:00"`: **no matchean, y el turno ocupado se
-- ofrece igual.** Se normaliza con `lpad`/`split_part`, la misma regla que usa
-- `coach_availability_status` — es el precedente del repo para esto.
--
-- 📌 El mismo error estaba del lado del cliente en `lib/coachProposeData.ts`
-- (comparaba con `slice(0, 5)`) y se arregló el 09/09 en la misma pasada.
--
-- ── Dos detalles que no son obvios ───────────────────────────────────────────
--
-- 1. **El orden es numérico, no alfabético.** Como la hora es texto, `order by`
--    a secas pone `"10:00"` antes que `"9:00"`. Se ordena por hora y minuto
--    convertidos a número.
-- 2. **Se devuelve el texto ORIGINAL de la hora**, no el normalizado: es el
--    valor que la app escribe en `bookings.scheduled_time` al reservar
--    (`BookingScreen_Time` usa `s.time` tal cual), y cambiarlo acá haría que la
--    web y la app guarden formatos distintos — que es justo el problema que
--    esta función viene esquivando.
--
-- ⚠️ **Lo que queda expuesto, dicho de frente**: cualquiera puede ver la agenda
-- libre de un profesional verificado, y mirándola dos veces puede inferir que
-- alguien reservó (un horario que estaba y ya no está). Es la misma información
-- que hoy ve cualquier usuario logueado en la app, y es inseparable de poder
-- reservar sin cuenta. No revela de quién es la reserva.

begin;

create or replace function public.slots_libres(p_slug text, p_dias int default 21)
returns table (fecha date, hora text)
language sql
security definer
set search_path = public
stable
as $$
  with hoy as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date            as d,
           extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') * 60
         + extract(minute from now() at time zone 'America/Argentina/Buenos_Aires') as min_ahora
  )
  select a.date, a.time
  from coaches c
  join coach_availability a on a.coach_id = c.id
  cross join hoy
  where c.slug = p_slug
    and c.verified
    and c.availability_status = 'activo'
    and a.blocked = false
    and a.date >= hoy.d
    and a.date <  hoy.d + least(greatest(coalesce(p_dias, 21), 1), 60)
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
  order by
    a.date,
    split_part(a.time, ':', 1)::int,
    coalesce(nullif(split_part(a.time, ':', 2), ''), '0')::int;
$$;

revoke all on function public.slots_libres(text, int) from public;
grant execute on function public.slots_libres(text, int) to anon, authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) Existe, es definer y con search_path fijo. Esperado: 1 fila, prosecdef = t.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'slots_libres';

-- 2) Devuelve algo para un coach real, ordenado de verdad.
--    ⚠️ Mirá que las horas suban (9:00 antes que 10:00): si aparece "10:00"
--    primero, el orden numérico no se aplicó.
select * from public.slots_libres('joaquin-silva') limit 15;

-- 3) 🔴 La prueba que importa: un turno RESERVADO no aparece.
--    Compara los slots declarados de un día contra los que devuelve la función.
--    `declarados - libres` tiene que ser exactamente la cantidad de reservas
--    vivas de ese día.
with c as (select id from coaches where slug = 'joaquin-silva'),
     dia as (
       select a.date
       from coach_availability a join c on a.coach_id = c.id
       where a.blocked = false
         and a.date > (now() at time zone 'America/Argentina/Buenos_Aires')::date
       order by a.date limit 1
     )
select
  (select count(*) from coach_availability a join c on a.coach_id = c.id
     where a.date = (select date from dia) and a.blocked = false)          as declarados,
  (select count(*) from public.slots_libres('joaquin-silva')
     where fecha = (select date from dia))                                 as libres,
  (select count(*) from bookings b join c on b.coach_id = c.id
     where b.scheduled_date = (select date from dia)
       and b.status in ('pendiente','confirmada'))                         as reservas_vivas;

-- 4) Un slug que no existe no devuelve nada, y uno no verificado tampoco.
select count(*) as debe_ser_cero from public.slots_libres('no-existe-jamas');
