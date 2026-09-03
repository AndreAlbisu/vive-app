-- add-user-consents.sql
--
-- Consentimiento específico para el tratamiento de datos sensibles.
--
-- ⚠️ PENDIENTE DE CORRER al 03/09/2026.
--
-- ── Por qué existe ───────────────────────────────────────────────────────────
-- Hasta hoy la única constancia era `profiles.accepted_terms`: un checkbox de
-- aceptación de los T&C. Para dato sensible eso no alcanza, por dos razones que
-- están desarrolladas en `docs/consentimiento-datos-sensibles.md`:
--
--   · Es GENÉRICO y va EN PAQUETE. Aceptar los T&C cubre la relación entera; no
--     aísla el propósito "tratar tu información de salud". Un consentimiento
--     específico no puede ir escondido dentro de uno general.
--   · La Política §3 dice hoy que el consentimiento se otorga "al utilizar las
--     funcionalidades correspondientes". Eso es consentimiento POR CONDUCTA, y
--     la Ley 25.326 pide EXPRESO para dato sensible.
--
-- ── Qué cubre ────────────────────────────────────────────────────────────────
-- `datos_sensibles_bienestar`: ánimo, diario, gratitud, Y el registro de qué
-- recursos usa la persona.
--
-- 🔴 Lo último se agregó el 03/09/2026 y no es un detalle. "Escuchaste tres
-- audios de ansiedad esta semana" revela lo mismo sobre la salud mental que un
-- check-in, solo que por deducción en vez de por declaración. El TJUE lo fijó en
-- C-184/20 (01/08/2022): los datos que por "una operación intelectual de
-- comparación o deducción" revelan información sensible SON categoría especial.
-- O sea que `resource_events` / `resource_saves` / `pinned_resources` entran.
--
-- ── Por qué una tabla y no columnas en `profiles` ────────────────────────────
-- Porque hay que poder tener VARIOS consentimientos (hoy uno, mañana el paquete
-- para la sesión, el compartir con el profesional) y sobre todo su HISTORIA:
-- otorgado, revocado, vuelto a otorgar. Una columna booleana pierde la
-- secuencia, y la secuencia es justamente lo que se prueba.

create table if not exists public.user_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  consent_type  text not null check (consent_type in ('datos_sensibles_bienestar')),
  granted       boolean not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  -- El LEGAL_VERSION de `constants/legal.ts` (sha256 de 12 hex del contenido de
  -- T&C + Política). Mismo criterio que `profiles.accepted_terms_version`: sin
  -- saber QUÉ texto leyó, la constancia dice que aceptó pero no qué.
  policy_version text,
  created_at    timestamptz not null default now()
);

comment on table public.user_consents is
  'Consentimiento expreso y específico para tratar datos sensibles (Ley 25.326 art. 7). Se escribe SOLO desde la edge function user-consent, nunca desde el cliente.';

comment on column public.user_consents.granted is
  'true = otorgado, false = revocado. Se inserta una fila por cada acto; no se pisa la anterior, para conservar la historia.';

create index if not exists user_consents_lookup
  on public.user_consents (user_id, consent_type, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: el titular LEE lo suyo y NO ESCRIBE NADA
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 🔴 Este es el punto de la tabla, y es la corrección de un defecto conocido.
-- `SCHEMA.md` ya documenta que las cuatro columnas de aceptación de `profiles`
-- las escribe el cliente desde `AuthContext`, "o sea que son falsificables por
-- su propio titular, lo que debilita su valor probatorio".
--
-- El Decreto 1558/2001 admite el consentimiento por un medio distinto al escrito
-- pero exige que ASEGURE LA AUTORÍA Y LA INTEGRIDAD DE LA DECLARACIÓN. Una fila
-- que el titular puede escribir —o borrar, o fechar como quiera— no asegura
-- ninguna de las dos. Sería construir la prueba con el mismo defecto que ya
-- tenemos identificado, en la tabla que existe justamente para probar algo.
--
-- Por eso: `select` propio sí, `insert`/`update`/`delete` NO para nadie salvo
-- el service role, que solo alcanza la edge function.

alter table public.user_consents enable row level security;

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own on public.user_consents
  for select to authenticated
  using (user_id = auth.uid());

-- Sin policies de insert/update/delete a propósito: con RLS activa y sin
-- policy, la operación se rechaza. El service role las saltea por definición.

revoke insert, update, delete on public.user_consents from authenticated;
revoke all on public.user_consents from anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- Vista de lectura: el estado ACTUAL de cada consentimiento
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La tabla guarda la historia; la app casi siempre quiere saber una sola cosa:
-- ¿ahora mismo está otorgado? Sin esto, cada pantalla tendría que hacer el
-- `distinct on` a mano y alguna se lo iba a olvidar.

create or replace view public.user_consents_current
with (security_invoker = true) as
  select distinct on (user_id, consent_type)
    user_id, consent_type, granted, granted_at, revoked_at, policy_version
  from public.user_consents
  order by user_id, consent_type, created_at desc;

comment on view public.user_consents_current is
  'El último acto de cada consentimiento por usuario. security_invoker = true: hereda la RLS de la tabla, así que cada uno ve solo lo suyo.';

grant select on public.user_consents_current to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 📝 Baja de cuenta: esta tabla NO se agrega a PERSONAL_TABLES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Decisión consciente. `delete-account` borra el contenido personal y conserva
-- lo que también le pertenece a un tercero o hay que guardar. El consentimiento
-- es la constancia de que el tratamiento que YA OCURRIÓ fue lícito, y esa
-- constancia sigue haciendo falta después de la baja — mismo criterio por el que
-- la fila de `profiles` queda como lápida con `accepted_terms`.
--
-- ⚠️ Pero el `on delete cascade` contra `auth.users` la borra igual cuando la
-- function elimina la cuenta al final. Si se decide conservarla, hay que
-- cambiar la FK a `on delete set null` y aceptar filas huérfanas, o mover la
-- referencia a `profiles`. Queda anotado y sin resolver: es una pregunta para
-- la consulta legal, no una decisión de implementación.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   -- 1) la tabla existe con sus columnas
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'user_consents'
--   order by ordinal_position;
--   -- esperado: 8 filas
--
--   -- 2) 🔴 EL CHEQUEO QUE IMPORTA: el titular no puede escribir
--   select privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'user_consents'
--     and grantee = 'authenticated';
--   -- esperado: SELECT y nada más. Si aparece INSERT o UPDATE, el revoke no
--   -- corrió y la constancia vuelve a ser falsificable por su titular.
--
--   -- 3) RLS activa y con una sola policy
--   select relrowsecurity from pg_class
--   where oid = 'public.user_consents'::regclass;
--   -- esperado: true
--
--   select polname, polcmd from pg_policy
--   where polrelid = 'public.user_consents'::regclass;
--   -- esperado: 1 fila, user_consents_select_own, cmd = r (select)
--
--   -- 4) la vista hereda la RLS
--   select c.relname, c.reloptions
--   from pg_class c where c.relname = 'user_consents_current';
--   -- esperado: reloptions incluye security_invoker=true
