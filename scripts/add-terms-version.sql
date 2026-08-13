-- add-terms-version.sql
--
-- Constancia de QUÉ y CUÁNDO se aceptó.
--
-- `profiles.accepted_terms` es un booleano: dice que la persona aceptó, no qué
-- texto leyó ni cuándo. Eso alcanza mientras los documentos no cambien nunca —
-- y van a cambiar: los legales de hoy son borrador con 12 placeholders, y §20
-- prevé expresamente modificarlos.
--
-- Sin estas dos columnas, el día que se invoque §20 (modificaciones) o §10 (no
-- elusión) contra alguien, no hay forma de probar qué versión aceptó. La
-- aceptación existe pero es inoponible en su contenido.
--
-- `accepted_terms_version` guarda el valor de LEGAL_VERSION de constants/legal.ts,
-- que es el sha256 (12 hex) del contenido de T&C + Política. Se deriva del texto
-- a propósito: un número de versión mantenido a mano se olvida justo cuando
-- importa —al editar el documento— y entonces habría aceptaciones apuntando a
-- una versión que no es la que la persona leyó.

alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

alter table public.profiles
  add column if not exists accepted_terms_version text;

comment on column public.profiles.accepted_terms_at is
  'Cuándo aceptó los T&C + Política. NULL en cuentas previas al 13/08/2026, donde no se registraba.';

comment on column public.profiles.accepted_terms_version is
  'LEGAL_VERSION (sha256 corto del contenido de T&C + Política) vigente al aceptar. NULL en cuentas previas al 13/08/2026.';

-- ⚠️ NO se backfillea, mismo criterio que `age_confirmed`. Las cuentas
-- anteriores aceptaron de verdad (`accepted_terms = true`) pero no se registró
-- ni cuándo ni qué versión, y ponerle una fecha o un hash inventado sería
-- fabricar una constancia — peor que reconocer que no la hay.

-- Sin RLS nueva: `profiles_update_own` (id = auth.uid()) ya cubre la escritura,
-- que es la misma policy por la que se escriben `accepted_terms` y `age_confirmed`.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('accepted_terms_at', 'accepted_terms_version');
--   -- esperado: 2 filas — timestamptz / YES y text / YES
