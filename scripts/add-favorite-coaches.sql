-- ============================================================
-- Vita — Favoritos de coaches (feature real, antes era solo visual)
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-01
--
-- Hasta ahora "favoritos" eran dos toggles de useState puramente
-- locales y DESCONECTADOS entre sí: la estrella en
-- conexiones.tsx (Destacados de la semana) y el botón "Guardar en
-- favoritos" de ProfesionalScreen.tsx. Ninguno persistía nada ni
-- se relacionaba con el otro — marcar un coach de favorito en un
-- lugar no lo marcaba en el otro, y se perdía al recargar.
--
-- Esta tabla + el hook compartido hooks/useFavoriteCoaches.ts
-- unifican ambos toggles en una sola fuente de verdad real.
--
-- coach_profile_id apunta a profiles.id (= coaches.profile_id),
-- mismo criterio que salas.coach_id — NO es coaches.id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.favorite_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, coach_profile_id)
);

ALTER TABLE public.favorite_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_coaches_select_own"
  ON public.favorite_coaches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "favorite_coaches_insert_own"
  ON public.favorite_coaches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorite_coaches_delete_own"
  ON public.favorite_coaches FOR DELETE
  USING (user_id = auth.uid());

-- Para revertir si hace falta:
-- DROP TABLE IF EXISTS public.favorite_coaches;
