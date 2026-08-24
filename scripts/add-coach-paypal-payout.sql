-- Tercer método de cobro para el coach: recibir los dólares en su PayPal.
-- ----------------------------------------------------------------------
-- Hasta ahora eran dos: `transferencia` (pesos al CBU) y `usdt` (dólares a una
-- wallet). El que quería DÓLARES estaba obligado a pasar por cripto.
--
-- Verificado el 24/08/2026 antes de escribir esto:
--   · Argentina está soportada por PayPal Payouts — la tabla oficial de países
--     la lista como "Send, receive, and withdraw".
--   · Para Latinoamérica los payouts se mandan en USD, y el receptor puede
--     retirar a su banco en moneda local.
--   · La comisión es 2% del monto y **la paga el emisor**; el receptor no paga
--     nada. Esos 2% los absorbe VIVE (ver `lib/payout.ts`).
--
-- ⚠️ Lo que el coach tiene que entender, y por eso está en su documento: los
-- dólares le llegan a su PayPal, pero bajarlos a un banco ARGENTINO los
-- convierte a pesos al cambio de PayPal — la cuenta destino tiene que ser en
-- pesos, los retiros a cuentas locales en dólares se revierten. Quedarse con
-- dólares de verdad requiere dejarlos en PayPal o tener cuenta en EEUU.

-- ── 1. El método nuevo ───────────────────────────────────────────────────────
alter table public.coach_payout_accounts
  drop constraint if exists coach_payout_accounts_method_check;

alter table public.coach_payout_accounts
  add constraint coach_payout_accounts_method_check
  check (method in ('transferencia', 'usdt', 'paypal'));

-- ── 2. El destino ────────────────────────────────────────────────────────────
alter table public.coach_payout_accounts
  add column if not exists paypal_email text;

comment on column public.coach_payout_accounts.paypal_email is
  'Mail de la cuenta de PayPal del coach, destino del payout. Solo con method = paypal.';

-- ── 3. Coherencia: cada método exige SUS campos ──────────────────────────────
-- Mismo criterio que los dos constraints que ya existían. Sin esto se puede
-- guardar method='paypal' sin mail y el error recién aparece al ir a pagar.
alter table public.coach_payout_accounts
  drop constraint if exists payout_paypal_completa;

alter table public.coach_payout_accounts
  add constraint payout_paypal_completa
  check (method <> 'paypal' or paypal_email is not null);

-- Formato. Deliberadamente laxo, a diferencia del de la wallet: un mail mal
-- escrito **no pierde los fondos** — PayPal rebota el payout y la plata vuelve
-- al saldo de VIVE. Una dirección de cripto mal escrita, en cambio, no rebota.
-- La misma regla está en `paypalEmailError` de `lib/payout.ts`; si cambia una,
-- cambia la otra.
alter table public.coach_payout_accounts
  drop constraint if exists payout_paypal_formato;

alter table public.coach_payout_accounts
  add constraint payout_paypal_formato
  check (paypal_email is null or paypal_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$');


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) El método nuevo se acepta y los otros dos siguen andando:
--    select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'coach_payout_accounts_method_check';
--    -- esperado: CHECK (method = ANY (ARRAY['transferencia','usdt','paypal']))
--
-- 2) La columna existe:
--    select column_name from information_schema.columns
--     where table_name = 'coach_payout_accounts' and column_name = 'paypal_email';
--
-- 3) 🔴 Los dos CHECK rechazan lo que tienen que rechazar (los dos DEBEN fallar):
--    insert into public.coach_payout_accounts (coach_id, method)
--    values ('00000000-0000-0000-0000-000000000000', 'paypal');
--    -- esperado: viola «payout_paypal_completa»
--
--    insert into public.coach_payout_accounts (coach_id, method, paypal_email)
--    values ('00000000-0000-0000-0000-000000000000', 'paypal', 'no-es-un-mail');
--    -- esperado: viola «payout_paypal_formato»
--
-- 4) Nadie quedó inconsistente (no debería devolver filas):
--    select coach_id, method from public.coach_payout_accounts
--     where method = 'paypal' and paypal_email is null;

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- ⚠️ Volver atrás el CHECK de `method` con coaches ya en 'paypal' FALLA, y está
-- bien que falle: primero hay que migrarlos a otro método.
--   alter table public.coach_payout_accounts drop constraint payout_paypal_formato;
--   alter table public.coach_payout_accounts drop constraint payout_paypal_completa;
--   alter table public.coach_payout_accounts drop column paypal_email;
--   alter table public.coach_payout_accounts drop constraint coach_payout_accounts_method_check;
--   alter table public.coach_payout_accounts add constraint coach_payout_accounts_method_check
--     check (method in ('transferencia', 'usdt'));
