-- diagnostico-fuga.sql
--
-- MIRAR, NO CASTIGAR. Consulta de diagnóstico para ver si el patrón de fuga
-- existe de verdad antes de construir cualquier algoritmo que penalice.
--
-- ⚠️ NO CREA NADA: no hay vista, ni tabla, ni trigger. Se pega en el SQL Editor
-- y se lee. Es a propósito — ver "Por qué todavía no hay algoritmo".
--
-- ── Por qué todavía no hay algoritmo (12/09/2026) ────────────────────────────
--
-- 🔴 **No hay muestra.** Al 12/09 hay 12 coaches con al menos una sesión
-- completada y **UNO SOLO** con 5 o más, que es el piso que el propio deck exige
-- para que `rebooking_rate` cuente (`MIN_REBOOKING_SAMPLE`). Penalizar con eso
-- sería castigar ruido: a un coach con 3 clientes, que uno se mude de ciudad lo
-- manda de 33% a 0%.
--
-- 🔴 **Y la métrica que hay mide otra cosa.** `rebooking_rate` baja por cuatro
-- motivos distintos: el que se lleva la gente afuera, el que atiende consultas
-- de una sola vez, el que atiende gente que se cura —el mejor resultado
-- posible— y el que es malo (a ese ya lo penalizan las reseñas). Un número,
-- cuatro causas: castigarlo le pega a tres inocentes por cada culpable.
--
-- La firma de la fuga es más específica: **un cliente que VITA le presentó, que
-- dejó de reservar, y con el que hubo intercambio de contacto.** Las tres cosas
-- juntas. Esta consulta arma las dos primeras; la tercera todavía no se puede
-- (ver abajo).
--
-- ── Criterio de "se cayó" ────────────────────────────────────────────────────
--
-- El MISMO que ya usa `lib/coachContinuity.ts` para la tarjeta del coach, para
-- no inventar un segundo criterio que después no coincida con lo que él ve:
--   · sin próxima sesión agendada;
--   · si tuvo UNA sola sesión: 21 días sin volver;
--   · si tenía ritmo: el doble de su cadencia (mediana de huecos), mínimo 14;
--   · techo de 120 días: más allá no "se está cayendo", ya se fue hace rato.
--
-- ── Lo que esta consulta NO puede ver todavía ────────────────────────────────
--
-- 🔴 El evento `mensaje_contacto_detectado` guarda solo `role` y `sent_anyway`:
-- **no guarda entre quiénes pasó**, así que no se puede cruzar con el par
-- coach-cliente. Sin eso, "se cayó" no distingue fuga de abandono, que es
-- justamente la distinción que importa. Arreglarlo es agregar el par al evento
-- en `SalaScreen`; hasta entonces esta consulta es media señal.
--
-- 📌 `origen = 'link'` es la otra mitad y sí está: al cliente que trajo el coach
-- por su propio link **no se lo cuenta como fuga**. Nunca fue de Vita, y
-- cobrarle por perderlo sería cobrarle por su propia cartera.

with sesiones as (
  select b.coach_id, b.user_id, b.scheduled_date::date as fecha
  from public.bookings b
  where b.status = 'completada'
),
huecos as (
  select
    coach_id, user_id, fecha,
    fecha - lag(fecha) over (partition by coach_id, user_id order by fecha) as hueco
  from sesiones
),
por_par as (
  select
    coach_id,
    user_id,
    count(*)                                                                   as sesiones,
    max(fecha)                                                                 as ultima,
    percentile_cont(0.5) within group (order by hueco)
      filter (where hueco is not null)                                         as cadencia_dias
  from huecos
  group by 1, 2
),
-- Un par con sesión futura agendada no se está cayendo: está esperando.
con_proxima as (
  select distinct coach_id, user_id
  from public.bookings
  where status in ('pendiente', 'confirmada')
    and scheduled_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
),
-- ¿Este cliente lo trajo el coach por su link, o se lo presentó Vita?
procedencia as (
  select coach_id, user_id, bool_or(origen = 'link') as lo_trajo_el_coach
  from public.bookings
  group by 1, 2
),
caidos as (
  select
    p.coach_id,
    p.user_id,
    p.sesiones,
    p.ultima,
    p.cadencia_dias,
    ((now() at time zone 'America/Argentina/Buenos_Aires')::date - p.ultima) as dias_sin_verse,
    case
      when p.cadencia_dias is null then 21                      -- una sola sesión
      else greatest(p.cadencia_dias * 2, 14)                    -- el doble de su ritmo, piso 14
    end as umbral,
    coalesce(pr.lo_trajo_el_coach, false) as lo_trajo_el_coach
  from por_par p
  left join procedencia pr on pr.coach_id = p.coach_id and pr.user_id = p.user_id
  where not exists (
    select 1 from con_proxima c where c.coach_id = p.coach_id and c.user_id = p.user_id
  )
)
select
  c.slug,
  count(*) filter (where q.dias_sin_verse >= q.umbral and q.dias_sin_verse <= 120)                              as caidos,
  count(*) filter (where q.dias_sin_verse >= q.umbral and q.dias_sin_verse <= 120 and not q.lo_trajo_el_coach)  as caidos_que_trajo_vita,
  count(*)                                                                                                      as clientes_sin_proxima,
  (select count(distinct user_id) from sesiones s where s.coach_id = q.coach_id)                                as clientes_con_sesion,
  round(avg(q.dias_sin_verse) filter (where q.dias_sin_verse >= q.umbral), 1)                                   as promedio_dias_sin_verse
from caidos q
join public.coaches c on c.id = q.coach_id
group by c.slug, q.coach_id
having count(*) filter (where q.dias_sin_verse >= q.umbral and q.dias_sin_verse <= 120) > 0
order by caidos_que_trajo_vita desc, caidos desc;

-- ── Cómo leerlo ──────────────────────────────────────────────────────────────
--
-- `caidos_que_trajo_vita` es la columna que importa: clientes que Vita le
-- presentó y dejaron de volver. `caidos` incluye también los que trajo él.
--
-- ⚠️ Un número alto NO prueba fuga: puede ser un coach que atiende consultas
-- únicas, o gente que mejoró. Sirve para MIRAR si hay coaches que se despegan
-- del resto, y para tener con qué comparar cuando haya volumen. La decisión de
-- hacer algo con esto pide la tercera señal y 30-40 coaches con muestra.
