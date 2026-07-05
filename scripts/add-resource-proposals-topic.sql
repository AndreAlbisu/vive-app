-- ============================================================
-- Vita — resource_proposals.topic (subtema propuesto por el coach)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resource-proposals.sql ya corrido
-- Fecha: 2026-07-04
--
-- Hallazgo: el mockup ya existente de "Proponer recurso a VIVE"
-- (screens/CoachResourcesScreen.tsx, pestaña Recursos del coach) tenía un
-- selector de Tema (uno de los 28 subtemas de AXES en
-- constants/searchData.ts) que la migración anterior (sesión 03/07) no
-- contempló — resource_proposals no tenía ninguna columna para guardarlo.
-- Se agrega acá para no perder esa UX ya diseñada. El coach etiqueta UN
-- subtema al proponer; VITA lo ve en la revisión y lo usa como referencia
-- para asignar ejes (resource_axes) y tags (resource_tags) al aprobar —
-- sigue sin ser un vínculo automático a esas tablas, solo una referencia
-- textual para el revisor.
--
-- Sin CHECK constraint contra la lista de 28 subtemas a propósito —
-- mismo criterio que coach_topics.topic: la lista vive en el frontend,
-- no vale la pena la rigidez de un enum en la base (ver SCHEMA.md,
-- sección coach_topics).
-- ============================================================

ALTER TABLE public.resource_proposals
  ADD COLUMN IF NOT EXISTS topic text;

NOTIFY pgrst, 'reload schema';
