-- revoke-truncate-trigger-references.sql
--
-- Sacarle a `authenticated` y a `anon` los tres permisos que Supabase concede
-- por default sobre todo `public` y que la app no usa nunca: TRUNCATE,
-- REFERENCES y TRIGGER.
--
-- ⚠️ PENDIENTE DE CORRER al 03/09/2026.
--
-- ── Cómo apareció ────────────────────────────────────────────────────────────
-- Verificando `add-user-consents.sql` recién corrido. El `revoke` de ese script
-- decía `insert, update, delete`, y la verificación devolvió igual
-- **SELECT, TRUNCATE, REFERENCES, TRIGGER**. O sea que revocar los tres de
-- escritura no alcanza: hay otros tres que vienen puestos de fábrica.
--
-- El barrido después confirmó que **está en TODAS las tablas y vistas de
-- `public`**, incluidas `mood_entries`, `journal_entries`, `gratitude_entries`,
-- `messages`, `profiles`, `bookings` y `coach_payout_accounts`.
--
-- ── Qué tan grave es, sin dramatizar ─────────────────────────────────────────
-- 🔴 **TRUNCATE es el que importa, y el motivo es que la RLS NO lo filtra.** Las
-- policies se evalúan sobre select/insert/update/delete; truncate no pasa por
-- ahí. O sea que toda la protección por filas que tiene el proyecto —cada uno ve
-- y toca lo suyo— no dice nada sobre vaciar la tabla entera.
--
-- ✅ **Hoy NO es explotable desde la app**, y conviene decirlo con la misma
-- claridad: PostgREST no expone TRUNCATE por HTTP. No hay verbo que mapee a eso,
-- así que con la superficie actual —la anon key y la REST API— nadie puede
-- ejecutarlo. Esto no es un incidente, es un permiso que no debería existir.
--
-- ⚠️ **Cuándo dejaría de ser teórico:** el día que se agregue una función RPC
-- con SQL dinámico, o cualquier camino que le permita a un `authenticated`
-- ejecutar SQL arbitrario. Ahí el permiso pasa de sobrante a habilitante. Y
-- cerrarlo ahora cuesta una sentencia.
--
-- `REFERENCES` (crear FKs que apunten a la tabla) y `TRIGGER` (crear triggers
-- sobre ella) van en el mismo viaje: la app no los usa y no hay motivo para
-- dejarlos. Son menos graves que TRUNCATE, no cero.
--
-- ── Por qué no alcanza con arreglar las tablas de hoy ────────────────────────
-- 🔴 Sin la segunda parte, **la próxima tabla nace con el mismo problema** —
-- que es exactamente lo que le pasó a `user_consents`, creada con todo el
-- cuidado del mundo y con TRUNCATE igual. El `alter default privileges` es la
-- parte que hace que no vuelva.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Las tablas y vistas que ya existen
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se itera sobre los grants reales en vez de sobre `pg_tables`: así se toca
-- exactamente lo que está concedido, y las vistas entran sin necesitar un caso
-- aparte. Idempotente — correrlo dos veces no hace nada la segunda.

do $$
declare r record;
begin
  for r in
    select distinct table_name
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('authenticated', 'anon')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    order by table_name
  loop
    execute format(
      'revoke truncate, references, trigger on public.%I from authenticated, anon',
      r.table_name
    );
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Que la próxima tabla no nazca con el problema
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ `alter default privileges` es POR ROL CREADOR. Esto cubre lo que cree
-- `postgres`, que es el rol con el que corre el SQL editor del dashboard —o sea
-- el camino por el que se crearon todas las tablas de este proyecto.
--
-- Si en algún momento algo crea tablas con otro rol (una migración corrida por
-- `supabase_admin`, por ejemplo), hay que repetirlo para ese rol. La
-- verificación de abajo lo detecta: si aparece una tabla nueva con TRUNCATE,
-- fue creada por un rol que este bloque no cubre.

alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated;

alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   -- 1) 🔴 EL CHEQUEO: no tiene que quedar ninguna fila
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('authenticated', 'anon')
--     and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
--   order by table_name, grantee;
--   -- esperado: 0 filas
--
--   -- 2) Y que NO se haya llevado puesto lo que la app sí necesita.
--   -- Este es el control de que el barrido no rompió nada: las tablas que la
--   -- app escribe tienen que seguir teniendo sus permisos de escritura.
--   select table_name, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee = 'authenticated'
--     and table_name in ('mood_entries', 'journal_entries', 'gratitude_entries', 'messages', 'bookings')
--   group by table_name
--   order by table_name;
--   -- esperado: las cinco con al menos SELECT e INSERT. Si alguna quedó solo
--   -- con SELECT, el revoke se pasó de largo y hay que devolverle lo suyo.
--
--   -- 3) Los default privileges quedaron aplicados
--   select defaclrole::regrole as creador, defaclacl
--   from pg_default_acl
--   where defaclnamespace = 'public'::regnamespace and defaclobjtype = 'r';
--   -- esperado: para authenticated y anon ya no aparece la D (truncate),
--   -- la x (references) ni la t (trigger) en el ACL.
