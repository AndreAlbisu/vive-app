-- ============================================================
-- Vita — notifications.type: sumar 'propuesta_publicada' y 'propuesta_ajustes'
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-notifications-recurso-feedback-umbral.sql ya corrido
-- Fecha: 2026-07-05
--
-- Migración C del batch de implementación (spec en Notion, 05/07).
-- Mismo patrón defensivo que el script de recurso_feedback_umbral:
-- buscamos el nombre real de la constraint en pg_constraint en vez de
-- asumirlo, así no rompe si difiere del nombre por convención.
--
-- Qué hace: agrega 2 tipos para avisarle al coach el resultado de la
-- revisión de su propuesta de recurso, preservando los 7 existentes:
--   - 'propuesta_publicada'  → su recurso fue aprobado y ya está publicado
--   - 'propuesta_ajustes'    → VITA le dejó sugerencias para ajustar
--
-- A propósito NO hay tipo para 'descartada': el descarte se comunica
-- solo en el historial de Mis propuestas con sus notas — una push de
-- descarte sería lo más punitivo del sistema (regla no punitiva).
--
-- Las filas las inserta VITA a mano como parte del protocolo de
-- revisión (docs/revision-recursos.md) — nada automático todavía.
-- ============================================================

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT con.conname INTO con_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'notifications'
    AND con.contype = 'c'
    AND att.attname = 'type'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'reserva_nueva',
      'reserva_confirmada',
      'reserva_rechazada',
      'reserva_cancelada',
      'recordatorio_sesion',
      'invitacion_review',
      'recurso_feedback_umbral',
      'propuesta_publicada',
      'propuesta_ajustes'
    ));
END $$;

NOTIFY pgrst, 'reload schema';
