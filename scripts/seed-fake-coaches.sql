-- seed-fake-coaches.sql
--
-- 24 coaches + 8 usuarios falsos para poder VER funcionar el deck v3. Con los 6
-- coaches reales repartidos en 10 puertas no se llena ningún slot de mérito, la
-- rotación por persona/día no se nota, y el relleno tapa todo.
--
-- ⚠️ ESTO ESCRIBE EN PRODUCCIÓN. No hay staging. Los coaches falsos son
--    reservables por cualquiera que entre a la app. Correr `unseed-fake-coaches.sql`
--    antes de que haya usuarios reales.
--
-- Marca de borrado: TODO lo que crea este script tiene email `@seed.vive.local`.
-- El unseed cuelga de ahí. No cambiar el dominio sin cambiar los dos.
--
-- No toca `auth.users`: `profiles.id` ya no tiene FK contra auth (dropeada el
-- 06/08/2026, ver SCHEMA.md "Baja de cuenta"). Estas cuentas no pueden loguearse,
-- que es exactamente lo que queremos — son catálogo, no usuarios.
--
-- Correr en el SQL editor de Supabase (rol postgres ⇒ sin RLS).
-- Fecha: 2026-08-07

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Guarda: no sembrar dos veces.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.profiles where email like '%@seed.vive.local') then
    raise exception 'Ya hay datos sembrados. Corré unseed-fake-coaches.sql primero.';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Perfiles de los 24 coaches.
--    `created_at` escalonado a propósito: los primeros 6 quedan dentro de los 28
--    días para que el slot "Nuevo en Vita" tenga con qué llenarse; el resto no.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.profiles (id, email, name, role, nationality, gender, accepted_terms, created_at)
select
  gen_random_uuid(),
  format('seed.coach.%s@seed.vive.local', lpad(i::text, 2, '0')),
  n.name,
  'coach',
  case when i % 3 = 0 then 'Uruguay' when i % 3 = 1 then 'Argentina' else 'Chile' end,
  case when i % 2 = 0 then 'femenino' else 'masculino' end,
  true,
  now() - make_interval(days => case when i <= 6 then 3 + i * 3 else 40 + i * 11 end)
