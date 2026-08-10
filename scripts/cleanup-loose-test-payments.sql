-- cleanup-loose-test-payments.sql
--
-- Limpieza puntual de los 3 pagos de $1 ARS que quedaron sin reembolsar
-- después de las pruebas reales contra MP del 09/08 (ver CHANGELOG_SESIONES.md,
-- sesión 87 de Andre). Bookings identificados por el prefijo de su id:
-- `2c72b126`, `51b36c93`, `5948c59d`.
--
-- Qué hace: cancela esas 3 reservas. `trg_mark_refund_on_cancel` (ya en prod)
-- detecta el pasaje a 'cancelada' con payment_status='aprobado' y lo marca
-- 'reembolso_pendiente' automáticamente — no hace falta tocar payment_status
-- a mano. El cron de mp-process-refunds (cada 5 min) hace el reembolso real
-- contra la API de MP en la corrida siguiente.
--
-- No se setea cancelled_by/cancelled_late: dejarlos NULL evita la única
-- excepción del trigger (cancelación TARDÍA del propio usuario, que no
-- reembolsa como penalidad) — no aplica acá, es limpieza de pagos de prueba.
--
-- Correr en el SQL editor de Supabase, PASO A PASO — no todo de una.

-- ── Paso 1: confirmar que son estas 3 y que están 'aprobado' antes de tocar nada ──
select id, status, payment_status, payment_id, amount, scheduled_date, created_at
from public.bookings
where id::text like '2c72b126%'
   or id::text like '51b36c93%'
   or id::text like '5948c59d%';

-- Verificar en el resultado: las 3 filas, payment_status = 'aprobado',
-- status distinto de 'cancelada' ya. Si alguna no matchea esto, PARAR y
-- revisar antes de seguir — el WHERE del paso 2 es deliberadamente estricto
-- (payment_status = 'aprobado') para no tocar nada que no corresponda.

-- ── Paso 2: cancelar (dispara el trigger de reembolso) ──
update public.bookings
set status = 'cancelada'
where id::text in (
  select id::text from public.bookings
  where (id::text like '2c72b126%' or id::text like '51b36c93%' or id::text like '5948c59d%')
    and payment_status = 'aprobado'
);

-- ── Paso 3: verificar que el trigger marcó reembolso_pendiente ──
select id, status, payment_status, refund_attempts
from public.bookings
where id::text like '2c72b126%'
   or id::text like '51b36c93%'
   or id::text like '5948c59d%';

-- Debería mostrar status='cancelada', payment_status='reembolso_pendiente'
-- en las 3. El reembolso real contra MP lo hace mp-process-refunds en su
-- próxima corrida (cron cada 5 min) — no hace falta invocar nada a mano.
-- Para confirmar que se completó, volver a correr el select del paso 3 en
-- ~10 min: payment_status debería pasar a 'reembolsado'.
