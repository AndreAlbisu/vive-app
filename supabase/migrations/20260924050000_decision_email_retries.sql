-- Las decisiones de postulación son el único canal de aviso para quien quedó
-- fuera de la app. Reintentar sin vencimiento, con espera creciente, exige
-- distinguirlas de los avisos de reservas que caducan a las tres horas.
alter table public.notifications
  add column if not exists mail_retry_after timestamptz,
  add column if not exists mail_attempts integer not null default 0,
  add column if not exists mail_completed_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_mail_attempts_nonnegative;
alter table public.notifications
  add constraint notifications_mail_attempts_nonnegative check (mail_attempts >= 0);

-- No mandar de golpe decisiones históricas que el mecanismo anterior ya dio
-- por vencidas. Las de las últimas tres horas siguen pendientes para el cron.
-- Las decisiones creadas DESPUÉS de esta migración no caducan.
update public.notifications
   set emailed_at = now()
 where type in ('postulacion_aprobada', 'postulacion_rechazada')
   and emailed_at is null
   and created_at < now() - interval '3 hours';

-- `emailed_at` se usaba tanto para reservar como para indicar que terminó.
-- Las filas anteriores no deben confundirse con una reserva recuperable.
update public.notifications
   set mail_completed_at = emailed_at
 where type in ('postulacion_aprobada', 'postulacion_rechazada')
   and emailed_at is not null
   and mail_completed_at is null;

create index if not exists notifications_decision_mail_retry_idx
  on public.notifications (mail_retry_after, created_at)
  where emailed_at is null
    and type in ('postulacion_aprobada', 'postulacion_rechazada');
