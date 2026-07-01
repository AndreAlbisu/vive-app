-- ============================================================
-- Vita — Foto de perfil real para coaches (subida de archivo)
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-01
--
-- profiles.avatar_url ya existe en la tabla (columna vieja, sin uso
-- hasta ahora) — no hace falta ALTER TABLE. Esta migración agrega:
--   1. Bucket de Storage `avatars` (mismo patrón que coach-videos).
--   2. RLS de storage para ese bucket.
--   3. Política de UPDATE en profiles (guardada con IF NOT EXISTS
--      porque no hay certeza de que ya exista una — no está
--      documentada en ningún script previo. Si profiles ya tenía
--      una política de UPDATE propia, este bloque no hace nada).
--
-- Convención de path: avatars/{auth.uid()}/avatar.jpg (carpeta por
-- usuario, filename fijo, subida siempre con upsert:true — mismo
-- criterio que coach-videos, para no dejar archivos huérfanos).
-- auth.uid() = profiles.id, así que la RLS no necesita joins.
--
-- Aunque el pedido es solo para coaches, avatar_url vive en
-- profiles (tabla compartida por coaches y usuarios) — el bucket y
-- la política quedan disponibles para cualquier perfil, pero por
-- ahora solo CoachProfileScreen.tsx tiene la UI para subir foto.
-- ============================================================

-- 1. Bucket de Storage — público (cualquier usuario debe poder ver
--    la foto sin sesión), 5MB de límite, solo mime types de imagen.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS sobre storage.objects para este bucket
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Política de UPDATE en profiles, solo si no existe ninguna ya
--    (evita error si profiles ya tenía una política propia de update).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Para revertir si hace falta:
-- DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'avatars';
-- DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
