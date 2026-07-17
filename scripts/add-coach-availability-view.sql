-- add-coach-availability-view.sql  ·  BORRADOR — revisar antes de correr.
--
-- Disponibilidad AUTOMÁTICA del coach (reemplaza cualquier cálculo manual del
-- badge que ve el usuario en Conexiones). Server-side, mismo patrón que
-- coach_trending_stats / coach_rebooking_stats (security_invoker).
--
-- Estado por coach:
--   'this_week'    → tiene al menos un slot LIBRE (no bloqueado y sin reserva)
--                    en los próximos 7 días.
--   'responds_24h' → activo (availability_status='activo') pero sin slot libre
--                    en la ventana (agenda llena o sin slots cargados).
--   null           → en pausa (availability_status='en_pausa').
--
-- Refina la v1 de lib/coachAvailability.ts, que marcaba "con lugar" con solo
-- existir un slot no bloqueado SIN cruzar contra bookings (documentado como
-- aceptable). Acá sí se cruza para distinguir libre vs. ocupado.
--
-- ⚠️ VERIFICAR ANTES DE CORRER — formato de hora:
--   coach_availability.time es texto "H:MM" (ej. "9:00", "13:30") y
--   bookings.scheduled_time puede estar como "HH:MM:SS" o "H:MM". El JOIN de
--   abajo compara con LEFT(...,5) tras normalizar el cero inicial, pero conviene
--   confirmar los valores reales con:
--     select distinct time from coach_availability limit 20;
--     select distinct scheduled_time from bookings limit 20;
--   y ajustar la normalización si hace falta. NO correr a ciegas.

create or replace view public.coach_availability_status
with (security_invoker = true) as
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
            -- normalización defensiva de formato de hora (ver nota de arriba)
            and lpad(split_part(b.scheduled_time::text, ':', 1), 2, '0') || ':' || split_part(b.scheduled_time::text, ':', 2)
              = lpad(split_part(a.time, ':', 1), 2, '0') || ':' || split_part(a.time, ':', 2)
            and b.status in ('confirmada', 'pendiente')
        )
    ) then 'this_week'
    when c.availability_status = 'activo' then 'responds_24h'
    else null
  end as status
from public.coaches c;

-- Consumo previsto: lib/coachAvailability.ts pasa a leer esta vista (una query
-- por los coaches del deck) en vez de calcular en cliente. El toggle manual
-- availability_status ('activo'/'en_pausa') se MANTIENE (es "pausar mi listado",
-- distinto del badge) — decisión Andre 16/07.
