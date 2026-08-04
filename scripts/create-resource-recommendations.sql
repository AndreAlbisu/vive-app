-- Migration: resource_recommendations
-- Un evento por cada vez que se muestra la tarjeta "Para vos ahora" en Inicio
-- (con check-in de hoy real), con el par de recursos sugerido y en qué orden,
-- y cuál eligió el usuario (NULL si no tocó ninguno). Correr en el SQL Editor
-- de Supabase antes de que la tarjeta pueda registrar nada.

CREATE TABLE IF NOT EXISTS public.resource_recommendations (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  mood_id           smallint    NOT NULL CHECK (mood_id BETWEEN 1 AND 5),
  mood_label        text        NOT NULL,
  suggested_first   text        NOT NULL,   -- resource_id mostrado primero (slug: 'diario'/'gratitud'/'respiracion')
  suggested_second  text        NOT NULL,   -- resource_id mostrado segundo
  chosen            text,                  -- resource_id que tocó el usuario, o NULL si no tocó ninguno
  CONSTRAINT resource_recommendations_chosen_valid
    CHECK (chosen IS NULL OR chosen IN (suggested_first, suggested_second))
);

ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_recommendations_select_own" ON public.resource_recommendations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "resource_recommendations_insert_own" ON public.resource_recommendations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "resource_recommendations_update_own" ON public.resource_recommendations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "resource_recommendations_delete_own" ON public.resource_recommendations
  FOR DELETE USING (user_id = auth.uid());
