-- unseed-fake-coaches.sql
--
-- Borra TODO lo que creó `seed-fake-coaches.sql`. El criterio es el dominio de
-- email `@seed.vive.local` — nada real lo usa. Si cambiás el dominio en el seed,
-- cambialo también acá.
--
-- Correr en el SQL editor de Supabase (rol postgres ⇒ sin RLS; `reviews` no tiene
-- política de DELETE, así que desde el cliente esto sería imposible a propósito).
--
-- Orden: de las hojas hacia la raíz, para no pelear con las FKs.
-- Fecha: 2026-08-07

begin;

-- Ids del seed, una sola vez.
create temporary table _seed_ids on commit drop as
select p.id as profile_id, p.role, c.id as coach_id
from public.profiles p
left join public.coaches c on c.profile_id = p.id
where p.email like '%@seed.vive.local';

-- 1. Reseñas (escritas por usuarios seed o recibidas por coaches seed).
delete from public.reviews r
where r.reviewer_id in (select profile_id from _seed_ids)
   or r.reviewed_id in (select profile_id from _seed_ids);

-- 2. Mensajes de las salas del seed, y después las salas.
delete from public.messages m
where m.sala_id in (
  select s.id from public.salas s
  where s.user_id in (select profile_id from _seed_ids)
     or s.coach_id in (select profile_id from _seed_ids)
);

-- 3. Notas de sesión colgadas de reservas del seed.
delete from public.session_notes sn
where sn.coach_id in (select profile_id from _seed_ids)
   or sn.user_id  in (select profile_id from _seed_ids);

-- 4. Reservas. Ojo: `coach_id` es `coaches.id`, `user_id` es `profiles.id`.
delete from public.bookings b
where b.user_id  in (select profile_id from _seed_ids)
   or b.coach_id in (select coach_id from _seed_ids where coach_id is not null);

-- 5. Salas (ya sin mensajes ni reservas apuntando).
delete from public.salas s
where s.user_id  in (select profile_id from _seed_ids)
   or s.coach_id in (select profile_id from _seed_ids);

-- 6. Todo lo que cuelga de `coaches.id`.
delete from public.coach_topics       where coach_id in (select coach_id from _seed_ids where coach_id is not null);
delete from public.coach_availability where coach_id in (select coach_id from _seed_ids where coach_id is not null);
delete from public.coach_weekly_pattern where coach_id in (select coach_id from _seed_ids where coach_id is not null);

-- 7. Favoritos y notificaciones que alguien real pudo haber generado sobre ellos.
delete from public.favorite_coaches where coach_profile_id in (select profile_id from _seed_ids);
delete from public.notifications    where recipient_id     in (select profile_id from _seed_ids);

-- 8. Coaches y perfiles.
delete from public.coaches  where profile_id in (select profile_id from _seed_ids);
delete from public.profiles where email like '%@seed.vive.local';

commit;

-- Verificación — todo tiene que dar 0.
select
  (select count(*) from public.profiles where email like '%@seed.vive.local') as perfiles,
  (select count(*) from public.coaches c
     left join public.profiles p on p.id = c.profile_id
     where p.id is null)                                                       as coaches_huerfanos;
