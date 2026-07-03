-- ============================================================
-- Vita — notifications.type: sumar 'recurso_feedback_umbral'
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-03
--
-- Migración 7/7. Idempotente y defensivo: no asumimos el nombre exacto
-- de la constraint CHECK actual sobre notifications.type (SCHEMA.md no
-- lo documenta) — la buscamos dinámicamente en pg_constraint antes de
-- reemplazarla, así el script no falla si el nombre real es distinto
-- al que asumiríamos por convención.
--
-- Qué hace: agrega 'recurso_feedback_umbral' a los valores válidos,
-- preservando los 6 existentes (reserva_nueva, reserva_confirmada,
-- reserva_rechazada, reserva_cancelada, recordatorio_sesion,
-- invitacion_review). No dispara nada todavía — el disparo real de esta
-- notificación (detección de umbral en resource_feedback) es lógica de
-- aplicación, fuera de este trabajo.
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
      'recurso_feedback_umbral'
    ));
END $$;

NOTIFY pgrst, 'reload schema';
