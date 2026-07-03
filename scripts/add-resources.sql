-- ============================================================
-- Vita — resources (catálogo publicado de recursos de coaches)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resource-proposals.sql corrido antes (FK a resource_proposals.id)
-- Fecha: 2026-07-03
--
-- Migración 2/7. Idempotente.
--
-- Qué hace:
--   1. Crea resources — el recurso ya publicado y visible en la app.
--      NACE VACÍA: no migra el catálogo hardcodeado actual (Diario,
--      Gratitud, Respiración, etc. de app/(tabs)/recursos.tsx) — eso
--      sigue viviendo en el frontend, sin tocar, fuera de este trabajo.
--   2. proposal_id: de dónde salió el recurso (nullable — VITA también
--      podría cargar recursos propios sin propuesta de por medio).
--      UNIQUE porque una propuesta aprobada se convierte en, como mucho,
--      un solo recurso — evita duplicar por error al cargar a mano.
--   3. attributed_to_coach_id → profiles.id (no coaches.id): es atribución
--      para mostrar/enlazar el perfil del coach, mismo criterio que
--      favorite_coaches.coach_profile_id y salas.coach_id, NO el criterio
--      operativo de coach_topics/coach_availability (que usan coaches.id).
--   4. RLS: SELECT público (cualquiera puede leer recursos publicados,
--      logueado o no). Sin política de INSERT/UPDATE/DELETE para
--      authenticated — la única forma de escribir es a mano vía
--      Supabase Dashboard (bypasea RLS), consistente con "el coach nunca
--      escribe directo en resources".
--
-- NO toca resource_proposals ni ninguna tabla existente.
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resources (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id             uuid UNIQUE REFERENCES public.resource_proposals(id),
  attributed_to_coach_id  uuid REFERENCES public.profiles(id),
  type                    text NOT NULL CHECK (type IN ('audio', 'guia_pasos', 'lectura_breve', 'journaling', 'gratitud')),
  title                   text NOT NULL,
  description             text,
  duration_min            int CHECK (duration_min IS NULL OR duration_min > 0),
  content                 jsonb NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_attributed_to_coach_id ON public.resources(attributed_to_coach_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(type);

-- 2. RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources_select_public" ON public.resources;

CREATE POLICY "resources_select_public"
  ON public.resources FOR SELECT
  USING (true);

-- Sin políticas de INSERT/UPDATE/DELETE → con RLS activado y sin ellas,
-- cualquier escritura desde la app (authenticated o anon) queda bloqueada
-- por defecto. Solo se escribe vía SQL Editor / Dashboard (bypasea RLS).

-- 3. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
