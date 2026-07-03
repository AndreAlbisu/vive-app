-- ============================================================
-- Vita — resource_tag_links (relación N:M resources ↔ resource_tags)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resources.sql y scripts/add-resource-tags.sql corridos antes
-- Fecha: 2026-07-03
--
-- Migración 5/7. Idempotente.
--
-- RLS: SELECT público (filtrar por tag en la UI sin sesión). Sin
-- INSERT/UPDATE/DELETE para authenticated — el link tag↔recurso se crea
-- a mano junto con la aprobación de la propuesta, vía Dashboard (mismo
-- criterio que resources/resource_axes).
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resource_tag_links (
  resource_id  uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  tag_id       uuid NOT NULL REFERENCES public.resource_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_tag_links_tag_id ON public.resource_tag_links(tag_id);

-- 2. RLS
ALTER TABLE public.resource_tag_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_tag_links_select_public" ON public.resource_tag_links;

CREATE POLICY "resource_tag_links_select_public"
  ON public.resource_tag_links FOR SELECT
  USING (true);

-- 3. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
