-- coach_availability_status
-- Disponibilidad AUTOMÁTICA del coach para el badge que ve el usuario en
-- Conexiones (reemplaza cualquier cálculo manual). Expone SOLO un enum por coach.
--
-- PRIVACIDAD (mismo motivo que coach_trending_stats / coach_rebooking_stats):
--   El cálculo cruza contra TODOS los bookings de la plataforma para saber qué
--   slots están tomados, pero un usuario NO puede leer bookings de terceros (RLS).
--   Por eso la vista corre con permisos del OWNER (security_invoker = false) y se
--   hace GRANT de la vista, no de public.bookings.
--
-- ESTADO por coach:
--   'this_week'    → tiene ≥1 slot LIBRE (no bloqueado y sin reserva confirmada/
--                    pendiente) en los próximos 7 días.
--   'responds_24h' → activo (availability_status='activo') pero sin slot libre
--                    en la ventana (agenda llena o sin slots cargados).
--   null           → en pausa (availability_status='en_pausa').
--
-- Refina la v1 de lib/coachAvailability.ts (que marcaba "con lugar" con solo
-- existir un slot no bloqueado, sin cruzar bookings). Acá sí distingue libre vs.
-- ocupado.
--
-- Formato de hora: coach_availability.time y bookings.scheduled_time salen del
-- mismo slot ("H:MM", ej. "9:00", vía lib/availabilityGenerator.formatTime). El
-- lpad/split_part normaliza el cero inicial y cubre el caso de que scheduled_time
-- sea columna `time` ("09:00:00") — verificado 16/07.

create or replace view public.coach_availability_status
with (security_invoker = false) as
select
  c.id as coach_id,
  case
    when exists (
      select 1
      from public.coach_availability a
      where a.coach_id = c.id
        and a.blocked = false
        and a.date >= current_date
        and a.date < current_date + interval '7 days'
        and not exists (
          select 1
          from public.bookings b
          where b.coach_id = c.id
            and b.scheduled_date = a.date
            and lpad(split_part(b.scheduled_time::text, ':', 1), 2, '0') || ':' || split_part(b.scheduled_time::text, ':', 2)
              = lpad(split_part(a.time, ':', 1), 2, '0') || ':' || split_part(a.time, ':', 2)
            and b.status in ('confirmada', 'pendiente')
        )
    ) then 'this_week'
    when c.availability_status = 'activo' then 'responds_24h'
    else null
  end as status
from public.coaches c;

grant select on public.coach_availability_status to anon, authenticated;

-- Consumo previsto: lib/coachAvailability.ts pasa a leer esta vista (una query
-- por los coaches del deck) en vez de calcular en cliente. El toggle manual
-- availability_status ('activo'/'en_pausa') se MANTIENE (es "pausar mi listado",
-- distinto del badge) — decisión Andre 16/07.
