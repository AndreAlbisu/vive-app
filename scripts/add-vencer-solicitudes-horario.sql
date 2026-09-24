-- add-vencer-solicitudes-horario.sql
--
-- Las solicitudes de cambio de horario que ya pasaron se vencen solas
-- (24/09/2026, reportado por Andre: *"no se vencen las solicitudes de cambios de
-- horario que ya pasaron"*).
--
-- 🔴 El agujero: `reschedule_requests` solo cambiaba de estado cuando ALGUIEN
-- respondía. `responder_reagendado` ya se defiende —si el horario propuesto
-- quedó en el pasado marca la solicitud `vencida` en vez de mover la sesión—
-- pero eso pasa únicamente si el otro entra a responder. Si nadie contesta, la
-- fila queda `pendiente` para siempre, y eso se ve:
--
--   · el cliente sigue con la tarjeta "no puede a esa hora, te propone estos
--     horarios" ofreciéndole horarios que ya pasaron;
--   · el profesional sigue con el pedido en Reservas, pidiéndole una respuesta
--     sobre algo que ya no existe.
--
-- Se vencen dos casos, los dos sin ambigüedad:
--   1. el horario PROPUESTO ya pasó;
--   2. la reserva ya no está confirmada (se canceló o se completó), así que no
--      hay nada que mover.
--
-- 📌 No avisa a nadie, a propósito. Un aviso de "venció una propuesta que nadie
-- respondió" es ruido sobre una sesión que, en el caso 1, ya pasó. Lo que sí
-- hace falta es que la pantalla deje de pedir una acción imposible.
--
-- Fecha: 2026-09-24

begin;

create or replace function public.vencer_solicitudes_horario()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n integer;
begin
  update public.reschedule_requests r
     set estado = 'vencida', resolved_at = now()
   from public.bookings b
   where r.booking_id = b.id
     and r.estado = 'pendiente'
     and (
       public.inicio_de_sesion(r.fecha, r.hora) <= now()
       or b.status <> 'confirmada'
     );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Solo el cron (service role). Nadie más tiene por qué vencer solicitudes.
revoke all on function public.vencer_solicitudes_horario() from public, anon, authenticated;
grant execute on function public.vencer_solicitudes_horario() to service_role;

comment on function public.vencer_solicitudes_horario() is
  'Marca vencidas las solicitudes de cambio de horario cuyo destino ya pasó, o cuya reserva dejó de estar confirmada. La corre el cron cada 5 minutos.';

commit;

-- Cada 5 minutos, igual que `expire-pending-bookings` y `complete-sessions`.
select cron.schedule('vencer-solicitudes-horario', '*/5 * * * *',
  $$ select public.vencer_solicitudes_horario(); $$);

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare v_n int; v_quedan int; v_job int;
begin
  -- Corre una vez sobre los datos reales: hay una pendiente con el horario ya
  -- pasado (medida antes de escribir esto).
  select public.vencer_solicitudes_horario() into v_n;
  insert into _r values ('solicitudes vencidas en esta corrida', v_n::text, v_n >= 1);

  select count(*) into v_quedan from public.reschedule_requests r
    join public.bookings b on b.id = r.booking_id
   where r.estado = 'pendiente'
     and (public.inicio_de_sesion(r.fecha, r.hora) <= now() or b.status <> 'confirmada');
  insert into _r values ('pendientes imposibles que quedan (esperado 0)', v_quedan::text, v_quedan = 0);

  select count(*) into v_job from cron.job where jobname = 'vencer-solicitudes-horario';
  insert into _r values ('el cron quedó programado', v_job::text, v_job = 1);

  select count(*) into v_n from information_schema.routine_privileges
   where routine_name = 'vencer_solicitudes_horario' and grantee in ('anon','authenticated');
  insert into _r values ('nadie más puede ejecutarla (esperado 0)', v_n::text, v_n = 0);
end $$;

select * from _r;
