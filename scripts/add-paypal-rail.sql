-- Riel de PayPal — schema previo a las edge functions
-- ----------------------------------------------------
-- Tres cambios, todos independientes del código de PayPal: se pueden correr
-- antes de que exista una sola función, y nada los usa hasta entonces.
--
-- ⚠️ ORDEN: este script va ANTES de deployar `paypal-create-payment`. Al revés,
-- la función escribiría una columna inexistente y el cobro fallaría entero.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. `bookings.charged_amount` — lo que se le cobró al cliente
--
-- Hoy `amount` cumple dos papeles que hasta ahora coincidían: el precio del
-- profesional y lo que paga el cliente. Con PayPal dejan de ser lo mismo.
--
-- La comisión de PayPal (5,40% + USD 0,30, confirmada en su tarifa oficial para
-- Argentina) NO sale de la parte del coach: se suma al precio, así que el
-- cliente paga `(precio + 0,30) / 0,946` y el coach sigue cobrando sobre su
-- precio. Eso mantiene exacto el copy de "20% / 15%" — si el costo saliera de
-- adentro, la comisión real sería 21-22% y estaríamos diciendo 15%.
--
-- 🔴 `amount` TIENE que seguir siendo el precio del profesional: es la base con
-- la que `lib/admin.ts` calcula cuánto transferirle (`amount × (1 − fee%)`).
-- Si alguien la usa para guardar el total cobrado, todos los coaches del riel
-- internacional cobran de más y nada lo avisa.
--
-- No se aplica a USDT: ahí el total cobrado es `usdt_amount`, que además lleva
-- el identificador del pago en los centavos. Son conceptos distintos y por eso
-- no se unifican.

alter table public.bookings
  add column if not exists charged_amount numeric(12,2);

comment on column public.bookings.charged_amount is
  'Lo que se le cobró al cliente, en `currency`. Distinto de `amount`, que es el precio del profesional y la base del payout. Solo lo usa el riel de PayPal: en USDT el total cobrado es `usdt_amount`.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Mínimo para el precio internacional
--
-- El CHECK actual permite `price_usd` desde 1. Como la comisión fija de PayPal
-- (USD 0,30) no escala, en precios bajos se come todo:
--
--     USD 100 → hay que cobrar 106,03  (+6,0%)
--     USD  60 → 63,74                  (+6,2%)
--     USD  20 → 21,46                  (+7,3%)
--     USD   6 → 6,66                   (+11,0%)
--     USD   1 → 1,37                   (+37%)
--
-- Con un piso de 20 el fijo queda en ruido. Decisión de Andre, 19/08/2026.

-- ⚠️ Este UPDATE va PRIMERO o el CHECK no se puede crear: el coach de prueba
-- tiene price_usd = 6, que es el precio de test que quedó de la sesión 103 y
-- que estaba pendiente de cambiar. Es la única fila con price_usd cargado
-- (verificado contra el REST API el 19/08/2026), así que este UPDATE toca una
-- sola fila y de paso cierra ese pendiente.
update public.coaches
   set price_usd = 60
 where price_usd is not null
   and price_usd < 20;

alter table public.coaches
  drop constraint if exists coaches_price_usd_check;

alter table public.coaches
  add constraint coaches_price_usd_check
  check (price_usd is null or (price_usd >= 20 and price_usd <= 10000));

-- La misma regla está duplicada en `screens/CoachProfileScreen.tsx` para mostrar
-- el error mientras se escribe. La base sigue siendo la frontera; si cambia una,
-- cambia la otra.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Expirar también los checkouts de PayPal abandonados
--
-- Mismo problema que tuvo USDT (`expire-unpaid-usdt.sql`): la función busca los
-- marcadores de los rieles que conoce, y una reserva del riel nuevo no tiene
-- ninguno, así que **se queda 'pendiente' para siempre** ocupando el horario.
--
-- PayPal lleva la ventana de 30 minutos, igual que Mercado Pago: se paga dentro
-- del propio flujo, con tarjeta o saldo. Los 60 de USDT existen porque ahí hay
-- que salir a otra app, buscar el saldo y confirmar en la red.

create or replace function expire_unpaid_checkouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
begin
  for v_booking in
    select id, user_id
    from bookings
    where payment_status = 'pendiente'
      -- Un cobro iniciado, por cualquiera de los TRES rieles.
      and (
        (preference_id is not null and created_at < now() - interval '30 minutes')
        or
        (usdt_amount is not null and created_at < now() - interval '60 minutes')
        or
        (payment_provider = 'paypal' and created_at < now() - interval '30 minutes')
      )
      -- Solo estados vivos. 'completada' y 'cancelada' quedan afuera a propósito:
      -- no se reescribe historia, esto previene casos nuevos.
      and status in ('pendiente', 'confirmada')
  loop
    update bookings
       set status = 'cancelada'
     where id = v_booking.id;

    insert into notifications (recipient_id, type, booking_id, title, body)
    values (
      v_booking.user_id,
      'reserva_cancelada',
      v_booking.id,
      'Reserva cancelada',
      'No se completó el pago, así que liberamos ese horario. Podés reservarlo de nuevo cuando quieras.'
    );
  end loop;
end;
$$;

-- El cron ('expire-unpaid-checkouts', cada 5 min) llama a esta misma función.
-- No hay que reagendarlo.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
--
-- 1) La columna existe:
--    select column_name, data_type from information_schema.columns
--     where table_name = 'bookings' and column_name = 'charged_amount';
--
-- 2) El coach de prueba quedó arriba del mínimo, y no quedó ninguno abajo:
--    select id, price_usd from public.coaches where price_usd is not null;
--    -- esperado: ninguna fila con price_usd < 20
--
-- 3) El CHECK rechaza lo que tiene que rechazar (esto DEBE fallar):
--    update public.coaches set price_usd = 5
--     where price_usd is not null limit 1;
--    -- esperado: ERROR ... viola la restricción «coaches_price_usd_check»
--
-- 4) La función reconoce los tres rieles:
--    select prosrc like '%paypal%' as cubre_paypal
--      from pg_proc where proname = 'expire_unpaid_checkouts';
