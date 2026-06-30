-- ============================================================
-- Vita — Política de UPDATE faltante en coaches
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-06-30
--
-- Bug encontrado: la tabla coaches solo tenía una política RLS,
-- "coaches_insert_own" (FOR INSERT). No existía ninguna política
-- de UPDATE, así que con RLS activado CUALQUIER update a coaches
-- (price_per_session, video_url, bio, specialty, etc.) afectaba
-- 0 filas en silencio — Postgrest no devuelve error cuando RLS
-- filtra todas las filas de un UPDATE sin .select() encadenado,
-- así que el cliente (CoachProfileScreen.tsx) creía que había
-- guardado bien y actualizaba su estado local, pero la base nunca
-- cambiaba. Confirmado en producción: "Coach Prueba" seteó su
-- precio en $10000 desde el perfil, la app lo mostraba actualizado,
-- pero un SELECT directo (anon key, sin filtro) seguía devolviendo
-- price_per_session = 4500.
--
-- Mismo problema aplica al guardado de video_url (sesión 28) —
-- nunca se había confirmado en dispositivo real que esa escritura
-- persistiera de verdad.
-- ============================================================

CREATE POLICY "coaches_update_own"
  ON public.coaches FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Para revertir si hace falta:
-- DROP POLICY IF EXISTS "coaches_update_own" ON public.coaches;
