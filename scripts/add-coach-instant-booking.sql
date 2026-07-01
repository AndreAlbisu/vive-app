-- ============================================================
-- Vita — Columna instant_booking en coaches
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-01
--
-- Habilita la modalidad "reserva instantánea": si instant_booking
-- es true para un coach, sus reservas nacen con status='confirmada'
-- directo (sin pasar por 'pendiente' ni por aceptación manual del
-- coach). Default false — todo coach existente sigue funcionando
-- exactamente igual que hoy (modo "con confirmación") hasta que
-- prenda el switch desde su perfil.
--
-- No hace falta política de RLS nueva: coaches_update_own (agregada
-- el 30/06/2026) ya cubre cualquier UPDATE a columnas propias del
-- coach, incluida esta.
-- ============================================================

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS instant_booking boolean NOT NULL DEFAULT false;

-- Para revertir si hace falta:
-- ALTER TABLE public.coaches DROP COLUMN IF EXISTS instant_booking;
