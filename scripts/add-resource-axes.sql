-- ============================================================
-- Vita — resource_axes (relación N:M recursos ↔ ejes Cuerpo/Mente/Alma)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resources.sql corrido antes (FK a resources.id)
-- Fecha: 2026-07-03
--
-- Migración 3/7. Idempotente.
--
-- Nota: 'cuerpo'/'mente'/'alma' es una taxonomía NUEVA y separada de los
-- AXES de constants/searchData.ts (Bienestar físico/emocional-mental/
-- Crecimiento, usada para coach_topics) — no son lo mismo, no se unifican
-- en este trabajo.
--
-- ON DELETE CASCADE: si se borra un resource, sus filas de eje se van
-- con él (no tiene sentido un axis link huérfano apuntando a nada).
--
-- RLS: SELECT público (necesario para filtrar por eje en la UI sin
-- sesión). Sin INSERT/UPDATE/DELETE para authenticated — se escribe a
-- mano junto con el resource, vía Dashboard.
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resource_axes (
  resource_id  uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  axis         text NOT NULL CHECK (axis IN ('cuerpo', 'mente', 'alma')),
  PRIMARY KEY (resource_id, axis)
);

-- 2. RLS
ALTER TABLE public.resource_axes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_axes_select_public" ON public.resource_axes;

CREATE POLICY "resource_axes_select_public"
  ON public.resource_axes FOR SELECT
  USING (true);

-- 3. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
