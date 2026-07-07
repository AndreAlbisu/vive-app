-- ============================================================
-- Vita — coaches.availability_status
-- Fecha: 2026-07-07
--
-- Columna que indica si el coach acepta nuevas reservas.
-- Valores: 'activo' (default) | 'en_pausa'
--
-- 'activo'   → aparece en búsquedas y puede recibir reservas
-- 'en_pausa' → oculto en búsquedas; reservas existentes no se tocan
--
-- La columna ya queda cubierta por la policy de UPDATE existente en
-- coaches (coaches_can_update_own_profile). No requiere nueva RLS.
-- ============================================================

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS availability_status text
  NOT NULL DEFAULT 'activo'
  CHECK (availability_status IN ('activo', 'en_pausa'));

-- Verificar: todos los coaches existentes deben quedar en 'activo'
-- SELECT id, availability_status FROM coaches;

NOTIFY pgrst, 'reload schema';