from (values
  (1,'Valentina Ríos'),(2,'Tomás Aguirre'),(3,'Camila Peralta'),(4,'Ignacio Vera'),
  (5,'Julieta Sosa'),(6,'Bruno Cabrera'),(7,'Malena Ortiz'),(8,'Facundo Lemos'),
  (9,'Rocío Ibáñez'),(10,'Damián Costa'),(11,'Agustina Ferrer'),(12,'Nicolás Bravo'),
  (13,'Paula Miranda'),(14,'Emiliano Duarte'),(15,'Carla Benítez'),(16,'Santiago Roldán'),
  (17,'Florencia Acosta'),(18,'Manuel Escobar'),(19,'Delfina Márquez'),(20,'Joaquín Silva'),
  (21,'Micaela Paz'),(22,'Lautaro Godoy'),(23,'Renata Quiroga'),(24,'Andrés Maldonado')
) as n(i, name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Perfiles de los 8 usuarios (solo existen para poder tener reservas y reseñas).
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.profiles (id, email, name, role, accepted_terms, created_at)
select
  gen_random_uuid(),
  format('seed.user.%s@seed.vive.local', lpad(i::text, 2, '0')),
  format('Usuario Seed %s', i),
  'user',
  true,
  now() - make_interval(days => 90)
from generate_series(1, 8) as i;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Filas de `coaches`.
--    Precio escalonado 3.400→12.600 para que la mediana de cada puerta parta el
--    grupo en dos y "Opción económica" tenga un pool de verdad, no un ganador.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.coaches (
  id, profile_id, specialty, bio, price_per_session, nationality,
  verified, availability_status, instant_booking, created_at
)
select
  gen_random_uuid(),
  p.id,
  (array['Coach de vida','Psicóloga clínica','Coach ontológico','Nutricionista',
         'Coach de bienestar','Terapeuta cognitivo'])[1 + (i % 6)],
  format('Trabajo hace años acompañando procesos de cambio. Sesiones de 60 minutos, con seguimiento entre encuentros. (Perfil de prueba #%s)', i),
  3000 + i * 400,
  p.nationality,
  true,
  'activo',
  (i % 4 = 0),
  p.created_at
from public.profiles p
cross join lateral (select (regexp_replace(p.email, '\D', '', 'g'))::int as i) x
where p.email like 'seed.coach.%@seed.vive.local';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Temas. Cada puerta recibe 6 coaches, ciclando por sus subtemas.
--    Los strings tienen que coincidir EXACTO con AXES / DOORS del frontend
--    (la base no valida — ver SCHEMA.md, sección coach_topics).
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.coach_topics (coach_id, topic)
select c.id, t.topic
from (values
  -- Ansiedad y estrés
  (1,'Ansiedad'),(2,'Ansiedad social'),(3,'Estrés físico'),(4,'Ansiedad'),(5,'Ansiedad social'),(6,'Estrés físico'),
  -- Estado de ánimo
  (3,'Tristeza'),(4,'Enojo'),(5,'Culpa'),(6,'Vergüenza'),(7,'Alegría'),(8,'Autoestima'),
  -- Relaciones
  (5,'Pareja'),(6,'Familia'),(7,'Amistades'),(8,'Vínculos laborales'),(9,'Pareja'),(10,'Familia'),
  -- Foco, hábitos y trabajo
  (7,'Concentración'),(8,'Procrastinación'),(9,'Productividad'),(10,'Hábitos mentales'),(11,'Burnout (estrés laboral)'),(12,'Hábitos'),
  -- Descanso y energía
  (9,'Sueño'),(10,'Energía'),(11,'Sueño'),(12,'Energía'),(13,'Sueño'),(14,'Energía'),
  -- Nutrición y movimiento
  (11,'Nutrición'),(12,'Actividad física'),(13,'Nutrición'),(14,'Actividad física'),(15,'Nutrición'),(16,'Actividad física'),
  -- Sexualidad e intimidad (un solo subtema: hay que asignarlo explícitamente)
  (13,'Sexualidad'),(14,'Sexualidad'),(15,'Sexualidad'),(16,'Sexualidad'),(17,'Sexualidad'),(18,'Sexualidad'),
  -- Propósito y dirección
  (15,'Propósito'),(16,'Momentos de cambio'),(17,'Propósito'),(18,'Momentos de cambio'),(19,'Propósito'),(20,'Momentos de cambio'),
  -- Identidad y motivación
  (17,'Identidad'),(18,'Motivación'),(19,'Crecimiento'),(20,'Identidad'),(21,'Motivación'),(22,'Crecimiento'),
  -- Espiritualidad y soledad
  (19,'Espiritualidad'),(20,'Soledad'),(21,'Espiritualidad'),(22,'Soledad'),(23,'Espiritualidad'),(24,'Soledad')
) as t(idx, topic)
join public.profiles p on p.email = format('seed.coach.%s@seed.vive.local', lpad(t.idx::text, 2, '0'))
join public.coaches  c on c.profile_id = p.id
on conflict (coach_id, topic) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Disponibilidad. Los de índice impar reciben huecos en los próximos 7 días
--    ⇒ la vista los marca 'this_week'; los pares caen a 'responds_24h'. Así el
--    chip "Con lugar esta semana" tiene con qué llenarse y el otro también.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.coach_availability (coach_id, date, time, blocked)
select c.id, (current_date + d)::date, h.t, false
from public.profiles p
join public.coaches c on c.profile_id = p.id
cross join lateral (select (regexp_replace(p.email, '\D', '', 'g'))::int as i) x
cross join generate_series(1, 5) as d
cross join (values ('10:00'),('15:00'),('18:00')) as h(t)
where p.email like 'seed.coach.%@seed.vive.local'
  and x.i % 2 = 1
on conflict (coach_id, date, time) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Salas + reservas COMPLETADAS.
--    Dos grupos a propósito:
--      · coaches 07-12 → sesiones de hace 40-60 días  ⇒ alimentan reseñas, NO tendencia
--      · coaches 13-15 → sesiones de hace 5-20 días   ⇒ alimentan "En tendencia"
-- ─────────────────────────────────────────────────────────────────────────────
create temporary table _seed_pairs on commit drop as
select
  c.id            as coach_id,
  p.id            as coach_profile_id,
  p.name          as coach_name,
  c.specialty     as coach_specialty,
  c.price_per_session as amount,
  u.id            as user_id,
  x.i             as idx,
  un.u            as unum,
  case when x.i between 13 and 15 then 5 + un.u * 4 else 40 + un.u * 5 end as days_ago
from public.profiles p
join public.coaches c on c.profile_id = p.id
cross join lateral (select (regexp_replace(p.email, '\D', '', 'g'))::int as i) x
cross join generate_series(1, 4) as un(u)
join public.profiles u on u.email = format('seed.user.%s@seed.vive.local', lpad(un.u::text, 2, '0'))
where p.email like 'seed.coach.%@seed.vive.local'
  and x.i between 7 and 15;

insert into public.salas (id, user_id, coach_id, created_at)
select gen_random_uuid(), s.user_id, s.coach_profile_id, now() - make_interval(days => s.days_ago)
from _seed_pairs s;

insert into public.bookings (
  id, user_id, coach_id, sala_id, coach_name, coach_specialty,
  scheduled_date, scheduled_time, amount, status, duration_minutes, created_at
)
select
  gen_random_uuid(), s.user_id, s.coach_id, sa.id, s.coach_name, s.coach_specialty,
  (current_date - s.days_ago)::date,
  (array['10:00','15:00','18:00'])[1 + (s.unum % 3)],
  s.amount, 'completada', 60,
  now() - make_interval(days => s.days_ago)
from _seed_pairs s
join public.salas sa
  on sa.user_id = s.user_id and sa.coach_id = s.coach_profile_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Reseñas. Solo para los coaches 07-12, y con dos perfiles distintos:
--      · 07-10 → promedio 4.75 ⇒ CRUZAN la barra de "Recomendado por Vita"
--      · 11-12 → promedio 4.33 ⇒ tienen reseñas pero NO cruzan (caso a testear)
--    Cada reseña cuelga de un booking completado real, así que también valida
--    que la política nueva de INSERT no rompió el flujo legítimo.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.reviews (booking_id, reviewer_id, reviewed_id, rating, comment, is_private)
select
  b.id, s.user_id, s.coach_profile_id,
  case
    when s.idx between 7 and 10 then (array[5,5,4,5])[s.unum]
    else (array[4,4,5,4])[s.unum]
  end,
  (array['Muy buena escucha, salí con herramientas concretas.',
         'Me ayudó a ordenar el tema que venía dando vueltas hace meses.',
         'Puntual y muy claro. Volvería.',
         'Buena sesión, me sirvió.'])[s.unum],
  false
from _seed_pairs s
join public.bookings b
  on b.user_id = s.user_id and b.coach_id = s.coach_id
where s.idx between 7 and 12
on conflict (reviewer_id, reviewed_id) do nothing;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación — debería dar 24 coaches, 8 usuarios, ~60 temas, y los slots de
-- mérito con pool. Después correr `npx sucrase-node scripts/check-deck-pools.ts`.
-- ─────────────────────────────────────────────────────────────────────────────
select
  (select count(*) from public.profiles where email like 'seed.coach.%@seed.vive.local') as coaches,
  (select count(*) from public.profiles where email like 'seed.user.%@seed.vive.local')  as usuarios,
  (select count(*) from public.coach_topics ct
     join public.coaches c on c.id = ct.coach_id
     join public.profiles p on p.id = c.profile_id
     where p.email like '%@seed.vive.local')                                             as temas,
  (select count(*) from public.bookings b
     join public.profiles u on u.id = b.user_id
     where u.email like '%@seed.vive.local')                                             as reservas,
  (select count(*) from public.reviews r
     join public.profiles u on u.id = r.reviewer_id
     where u.email like '%@seed.vive.local')                                             as resenias;
