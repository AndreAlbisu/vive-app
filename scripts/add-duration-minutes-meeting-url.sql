-- Agrega duration_minutes y meeting_url a bookings
-- Correr en Supabase SQL Editor
-- duration_minutes: se puebla al crear el booking desde coach_weekly_pattern.slot_duration_minutes
-- meeting_url: se puebla por la Edge Function create-meeting-room al confirmar una sesión

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS meeting_url text;
