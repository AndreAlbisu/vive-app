-- coach_trending_stats
-- Agregado por coach para el slot "En tendencia" del deck de Conexiones.
-- Expone SOLO un número agregado por coach; nunca filas de bookings individuales.
--
-- PRIVACIDAD (mismo motivo que coach_rebooking_stats — por eso es server-side):
--   La señal se calcula sobre TODOS los bookings de la plataforma, pero un usuario
--   NO puede leer bookings de terceros (RLS). La vista corre con permisos del OWNER
--   (security_invoker = false) y solo se hace GRANT de la vista, no de public.bookings.
--
-- SEMÁNTICA:
--   - coach_id = coaches.id (no profiles.id).
--   - recent_bookers = USUARIOS DISTINTOS que reservaron a ese coach en los últimos
--     30 días (por created_at, el ACTO de reservar). Distintos usuarios y no filas
--     para que un mismo usuario reservando varias veces no infle la tendencia.
--   - Se excluyen las reservas 'cancelada' (una reserva cancelada no es "elegir al coach").
--   - Ventana: created_at >= now() - interval '30 days'.
--
-- REFRESCO: vista en vivo (siempre fresca). Si el volumen la pone lenta, convertir a
--   MATERIALIZED VIEW refrescada por cron (mismo patrón que coach_rebooking_stats).

create or replace view public.coach_trending_stats
with (security_invoker = false) as
select
  coach_id,
  count(distinct user_id) as recent_bookers
from public.bookings
where created_at >= now() - interval '30 days'
  and status <> 'cancelada'
group by coach_id;

grant select on public.coach_trending_stats to anon, authenticated;
