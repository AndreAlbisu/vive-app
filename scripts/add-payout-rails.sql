-- Regla espejo (D4) + el costo de entrega lo absorbe VIVE (D5) + publicar exige
-- un riel completo (D6). Ver `docs/decisiones-pagos.md`.
-- ---------------------------------------------------------------------------
-- Hasta ahora el coach elegía UN método de cobro (`method`) entre transferencia,
-- usdt y paypal. Con la regla espejo eso cambia de forma: **declara qué rieles
-- ACEPTA**, sus clientes ven solo esos, y cada reserva se paga por el riel por el
-- que entró.
--
-- ⚠️ ADITIVA A PROPÓSITO. `method` se conserva y se sigue pudiendo leer: si esta
-- migración corre antes de que la app nueva esté en los teléfonos, la vieja sigue
-- andando. Borrar la columna es un script posterior, cuando no quede build viejo.

-- ── 1. Los rieles aceptados ──────────────────────────────────────────────────
alter table public.coach_payout_accounts
  add column if not exists accepts_paypal boolean not null default false,
  add column if not exists accepts_usdt   boolean not null default false;

comment on column public.coach_payout_accounts.accepts_paypal is
  'El coach acepta cobrar por PayPal. Sus clientes del exterior ven ese medio.';
comment on column public.coach_payout_accounts.accepts_usdt is
  'El coach acepta cobrar en USDT. Sus clientes del exterior ven ese medio.';

-- ── 2. Backfill desde el método único ────────────────────────────────────────
-- `transferencia` NO se migra a ningún riel: bajo la regla espejo el CBU deja de
-- ser una opción de cobro del exterior (no hay riel de entrada en pesos que lo
-- espeje). Quien tuviera eso queda sin rieles y, por D6, sin poder recibir
-- reservas internacionales hasta que configure uno.
update public.coach_payout_accounts
   set accepts_paypal = (method = 'paypal'),
       accepts_usdt   = (method = 'usdt')
 where accepts_paypal = false and accepts_usdt = false;

-- 🔴 Y `method` deja de ser OBLIGATORIA. La columna se conserva (arriba se
-- explica por qué), pero con la regla espejo un coach acepta CERO, UNO o DOS
-- rieles y `method` es singular: ya no hay valor que represente el estado.
-- Mientras siguiera siendo NOT NULL sin default, la pantalla de cobro no podía
-- guardar nada — el upsert no la manda, y Postgres valida el NOT NULL sobre la
-- tupla propuesta ANTES de resolver el `on conflict`, así que fallaba también
-- para el coach que ya tenía fila.
--
-- Los tres CHECK viejos por método siguen vivos y siguen valiendo: los tres
-- tienen la forma `method <> 'x' or <destino> is not null`, que con `method`
-- en null da verdadero. O sea que un build viejo que todavía escriba `method`
-- sigue validando igual que antes.
alter table public.coach_payout_accounts
  alter column method drop not null;

-- ── 3. Coherencia: aceptar un riel exige tener su destino ────────────────────
-- Mismo criterio que los CHECK que ya existían por método. Sin esto se puede
-- aceptar PayPal sin mail y el error aparece recién el día de pagar.
alter table public.coach_payout_accounts
  drop constraint if exists payout_paypal_aceptado_completo;
alter table public.coach_payout_accounts
  add constraint payout_paypal_aceptado_completo
  check (not accepts_paypal or paypal_email is not null);

alter table public.coach_payout_accounts
  drop constraint if exists payout_usdt_aceptado_completo;
alter table public.coach_payout_accounts
  add constraint payout_usdt_aceptado_completo
  check (not accepts_usdt or (wallet is not null and network is not null));

-- 📝 `cbu` y `alias` se conservan sin uso. No son basura: si algún día se agrega
-- la "conversión pasante" de D4 —VIVE convierte ese pago puntual y transfiere
-- pesos, pasando el tipo de cambio real con comprobante— vuelven a hacer falta.

