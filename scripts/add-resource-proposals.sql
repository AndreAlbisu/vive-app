-- ============================================================
-- Vita — resource_proposals (propuestas de recursos por coaches)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-03
--
-- Migración 1/7 del sistema de "Recursos propuestos por coaches".
-- Este script es idempotente (CREATE TABLE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER/POLICY IF EXISTS).
--
-- Qué hace:
--   1. Crea resource_proposals — donde el coach postula un recurso
--      (audio / guía de pasos / lectura breve) para revisión de VITA.
--   2. RLS: el coach solo ve/crea/edita SUS propias propuestas.
--      Nadie más tiene acceso — esta tabla nunca la lee un usuario final.
--   3. Trigger de protección: un coach autenticado NO puede cambiar
--      `status` ni `reviewer_notes` de su propia propuesta directamente
--      (evita que se auto-apruebe o borre notas de revisión editando
--      su propia fila vía UPDATE). Mismo patrón que `reviews_before_update`
--      documentado en SCHEMA.md — RLS no puede restringir por columna,
--      así que se resuelve con un trigger que sí tiene acceso a OLD/NEW.
--      Cuando se corre desde el SQL Editor / Dashboard (auth.uid() IS NULL,
--      no hay JWT de usuario en la sesión), el trigger no bloquea nada —
--      así el equipo VITA sigue aprobando manualmente sin fricción.
--
-- NO toca ninguna tabla existente. NO crea resources todavía (script 2/7).
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resource_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES public.coaches(id),
  type            text NOT NULL CHECK (type IN ('audio', 'guia_pasos', 'lectura_breve')),
  title           text NOT NULL,
  description     text,
  duration_min    int CHECK (duration_min IS NULL OR duration_min > 0),
  content         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'enviada'
                    CHECK (status IN ('enviada', 'necesita_ajustes', 'aprobada', 'descartada')),
  reviewer_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_proposals_coach_id ON public.resource_proposals(coach_id);
CREATE INDEX IF NOT EXISTS idx_resource_proposals_status ON public.resource_proposals(status);

-- 2. RLS
ALTER TABLE public.resource_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_proposals_select_own" ON public.resource_proposals;
DROP POLICY IF EXISTS "resource_proposals_insert_own" ON public.resource_proposals;
DROP POLICY IF EXISTS "resource_proposals_update_own" ON public.resource_proposals;

CREATE POLICY "resource_proposals_select_own"
  ON public.resource_proposals FOR SELECT TO authenticated
  USING (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

CREATE POLICY "resource_proposals_insert_own"
  ON public.resource_proposals FOR INSERT TO authenticated
  WITH CHECK (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

CREATE POLICY "resource_proposals_update_own"
  ON public.resource_proposals FOR UPDATE TO authenticated
  USING (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()))
  WITH CHECK (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

-- Sin política de DELETE → un coach no puede borrar una propuesta ya enviada.

-- 3. Trigger: protege status/reviewer_notes de ediciones directas del coach,
--    y de paso mantiene updated_at al día (mismo criterio que reviews_before_update).
CREATE OR REPLACE FUNCTION public.fn_resource_proposals_protect_review_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'No podés modificar el estado de tu propuesta directamente.';
    END IF;
    IF NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes THEN
      RAISE EXCEPTION 'No podés modificar las notas de revisión.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_proposals_protect ON public.resource_proposals;
CREATE TRIGGER trg_resource_proposals_protect
  BEFORE UPDATE ON public.resource_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_resource_proposals_protect_review_fields();

-- 4. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
