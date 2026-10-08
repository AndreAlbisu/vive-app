-- Privacidad: el reclamante no debe leer el motivo de rechazo del admin.
--
-- EL PROBLEMA (confirmado en la auditoría fase 5 de Andre, 04/10): la columna
-- `guarantee_claims.notes` guarda el contexto de la decisión — sobre todo el
-- MOTIVO DE RECHAZO que escribe el admin (`guarantee-claim` edge function,
-- `body.reject` → `notes`), incluido el rechazo por uso abusivo (§9.3). Con la
-- policy `guarantee_claims_select_own`, el reclamante puede leer su propia fila
-- por la API, con `notes` adentro.
--
-- No se ve en la app —`BookingScreen_Confirm` y `ProfesionalScreen` solo leen
-- `id`—, así que esto NO cambia nada de la experiencia del usuario: la fuga es
-- solo por la API cruda con la user key. Pero filtrarle a un abusador CÓMO se lo
-- detectó es lo peor que puede pasar en esta tabla.
--
-- EL FIX: `authenticated` deja de poder leer la columna `notes`. No alcanza con
-- revocar porque el ADMIN también es `authenticated` y la RLS filtra FILAS, no
-- columnas; los dos comparten el grant de columna. El admin, que sí necesita las
-- notas para el panel (`lib/admin.ts` → `listClaims`), las lee por una función
-- security definer gateada por `is_admin`.
--
-- 🔴 ACOPLADO al cambio de `lib/admin.ts` (lee las notas por la RPC
-- `notas_garantia_admin`). Aplicar esta migración en prod y mergear el código
-- JUNTOS: si el código llega antes, el panel pide una función que no existe; si
-- la migración llega antes, el panel deja de ver las notas hasta el deploy.
--
-- Decisión de producto para Andre: esto ESCONDE la nota del reclamante. Si en
-- algún momento se quiere mostrarle un motivo (distinto del interno/abuso), la
-- alternativa es partir el campo en dos — `notes` interno (admin) + un
-- `motivo_cliente` visible. Eso es más trabajo y se deja afuera a propósito.

begin;

-- 1) Grants por columna: se revoca el SELECT de tabla de `authenticated` (hoy lo
--    tiene por el default de Supabase, sin grants por columna) y se re-grantea
--    todo MENOS `notes`.
revoke select on public.guarantee_claims from authenticated;
grant select (id, booking_id, user_id, coach_id, status, requested_at, resolved_at, resolved_by)
  on public.guarantee_claims to authenticated;

-- 2) El admin lee las notas por acá, no por la tabla. A quien no es admin le
--    devuelve 0 filas (el EXISTS); security definer saltea el revoke de columna.
create or replace function public.notas_garantia_admin()
returns table (id uuid, notes text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select g.id, g.notes
  from public.guarantee_claims g
  where exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  );
$$;

revoke all on function public.notas_garantia_admin() from public, anon;
grant execute on function public.notas_garantia_admin() to authenticated;

commit;

-- Verificación (correr aparte, con una user key que NO sea admin):
--   select notes from guarantee_claims limit 1;   -- esperado: 42501 permission denied
--   select * from notas_garantia_admin();          -- esperado: 0 filas
-- Con una admin key: la RPC devuelve (id, notes) de todas las garantías.
