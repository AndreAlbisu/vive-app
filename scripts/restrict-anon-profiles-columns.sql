-- restrict-anon-profiles-columns.sql
--
-- `anon` deja de poder leer TODAS las columnas de `profiles` y pasa a leer solo
-- las cuatro que el catálogo público necesita.
--
-- ⚠️ PENDIENTE DE CORRER.
--
-- ── Qué encontró esto ────────────────────────────────────────────────────────
--
-- Verificando (08/09/2026) si hacía falta una policy de lectura pública para la
-- página web del coach, se descubrió que **ya existía y era más ancha de lo que
-- debía**. Con la anon key —que viaja DENTRO de la app publicada, así que es
-- pública por definición— cualquiera podía leer, de los 32 coaches:
--
--   email · birth_date · gender · nationality · push_token · is_admin
--   email_verified_at · deleted_at · accepted_terms* · created_at · role
--
-- 🟢 **Lo que estaba bien y se verificó igual**: la RLS filtra por
-- `role = 'coach'`, así que los perfiles de usuarios finales NO se veían (0
-- filas con `role='user'`). Y lo sensible está cerrado: `mood_entries`,
-- `journal_entries`, `messages`, `bookings` y `session_notes` devuelven `[]`
-- para anon, y `coach_payout_accounts` tiene el SELECT revocado. El problema
-- era de COLUMNAS, no de filas — y por eso el arreglo es un grant y no una
-- policy: **la RLS decide qué filas, los grants deciden qué columnas.**
--
-- ── Por qué importaba, en orden ──────────────────────────────────────────────
--
-- 1. 🔴 Cualquiera podía bajarse la lista completa de coaches de VIVE con su
--    mail. Es la estrategia anti-fuga al revés: una plataforma competidora
--    scrapea el roster entero y les escribe uno por uno.
-- 2. `push_token` expuesto: con un token de Expo alcanza para mandarle una
--    notificación al teléfono de esa persona.
-- 3. `birth_date` y `nationality` son datos personales bajo la Ley 25.326,
--    publicados sin consentimiento para esa finalidad.
-- 4. `is_admin` decía qué cuentas atacar. Hoy da 0 entre los coaches visibles,
--    pero el día que un admin sea coach, se ve.
--
-- ── Por qué estas cuatro columnas y no otras ─────────────────────────────────
--
-- Se recorrió todo lo que lee `profiles` sin sesión iniciada:
--   · `lib/coachesCache.ts`      → profiles!inner(id, name, avatar_url, gender)
--   · `app/search3.tsx`          → profiles!inner(id, name, avatar_url, gender)
--   · `screens/ProfesionalScreen.tsx` → profiles!inner(name, avatar_url)
--   · `screens/FavoritosScreen.tsx`, `app/coach-recurso.tsx`,
--     `app/formato.tsx`, `screens/ResourceDetailScreen.tsx` → subconjuntos
--
-- `gender` se queda **a propósito**: no es un descuido, es dato de producto. Se
-- muestra en el perfil público (`ProfesionalScreen`, junto a nacionalidad) y es
-- un filtro de búsqueda (`search3.tsx`, "sexo del profesional").
--
-- `nationality` NO entra: la que se muestra sale de `coaches.nationality`, no de
-- `profiles`. Y `birth_date` tampoco: `ProfesionalScreen` tiene un campo `age`
-- que nunca se llena desde la base — queda en string vacío.
--
-- ⚠️ **Esto NO toca a `authenticated`**, que es el rol de cualquiera con sesión
-- iniciada, y todas las demás lecturas de `profiles` del repo corren logueadas
-- (acciones del coach, notificaciones, panel de admin, que lee `name, email`).
-- 🔴 **Queda abierto y hay que mirarlo aparte**: si `authenticated` también
-- puede leer el mail de todos los coaches, entonces alcanza con registrarse para
-- scrapear el roster, y el agujero 1 sigue abierto por otra puerta. La
-- verificación 3 de abajo lo deja a la vista.

begin;

revoke select on public.profiles from anon;

grant select (id, name, avatar_url, gender) on public.profiles to anon;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Correr después del commit y comparar contra lo esperado.

-- 1) `anon` tiene EXACTAMENTE estas cuatro columnas. Esperado: 4 filas —
--    avatar_url, gender, id, name.
select column_name
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT'
order by column_name;

-- 2) Y NINGUNA de las que motivaron el script. Esperado: 0 filas.
select column_name
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT'
  and column_name in (
    'email', 'push_token', 'birth_date', 'nationality', 'is_admin',
    'email_verified_at', 'deleted_at', 'role', 'created_at',
    'accepted_terms', 'accepted_terms_at', 'accepted_terms_version'
  );

-- 3) 🔴 Lo que queda por decidir: qué ve `authenticated`. Si acá aparecen
--    `email` y `push_token`, cualquiera que se registre puede scrapear el
--    roster de coaches — el mismo agujero, una puerta más adentro.
select
  count(*) filter (where column_name = 'email')      as ve_email,
  count(*) filter (where column_name = 'push_token') as ve_push_token,
  count(*)                                           as columnas_totales
from information_schema.column_privileges
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT';

-- 4) La RLS no se tocó, pero se confirma que sigue filtrando por rol.
--    Esperado: la policy de SELECT de `profiles` sigue existiendo.
select polname, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.profiles'::regclass
  and polcmd in ('r', '*');
