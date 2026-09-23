-- Run only after deploying the payment-integrity migration and the
-- reconcile-paid-effects Edge Function. Requires the existing Vault secret.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    raise exception 'Falta service_role_key en Vault';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
     like '%PEGAR_SERVICE_ROLE_KEY%' then
    raise exception 'service_role_key contiene un placeholder';
  end if;
end $$;

select cron.schedule('reconcile-paid-effects', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/reconcile-paid-effects',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )),
    body := '{}'::jsonb
  );
$$);
