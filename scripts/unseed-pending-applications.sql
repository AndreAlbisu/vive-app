-- unseed-pending-applications.sql
--
-- Borra las 3 postulaciones de prueba de `seed-pending-applications.sql`.
--
-- ⚠️ Correr esto cuando termines de probar el panel. Si aprobaste alguna, esa
--    quedó VISIBLE y RESERVABLE en el catálogo real — no la dejes ahí.
--
-- Cuelga del marcador `@prueba.panel.local`. No toca `@seed.vive.local`
-- (los 24 coaches del deck), que tiene su propio unseed.
--
-- Correr en el SQL editor de Supabase (rol postgres ⇒ sin RLS).

begin;

-- Orden: primero lo que depende de `coaches`, después `coaches`, al final
-- `profiles`. `coach_topics` cuelga de coaches con CASCADE, pero se borra
-- explícito para no depender de cómo esté definida la FK.
delete from public.coach_topics ct
using public.coaches c, public.profiles p
where ct.coach_id = c.id
  and c.profile_id = p.id
  and p.email like '%@prueba.panel.local';

delete from public.coaches c
using public.profiles p
where c.profile_id = p.id
  and p.email like '%@prueba.panel.local';

delete from public.profiles
where email like '%@prueba.panel.local';

commit;

-- ⚠️ Si alguna de las 3 llegó a tener una reserva real (poco probable, pero
-- posible si quedó aprobada un rato), estos DELETE van a fallar por la FK de
-- `bookings.coach_id`. En ese caso NO forzar el borrado: dejar la fila y
-- ponerla en `verified = false`, que la saca del catálogo sin romper historial.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación (correr aparte):
--
--   select count(*) from public.profiles where email like '%@prueba.panel.local';
--   -- esperado: 0
