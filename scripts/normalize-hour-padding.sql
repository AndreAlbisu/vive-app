-- normalize-hour-padding.sql — las horas de texto pasan a HH:MM siempre.
--
-- 🔴 POR QUÉ: `lib/availabilityGenerator.ts` y las pantallas del coach armaban
-- la hora como `7:00`. De ahí la copiaba la reserva, y `scheduledAtMs` (edge
-- functions) exige HH:MM: `create-meeting-room` devolvía 422 y la sala de esas
-- sesiones no se podía abrir (14/09/2026). Medido antes de correr: 51/185
-- bookings, 362/2297 coach_availability, 7/8 coach_weekly_pattern.
--
-- 📌 El trigger es lo importante, no el UPDATE: los builds viejos siguen
-- escribiendo `7:00`, y así la base lo corrige al guardar sin depender de que
-- todos actualicen la app.
--
-- ⚠️ 19 filas de coach_availability existían en las dos formas (`9:00` y
-- `09:00`, mismo coach y día, todas de julio 2026, ninguna bloqueada). Hay un
-- UNIQUE (coach_id, date, time), así que se borra la versión sin cero antes de
-- normalizar. Si una estuviera bloqueada, el bloqueo se conserva en la que queda.

begin;

create or replace function public.normalize_hhmm(t text)
returns text
language sql
immutable
as $$
  select case
    when t ~ '^[0-9]{1,2}:[0-9]{2}'
      then lpad(split_part(t, ':', 1), 2, '0') || ':' || left(split_part(t, ':', 2), 2)
    else t
  end
$$;

-- Duplicados: conservar el bloqueo si lo tenía cualquiera de las dos.
update public.coach_availability con
set blocked = true
from public.coach_availability sin
where sin.coach_id = con.coach_id
  and sin.date = con.date
  and sin.id <> con.id
  and sin.time !~ '^[0-9]{2}:'
  and public.normalize_hhmm(sin.time) = con.time
  and sin.blocked
  and not con.blocked;

delete from public.coach_availability sin
using public.coach_availability con
where sin.coach_id = con.coach_id
  and sin.date = con.date
  and sin.id <> con.id
  and sin.time !~ '^[0-9]{2}:'
  and public.normalize_hhmm(sin.time) = con.time;

update public.coach_availability set time = public.normalize_hhmm(time)
where time is distinct from public.normalize_hhmm(time);

update public.bookings set scheduled_time = public.normalize_hhmm(scheduled_time)
where scheduled_time is distinct from public.normalize_hhmm(scheduled_time);

update public.coach_weekly_pattern
set start_time = public.normalize_hhmm(start_time),
    end_time   = public.normalize_hhmm(end_time)
where start_time is distinct from public.normalize_hhmm(start_time)
   or end_time   is distinct from public.normalize_hhmm(end_time);

-- Triggers: una función por tabla porque las columnas se llaman distinto.
create or replace function public.tg_normalize_availability_time()
returns trigger language plpgsql as $$
begin
  new.time := public.normalize_hhmm(new.time);
  return new;
end $$;

create or replace function public.tg_normalize_booking_time()
returns trigger language plpgsql as $$
begin
  new.scheduled_time := public.normalize_hhmm(new.scheduled_time);
  return new;
end $$;

create or replace function public.tg_normalize_pattern_time()
returns trigger language plpgsql as $$
begin
  new.start_time := public.normalize_hhmm(new.start_time);
  new.end_time   := public.normalize_hhmm(new.end_time);
  return new;
end $$;

drop trigger if exists trg_normalize_availability_time on public.coach_availability;
create trigger trg_normalize_availability_time
  before insert or update of time on public.coach_availability
  for each row execute function public.tg_normalize_availability_time();

drop trigger if exists trg_normalize_booking_time on public.bookings;
create trigger trg_normalize_booking_time
  before insert or update of scheduled_time on public.bookings
  for each row execute function public.tg_normalize_booking_time();

drop trigger if exists trg_normalize_pattern_time on public.coach_weekly_pattern;
create trigger trg_normalize_pattern_time
  before insert or update of start_time, end_time on public.coach_weekly_pattern
  for each row execute function public.tg_normalize_pattern_time();

commit;

-- Verificación (tiene que dar 0 en las tres):
-- select count(*) from bookings where scheduled_time !~ '^[0-9]{2}:[0-9]{2}';
-- select count(*) from coach_availability where time !~ '^[0-9]{2}:[0-9]{2}';
-- select count(*) from coach_weekly_pattern where start_time !~ '^[0-9]{2}:[0-9]{2}' or end_time !~ '^[0-9]{2}:[0-9]{2}';
