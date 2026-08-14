-- add-admin-flag.sql
--
-- Panel de administración: quién es admin, y qué puede LEER.
--
-- Hoy tres operaciones se hacen con SQL a mano en el dashboard de Supabase:
-- aprobar postulaciones de coaches (`coaches.verified`), moderar reportes
-- (`reports.status`) y resolver garantías (`guarantee_claims`). La primera es
-- la más urgente: `CoachApplicationScreen` inserta `verified: false` y **nada
-- en el código lo pasa a true**, así que sin intervención manual ningún coach
-- que se postule llega nunca al catálogo.
--
-- ── Por qué una columna y no un rol ──────────────────────────────────────────
-- `profiles.role` decide el enrutamiento entre `/(tabs)` y `/(coach)` en
-- `app/_layout.tsx`. Meterle un tercer valor obliga a tocar ese árbol y a
-- decidir qué ve un admin al abrir la app. Un booleano aparte no le cambia el
-- comportamiento a nadie: el admin sigue siendo un usuario normal que además
-- ve una entrada más en su perfil.
--
-- ── Escritura: NO se abre ────────────────────────────────────────────────────
-- El panel NO escribe a estas tablas desde el cliente. Escribe la edge function
-- `admin-actions`, que valida el JWT de quien llama, confirma que sea admin y
-- recién ahí usa el service role. Si el panel pudiera escribir directo habría
-- que reabrir justo las columnas que cerró `lock-privileged-columns.sql`.
--
-- Nota que se desprende de ese script: como allí se revocó el UPDATE de tabla
-- completa a `authenticated` y se otorgaron columnas NOMBRADAS, una columna
-- nueva **no queda otorgada**. `is_admin` nace sin permiso de escritura desde
-- el cliente sin que haya que hacer nada — nadie puede auto-nombrarse admin.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Puede operar el panel de administración (aprobar coaches, moderar reportes, resolver garantías). Se asigna a mano por SQL; el cliente no puede escribirla (ver lock-privileged-columns.sql).';


-- ─────────────────────────────────────────────────────────────────────────────
-- is_admin() — ¿quien llama es admin?
--
-- SECURITY DEFINER por la misma razón que `are_blocked`: se usa dentro de
-- políticas de OTRAS tablas, y ahí conviene que no dependa de qué puede ver el
-- invocador sobre `profiles`. Devuelve un booleano sobre uno mismo, así que no
-- filtra información de nadie.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Regla crítica 18: revocar de PUBLIC no alcanza en Supabase.
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- LECTURA para el panel.
--
-- Sin esto el panel no ve nada: `reports_select_own` y
-- `guarantee_claims_select_own` limitan a lo propio, que para un admin es
-- justamente lo que NO le interesa. Se agregan políticas de SELECT (no de
-- UPDATE) para que la pantalla pueda listar; escribir sigue siendo exclusivo de
-- la edge function.

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports
  for select to authenticated
  using (public.is_admin());

drop policy if exists guarantee_claims_select_admin on public.guarantee_claims;
create policy guarantee_claims_select_admin on public.guarantee_claims
  for select to authenticated
  using (public.is_admin());

-- `coaches`: las postulaciones pendientes tienen verified = false y las
-- políticas de lectura existentes están pensadas para el catálogo público. Sin
-- esta, el panel no puede listar lo que tiene que aprobar.
drop policy if exists coaches_select_admin on public.coaches;
create policy coaches_select_admin on public.coaches
  for select to authenticated
  using (public.is_admin());

-- `profiles`: para mostrar de quién es cada postulación/reporte. La política
-- existente solo expone perfiles con role = 'coach' y el propio.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- Darte de alta como admin (reemplazar el mail):
--
--   update public.profiles set is_admin = true
--   where lower(email) = lower('andrealbisu@gmail.com');
--
-- ⚠️ Correrlo desde el SQL editor, que usa service role. Desde la app fallaría,
-- que es exactamente lo que queremos.
--
-- ── Verificación (pegar DE A UNA, el editor muestra solo la última) ──────────
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='is_admin';
--   -- esperado: 1 fila — boolean / NO / false
--
--   select column_name from information_schema.column_privileges
--   where grantee='authenticated' and privilege_type='UPDATE'
--     and table_schema='public' and table_name='profiles' and column_name='is_admin';
--   -- esperado: 0 filas — el cliente NO puede escribirla
--
--   select policyname, cmd from pg_policies
--   where schemaname='public' and policyname like '%_select_admin';
--   -- esperado: 4 filas, todas SELECT
