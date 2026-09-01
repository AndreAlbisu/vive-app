-- ============================================================
-- Vita — dejar que la analítica se escriba SIN cuenta
-- Correr en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-09-01
--
-- POR QUÉ EXISTE
-- 🔴 Encontrado en dispositivo el 01/09/2026. Todos los eventos del onboarding
-- fallaban con:
--
--     new row violates row-level security policy for table "analytics_events"
--
-- La política de INSERT que hay pide sesión, y **la mitad más importante de lo
-- que hay que medir ocurre antes de que exista una cuenta**: las cuatro
-- pantallas del onboarding, y sobre todo `muro_cuenta_visto`, que por
-- definición se emite justo cuando la persona NO está registrada. O sea que el
-- embudo entero caía en el `console.warn` de `registrarEvento` y no llegaba
-- nada a la tabla.
--
-- QUÉ HACE
-- Agrega una política de INSERT para el rol `anon`, con dos candados:
--   · SOLO INSERT. `anon` no puede leer, actualizar ni borrar analítica.
--   · `user_id` TIENE que ser NULL. Sin esto, cualquiera con la anon key
--     podría escribir eventos atribuidos a otra persona.
-- Y una política de INSERT para `authenticated` que solo deja escribir eventos
-- propios (`user_id = auth.uid()`) o sin dueño.
--
-- ⚠️ LO QUE ESTO ACEPTA A CONCIENCIA: con la anon key en la mano, cualquiera
-- puede insertar filas de analítica basura. Es inherente a medir desde el
-- cliente y no hay forma de evitarlo sin mandar los eventos por una Edge
-- Function. Se acepta porque el daño máximo es ensuciar una tabla de métricas
-- —no toca datos de nadie, no se puede leer nada— y porque `properties.sesion`
-- permite descartar un origen entero si algún día aparece ruido.
-- ============================================================

-- ── PARTE 1 · Mirar qué políticas hay antes de tocar nada ────────────────────
-- Correr SOLO esto primero y leer el resultado.

select
  polname                                    as politica,
  case polcmd when 'r' then 'SELECT'
              when 'a' then 'INSERT'
              when 'w' then 'UPDATE'
              when 'd' then 'DELETE'
              when '*' then 'ALL' end        as comando,
  pg_get_expr(polqual,      polrelid)        as using_expr,
  pg_get_expr(polwithcheck, polrelid)        as with_check_expr,
  (select array_agg(rolname) from pg_roles where oid = any(polroles)) as roles
from pg_policy
where polrelid = 'public.analytics_events'::regclass
order by polcmd, polname;

-- Y confirmar que RLS está prendida (si dijera false, el problema sería otro):
select relrowsecurity as rls_prendida
from pg_class
where oid = 'public.analytics_events'::regclass;


-- ── PARTE 2 · Aplicar ────────────────────────────────────────────────────────
-- Correr después de mirar la parte 1.

do $$
begin
  -- Idempotente: se puede correr dos veces sin romper nada.
  if exists (
    select 1 from pg_policy
    where polrelid = 'public.analytics_events'::regclass
      and polname  = 'analytics_insert_anon'
  ) then
    raise notice 'analytics_events: la política de anon ya existía, no se toca';
  else
    -- 🔴 `with check (user_id is null)` es el candado que importa: `anon` puede
    -- dejar constancia de que algo pasó, pero no puede decir a quién le pasó.
    create policy analytics_insert_anon
      on public.analytics_events
      for insert
      to anon
      with check (user_id is null);
    raise notice 'analytics_events: creada analytics_insert_anon';
  end if;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.analytics_events'::regclass
      and polname  = 'analytics_insert_propio'
  ) then
    raise notice 'analytics_events: la política de authenticated ya existía, no se toca';
  else
    -- Con sesión: solo eventos propios o sin dueño. `user_id is null` sigue
    -- permitido porque un evento puede dispararse en el instante justo en que
    -- la sesión todavía no resolvió, y perderlo sería peor que guardarlo
    -- anónimo.
    create policy analytics_insert_propio
      on public.analytics_events
      for insert
      to authenticated
      with check (user_id is null or user_id = auth.uid());
    raise notice 'analytics_events: creada analytics_insert_propio';
  end if;
end $$;


-- ── PARTE 3 · Verificar ──────────────────────────────────────────────────────
-- Tienen que aparecer las dos políticas nuevas, las dos como INSERT.

select
  polname as politica,
  case polcmd when 'a' then 'INSERT' else polcmd::text end as comando,
  pg_get_expr(polwithcheck, polrelid) as with_check_expr,
  (select array_agg(rolname) from pg_roles where oid = any(polroles)) as roles
from pg_policy
where polrelid = 'public.analytics_events'::regclass
  and polname in ('analytics_insert_anon', 'analytics_insert_propio')
order by polname;

-- 🔴 Y la prueba de verdad: esto tiene que insertar UNA fila sin error.
-- (Se borra sola en la línea siguiente; no ensucia la métrica.)
insert into public.analytics_events (user_id, event_name, properties)
values (null, 'prueba_rls_anon', '{"sesion":"prueba-manual"}'::jsonb);

delete from public.analytics_events where event_name = 'prueba_rls_anon';

-- ⚠️ Ojo: corriendo desde el SQL Editor sos `postgres` y las políticas no se
-- aplican, así que el insert de arriba pasa igual. La prueba REAL es abrir la
-- app sin cuenta y confirmar que ya no aparece el warn de RLS en la consola.
