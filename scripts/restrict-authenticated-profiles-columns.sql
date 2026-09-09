-- restrict-authenticated-profiles-columns.sql
--
-- `authenticated` (cualquiera con una cuenta) deja de poder leer `email` y
-- `push_token` de `profiles`. Cierra A4 fase 3 — ver docs/problemas-abiertos.md.
--
-- ── Qué cierra ────────────────────────────────────────────────────────────────
--
-- La sesión 205 le sacó a `anon` el mail y el `push_token` de los 34 coaches,
-- pero quedó abierto que **cualquiera con una cuenta** todavía los leía: el mismo
-- agujero, una puerta más adentro. Con una cuenta gratis, una plataforma
-- competidora se baja el roster entero con los mails (la estrategia anti-fuga al
-- revés), y con un `push_token` de Expo alcanza para mandarle una notificación al
-- teléfono de esa persona.
--
-- ── Por qué un revoke de columnas y no una vista (por ahora) ──────────────────
--
-- La receta de Andre proponía una vista pública para el catálogo y sacarle a
-- `authenticated` el SELECT de la tabla entera. Al auditar (09/09) qué lee de
-- `profiles` un usuario logueado, resultó que para CERRAR ESTE agujero alcanza
-- con revocar las dos columnas: **nadie lee `email` ni `push_token` de `profiles`
-- desde el cliente** —ni de otros ni de la fila propia (el mail propio sale de la
-- sesión de auth, no de la tabla; el `push_token` solo se ESCRIBE en
-- `registerForPushNotifications`, que necesita UPDATE, no SELECT)—. Y los cuatro
-- lectores del catálogo (`coachesCache`, `search3`, `ProfesionalScreen`,
-- `FavoritosScreen`) piden solo `id, name, avatar_url, gender`, que se quedan.
--
-- La vista sigue teniendo valor —taparía además `is_admin`, `birth_date`,
-- `nationality` y sería a prueba de columnas sensibles futuras (la asimetría que
-- Andre anotó en la 207)— pero es un refactor del catálogo con riesgo de
-- regresión, y NO agrega nada para el agujero de mail/push_token. Queda como
-- mejora aparte, flagueada para Andre.
--
-- 🔴 Por qué NO se puede revocar más que estas dos: los grants son por ROL, no
-- por fila, así que revocar `birth_date`/`nationality`/`email_verified_at` le
-- sacaría a cada usuario la lectura de SU PROPIA fila — `EditProfileScreen` lee
-- `birth_date, gender, nationality` propios, y `emailVerificado` lee
-- `email_verified_at` propio. Ese "tu fila entera, la de los coaches cuatro
-- campos" es justo lo que un grant de columnas no expresa, y lo que resolvería
-- la vista.
--
-- ── Estado del grant antes de correr esto ─────────────────────────────────────
--
-- `authenticated` tiene el SELECT a nivel TABLA (`relacl` = `authenticated=ardm`
-- → INSERT, SELECT, DELETE, MAINTAIN), igual que `anon` antes de la 205. Por eso
-- NO alcanza con `revoke select (email, push_token)`: un grant de tabla cubre
-- todas las columnas y Postgres no deja revocar un subconjunto. Hay que revocar
-- el SELECT de la tabla y re-grantear las 15 columnas que se quedan — el mismo
-- patrón que `restrict-anon-profiles-columns.sql`.
--
-- 🟢 Efecto lateral bueno: al pasar de tabla a columnas, una columna sensible
-- NUEVA en `profiles` ya no queda legible sola para `authenticated` — cierra por
-- defecto. Es exactamente la asimetría que Andre anotó en la 207 (para `coaches`
-- sigue abierta; esto la arregla para `profiles`).
--
-- El UPDATE de `push_token` propio (registerForPushNotifications) NO se toca:
-- vive en un grant de columna aparte (`push_token=w`), no en el SELECT.
--
-- ✅ CORRIDO y VERIFICADO el 09/09/2026 — ver el bloque de verificación abajo y
-- la prueba con JWT real (email/push_token → 42501, fila propia y catálogo → ok).

begin;

revoke select on public.profiles from authenticated;

-- Las 15 columnas = las 17 de `profiles` menos `email` y `push_token`. Es todo
-- lo que `authenticated` leía hasta ahora salvo esas dos: se preserva el
-- comportamiento (fila propia + catálogo) y solo se cierran las dos del agujero.
grant select (
  id, name, role, avatar_url, created_at, accepted_terms, accepted_terms_at,
  birth_date, gender, nationality, deleted_at, age_confirmed,
  accepted_terms_version, is_admin, email_verified_at
) on public.profiles to authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Correr después del commit y comparar contra lo esperado.

-- 1) `authenticated` ya NO tiene SELECT sobre email ni push_token.
--    Esperado: ve_email = 0, ve_push_token = 0, columnas_totales = 15.
select
  count(*) filter (where column_name = 'email')      as ve_email,
  count(*) filter (where column_name = 'push_token') as ve_push_token,
  count(*)                                           as columnas_totales
from information_schema.column_privileges
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT';

-- 2) Las columnas que el catálogo y la fila propia SÍ necesitan siguen estando.
--    Esperado: 6 filas — avatar_url, birth_date, gender, id, name, nationality.
select column_name
from information_schema.column_privileges
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT'
  and column_name in ('id', 'name', 'avatar_url', 'gender', 'birth_date', 'nationality')
order by column_name;

-- 3) La RLS no se tocó: la policy de SELECT de `profiles` sigue existiendo.
select polname, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.profiles'::regclass
  and polcmd in ('r', '*');
