-- ============================================================
-- Vita — Subtemas que trabaja cada coach (feature real)
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-02
--
-- Hasta ahora "Temas que trabajo" en CoachProfileScreen.tsx era un
-- chip "+ Agregar" sin onPress, y ProfesionalScreen.tsx mostraba
-- siempre los mismos 5 temas hardcodeados (DEFAULT_PROFESIONAL.topics)
-- para cualquier coach. El filtro de búsqueda (search1 → search2 →
-- search3) ya dejaba elegir un subtema real de los 28 definidos en
-- constants/searchData.ts (AXES), pero search3.tsx lo comparaba
-- contra coaches.specialty (texto libre tipo "Coach de vida") en vez
-- de contra una lista real de temas del coach — casi nunca matcheaba.
--
-- Esta tabla guarda, por coach, qué subtemas de los 28 de AXES
-- trabaja. El valor de `topic` es el string tal cual aparece en
-- constants/searchData.ts (ej. "Ansiedad", "Pareja", "Sueño") — sin
-- CHECK constraint contra esa lista a propósito, mismo criterio que
-- saved_resources.resource_id: la lista vive en el frontend y no se
-- espera que cambie seguido, no vale la pena la rigidez de un enum
-- en la base (evita el problema histórico de este proyecto con los
-- CHECK constraints de messages.sender_type / notifications.type).
--
-- coach_id apunta a coaches.id (no profiles.id) — mismo criterio que
-- coach_availability y coach_weekly_pattern.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, topic)
);

ALTER TABLE public.coach_topics ENABLE ROW LEVEL SECURITY;

-- Lectura pública — se necesita tanto para mostrar los temas en el
-- perfil público (ProfesionalScreen.tsx) como para filtrar en la
-- búsqueda (search3.tsx), sin requerir sesión.
CREATE POLICY "coach_topics_public_read"
  ON public.coach_topics FOR SELECT
  USING (true);

-- Escritura solo para el coach dueño — mismo patrón que
-- coach_availability (coaches_manage_own_availability).
CREATE POLICY "coach_topics_manage_own"
  ON public.coach_topics FOR ALL
  USING (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()))
  WITH CHECK (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

-- Para revertir si hace falta:
-- DROP TABLE IF EXISTS public.coach_topics;
