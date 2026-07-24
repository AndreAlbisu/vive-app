-- ============================================================
-- Vita — Cron de procesamiento de reembolsos (mp-process-refunds)
-- Correr en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-07-23
--
-- Cierra el hueco marcado "PENDIENTE, requiere creds" en add-payments-v1.sql (§5).
-- El edge function mp-process-refunds YA está desplegado y ACTIVE, pero nada lo
-- llamaba: las reservas canceladas quedaban en payment_status='reembolso_pendiente'
-- en la DB y el dinero NUNCA se devolvía. Este cron lo dispara cada 5 min.
--
-- mp-process-refunds toma los bookings en 'reembolso_pendiente' con payment_id,
-- llama al refund de MP con el token del coach y los pasa a 'reembolsado'.
-- Autentica chequeando que el Authorization traiga la SERVICE_ROLE_KEY.
--
-- Es el PRIMER cron del proyecto que hace una llamada HTTP saliente (los otros
-- —expire-pending-bookings, complete-confirmed-sessions, session-reminders— son
-- SQL puro). Por eso hay que habilitar pg_net.
--
-- Project ref: ggygiihhnkjrerpinhha
-- Función:     https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/mp-process-refunds
-- ============================================================

-- ── 1) Extensiones ───────────────────────────────────────────────────────────
create extension if not exists pg_net;    -- llamadas HTTP salientes desde SQL
create extension if not exists pg_cron;    -- (ya está, por los otros crons; idempotente)

-- ── 2) Guardar la SERVICE_ROLE_KEY en Vault ──────────────────────────────────
-- NO hardcodear la service key en el command del cron: cron.job.command es texto
-- plano legible por cualquiera con acceso a la DB. Vault la guarda cifrada.
--
-- ⚠️ Reemplazá <PEGAR_SERVICE_ROLE_KEY> por la service_role key real
--    (Dashboard → Project Settings → API → service_role, la secreta).
-- Idempotente: si ya existe el secret 'service_role_key', actualiza el valor.
select vault.create_secret(
  '<PEGAR_SERVICE_ROLE_KEY>',
  'service_role_key',
  'Service role key para que los crons llamen edge functions (mp-process-refunds)'
)
where not exists (
  select 1 from vault.secrets where name = 'service_role_key'
);
-- Si ya existía y querés rotarla, en vez del INSERT de arriba corré:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'),
--     '<PEGAR_SERVICE_ROLE_KEY>'
--   );

-- ── 3) Agendar el cron (cada 5 min) ──────────────────────────────────────────
-- Idempotente: cron.schedule con el mismo nombre reemplaza el job existente.
-- Lee la key desde Vault en cada corrida (no queda en el command en texto plano).
select cron.schedule(
  'mp-process-refunds',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/mp-process-refunds',
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
-- Que quedó el job:
--   select jobname, schedule, active from cron.job where jobname = 'mp-process-refunds';
-- Últimas corridas (status y respuesta):
--   select job_run_details.* from cron.job_run_details
--     join cron.job using (jobid)
--     where cron.job.jobname = 'mp-process-refunds'
--     order by start_time desc limit 5;
-- Respuestas HTTP de pg_net (por si el function devolvió error):
--   select * from net._http_response order by created desc limit 5;

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- select cron.unschedule('mp-process-refunds');
