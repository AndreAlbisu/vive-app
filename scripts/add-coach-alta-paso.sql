-- add-coach-alta-paso.sql
--
-- `profiles.coach_alta_paso` — en qué paso quedó un alta de coach a medio hacer.
--
-- ⚠️ PENDIENTE DE CORRER (escrito el 10/09/2026). 🔴 Cambio estructural del flujo
-- de auth: por la regla #6 de SCHEMA.md se revisa entre Andre y Joaquín antes de
-- correrlo, y conviene una prueba en dispositivo del arranque después (el
-- AuthRedirect es zona de rebotes/parpadeos con historia).
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- El alta de coach crea la cuenta y abre sesión ANTES de que la persona termine
-- (primero verifica el mail, después postula). El marcador de "en qué paso está"
-- vivía en `AsyncStorage` (`lib/altaCoach.ts`), o sea EN EL TELÉFONO: borrar los
-- datos de la app lo saltea, y al reabrir el AuthRedirect deja entrar como
-- usuario final a una cuenta que se creó queriendo ser profesional y cuyo alta
-- nunca terminó. Este marcador cuelga del SERVIDOR, así que sobrevive a eso.
--
-- ── Por qué en `profiles` y no en `coaches` ──────────────────────────────────
--
-- La fila de `coaches` recién existe cuando se ENVÍA la postulación — que es
-- justo el momento en que el alta deja de estar a medias. Durante los dos pasos
-- previos no hay fila de coach donde colgar el estado; sí hay fila de `profiles`
-- (la crea el trigger de alta). Por eso va acá.

begin;

alter table public.profiles
  add column if not exists coach_alta_paso text
  check (coach_alta_paso in ('verificar', 'postular'));

comment on column public.profiles.coach_alta_paso is
  'En qué paso quedó un alta de coach a medio hacer: verificar (mail) o postular. NULL = no hay alta pendiente. La escribe el dueño de la fila; reemplaza al marcador que vivía en AsyncStorage, que se saltaba borrando los datos de la app. Ver lib/altaCoach.ts.';

-- 🔴 Después de A4 (`restrict-authenticated-profiles-columns.sql`) el SELECT y el
-- UPDATE de `profiles` para `authenticated` son POR COLUMNA, no de tabla
-- (verificado el 10/09: has_table_privilege UPDATE/SELECT = false; el grant vive
-- en cada columna). Una columna nueva no queda cubierta por ninguno, así que hay
-- que otorgar los dos explícitamente. La RLS (profiles_update_own y las de
-- SELECT) ya limita a la fila propia: el grant abre la columna, la policy la
-- acota a su dueño.
grant select (coach_alta_paso) on public.profiles to authenticated;
grant update (coach_alta_paso) on public.profiles to authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La columna existe con su CHECK. Esperado: 1 fila.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name = 'coach_alta_paso';

-- 2) `authenticated` puede leer y escribir SOLO esta columna nueva (la RLS hace
--    el resto). Esperado: las dos en true.
select
  has_column_privilege('authenticated', 'public.profiles', 'coach_alta_paso', 'SELECT') as puede_leer,
  has_column_privilege('authenticated', 'public.profiles', 'coach_alta_paso', 'UPDATE') as puede_escribir;

-- 3) 🔴 El grant no se derramó a la tabla entera (seguiría cerrado el mail). Los
--    dos esperados en false, igual que antes de esta migración.
select
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') as sel_tabla,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as upd_tabla;

-- 4) El CHECK rechaza un valor fuera del dominio. Debe FALLAR (correr suelto):
-- update public.profiles set coach_alta_paso = 'cualquier_cosa' where id = '<UUID>';
