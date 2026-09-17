-- add-contact-signals-purge.sql
--
-- Los avisos de contacto se borran a los 12 meses.
--
-- ✅ CORRIDO y VERIFICADO el 17/09/2026 desde el CLI.
--
-- Por qué: la Política de Privacidad (§10) dice cuánto se conservan estos
-- registros, y un plazo escrito que nadie hace cumplir es una promesa falsa. Hasta
-- hoy no había ningún borrado: los avisos se habrían acumulado para siempre, con
-- las dos cuentas involucradas adentro.
--
-- Por qué 12 meses: el panel mira 90 días, pero la reiteración de un
-- profesional se evalúa en un plazo más largo. Más de un año ya no dice nada
-- sobre cómo trabaja hoy.
--
-- ⚠️ Solo este evento. El resto de la analítica no guarda cuentas en las
-- propiedades y tiene su propio tratamiento en la Política.
-- ⚠️ Las sanciones NO se borran acá: son el registro de una decisión, y se
-- conservan con la cuenta del profesional (ver Política §10).

select cron.schedule(
  'purge-contact-signals',
  '23 6 * * *',   -- 03:23 en Argentina, fuera de cualquier uso
  $$
  delete from public.analytics_events
   where event_name = 'mensaje_contacto_detectado'
     and created_at < now() - interval '12 months';
  $$
);

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- select jobname, schedule, active from cron.job where jobname = 'purge-contact-signals';
-- select status, return_message from cron.job_run_details
--  where jobid = (select jobid from cron.job where jobname = 'purge-contact-signals')
--  order by start_time desc limit 3;
