-- ============================================================
-- Vive — Seguimiento de progreso de recursos
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-02
--
-- Habilita dos features en la pantalla Recursos:
--
-- 1. Racha semanal (StreakChip en el header): días consecutivos
--    con al menos un recurso completado. Se calcula client-side
--    a partir de `completed_at`.
--
-- 2. "Continuar donde dejaste" (ContinueCard): si `progress_seconds`
--    existe y es menor que `duration_seconds`, el recurso quedó a
--    medias. El bloque se muestra solo cuando hay un recurso parcial.
--    `duration_seconds` puede ser NULL para recursos libres (Diario,
--    Ruido blanco) — en ese caso nunca aparecen en ContinueCard.
--
-- `resource_id` es el id del TOOLS array del frontend (ej. "respiracion",
-- "gratitud") — mismo criterio que saved_resources.resource_id: la lista
-- vive en el frontend y no vale la pena un CHECK constraint en la base.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resource_completions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id      text        NOT NULL,
  completed_at     timestamptz NOT NULL DEFAULT now(),
  duration_seconds int,
  progress_seconds int
);

CREATE INDEX IF NOT EXISTS resource_completions_user_time_idx
  ON public.resource_completions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS resource_completions_user_resource_idx
  ON public.resource_completions (user_id, resource_id);

ALTER TABLE public.resource_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select_own" ON public.resource_completions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rc_insert_own" ON public.resource_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "rc_update_own" ON public.resource_completions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "rc_delete_own" ON public.resource_completions
  FOR DELETE USING (user_id = auth.uid());

-- Para revertir si hace falta:
-- DROP TABLE IF EXISTS public.resource_completions;
