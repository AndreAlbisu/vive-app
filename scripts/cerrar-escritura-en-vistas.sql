-- Cerrar la escritura sobre VISTAS y la de `anon` sobre `coaches` (23/09/2026, auditoría).
--
-- 🔴 EL HALLAZGO. `anon` y `authenticated` tenían INSERT/UPDATE/DELETE sobre
-- vistas del esquema público. Una vista simple de Postgres es ACTUALIZABLE, y
-- sin `security_invoker` corre con los permisos de su DUEÑO (`postgres`), que
-- saltea la RLS de la tabla de abajo. Probado contra producción con rollback,
-- con la anon key como rol (lo que tiene cualquiera, viaja dentro de la app):
--
--   · `coach_credentials_public` → UPDATE y DELETE de las 3 credenciales
--     verificadas. Borrar la matrícula de un psicólogo lo saca del filtro
--     Psicólogo y le vacía las escuelas.
--   · `coach_availability_status` → UPDATE de las 34 filas de `coaches` (es una
--     vista sobre `coaches`). El DELETE solo falló porque una FK lo frenó.
--
-- Por HTTP es un `PATCH`/`DELETE` a `/rest/v1/<vista>` con la anon key.
--
-- 📌 EL ARREGLO. Ninguna vista se escribe desde la app: se revoca toda escritura
-- de `anon` y `authenticated` sobre TODAS las vistas de `public` (no solo las
-- dos probadas: `operaciones_de_dinero`, `clasificacion_de_operaciones` y
-- `reversiones_despues_de_pagar` también son actualizables). ⚠️ No hay default
-- que distinga vistas de tablas (`alter default privileges ... on tables` cubre
-- las dos): toda vista NUEVA nace escribible y hay que revocarla en su script,
-- o volver a correr este. La verificación lo detecta. El SELECT se conserva: las
-- vistas públicas existen justamente para leerse. No se pasa a
-- `security_invoker`: `coach_credentials_public` expone columnas seguras de
-- filas que la RLS de la tabla no deja ver, y eso es a propósito.
--
-- De paso, `anon` pierde INSERT/UPDATE/DELETE sobre `coaches` (pendiente desde
-- el 23/09, ver SCHEMA): ningún camino sin cuenta escribe esa tabla, y hoy solo
-- lo frenaba la RLS.
--
-- Idempotente.

do $$
declare v record;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', v.relname);
  end loop;
end $$;

revoke insert, update, delete on public.coaches from anon;

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
insert into _res
select 'vistas con escritura para anon/authenticated (esperado 0)', count(*)::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) r(rol)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
where n.nspname = 'public' and c.relkind in ('v', 'm')
  and has_table_privilege(r.rol, c.oid, p.priv);

insert into _res
select 'anon puede escribir coaches (esperado 0)', count(*)::text
from (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
where has_table_privilege('anon', 'public.coaches', p.priv)
   or exists (select 1 from pg_attribute a where a.attrelid = 'public.coaches'::regclass and a.attnum > 0
              and not a.attisdropped and p.priv <> 'DELETE'
              and has_column_privilege('anon', 'public.coaches'::regclass, a.attnum, p.priv));

-- El ataque de antes, repetido: ahora tiene que dar permission denied.
do $$
declare n int; rol text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', rol);
      update coach_credentials_public set title = title;
      get diagnostics n = row_count;
      reset role;
      raise exception 'ENTRÓ filas:%', n;
    exception when others then
      reset role;
      insert into _res values (rol || ' UPDATE coach_credentials_public (esperado permission denied)', sqlerrm);
    end;
    begin
      execute format('set local role %I', rol);
      execute 'update coach_availability_status set coach_id = coach_id';
      get diagnostics n = row_count;
      reset role;
      raise exception 'ENTRÓ filas:%', n;
    exception when others then
      reset role;
      insert into _res values (rol || ' UPDATE coach_availability_status (esperado permission denied)', sqlerrm);
    end;
  end loop;
end $$;

-- Lo que tiene que seguir andando: leer las vistas públicas.
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from coach_credentials_public;
  reset role;
  insert into _res values ('anon sigue leyendo coach_credentials_public', n::text);
  set local role anon;
  select count(*) into n from coach_availability_status;
  reset role;
  insert into _res values ('anon sigue leyendo coach_availability_status', n::text);
exception when others then
  reset role;
  insert into _res values ('lectura pública', 'ROTA: ' || sqlerrm);
end $$;
select * from _res;
