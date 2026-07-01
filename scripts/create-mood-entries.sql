-- Migration: mood_entries
-- Un check-in por usuario por día. Correr en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.mood_entries (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id     int         NOT NULL CHECK (mood_id BETWEEN 1 AND 5),
  mood_label  text        NOT NULL,
  entry_date  date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mood_entries_user_date_unique UNIQUE (user_id, entry_date)
);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_select_own"  ON public.mood_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mood_insert_own"  ON public.mood_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mood_update_own"  ON public.mood_entries
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mood_delete_own"  ON public.mood_entries
  FOR DELETE USING (user_id = auth.uid());
