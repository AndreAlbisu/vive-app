-- ============================================================
-- Vita — resources.retired_at (baja editorial sin borrar)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resources.sql ya corrido
-- Fecha: 2026-07-05
--
-- Migración E del batch de implementación (spec en Notion, 05/07).
--
-- Dar de baja un recurso publicado es UPDATE, nunca DELETE: el DELETE
-- arrastraría por CASCADE resource_axes, resource_tag_links y —lo que
-- de verdad importa— resource_feedback (los votos de los usuarios).
-- Retirar = SET retired_at = now() desde el Dashboard, decisión
-- editorial, sin notificación automática al coach.
--
-- Todas las queries de consumo del frontend filtran retired_at IS NULL
-- (ProfesionalScreen, biblioteca en app/(tabs)/recursos.tsx, y la vista
-- de "mis recursos" del coach). Un recurso retirado desaparece de las
-- listas pero conserva su historia.
-- ============================================================

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

NOTIFY pgrst, 'reload schema';
