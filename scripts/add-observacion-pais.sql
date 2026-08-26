-- Dónde estaba quien reservó — D2 de `docs/decisiones-pagos.md`
-- --------------------------------------------------------------
-- 🔴 Hoy el sistema **no sabe** cuáles operaciones son internacionales. Lo
-- infería del RIEL de pago, y el riel lo elige el usuario: un argentino que paga
-- con PayPal generaba algo que parecía exportación y no lo era.
--
-- ⚠️ Esto ya NO decide la comisión (eso sale del riel, y está bien que así sea:
-- la comisión cubre lo que cuesta cobrar). Sirve para dos cosas: poder decirle la
-- verdad al profesional sobre su propia situación fiscal, y tener con qué
-- responder cuando el contador conteste.

-- ── La regla que ordena todo esto ────────────────────────────────────────────
-- 🔴 **Se guardan OBSERVACIONES; la clasificación se DERIVA.** Nunca se persiste
-- `es_internacional` como si fuera un hecho.
--
-- El motivo es concreto: **la respuesta del contador puede definir el criterio
-- distinto de como se asume hoy.** Con un booleano guardado, aplicar el criterio
-- nuevo obligaría a reescribir historia. Con la observación cruda, se vuelve a
-- derivar y no se toca ninguna fila.
--
-- Por eso tampoco se guarda el PAÍS: el país ya es una lectura de la zona
-- horaria. Se guarda la zona, que es lo que el dispositivo dijo.

alter table public.bookings
  add column if not exists user_tz_observed        text,
  add column if not exists user_observation_source text,
  add column if not exists user_observed_at        timestamptz;

comment on column public.bookings.user_tz_observed is
  'Zona horaria del dispositivo al reservar, cruda (ej. America/Argentina/Buenos_Aires). Observación, no conclusión.';
comment on column public.bookings.user_observation_source is
  'De dónde salió el dato. Importa tanto como el valor: las tres fuentes tienen confiabilidades muy distintas.';
comment on column public.bookings.user_observed_at is
  'Cuándo se observó. La reserva es un PROXY del hecho fiscal: el servicio se aprovecha en la sesión, y quien reserva puede viajar en el medio.';

alter table public.bookings drop constraint if exists bookings_observation_source_check;
alter table public.bookings add constraint bookings_observation_source_check
  check (user_observation_source is null
         or user_observation_source in ('timezone', 'declarado', 'ip'));

-- El cliente escribe la observación AL CREAR la reserva, y solo ahí.
grant insert (user_tz_observed, user_observation_source, user_observed_at)
  on public.bookings to authenticated;

-- 🔴 Y NO puede modificarla después: una observación que su propio observado
-- puede editar no es una observación. No se agrega a los `grant update`.

-- ── La clasificación, derivada y en UN solo lugar ────────────────────────────
-- 🔴 Este es el lugar que va a cambiar cuando el contador conteste, y por eso es
-- uno solo. Hoy aplica el criterio que se asume: **dónde se aprovecha el
-- servicio**, aproximado por dónde estaba quien reservó.
--
-- ⚠️ El criterio NO está confirmado. Puede resultar que dependa del domicilio
-- fiscal del profesional (D12) y no del cliente, o de las dos cosas. Cuando eso
-- se sepa, se reescribe esta vista y **ninguna fila se toca**.
create or replace view public.clasificacion_de_operaciones as
  select
    b.id                       as booking_id,
    b.scheduled_date,
    b.payment_provider         as riel,
    b.amount,
    b.currency,
    b.platform_fee_pct,
    b.payment_status,
    b.user_tz_observed,
    b.user_observation_source,
    case
      -- Sin observación no se supone nada. 🔴 El nulo se trata como **"sin
      -- clasificar"**, NUNCA como "local": un default silencioso es
      -- indistinguible de un dato real a los seis meses.
      when b.user_tz_observed is null then 'sin_clasificar'
      -- Las dos formas que usan los dispositivos para la Argentina: la moderna
      -- (America/Argentina/Buenos_Aires) y el alias viejo (America/Buenos_Aires),
      -- que sigue apareciendo en equipos que no actualizaron su base de zonas.
      when b.user_tz_observed like 'America/Argentina/%'
        or b.user_tz_observed = 'America/Buenos_Aires' then 'mercado_interno'
      else 'exterior'
    end as clasificacion
  from public.bookings b;

comment on view public.clasificacion_de_operaciones is
  'Clasificación fiscal DERIVADA de la observación. Es el único lugar donde vive el criterio: cuando el contador conteste, se reescribe acá y no se toca ninguna fila.';

revoke all on public.clasificacion_de_operaciones from anon, authenticated;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) Las columnas y el CHECK:
--    select column_name from information_schema.columns
--     where table_name = 'bookings' and column_name like 'user_%observ%';
--
-- 2) 🔴 Todas las reservas viejas tienen que quedar en 'sin_clasificar', NO en
--    'mercado_interno'. Si alguna sale clasificada, algo derivó de la nada:
--    select clasificacion, count(*) from public.clasificacion_de_operaciones
--     group by 1;
--    -- esperado hoy: sin_clasificar = todas
--
-- 3) El CHECK rechaza una fuente inventada (DEBE fallar):
--    update public.bookings set user_observation_source = 'adivinado'
--     where id = (select id from public.bookings limit 1);

-- ── Revertir ─────────────────────────────────────────────────────────────────
--   drop view if exists public.clasificacion_de_operaciones;
--   alter table public.bookings
--     drop constraint if exists bookings_observation_source_check,
--     drop column if exists user_tz_observed,
--     drop column if exists user_observation_source,
--     drop column if exists user_observed_at;
