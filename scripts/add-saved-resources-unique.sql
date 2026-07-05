-- ============================================================
-- Vita — saved_resources: deduplicar + UNIQUE(user_id, resource_id)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-05
--
-- Bug encontrado 05/07: saved_resources nunca tuvo UNIQUE(user_id,
-- resource_id) y toggleSave hacía INSERT (no upsert), así que un mismo
-- recurso podía quedar guardado en varias filas. La pantalla de
-- guardados (FlatList) crasheaba con "two children with the same key".
--
-- Este script:
--   1. Borra los duplicados, conservando la fila más antigua por
--      (user_id, resource_id).
--   2. Agrega la constraint UNIQUE para que no vuelva a pasar.
--
-- Idempotente: el DELETE no hace nada si ya no hay dupes; el ADD
-- CONSTRAINT se saltea si ya existe (bloque DO).
-- ============================================================

-- 1. Deduplicar (conservar el id más antiguo por par user/resource)
DELETE FROM public.saved_resources a
USING public.saved_resources b
WHERE a.user_id = b.user_id
  AND a.resource_id = b.resource_id
  AND a.created_at > b.created_at;

-- Empate de created_at (misma marca): conservar el menor id
DELETE FROM public.saved_resources a
USING public.saved_resources b
WHERE a.user_id = b.user_id
  AND a.resource_id = b.resource_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- 2. Constraint UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_resources_user_resource_unique'
  ) THEN
    ALTER TABLE public.saved_resources
      ADD CONSTRAINT saved_resources_user_resource_unique
      UNIQUE (user_id, resource_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
