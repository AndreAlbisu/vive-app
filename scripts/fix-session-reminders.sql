-- fix-session-reminders.sql
--
-- 🔴 **`send_session_reminders()` fallaba TODAS las noches y nunca mandó un solo
--    recordatorio.** Encontrado el 21/09/2026 revisando la costura entre el
--    reagendado y los crons que ya existían.
--
--    El motivo es de una línea: `to_char(b.scheduled_time, 'HH24:MI')`, y
--    **`scheduled_time` es `text`**, no `time`. En Postgres no existe
--    `to_char(text, text)`, así que la función levantaba
--    `42883: function to_char(text, unknown) does not exist` cada vez que había
--    una sesión al día siguiente. Verificado contra producción con una sesión
--    real agendada para mañana: **0 recordatorios enviados en toda la historia
--    de la tabla.**
--
--    Como plpgsql resuelve los tipos recién al ejecutar, la función se creó sin
--    quejarse y el cron corría "bien" todas las noches. El error moría adentro
--    del job.
--
-- 🔴 **Y una segunda cosa, que sí es nueva: el candado era para siempre.** El
--    `NOT EXISTS` miraba si existía CUALQUIER recordatorio de esa reserva, sin
--    fecha. Con M15 y M16 una sesión se mueve: si se avisó "tu sesión es mañana"
--    el lunes y después la sesión pasó al jueves, el recordatorio del jueves
--    **no se iba a mandar nunca**, porque ya había uno. La persona se quedaba
--    con un aviso de una fecha que ya no existe y sin aviso de la que sí.
--
--    Ahora el candado es "ya le avisé HOY", que protege contra que el job corra
--    dos veces en el día (que es de lo único que tenía que proteger, porque la
--    consulta ya se limita a las sesiones de mañana) y deja pasar el aviso
--    nuevo cuando la sesión se movió.

create or replace function public.send_session_reminders()
returns void
language plpgsql security definer as $$
begin
  insert into public.notifications (recipient_id, type, booking_id, title, body)
  select
    b.user_id,
    'recordatorio_sesion',
    b.id,
    'Tu sesión es mañana',
    'Tenés una sesión con ' || coalesce(b.coach_name, 'tu profesional') ||
    -- `left(...,5)` y no `to_char`: la hora está guardada como texto 'HH:MM'.
    ' mañana a las ' || left(b.scheduled_time, 5) || ' hs. Anotalo para no olvidarte.'
  from public.bookings b
  where b.status = 'confirmada'
    and b.scheduled_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date + 1
    and not exists (
      select 1 from public.notifications n
      where n.booking_id = b.id
        and n.type = 'recordatorio_sesion'
        -- Solo el de HOY. Ver la nota de arriba sobre las sesiones que se mueven.
        and n.created_at >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    );
end $$;
