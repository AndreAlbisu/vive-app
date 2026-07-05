-- ============================================================
-- Vita — bucket de Storage para audios de recursos de coaches
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-05
--
-- Cambio de producto: los recursos tipo 'audio' dejan de ser links
-- externos (YouTube/Drive/Spotify) — el coach sube el archivo desde
-- el formulario de propuesta y la app lo reproduce con expo-audio,
-- sin sacar al usuario de VITA. content.url pasa a ser la URL
-- pública de este bucket (los links externos viejos siguen andando
-- como fallback vía Linking).
--
-- Mismo patrón que scripts/add-avatar-upload.sql (bucket avatars):
--   - Bucket público (los recursos publicados son públicos)
--   - Path: resource-audio/{auth.uid()}/{timestamp}.{ext} — carpeta
--     por coach, filename único (a diferencia de avatars, acá hay
--     varios archivos por coach, sin upsert)
--   - INSERT restringido a coaches (no cualquier authenticated) y
--     solo dentro de su propia carpeta
--   - Sin UPDATE/DELETE para usuarios: un archivo subido queda
--     inmutable; los huérfanos de propuestas descartadas se limpian
--     a mano vía Dashboard si algún día molestan
-- ============================================================

-- 1. Bucket — 20MB por archivo, solo mime types de audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resource-audio',
  'resource-audio',
  true,
  20971520,  -- 20MB
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS sobre storage.objects para este bucket
DROP POLICY IF EXISTS "resource_audio_public_read" ON storage.objects;
DROP POLICY IF EXISTS "resource_audio_coach_insert" ON storage.objects;

CREATE POLICY "resource_audio_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resource-audio');

CREATE POLICY "resource_audio_coach_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resource-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Sin UPDATE/DELETE a propósito (ver header).
