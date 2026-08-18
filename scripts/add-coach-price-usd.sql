-- `coaches.price_usd` — precio de la sesión internacional, en dólares
-- -------------------------------------------------------------------
-- Lo fija el coach, igual que `price_per_session` en pesos. No se deriva de una
-- cotización a propósito: convertir dejaría a VIVE en el medio de una discusión
-- de tipo de cambio cada vez que el dólar se mueve, y el precio de afuera es una
-- decisión comercial distinta de la de acá (quien cobra en euros paga otra cosa).
--
-- ⚠️ ENTERO, no numeric. El cobro en USDT identifica cada reserva por un monto
-- único donde **los decimales son el identificador** (ver _shared/usdt.ts): un
-- precio con decimales se le sumaría y lo corrompería, dejando la transferencia
-- irreconocible. La restricción es barata: las sesiones de afuera se cotizan en
-- dólares redondos.

alter table public.coaches
  add column if not exists price_usd integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coaches_price_usd_check') then
    alter table public.coaches
      add constraint coaches_price_usd_check
      check (price_usd is null or (price_usd > 0 and price_usd <= 10000));
  end if;
end $$;

-- Sin esto el campo no se puede guardar desde la app: `lock-privileged-columns.sql`
-- hace `revoke update` sobre coaches y otorga columna por columna, y desde el
-- cliente la falta de permiso se ve como 0 filas afectadas, sin error.
grant update (price_usd) on public.coaches to authenticated;

comment on column public.coaches.price_usd is
  'Precio en USD (entero) de la sesion internacional. NULL = el coach todavia no lo fijo.';

-- ── Regla de completitud, a nivel de consulta y NO como CHECK ────────────────
-- Un coach solo puede recibir reservas del exterior si tiene las tres cosas:
--   accepts_international = true
--   price_usd is not null
--   una fila en coach_payout_accounts
-- Se deja fuera de un CHECK a propósito: un CHECK haría fallar el toggle cuando
-- el coach lo activa ANTES de cargar precio y datos de cobro, y desde el cliente
-- eso se ve como un guardado que no pasa nada. Mejor dejarlo activar y filtrarlo
-- en el catálogo, mostrándole qué le falta.

-- Coaches listos para internacional (esta es la consulta del catálogo):
-- select c.id, p.name, c.price_usd, pa.method
--   from public.coaches c
--   join public.profiles p on p.id = c.profile_id
--   join public.coach_payout_accounts pa on pa.coach_id = c.id
--  where c.accepts_international and c.price_usd is not null;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_name='coaches' and column_name='price_usd';
-- Debe FALLAR: update public.coaches set price_usd = 0 where id = (select id from public.coaches limit 1);
