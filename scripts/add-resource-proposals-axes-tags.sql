-- ============================================================
-- Vita — resource_proposals.axes + .tags (propuesta no vinculante del coach)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resource-proposals.sql ya corrido
-- Fecha: 2026-07-05
--
-- Migración A del batch de implementación (spec en Notion, 05/07).
--
-- El coach propone ejes (1-3 de 'cuerpo'/'mente'/'alma') y hasta 3 tags
-- al enviar su recurso. Igual que `topic`, son SOLO referencia para el
-- revisor de VITA: el vínculo real a resource_axes / resource_tag_links
-- lo crea VITA a mano al publicar. Por eso son columnas array acá y no
-- una tabla puente — no se consultan relacionalmente nunca.
--
-- Sin CHECK contra los valores válidos, mismo criterio que `topic` y
-- `coach_topics.topic`: la lista vive en el frontend.
-- ============================================================

ALTER TABLE public.resource_proposals
  ADD COLUMN IF NOT EXISTS axes text[];

ALTER TABLE public.resource_proposals
  ADD COLUMN IF NOT EXISTS tags text[];

NOTIFY pgrst, 'reload schema';
