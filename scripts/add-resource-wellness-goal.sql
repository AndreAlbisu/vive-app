-- ============================================================
-- Vita — objetivo de bienestar de cada recurso (`coach_resources.wellness_goal`)
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE ANTES DE CORRER
-- Fecha: 2026-08-29
--
-- QUÉ RESUELVE
-- El coach elige un OBJETIVO al subir un recurso — para qué sirve, no de qué
-- tema es. El tema ya lo captura `topic_id` (la puerta de Conexiones); esto es
-- otra cosa: la INTENCIÓN con la que alguien busca ("quiero calmar la ansiedad"
-- vs "el recurso es sobre ansiedad"). Su feature —descubrimiento por intención—
-- es de una fase futura y NO se construye ahora.
--
-- 🔴 POR QUÉ LA COLUMNA VA IGUAL, ANTES QUE LA FEATURE.
-- Es la única pieza de "Recursos v3" que no se puede diferir: etiquetar
-- contenido viejo después es inviable —ningún coach vuelve a editar lo que ya
-- subió—, así que si el campo no existe al momento de la carga, ese dato se
-- pierde para siempre. Capturarlo ahora es un seguro barato; construir el
-- filtro encima puede esperar a que haya volumen de contenido que lo justifique
-- (hoy hay ~18 recursos).
--
-- DECISIONES
--   · TEXT + CHECK, no un ENUM nativo de Postgres. Es la convención del
--     proyecto: `format`, `source` y `status` de esta misma tabla son todos
--     text con CHECK. Agregar un valor mañana es un ALTER de una línea, no un
--     `ALTER TYPE ... ADD VALUE` que no se puede correr dentro de una
--     transacción ni revertir.
--   · NULLABLE a nivel base, obligatorio en el CLIENTE. Las ~18 filas viejas
--     quedan en NULL a propósito (no se puede etiquetar lo que ya se subió), y
--     el CHECK deja pasar NULL —en Postgres un CHECK se cumple sobre NULL—, así
--     que lo viejo no rompe. El formulario de carga exige el valor solo para
--     los recursos nuevos.
--   · Ocho valores, alineados a cómo alguien pediría ayuda, no a las 10
--     puertas: una puerta puede alimentar varios objetivos y al revés.
--
-- Sin RLS nueva: la columna hereda las policies de `coach_resources` (el dueño
-- inserta/edita las suyas, published visible para todos) — no es un dato
-- sensible ni privilegiado, es contenido del propio recurso.
-- ============================================================

-- 1) La columna. `if not exists` para poder re-correr sin error.
alter table public.coach_resources
  add column if not exists wellness_goal text;

-- 2) El CHECK con los ocho valores. Se dropea antes de crear para que
--    re-correr el script no falle con "constraint already exists" y para que,
--    si algún día se agrega un valor, alcance con editar esta lista y volver a
--    correr. El CHECK admite NULL (filas viejas) por la semántica de Postgres.
alter table public.coach_resources
  drop constraint if exists coach_resources_wellness_goal_check;

alter table public.coach_resources
  add constraint coach_resources_wellness_goal_check
  check (wellness_goal in (
    'calmar_ansiedad',
    'dormir_mejor',
    'mejorar_animo',
    'ganar_foco',
    'construir_habitos',
    'entender_emociones',
    'mover_el_cuerpo',
    'alimentacion'
  ));

-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) La columna existe y es nullable:
--    select is_nullable from information_schema.columns
--    where table_name = 'coach_resources' and column_name = 'wellness_goal';
--    -- YES
--
-- 2) El CHECK quedó con los 8 valores:
--    select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.coach_resources'::regclass
--      and conname = 'coach_resources_wellness_goal_check';
--
-- 3) Las filas viejas quedaron en NULL, no rompieron:
--    select count(*) as viejas_sin_objetivo from public.coach_resources
--    where wellness_goal is null;
--
-- 4) Un valor inválido rebota (tiene que fallar con 23514):
--    -- update public.coach_resources set wellness_goal = 'xxx' where id = '<id>';
--
-- ── Para volver atrás ────────────────────────────────────────────────────────
-- alter table public.coach_resources drop constraint if exists coach_resources_wellness_goal_check;
-- alter table public.coach_resources drop column if exists wellness_goal;
