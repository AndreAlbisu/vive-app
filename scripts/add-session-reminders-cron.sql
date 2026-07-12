-- ============================================================
-- Vita — Recordatorio de sesión (notificación in-app, 24hs antes)
-- Correr en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-07-12
--
-- Qué hace:
--   Para cada booking 'confirmada' con scheduled_date = mañana,
--   inserta una notificación 'recordatorio_sesion' para el usuario
--   SI aún no existe una para ese booking.
--   No manda push real (sin pg_net/Edge Function por ahora) —
--   mismo alcance que complete_confirmed_sessions y
--   expire_pending_bookings: solo la fila en `notifications`
--   que la UI in-app lee.
--
-- Cron: 1 vez por día a las 18:00 hs Argentina (= 21:00 UTC).
--   Argentina no observa DST → UTC-3 fijo.
--
-- Para verificar que quedó el job:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'session-reminders';
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_session_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, booking_id, title, body)
  SELECT
    b.user_id,
    'recordatorio_sesion',
    b.id,
    'Tu sesión es mañana',
    'Tenés una sesión con ' || coalesce(b.coach_name, 'tu coach') ||
    ' mañana a las ' || to_char(b.scheduled_time, 'HH24:MI') || ' hs. ¡Anotalo para no olvidarte.'
  FROM public.bookings b
  WHERE b.status = 'confirmada'
    AND b.scheduled_date = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 1
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.booking_id = b.id
        AND n.type = 'recordatorio_sesion'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_session_reminders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_session_reminders() FROM anon, authenticated;

-- Agendar el cron (idempotente — si ya existe con ese nombre, lo reemplaza).
SELECT cron.schedule(
  'session-reminders',
  '0 21 * * *',
  $$SELECT public.send_session_reminders();$$
);

-- Para revertir si hace falta:
-- SELECT cron.unschedule('session-reminders');
-- DROP FUNCTION IF EXISTS public.send_session_reminders();
