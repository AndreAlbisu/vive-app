-- add-coach-has-matricula.sql
--
-- `coaches.has_matricula` — si el profesional tiene una matrícula VERIFICADA.
-- Derivada de `coach_credentials` por trigger, con el `update` revocado.
--
-- ✅ CORRIDO y VERIFICADO el 03/09/2026:
--   · la columna existe (boolean, NOT NULL, default false);
--   · `authenticated` tiene **SELECT y nada más** — el catálogo la lee, el coach
--     no la escribe;
--   · el backfill coincide con la realidad: **0 filas de diferencia** entre
--     `has_matricula` y lo que dicen las credenciales verificadas.
--
-- 📝 Las verificaciones de abajo salieron mal escritas la primera vez y quedó
-- anotado: la 3 pedía `c.name`, que no existe —el nombre vive en `profiles`—, y
-- la 2 decía "esperado 0 filas" cuando SELECT **tiene que estar**. Las dos ya
-- están corregidas acá.
--
-- ── Por qué existe ───────────────────────────────────────────────────────────
-- Sale de `docs/encuadre-salud-y-responsabilidad.md` §2. La Ley 23.277 reserva
-- **el diagnóstico, el pronóstico y el tratamiento** a quien tiene título
-- habilitante y matrícula. Un coach no puede hacer nada de eso.
--
-- La plataforma tiene coaches Y psicólogos/as bajo el mismo rótulo, en la misma
-- grilla, con el mismo flujo de reserva. Alguien que la está pasando mal puede
-- no distinguir si está reservando terapia o acompañamiento — y si termina en un
-- coach creyendo que es tratamiento, el problema es de Vita, que diseñó la
-- presentación que los volvió indistinguibles.
--
-- El 01/09 se agregó la distinción al perfil (`ProfesionalScreen`), pero **se
-- puede reservar sin entrar nunca ahí**: el catálogo, el buscador y la pantalla
-- de confirmación no saben nada. Esta columna es lo que les permite saberlo sin
-- consultar credenciales por cada tarjeta.
--
-- ── Por qué derivada y no una casilla ────────────────────────────────────────
-- Mismo motivo que `accepts_international` (ver `add-payout-rails.sql`): como
-- flag podría contradecir a los datos —marcarse sin tener la credencial— y
-- entonces el catálogo anunciaría una matrícula que nadie verificó. Eso es
-- exactamente el daño que esto viene a evitar, así que no puede depender de que
-- alguien la mantenga a mano.

alter table public.coaches
  add column if not exists has_matricula boolean not null default false;

comment on column public.coaches.has_matricula is
  'Derivada de coach_credentials: tiene al menos una credencial kind=matricula con status=verificada. Pública — el catálogo y el checkout la leen. La mantiene trg_sync_matricula. NO la escribe nadie a mano.';

-- 🔴 A diferencia de `accepts_international`, esta columna NO recibe
-- `grant update`. `lock-privileged-columns.sql` hace `revoke update on coaches`
-- y otorga columna por columna, así que una columna nueva ya nace no escribible
-- — pero el revoke explícito queda igual, para que se lea la intención y para
-- que no dependa de que ese modelo siga vigente.
revoke update (has_matricula) on public.coaches from authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- El trigger
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ Más simple que `sync_accepts_international` porque acá hay UNA sola tabla
-- de origen: no hace falta ramificar por `TG_TABLE_NAME`. Lo que sí hace falta
-- es distinguir INSERT/UPDATE de DELETE — en un DELETE `new` no está asignado y
-- tocarlo aborta la sentencia. Es el mismo defecto que costó que ningún coach
-- pudiera guardar su `price_usd` en agosto.
--
-- 📌 Y un caso que el otro trigger no tiene: en un UPDATE que cambia el
-- `coach_id` de una credencial habría que recalcular los DOS coaches. Hoy no
-- puede pasar (nada mueve una credencial de dueño), pero si algún día pasa, el
-- coach viejo se quedaría con la marca puesta. Por eso el UPDATE recalcula
-- `old.coach_id` también cuando difiere.

create or replace function public.sync_has_matricula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo uuid;
  v_viejo uuid;
begin
  if TG_OP = 'DELETE' then
    v_viejo := old.coach_id;
  elsif TG_OP = 'UPDATE' then
    v_nuevo := new.coach_id;
    if old.coach_id is distinct from new.coach_id then
      v_viejo := old.coach_id;
    end if;
  else
    v_nuevo := new.coach_id;
  end if;

  update public.coaches c
     set has_matricula = exists (
           select 1 from public.coach_credentials cc
            where cc.coach_id = c.id
              and cc.kind = 'matricula'
              and cc.status = 'verificada'
         )
   where c.id in (v_nuevo, v_viejo);

  return null;
end;
$$;

-- ⚠️ Sin `of` en columnas: cualquier cambio en una credencial puede mover el
-- resultado. Verificar una matrícula lo prende; rechazarla o editarla lo apaga
-- —`trg_reset_credential_on_edit` devuelve la fila a `pendiente` al editarla, y
-- ese reset tiene que apagar la marca del catálogo—.
drop trigger if exists trg_sync_matricula on public.coach_credentials;
create trigger trg_sync_matricula
  after insert or update or delete on public.coach_credentials
  for each row execute function public.sync_has_matricula();


-- Backfill con los datos de hoy.
update public.coaches c
   set has_matricula = exists (
         select 1 from public.coach_credentials cc
          where cc.coach_id = c.id
            and cc.kind = 'matricula'
            and cc.status = 'verificada'
       );


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   -- 1) la columna existe y no es escribible por el coach
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'coaches'
--     and column_name = 'has_matricula';
--   -- esperado: boolean, NO, false
--
--   select privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'coaches'
--     and column_name = 'has_matricula' and grantee = 'authenticated';
--   -- esperado: **SELECT y nada más**. El catálogo necesita leerla, así que
--   -- SELECT tiene que estar. 🔴 Si aparece UPDATE, el coach puede anunciarse
--   -- matriculado sin serlo, que es el daño exacto que esto evita.
--
--   -- 2) el trigger está
--   select tgname from pg_trigger
--   where tgrelid = 'public.coach_credentials'::regclass and not tgisinternal;
--   -- esperado: incluye trg_sync_matricula (y trg_reset_credential_on_edit)
--
--   -- 3) 🔴 el backfill coincide con la realidad — este es el que importa
--   -- ⚠️ El nombre sale de `profiles`, no de `coaches` — esta tabla no tiene
--   -- columna `name`. (La primera versión de esta query lo asumía y fallaba.)
--   select c.id, p.name, c.has_matricula,
--          exists (select 1 from public.coach_credentials cc
--                   where cc.coach_id = c.id and cc.kind = 'matricula'
--                     and cc.status = 'verificada') as deberia
--   from public.coaches c
--   join public.profiles p on p.id = c.profile_id
--   where c.has_matricula is distinct from exists (
--     select 1 from public.coach_credentials cc
--      where cc.coach_id = c.id and cc.kind = 'matricula' and cc.status = 'verificada');
--   -- esperado: 0 filas. Cualquier fila acá es un coach anunciado mal.
