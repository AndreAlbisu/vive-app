-- ============================================================
-- resource_topics — subtemas (AXES) que describen un recurso publicado
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER (regla 6 SCHEMA.md)
-- Fecha: 2026-07-09
--
-- Espejo de coach_topics: usa la MISMA lista de 28 subtemas de AXES
-- (constants/searchData.ts), sin CHECK contra ella a propósito — la lista
-- vive en el frontend (mismo criterio que coach_topics / resource_proposals.topic).
--
-- Por qué existe: para poder filtrar la biblioteca de recursos por "el problema
-- de la gente" con la misma taxonomía con la que los coaches ya se etiquetan,
-- en vez de inventar una 4ta taxonomía (ver regla 17 SCHEMA.md). El eje grueso
-- cuerpo/mente/alma sigue viviendo en resource_axes; esto es el nivel fino.
--
-- Se escribe a mano al publicar (revisar_aprobar / Dashboard), NUNCA desde la
-- app — igual que resource_axes y resource_tag_links.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resource_topics (
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  topic       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, topic)   -- un recurso no repite subtema
);

ALTER TABLE public.resource_topics ENABLE ROW LEVEL SECURITY;

-- SELECT público: cualquiera filtra la biblioteca con o sin sesión.
DROP POLICY IF EXISTS resource_topics_public_read ON public.resource_topics;
CREATE POLICY resource_topics_public_read ON public.resource_topics
  FOR SELECT USING (true);

-- Sin políticas de INSERT/UPDATE/DELETE para authenticated → con RLS activada
-- toda escritura desde la app queda bloqueada por defecto (igual que resources).

CREATE INDEX IF NOT EXISTS idx_resource_topics_topic ON public.resource_topics (topic);

NOTIFY pgrst, 'reload schema';