-- ── 4. Los rieles, PÚBLICOS en `coaches` ─────────────────────────────────────
-- 🔴 `coach_payout_accounts` solo la lee su dueño y el admin — y está bien, ahí
-- vive el mail y la wallet. Pero el checkout necesita saber QUÉ RIELES acepta el
-- coach para ofrecer solo esos, y lo consulta un cliente cualquiera.
--
-- Mismo criterio que `accepts_international`, que ya es público: **el hecho de
-- que acepta un riel es público; el destino no.** Los mantiene el mismo trigger.
alter table public.coaches
  add column if not exists accepts_paypal boolean not null default false,
  add column if not exists accepts_usdt   boolean not null default false;

comment on column public.coaches.accepts_paypal is
  'Derivada de coach_payout_accounts. Público: el checkout la lee para ofrecer el medio. La mantiene trg_sync_intl_on_payout.';
comment on column public.coaches.accepts_usdt is
  'Derivada de coach_payout_accounts. Público: el checkout la lee para ofrecer el medio. La mantiene trg_sync_intl_on_payout.';

-- Que no las pueda escribir nadie desde la app: son derivadas.
revoke update (accepts_paypal, accepts_usdt) on public.coaches from authenticated;

-- ── 5. `accepts_international` pasa de casilla a DATO DERIVADO ───────────────
-- 🔴 Hoy es un flag que el coach prende a mano, y puede contradecir a los datos:
-- se puede tener `accepts_international = true` sin `price_usd`, y entonces el
-- catálogo lo anuncia y la pantalla de pago no le puede cobrar. Con esto, el flag
-- pasa a ser el RESULTADO de tener con qué cobrar, y ese estado deja de existir.
--
-- Se mantiene como columna en vez de calcularse en cada lectura porque la leen
-- seis lugares distintos (catálogo, buscador, perfil público, dos create-payment
-- y la pantalla de reserva). Un trigger la mantiene; los lectores no cambian.
create or replace function public.sync_accepts_international()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  -- El disparo puede venir de `coaches` (cambió el precio) o de
  -- `coach_payout_accounts` (cambiaron los rieles).
  --
  -- 🔴 NO se puede resolver con un coalesce único sobre los cuatro campos.
  -- Parece defensivo y no lo es: PL/pgSQL resuelve cada campo contra la forma
  -- REAL del registro, así que `new.coach_id` sobre una fila de `coaches` no
  -- devuelve null — tira `record "new" has no field "coach_id"` y aborta la
  -- sentencia que disparó el trigger. Con `trg_sync_intl_on_price` colgado de
  -- `coaches` eso dejaba a TODO coach sin poder guardar su `price_usd`. Lo
  -- mismo `new` en un DELETE, donde no está asignado: rompía borrar una fila de
  -- cobro y, por cascada, borrar un coach.
  --
  -- Va con `if` y no con un `case` por el mismo motivo: el registro se evalúa
  -- como parámetro de la expresión entera, así que un `case` igual tocaría la
  -- rama que no corresponde.
  if TG_TABLE_NAME = 'coaches' then
    if TG_OP = 'DELETE' then
      v_coach := old.id;
    else
      v_coach := new.id;
    end if;
  else
    if TG_OP = 'DELETE' then
      v_coach := old.coach_id;
    else
      v_coach := new.coach_id;
    end if;
  end if;

  if v_coach is null then
    return null;
  end if;

  update public.coaches c
     set accepts_paypal = coalesce((
           select p.accepts_paypal from public.coach_payout_accounts p where p.coach_id = c.id
         ), false),
         accepts_usdt = coalesce((
           select p.accepts_usdt from public.coach_payout_accounts p where p.coach_id = c.id
         ), false),
         -- Un riel aceptado sin precio en dólares no sirve: `paypal-create-payment`
         -- y `usdt-create-payment` rechazan el cobro sin `price_usd`. Anunciarlo
         -- sería prometer en el catálogo algo que la pantalla de pago no ofrece.
         accepts_international = (
           c.price_usd is not null
           and exists (
             select 1 from public.coach_payout_accounts p
              where p.coach_id = c.id
                and (p.accepts_paypal or p.accepts_usdt)
           )
         )
   where c.id = v_coach;

  return null;
