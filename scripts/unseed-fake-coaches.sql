-- unseed-fake-coaches.sql
--
-- Borra TODO lo que creó `seed-fake-coaches.sql`. El criterio es el dominio de
-- email `@seed.vive.local` — nada real lo usa. Si cambiás el dominio en el seed,
-- cambialo también acá.
--
-- Correr en el SQL editor de Supabase (rol postgres ⇒ sin RLS; `reviews` no tiene
-- política de DELETE, así que desde el cliente esto sería imposible a propósito).
--
-- Sin tablas temporales a propósito: en un script multi-statement Postgres parsea
-- todo antes de ejecutar nada, así que una temp table creada arriba todavía no
-- existe cuando se parsean las sentencias de abajo. Los ids van inline.
--
-- Orden: de las hojas hacia la raíz, para no pelear con las FKs.
-- Fecha: 2026-08-07

begin;

-- 1. Reseñas (escritas por usuarios seed o recibidas por coaches seed).
delete from public.reviews r
where r.reviewer_id in (select id from public.profiles where email like '%@seed.vive.local')
   or r.reviewed_id in (select id from public.profiles where email like '%@seed.vive.local');

-- 2. Mensajes de las salas del seed.
delete from public.messages m
where m.sala_id in (
  select s.id from public.salas s
  where s.user_id  in (select id from public.profiles where email like '%@seed.vive.local')
     or s.coach_id in (select id from public.profiles where email like '%@seed.vive.local')
);

-- 3. Notas de sesión.
delete from public.session_notes sn
where sn.coach_id in (select id from public.profiles where email like '%@seed.vive.local')
   or sn.user_id  in (select id from public.profiles where email like '%@seed.vive.local');

-- 4. Reservas. Ojo: `coach_id` es `coaches.id`, `user_id` es `profiles.id`.
delete from public.bookings b
where b.user_id in (select id from public.profiles where email like '%@seed.vive.local')
   or b.coach_id in (
        select c.id from public.coaches c
        join public.profiles p on p.id = c.profile_id
        where p.email like '%@seed.vive.local');

-- 5. Salas (ya sin mensajes ni reservas apuntando).
delete from public.salas s
where s.user_id  in (select id from public.profiles where email like '%@seed.vive.local')
   or s.coach_id in (select id from public.profiles where email like '%@seed.vive.local');

-- 6. Todo lo que cuelga de `coaches.id`.
delete from public.coach_topics
where coach_id in (select c.id from public.coaches c
                   join public.profiles p on p.id = c.profile_id
                   where p.email like '%@seed.vive.local');

delete from public.coach_availability
where coach_id in (select c.id from public.coaches c
                   join public.profiles p on p.id = c.profile_id
                   where p.email like '%@seed.vive.local');

delete from public.coach_weekly_pattern
where coach_id in (select c.id from public.coaches c
                   join public.profiles p on p.id = c.profile_id
                   where p.email like '%@seed.vive.local');

-- 7. Favoritos y notificaciones que alguien real pudo haber generado sobre ellos.
delete from public.favorite_coaches
where coach_profile_id in (select id from public.profiles where email like '%@seed.vive.local');

delete from public.notifications
where recipient_id in (select id from public.profiles where email like '%@seed.vive.local');

-- 8. Coaches y perfiles.
delete from public.coaches
where profile_id in (select id from public.profiles where email like '%@seed.vive.local');

delete from public.profiles where email like '%@seed.vive.local';

commit;

-- Verificación — todo tiene que dar 0.
select
  (select count(*) from public.profiles where email like '%@seed.vive.local') as perfiles,
  (select count(*) from public.coaches c
     left join public.profiles p on p.id = c.profile_id
     where p.id is null)                                                       as coaches_huerfanos;
