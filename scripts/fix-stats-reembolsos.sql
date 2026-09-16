-- Las dos vistas del deck contaban como señal positiva la plata devuelta
-- ---------------------------------------------------------------------
-- 🔴 `coach_rebooking_stats` y `coach_trending_stats` colgaban SOLO de
-- `bookings.status`, y `status` no sabe nada de la plata (SCHEMA.md:250).
-- `mp-process-refunds` nunca toca `status` (SCHEMA.md:438), así que una sesión
-- reembolsada por la garantía §9.3 o contracargada sigue siendo 'completada' y
-- le sigue contando al coach para cruzar la barra de "Recomendado por Vita".
--
-- O sea: cuanto peor atiende un coach, más sesiones se le reembolsan, y cada
-- una de esas lo empuja igual hacia arriba en el deck. La garantía —que existe
-- para proteger al usuario— estaba alimentando el ranking del coach.
--
-- QUÉ SE EXCLUYE: 'reembolsado', 'contracargo' y 'reembolso_pendiente', o sea
-- "la plata volvió o está por volver".
--
-- QUÉ **NO** SE EXIGE: que el pago haya estado aprobado. Una reserva con un
-- coach sin Mercado Pago se confirma sin cobro (`BookingScreen_Confirm.tsx`,
-- `confirmedNow`) y queda en 'no_iniciado'; pedir 'aprobado' le borraría
-- sesiones reales a esos coaches y haría desaparecer todo lo anterior a los
-- pagos (agosto 2026).
--
-- Las cancelaciones tempranas del usuario —el grueso de los reembolsos— no se
-- tocan: ya quedaban afuera por `status = 'cancelada'`, y cancelar a tiempo no
-- dice nada del coach. Lo que este filtro saca es el reembolso sobre una sesión
-- que SÍ ocurrió: garantía reclamada y contracargo.
--
-- ⚠️ `payment_status` es NOT NULL con default 'no_iniciado' (SCHEMA.md:381), así
-- que `not in (...)` no tiene el agujero de los NULL. Si alguna vez se vuelve
-- nullable, estas dos vistas empiezan a mentir en silencio.

-- ── Cuánto mueve la aguja HOY (correr ANTES, es solo lectura) ────────────────
--   select payment_status, status, count(*)
--     from public.bookings
--    where payment_status in ('reembolsado','contracargo','reembolso_pendiente')
--    group by 1, 2 order by 3 desc;
-- Si no hay ninguna fila con `status <> 'cancelada'`, el cambio es preventivo y
-- no le mueve el número a nadie — que es el mejor momento para hacerlo.

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
    -- Completó y la plata se quedó donde tenía que quedarse.
    bool_or(
      b.status = 'completada'
      and b.payment_status not in ('reembolsado', 'contracargo', 'reembolso_pendiente')
    )                                         as has_completed,
    -- Completó, punto. Solo para poder CONTAR la diferencia (ver
    -- `reembolsadas_count`); no entra en ningún criterio del deck.
    bool_or(b.status = 'completada')          as has_completed_any,
    -- ⚠️ El reagendamiento se deja como estaba, a propósito: volver a reservar
    -- es una señal de intención, y lo que pase después con esa segunda reserva
    -- no la borra. Además el denominador ya quedó limpio — filtrarlo también
    -- haría que una garantía reclamada castigue dos veces.
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
  end                                                    as rebooking_rate,
  -- Usuarios que ANTES contaban y ahora no: todas sus sesiones completadas con
  -- este coach terminaron con la plata de vuelta. Es exactamente la diferencia
  -- entre la definición vieja y la nueva, y existe para poder EXPLICÁRSELO al
  -- coach en su panel de visibilidad — un número que baja solo, sin que nadie
  -- diga por qué, es peor que el número equivocado.
  --
  -- ⚠️ VA ÚLTIMA Y NO EN EL MEDIO, y no es cosmético: `create or replace view`
  -- solo deja AGREGAR columnas al final. Con la columna nueva antes de
  -- `rebooking_rate`, Postgres lo lee como un intento de RENOMBRAR la tercera
  -- columna y aborta con 42P16. Cualquier columna que se sume más adelante va
  -- también acá abajo, o hay que dropear la vista (y volver a hacer los GRANT).
  count(*) filter (where has_completed_any and not has_completed) as reembolsadas_count
from per_user
group by coach_id;

create or replace view public.coach_trending_stats
with (security_invoker = false) as
select
  coach_id,
  count(distinct user_id) as recent_bookers
from public.bookings
where created_at >= now() - interval '30 days'
  and status <> 'cancelada'
  and payment_status not in ('reembolsado', 'contracargo', 'reembolso_pendiente')
group by coach_id;

grant select on public.coach_rebooking_stats to anon, authenticated;
grant select on public.coach_trending_stats  to anon, authenticated;

-- ── Verificación (después de correr) ─────────────────────────────────────────
-- 1. La columna nueva existe y responde:
--      select coach_id, completadas_count, reembolsadas_count, rebooking_rate
--        from public.coach_rebooking_stats order by completadas_count desc limit 10;
--
-- 2. Los permisos siguen siendo los de antes (`create or replace` los conserva,
--    pero el GRANT de arriba es idempotente y barato):
--      select grantee, privilege_type from information_schema.role_table_grants
--       where table_name in ('coach_rebooking_stats','coach_trending_stats');
--
-- 3. 🔴 La privacidad NO se perdió en el replace — es lo único que si sale mal
--    sale mal en serio, porque estas vistas leen `bookings` de todo el mundo:
--      select relname, reloptions from pg_class
--       where relname in ('coach_rebooking_stats','coach_trending_stats');
--    Tiene que decir `security_invoker=false` en las dos.
