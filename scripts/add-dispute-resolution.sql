-- Cerrar una disputa GANADA: `dispute_resolved_at` y `dispute_outcome`
-- --------------------------------------------------------------------------
-- 🔴 El problema: `reversiones_despues_de_pagar` es la lista de "plata que hay
-- que recuperar o dar por perdida", y una disputa **resuelta a nuestro favor se
-- quedaba ahí para siempre**. La vista mira `disputed_at is not null`, y esa
-- columna no se limpia nunca — ni debe: documenta CUÁNDO SE ABRIÓ la disputa,
-- que es un hecho histórico. Borrarla para sacar la fila de la lista destruiría
-- el único registro de que la disputa existió.
--
-- La salida es una columna nueva y no tocar la vieja.
--
-- 📝 Y a propósito NO se ramifica por `dispute_outcome.outcome_code`. De los
-- enums de la API de disputas se pudo CITAR de la documentación el de `status`
-- (`OPEN`, `WAITING_FOR_SELLER_RESPONSE`, `WAITING_FOR_BUYER_RESPONSE`,
-- `UNDER_REVIEW`, `RESOLVED`), pero no el de `outcome_code`. Este proyecto ya se
-- quemó una vez con un número de comisión recordado en vez de verificado, así
-- que la lógica cuelga del campo que sí está confirmado y el outcome **se guarda
-- crudo** para que lo lea una persona. Mismo criterio que `session_attendance.raw`.

alter table public.bookings
  add column if not exists dispute_resolved_at timestamptz,
  add column if not exists dispute_outcome text;

comment on column public.bookings.dispute_resolved_at is
  'Cuándo PayPal dio la disputa por RESUELTA. Se limpia si la disputa vuelve a abrirse (escalada a chargeback o arbitraje): mientras esté en null la reserva sigue en reversiones_despues_de_pagar.';
comment on column public.bookings.dispute_outcome is
  'El `dispute_outcome.outcome_code` de PayPal, CRUDO y sin interpretar. No se ramifica por él — es para que una persona pueda leer por qué la disputa salió de la lista.';


-- ── La vista deja de contar las disputas ya cerradas ─────────────────────────
-- 🔴 La condición de `payment_status` NO se toca, y es la que sostiene el caso
-- peligroso: si la disputa se resuelve a favor del COMPRADOR, PayPal revierte la
-- captura, `PAYMENT.CAPTURE.REVERSED` deja `payment_status = 'contracargo'` y la
-- fila sigue en la lista por esa vía, no por `disputed_at`.
--
-- ⚠️ Los dos avisos son eventos distintos y PayPal no garantiza el orden: si
-- `RESOLVED` llega antes que `REVERSED`, la fila desaparece de la lista por un
-- rato y vuelve cuando llega la reversión. Es transitorio y se corrige solo; lo
-- que NO puede pasar —y no pasa— es que se quede afuera con la plata devuelta.
create or replace view public.reversiones_despues_de_pagar as
  select
    b.id,
    b.coach_id,
    b.coach_name,
    b.payment_provider,
    b.payment_status,
    b.amount,
    b.currency,
    b.paid_out_at,
    b.payout_reference,
    b.refunded_at,
    b.disputed_at,
    b.dispute_resolved_at,
    b.dispute_outcome
  from public.bookings b
  where b.paid_out_at is not null
    and (b.payment_status in ('contracargo','reembolsado','reembolso_pendiente')
         or (b.disputed_at is not null and b.dispute_resolved_at is null));

comment on view public.reversiones_despues_de_pagar is
  'Reservas donde la plata volvió (o está en disputa ABIERTA) DESPUÉS de habérsela transferido al coach. Cada fila es plata que hay que recuperar o dar por perdida. Una disputa resuelta sin reversión sale de la lista; una resuelta CON reversión se queda por payment_status.';

revoke all on public.reversiones_despues_de_pagar from anon, authenticated;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) Las columnas nuevas:
--
-- select column_name, data_type from information_schema.columns
--  where table_name = 'bookings'
--    and column_name in ('disputed_at','dispute_resolved_at','dispute_outcome');
--
-- 2) La vista compila y hoy debería dar 0 filas:
--
-- select * from public.reversiones_despues_de_pagar;
--
-- 3) 🔴 El caso que motivó todo: una disputa GANADA sale de la lista, y una
--    PERDIDA se queda. El rollback deja todo como estaba.
--
-- begin;
--   -- se fabrica el escenario sobre una reserva cualquiera ya transferida
--   update public.bookings
--      set paid_out_at = coalesce(paid_out_at, now()),
--          disputed_at = now(),
--          dispute_resolved_at = null
--    where id = (select id from public.bookings limit 1);
--   select 'disputa abierta' as caso, count(*) from public.reversiones_despues_de_pagar
--    where id = (select id from public.bookings limit 1);   -- esperado: 1
--
--   update public.bookings set dispute_resolved_at = now()
--    where id = (select id from public.bookings limit 1);
--   select 'ganada' as caso, count(*) from public.reversiones_despues_de_pagar
--    where id = (select id from public.bookings limit 1);   -- esperado: 0
--
--   update public.bookings set payment_status = 'contracargo'
--    where id = (select id from public.bookings limit 1);
--   select 'perdida' as caso, count(*) from public.reversiones_despues_de_pagar
--    where id = (select id from public.bookings limit 1);   -- esperado: 1
-- rollback;


-- ── Revertir ─────────────────────────────────────────────────────────────────
-- ⚠️ Hay que recrear la vista ANTES de borrar las columnas, si no el drop falla
-- por dependencia.
--   create or replace view public.reversiones_despues_de_pagar as ... (versión de add-chargebacks.sql)
--   alter table public.bookings
--     drop column if exists dispute_resolved_at, drop column if exists dispute_outcome;
