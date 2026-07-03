-- ============================================================
-- Vita — resource_tags (catálogo abierto de tags, oficial | propuesto)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-03
--
-- Migración 4/7. Idempotente. No depende de las tablas anteriores.
--
-- Qué hace:
--   1. Crea resource_tags — catálogo abierto de tags.
--   2. RLS: SELECT público. INSERT solo para coaches autenticados
--      (no cualquier usuario), y forzando status='propuesto' en el
--      WITH CHECK — un coach nunca puede crear un tag ya 'oficial'
--      directo, eso se decide manualmente como parte de la revisión
--      de su propuesta (aprobar el tag o fusionarlo con uno existente).
--      Sin UPDATE/DELETE para authenticated — promover a 'oficial' o
--      fusionar tags también es manual, vía Dashboard.
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resource_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'propuesto' CHECK (status IN ('oficial', 'propuesto')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_tags_select_public" ON public.resource_tags;
DROP POLICY IF EXISTS "resource_tags_insert_coach_proposed" ON public.resource_tags;

CREATE POLICY "resource_tags_select_public"
  ON public.resource_tags FOR SELECT
  USING (true);

CREATE POLICY "resource_tags_insert_coach_proposed"
  ON public.resource_tags FOR INSERT TO authenticated
  WITH CHECK (
    status = 'propuesto'
    AND EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
  );

-- 3. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
