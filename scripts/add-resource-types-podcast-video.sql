-- ============================================================
-- Sumar 'podcast' y 'video' a los tipos de recurso
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER (regla 6 SCHEMA.md)
-- Fecha: 2026-07-09
--
-- Decisión de producto (09/07): un audio guía (algo que HACÉS, participativo)
-- no es lo mismo que un podcast/charla (algo que ESCUCHÁS, pasivo) → tipos
-- separados. Y todos los formatos se consumen dentro de la app, incluido video.
--
-- Tipos finales que puede subir un coach: audio, podcast, video, guia_pasos,
-- lectura_breve. (journaling/gratitud siguen exclusivos de VITA, solo en resources.)
--
-- Se dropea el CHECK de 'type' por nombre real (buscado en pg_constraint, no
-- asumido) para no dejar dos constraints conviviendo — el viejo rechazaría los
-- valores nuevos. Mismo criterio que add-notifications-recurso-feedback-umbral.sql.
-- ============================================================

-- resource_proposals: lo que un coach puede proponer
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.resource_proposals'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.resource_proposals DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.resource_proposals
  ADD CONSTRAINT resource_proposals_type_check
  CHECK (type IN ('audio', 'podcast', 'video', 'guia_pasos', 'lectura_breve'));

-- resources: lo publicado (incluye los exclusivos de VITA journaling/gratitud)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.resources'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.resources DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_type_check
  CHECK (type IN ('audio', 'podcast', 'video', 'guia_pasos', 'lectura_breve', 'journaling', 'gratitud'));

NOTIFY pgrst, 'reload schema';
