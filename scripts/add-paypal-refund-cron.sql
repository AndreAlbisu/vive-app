-- Cron de `paypal-process-refunds`
-- --------------------------------
-- Gemelo del de Mercado Pago (`add-refund-cron.sql`). Cada riel tiene su
-- procesador y por lo tanto su cron: el trigger marca 'reembolso_pendiente'
-- venga de donde venga el pago, y cada procesador filtra por su
-- `payment_provider`. Si el de PayPal no corre, esas reservas se quedan
-- marcadas para siempre y **nadie recibe su plata de vuelta**, sin ningún error
-- visible.
--
-- Reusa el secret `service_role_key` del Vault, que ya existe desde
-- `add-refund-cron.sql`. Si por algún motivo no estuviera, correr ese primero.

-- ── El chequeo que este proyecto aprendió a golpes ───────────────────────────
-- 🔴 `add-refund-cron.sql` se corrió una vez SIN reemplazar el placeholder: el
-- Vault guardó literalmente el texto '<PEGAR_SERVICE_ROLE_KEY>', el cron mandó
-- eso como Bearer, y el gateway devolvió 401 cada 5 minutos **durante dos
-- semanas y media sin reembolsar a nadie**. Nada falla ruidosamente en ese
-- camino: el job queda `active = true` y la única traza está en
-- `net._http_response`. Este bloque hace que el script se niegue a seguir.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    raise exception
      'Falta el secret service_role_key en el Vault. Corré scripts/add-refund-cron.sql primero.';
  end if;

  if (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
     like '%PEGAR_SERVICE_ROLE_KEY%' then
    raise exception
      'El secret service_role_key tiene el placeholder sin reemplazar. Poné la key real (la nueva sb_secret_…, NO la service_role legacy con formato JWT) con vault.update_secret y volvé a correr.';
  end if;
end $$;

-- ── Agendar (cada 5 min) ─────────────────────────────────────────────────────
-- Idempotente: cron.schedule con el mismo nombre reemplaza el job existente.
-- Lee la key desde Vault en cada corrida (no queda en el command en texto plano).
select cron.schedule(
  'paypal-process-refunds',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/paypal-process-refunds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);


-- ── Verificación ─────────────────────────────────────────────────────────────
-- ⚠️ Que el job aparezca `active = true` NO prueba que funcione. Es la moraleja
-- que este proyecto ya se comió tres veces. Para los que hacen HTTP saliente, la
-- verificación real es la respuesta.
--
-- 1) Que quedó agendado:
--    select jobname, schedule, active from cron.job where jobname = 'paypal-process-refunds';
--
-- 2) 🔴 La que importa — disparar el command a mano y mirar la RESPUESTA:
--    select net.http_post(
--      url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/paypal-process-refunds',
--      headers := jsonb_build_object(
--        'Content-Type', 'application/json',
--        'Authorization', 'Bearer ' || (
--          select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
--        )
--      ),
--      body    := '{}'::jsonb
--    );
--    -- y después, unos segundos más tarde:
--    select status_code, content from net._http_response order by created desc limit 3;
--    -- esperado: 200 {"processed":0,"failed":0}
--    -- un 401 acá significa que la key del Vault no es la que espera la función.
--
-- 3) Reservas trabadas en el dead-letter (ninguna debería quedar ahí):
--    select id, refund_attempts, charged_amount from public.bookings
--     where payment_provider = 'paypal' and payment_status = 'reembolso_pendiente'
--       and refund_attempts >= 6;
--    -- reencolar una = poner refund_attempts en 0.

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- select cron.unschedule('paypal-process-refunds');
