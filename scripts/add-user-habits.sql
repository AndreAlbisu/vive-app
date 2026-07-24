-- ============================================================
-- Vita — Hábitos (rutina de prácticas VITA elegida por el usuario)
-- Correr en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-07-23
--
-- Qué habilita:
--   La sección "Hábitos de hoy" de la pantalla Progreso deja de ser una
--   maqueta hardcodeada. El usuario arma su rutina eligiendo de un catálogo
--   de prácticas VITA (respiración, gratitud, meditación...). Cada hábito se
--   marca "hecho hoy" de forma automática cuando el usuario COMPLETA la
--   herramienta real (que ya escribe en `resource_completions`) — no hay
--   check manual: es "atado al uso real".
--
-- Esta tabla guarda SOLO la rutina (qué prácticas eligió el usuario). El
-- registro de "hecho" vive en `resource_completions` (ver
-- scripts/add-resource-completions.sql) — no se duplica acá.
--
-- `tool_id` es la clave del catálogo de constants/tools.ts (ej. "respiracion",
-- "gratitud"), la misma que usa `resource_completions.resource_id`. La lista
-- vive en el frontend → sin CHECK constraint (mismo criterio que
-- resource_completions.resource_id y coach_resources.topic_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_habits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id     text        NOT NULL,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_id)   -- una práctica aparece una sola vez en la rutina
);

CREATE INDEX IF NOT EXISTS user_habits_user_order_idx
  ON public.user_habits (user_id, sort_order);

ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uh_select_own" ON public.user_habits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "uh_insert_own" ON public.user_habits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "uh_update_own" ON public.user_habits
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "uh_delete_own" ON public.user_habits
  FOR DELETE USING (user_id = auth.uid());

-- Para revertir si hace falta:
-- DROP TABLE IF EXISTS public.user_habits;
