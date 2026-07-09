-- ============================================================
-- Vita — bucket de Storage para videos de recursos de coaches
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-09
--
-- Decisión de producto (09/07): los recursos tipo 'video' se consumen
-- DENTRO de la app (no links a YouTube) — el coach sube el archivo desde
-- el formulario y se reproduce con expo-video (mismo criterio que el
-- audio en resource-audio). content.url = URL pública de este bucket.
--
-- Mismo patrón exacto que scripts/add-resource-audio-storage.sql, con:
--   - Límite 100MB (el video pesa mucho más que el audio; aún así hay que
--     avisarle al coach que grabe cortos — ver hint del formulario)
--   - mime types de video
-- Path: resource-video/{auth.uid()}/{timestamp}.{ext}. Sin UPDATE/DELETE.
-- ============================================================

-- 1. Bucket — 100MB por archivo, solo mime types de video
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resource-video',
  'resource-video',
  true,
  104857600,  -- 100MB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS sobre storage.objects para este bucket
DROP POLICY IF EXISTS "resource_video_public_read" ON storage.objects;
DROP POLICY IF EXISTS "resource_video_coach_insert" ON storage.objects;

CREATE POLICY "resource_video_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resource-video');

CREATE POLICY "resource_video_coach_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resource-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Sin UPDATE/DELETE a propósito (archivos inmutables; huérfanos a mano).
