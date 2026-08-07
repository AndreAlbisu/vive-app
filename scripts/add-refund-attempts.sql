-- add-refund-attempts.sql
--
-- Dead-letter para mp-process-refunds.
--
-- Problema: hasta hoy, un reembolso que falla de forma PERMANENTE (pago no
-- reembolsable, coach desconectado de MP, token irrecuperable) quedaba en
-- payment_status = 'reembolso_pendiente' y el cron lo reintentaba cada ~5 min
-- para siempre, golpeando la API de MP en loop y sin que nadie se enterara.
--
-- Solución: un contador de intentos por booking. mp-process-refunds lo incrementa
-- en cada fallo y filtra por refund_attempts < MAX_ATTEMPTS (6 ≈ 30 min de
-- reintentos). Al tocar el tope, la fila deja de reintentarse (queda visible en
-- 'reembolso_pendiente' con refund_attempts = MAX para intervención manual) y la
-- función loguea una línea DEAD-LETTER.
--
-- No se agregó un estado nuevo (ej. 'reembolso_fallido') a propósito: habría que
-- tocar el CHECK de payment_status; el contador + filtro alcanza y es reversible
-- (poner refund_attempts en 0 reencola el reembolso).

alter table public.bookings
  add column if not exists refund_attempts smallint not null default 0;

-- Reencolar manualmente un reembolso que quedó en dead-letter:
--   update public.bookings set refund_attempts = 0 where id = '<booking_id>';
