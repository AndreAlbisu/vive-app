-- Cron de verificación de cobros en USDT
-- --------------------------------------
-- A diferencia de Mercado Pago, la red Tron no nos notifica nada: no hay
-- webhook. Preguntamos nosotros, cada minuto, si llegó alguna transferencia que
-- corresponda a una reserva pendiente.
--
-- Cada minuto y no cada 5: acá el usuario está mirando la pantalla esperando la
-- confirmación. Con 5 minutos, la mitad de las veces creería que el pago falló.
-- La corrida es barata — una consulta a TronGrid y un cruce en memoria — y si no
-- hay reservas pendientes sale sin llamar a la red.
--
-- Reusa el mismo mecanismo que 'mp-process-refunds': pg_net + la service key
-- leída del Vault en cada corrida, para que no quede en texto plano en el job.
-- Requiere que `scripts/add-refund-cron.sql` ya haya dejado el secreto
-- 'service_role_key' en el Vault (si ese cron anda, ya está).

select cron.schedule(
  'usdt-check-payments',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/usdt-check-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Que quedó agendado:
--   select jobname, schedule, active from cron.job where jobname = 'usdt-check-payments';
--
-- Últimas corridas (mirar que status sea 'succeeded'):
--   select j.jobname, d.status, d.start_time, d.return_message
--     from cron.job_run_details d join cron.job j using (jobid)
--    where j.jobname = 'usdt-check-payments'
--    order by d.start_time desc limit 5;
--
-- ⚠️ Si `return_message` dice que falta el secreto del Vault, corré primero
-- scripts/add-refund-cron.sql — es el que lo deja cargado.

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- select cron.unschedule('usdt-check-payments');
