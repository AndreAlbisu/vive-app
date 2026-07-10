-- coach_rebooking_stats
-- Agregado por coach para el ranking del deck de Conexiones (criterio v1, sección 4 del spec).
-- Expone SOLO números agregados por coach; nunca filas de bookings individuales.
--
-- PRIVACIDAD (el motivo de que esto sea server-side y no cliente):
--   La tasa se calcula sobre TODOS los bookings de la plataforma, pero un usuario
--   NO puede leer bookings de terceros (RLS). Por eso la vista corre con permisos
--   del OWNER (security_invoker = false) y solo se hace GRANT de la vista, no de
--   public.bookings. Así el cliente lee el agregado sin poder acceder a los datos
--   crudos de otros usuarios.
--
-- SEMÁNTICA (definiciones cerradas en el spec):
--   - coach_id = coaches.id (no profiles.id).
--   - Todo en USUARIOS DISTINTOS, no filas: per_user tiene una fila por (usuario, coach).
--   - completadas_count = usuarios distintos con >=1 booking 'completada' con el coach.
--   - rebookers_count   = de esos, cuantos "volvieron a agendar" = tienen algun booking
--                         creado despues de su primer booking con el coach (cualquier
--                         status posterior cuenta; una 2da reserva aunque se cancele ya
--                         es senal de intencion de volver).
--   - rebooking_rate    = rebookers / completadas, NULL si completadas < 5 (piso minimo
--                         de muestra: por debajo se considera "sin dato suficiente" y el
--                         cliente cae a rating).
--   - Rate GLOBAL del coach (no por tema/puerta) para v1.
--
-- SUPUESTO: public.bookings tiene columna created_at (timestamp de creacion del booking).
--   Uso created_at (el ACTO de reservar de nuevo), no scheduled_date, para "posterior":
--   "volvio a agendar" = hizo una reserva mas tarde, no que la sesion sea en fecha posterior.
--
-- REFRESCO: vista en vivo (siempre fresca). Si crece el volumen y se pone lenta,
--   convertir a MATERIALIZED VIEW refrescada por cron (mismo patron que complete_confirmed_sessions()).

create or replace view public.coach_rebooking_stats
with (security_invoker = false) as
with first_booking as (
  select user_id, coach_id, min(created_at) as first_created
  from public.bookings
  group by user_id, coach_id
),
per_user as (
  select
    b.coach_id,
    b.user_id,
    bool_or(b.status = 'completada')          as has_completed,
    bool_or(b.created_at > fb.first_created)  as has_rebooked
  from public.bookings b
  join first_booking fb
    on fb.user_id = b.user_id
   and fb.coach_id = b.coach_id
  group by b.coach_id, b.user_id
)
select
  coach_id,
  count(*) filter (where has_completed)                  as completadas_count,
  count(*) filter (where has_completed and has_rebooked) as rebookers_count,
  case
    when count(*) filter (where has_completed) >= 5
      then round(
        count(*) filter (where has_completed and has_rebooked)::numeric
          / nullif(count(*) filter (where has_completed), 0),
        3
      )
    else null
  end                                                    as rebooking_rate
from per_user
group by coach_id;

grant select on public.coach_rebooking_stats to anon, authenticated;
