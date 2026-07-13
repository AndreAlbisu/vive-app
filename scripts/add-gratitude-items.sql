-- ============================================================
-- Vive — Diario de gratitud: 3 ítems por entrada
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-12
--
-- La pantalla `/gratitud` (app/gratitud.tsx) guarda TRES ítems por
-- entrada (item_1/2/3), pero la tabla original solo tenía `content`
-- (una sola columna de texto libre). Por eso el insert fallaba y la
-- pantalla nunca persistía nada (mostraba "Guardado" igual).
--
-- Decisión de producto 2026-07-12: el diario de gratitud son 3 ítems
-- por día, no texto libre.
--
-- Esta migración agrega item_1/2/3 (nullable: el usuario puede llenar
-- solo 1 o 2) y afloja el NOT NULL de `content` para que el insert de
-- 3 ítems no tenga que mandar `content`. `content` queda como columna
-- vestigial (backward-compat, no la lee el frontend nuevo).
-- ============================================================

ALTER TABLE public.gratitude_entries
  ADD COLUMN IF NOT EXISTS item_1 text,
  ADD COLUMN IF NOT EXISTS item_2 text,
  ADD COLUMN IF NOT EXISTS item_3 text;

-- El insert de 3 ítems no envía `content`; si estaba NOT NULL, fallaba.
ALTER TABLE public.gratitude_entries
  ALTER COLUMN content DROP NOT NULL;

-- Para revertir si hace falta:
-- ALTER TABLE public.gratitude_entries
--   DROP COLUMN IF EXISTS item_1,
--   DROP COLUMN IF EXISTS item_2,
--   DROP COLUMN IF EXISTS item_3;
