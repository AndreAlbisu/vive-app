-- Verificación del riel de PayPal — SOLO LECTURA
-- ---------------------------------------------
-- Correr DESPUÉS de `add-paypal-rail.sql` y `add-paypal-refund-cron.sql`.
-- Devuelve una fila por chequeo. Todas tienen que decir OK.
--
-- Existe porque el estado real y el changelog se desincronizaron: al 24/08/2026
-- `bookings.charged_amount` YA estaba en la base y los dos documentos la daban
-- por pendiente. Un `add column if not exists` no distingue "lo creé" de "ya
-- estaba", así que la única forma de saber es preguntar.

with checks as (

  -- 1. La columna que las tres funciones de PayPal escriben o leen.
  --    Sin ella `paypal-create-payment` falla el insert y no hay cobro.
  select 1 as n, 'bookings.charged_amount existe' as chequeo,
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'bookings'
                    and column_name = 'charged_amount') as ok,
         coalesce((select data_type from information_schema.columns
                    where table_schema = 'public' and table_name = 'bookings'
                      and column_name = 'charged_amount'), 'AUSENTE') as detalle

  -- 2. El piso de USD 20. Abajo de eso el fijo de PayPal (USD 0,30) deja de ser
  --    ruido: sobre USD 1 el recargo es +37%.
  union all
  select 2, 'CHECK price_usd >= 20',
         exists (select 1 from pg_constraint
                  where conname = 'coaches_price_usd_check'
                    and pg_get_constraintdef(oid) like '%20%'),
         coalesce((select pg_get_constraintdef(oid) from pg_constraint
                    where conname = 'coaches_price_usd_check'), 'AUSENTE')

  -- 3. Ningún coach por debajo del piso. Si el CHECK existe esto es redundante,
  --    pero si el CHECK falta es lo que dice por qué no se pudo crear.
  union all
  select 3, 'ningún coach con price_usd < 20',
         not exists (select 1 from coaches where price_usd is not null and price_usd < 20),
         coalesce((select string_agg(id::text || '=' || price_usd, ', ')
                     from coaches where price_usd is not null), 'ninguno con precio')

  -- 4. La función que libera horarios tiene que conocer los TRES rieles. Una
  --    reserva de PayPal abandonada sin esto se queda 'pendiente' para siempre
  --    ocupando el horario (la vista de disponibilidad cuenta 'pendiente').
  union all
  select 4, 'expire_unpaid_checkouts cubre paypal',
         coalesce((select prosrc like '%paypal%' from pg_proc
                    where proname = 'expire_unpaid_checkouts'), false),
         case when exists (select 1 from pg_proc where proname = 'expire_unpaid_checkouts')
              then 'existe; cubre MP=' ||
                   (select (prosrc like '%preference_id%')::text from pg_proc where proname = 'expire_unpaid_checkouts') ||
                   ' usdt=' ||
                   (select (prosrc like '%usdt_amount%')::text from pg_proc where proname = 'expire_unpaid_checkouts')
              else 'FUNCIÓN AUSENTE' end

  -- 5. Sin este cron, las reservas marcadas 'reembolso_pendiente' del riel de
  --    PayPal se quedan así para siempre y nadie recibe su plata. Sin error.
  union all
  select 5, 'cron paypal-process-refunds activo',
         coalesce((select active from cron.job where jobname = 'paypal-process-refunds'), false),
         coalesce((select schedule from cron.job where jobname = 'paypal-process-refunds'), 'NO AGENDADO')

  -- 6. El de Mercado Pago, de control: si este falta, falta algo más grande.
  union all
  select 6, 'cron mp-process-refunds activo',
         coalesce((select active from cron.job where jobname = 'mp-process-refunds'), false),
         coalesce((select schedule from cron.job where jobname = 'mp-process-refunds'), 'NO AGENDADO')

  -- 7. 🔴 El error que costó dos semanas y media de reembolsos sin procesar:
  --    el Vault guardó el texto '<PEGAR_SERVICE_ROLE_KEY>' y el cron mandó eso
  --    como Bearer. El job figuraba active = true todo ese tiempo.
  union all
  select 7, 'service_role_key sin placeholder',
         coalesce((select decrypted_secret not like '%PEGAR_SERVICE_ROLE_KEY%'
                     from vault.decrypted_secrets where name = 'service_role_key'), false),
         case when not exists (select 1 from vault.secrets where name = 'service_role_key')
              then 'SECRET AUSENTE — correr add-refund-cron.sql'
              else 'presente, largo=' ||
                   (select length(decrypted_secret)::text from vault.decrypted_secrets
                     where name = 'service_role_key') end

  -- 8. Dead-letter: reembolsos que agotaron los 6 intentos. Reencolar = poner
  --    refund_attempts en 0.
  --
  --    ⚠️ Al 24/08/2026 esta fila da 🔴 con UNA sola reserva, y es esperado:
  --    `2c72b126-67f9-4844-83fc-0f286958a2da` (riel mp, ARS 1, 09/08). Su pago
  --    se cobró con la cuenta de Mercado Pago ANTERIOR del coach de prueba, y
  --    `mp-process-refunds` siempre usa el token actual — MP contesta 404
  --    "Payment not found" porque el pago no existe *para esa cuenta*.
  --    Reencolarla no sirve: vuelve a fallar igual. Decisión de la sesión 88:
  --    se deja así (es plata de prueba de Andre; si algún día importa, se
  --    reembolsa a mano desde mercadopago.com con la cuenta vieja).
  --    Por eso el detalle lista los IDS: cualquier id distinto a ese, o
  --    cualquier fila con payment_provider = 'paypal', es un caso NUEVO.
  union all
  select 8, 'sin reembolsos trabados en dead-letter',
         not exists (select 1 from bookings
                      where payment_status = 'reembolso_pendiente' and refund_attempts >= 6),
         coalesce((select string_agg(payment_provider || ':' || left(id::text, 8), ', ')
                     from bookings
                    where payment_status = 'reembolso_pendiente' and refund_attempts >= 6),
                  'ninguna')
)
select n, case when ok then 'OK' else '🔴 FALTA' end as estado, chequeo, detalle
  from checks order by n;


-- ── El chequeo que ninguna consulta puede hacer por vos ──────────────────────
-- Que el cron figure `active = true` NO prueba que funcione: el 401 del
-- placeholder también figuraba activo. La prueba real es la respuesta HTTP.
-- Correr aparte, y unos segundos después mirar la respuesta:
--
--   select net.http_post(
--     url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/paypal-process-refunds',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
--       )
--     ),
--     body    := '{}'::jsonb
--   );
--
--   select status_code, content from net._http_response order by created desc limit 3;
--   -- esperado: 200 {"processed":0,"failed":0}
--   -- 401 = la key del Vault no es la que espera la función.