end;
$$;

drop trigger if exists trg_sync_intl_on_payout on public.coach_payout_accounts;
create trigger trg_sync_intl_on_payout
  after insert or update or delete on public.coach_payout_accounts
  for each row execute function public.sync_accepts_international();

drop trigger if exists trg_sync_intl_on_price on public.coaches;
create trigger trg_sync_intl_on_price
  after update of price_usd on public.coaches
  for each row execute function public.sync_accepts_international();

-- Backfill: dejar las tres columnas coherentes con los datos de hoy.
update public.coaches c
   set accepts_paypal = coalesce((
         select p.accepts_paypal from public.coach_payout_accounts p where p.coach_id = c.id
       ), false),
       accepts_usdt = coalesce((
         select p.accepts_usdt from public.coach_payout_accounts p where p.coach_id = c.id
       ), false),
       accepts_international = (
     c.price_usd is not null
     and exists (
       select 1 from public.coach_payout_accounts p
        where p.coach_id = c.id and (p.accepts_paypal or p.accepts_usdt)
     )
   );

-- 🔴 Y que el coach no la pueda escribir a mano: si pudiera, volvería a poder
-- contradecir a los datos y el trigger sería decorativo.
revoke update (accepts_international) on public.coaches from authenticated;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) Las columnas y el backfill:
--    select coach_id, method, accepts_paypal, accepts_usdt from public.coach_payout_accounts;
--
-- 2) El derivado quedó coherente (no debería devolver filas):
--    select c.id, c.accepts_international, c.price_usd,
--           exists (select 1 from coach_payout_accounts p
--                    where p.coach_id = c.id and (p.accepts_paypal or p.accepts_usdt)) as tiene_riel
--      from public.coaches c
--     where c.accepts_international <> (c.price_usd is not null and exists (
--             select 1 from coach_payout_accounts p
--              where p.coach_id = c.id and (p.accepts_paypal or p.accepts_usdt)));
--
-- 3) 🔴 El trigger reacciona (debe pasar a false y volver a true):
--    update public.coach_payout_accounts set accepts_usdt = false where coach_id = '<UUID>';
--    select accepts_international from public.coaches where id = '<UUID>';  -- esperado: false
--    update public.coach_payout_accounts set accepts_usdt = true where coach_id = '<UUID>';
--    select accepts_international from public.coaches where id = '<UUID>';  -- esperado: true
--
-- 4) El CHECK rechaza aceptar un riel sin destino (DEBE fallar):
--    update public.coach_payout_accounts set accepts_paypal = true, paypal_email = null
--     where coach_id = '<UUID>';
--    -- esperado: viola «payout_paypal_aceptado_completo»
--
-- 5) El coach ya no puede escribir el flag (DEBE fallar desde la app, no desde el
--    SQL Editor, que corre como service role).

-- ── Revertir ─────────────────────────────────────────────────────────────────
--   drop trigger if exists trg_sync_intl_on_price on public.coaches;
--   drop trigger if exists trg_sync_intl_on_payout on public.coach_payout_accounts;
--   drop function if exists public.sync_accepts_international();
--   grant update (accepts_international) on public.coaches to authenticated;
--   alter table public.coaches drop column if exists accepts_paypal, drop column if exists accepts_usdt;
--   alter table public.coach_payout_accounts
--     drop constraint if exists payout_paypal_aceptado_completo,
--     drop constraint if exists payout_usdt_aceptado_completo,
--     drop column if exists accepts_paypal,
--     drop column if exists accepts_usdt;
