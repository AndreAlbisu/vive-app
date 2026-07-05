-- ============================================================
-- Vita — permitir re-envío de propuestas en necesita_ajustes
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resource-proposals.sql ya corrido
-- Fecha: 2026-07-05
--
-- Migración B del batch de implementación (spec en Notion, 05/07).
--
-- El trigger trg_resource_proposals_protect bloqueaba TODO cambio de
-- status hecho con sesión de usuario, así que el coach no podía
-- reenviar una propuesta después de ajustarla. Este script reemplaza
-- la función para permitir UNA única transición al coach:
--
--   necesita_ajustes → enviada   (re-envío tras ajustes)
--
-- Todo lo demás sigue igual que antes:
--   - cualquier otro cambio de status con sesión → excepción
--   - cualquier cambio de reviewer_notes con sesión → excepción
--     (las notas NO se borran al reenviar: son historial del revisor)
--   - sin sesión (SQL Editor / Dashboard, auth.uid() IS NULL) no se
--     bloquea nada — VITA sigue revisando sin fricción
--   - updated_at se mantiene al día en cada UPDATE
--
-- El trigger existente ya apunta a esta función; CREATE OR REPLACE
-- alcanza, no hay que recrear el trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_resource_proposals_protect_review_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- Única transición permitida al coach: reenviar tras ajustes.
      IF NOT (OLD.status = 'necesita_ajustes' AND NEW.status = 'enviada') THEN
        RAISE EXCEPTION 'No podés modificar el estado de tu propuesta directamente.';
      END IF;
    END IF;
    IF NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes THEN
      RAISE EXCEPTION 'No podés modificar las notas de revisión.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
