-- ============================================================
-- Vita — user_quiz_answers
-- Fecha: 2026-07-07
--
-- Guarda las respuestas del quiz de onboarding por usuario.
-- Una fila por usuario; se hace upsert al re-hacer el quiz.
--
-- Q1 topic:             emocion | relaciones | trabajo | salud | proposito
-- Q2 professional_type: coach | psicologo | nutricionista | any
-- Q3 budget:            low | mid | high | flex
--
-- Uso actual: personalizar "Para vos" en el home y las sugerencias
-- del quiz. Puede extenderse a recomendaciones automáticas de coaches.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_quiz_answers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic             text,       -- Q1
  professional_type text,       -- Q2
  budget            text,       -- Q3
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_select_own" ON public.user_quiz_answers;
DROP POLICY IF EXISTS "quiz_insert_own" ON public.user_quiz_answers;
DROP POLICY IF EXISTS "quiz_update_own" ON public.user_quiz_answers;

CREATE POLICY "quiz_select_own"
  ON public.user_quiz_answers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "quiz_insert_own"
  ON public.user_quiz_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "quiz_update_own"
  ON public.user_quiz_answers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
