-- Arreglo de `add-payout-rails.sql`: el trigger derivado y el `method` obligatorio
-- --------------------------------------------------------------------------------
-- Dos defectos del script de la regla espejo (D4). Los dos rompen escrituras que
-- la app hace todos los días, y ninguno de los dos avisa: el error sale del lado
-- del cliente como "no se pudo guardar".
--
-- ⚠️ CUÁNDO CORRER ESTO. `add-payout-rails.sql` ya quedó arreglado en su lugar,
-- así que este archivo es SOLO para la base donde aquel ya se corrió. Si todavía
-- no se corrió, corré aquel (ya corregido) y este no hace falta — correrlo igual
-- es inofensivo, es `create or replace` + un `drop not null` idempotente.
--
-- 🔴 Y hay que averiguar cuál de los dos casos es: al 25/08/2026
-- CHANGELOG_SESIONES.md dice "CORRIDO y VERIFICADO" y SCHEMA.md dice "PENDIENTE
-- DE CORRER". El chequeo 0 de abajo lo contesta contra la base, que es la única
-- fuente que no se desactualiza.


-- ── 1. El trigger no puede resolver el coach con un coalesce único ───────────
-- `v_coach := coalesce(new.coach_id, old.coach_id, new.id, old.id)` parece
-- defensivo y no lo es. PL/pgSQL resuelve cada campo contra la forma REAL del
-- registro: `new.coach_id` sobre una fila de `coaches` no devuelve null, tira
-- `record "new" has no field "coach_id"` y ABORTA la sentencia que disparó el
-- trigger. Como `trg_sync_intl_on_price` cuelga de `coaches`, eso significa que
-- ningún coach puede guardar su `price_usd` — que es justo el dato que la
-- regla espejo le pide cargar. Y `new` en un DELETE no está asignado, así que
-- también rompía borrar una fila de cobro y, por cascada, borrar un coach.
create or replace function public.sync_accepts_international()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  -- Va con `if` y no con un `case`: el registro se evalúa como parámetro de la
  -- expresión entera, así que un `case` igual tocaría la rama que no toca.
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


-- ── 2. `method` no puede seguir siendo NOT NULL ──────────────────────────────
-- Con la regla espejo el coach acepta CERO, UNO o DOS rieles, y `method` es
-- singular: ya no hay valor que represente el estado. La pantalla de cobro dejó
-- de mandarla, y como Postgres valida el NOT NULL sobre la tupla propuesta ANTES
-- de resolver el `on conflict`, el upsert fallaba también para el coach que ya
-- tenía fila. O sea: nadie podía guardar sus datos de cobro.
--
-- La columna se CONSERVA — sigue siendo el valor que lee un build viejo — y los
-- tres CHECK por método siguen vivos y siguen valiendo: los tres tienen la forma
-- `method <> 'x' or <destino> is not null`, verdadera cuando `method` es null.
alter table public.coach_payout_accounts
  alter column method drop not null;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 0) ¿`add-payout-rails.sql` está corrido? (la pregunta que el changelog y
--    SCHEMA.md contestan distinto). Esperado si corrió: 4 filas.
--
-- select table_name, column_name
--   from information_schema.columns
--  where (table_name = 'coach_payout_accounts' and column_name in ('accepts_paypal','accepts_usdt'))
--     or (table_name = 'coaches' and column_name in ('accepts_paypal','accepts_usdt'))
--  order by table_name, column_name;
--
-- 1) `method` quedó nullable. Esperado: is_nullable = YES.
--
-- select column_name, is_nullable
--   from information_schema.columns
--  where table_name = 'coach_payout_accounts' and column_name = 'method';
--
-- 2) 🔴 EL CASO QUE ROMPÍA: guardar el precio en dólares de un coach.
--    Antes de este arreglo tiraba `record "new" has no field "coach_id"`.
--    El rollback deja todo como estaba pase lo que pase.
--
-- begin;
--   update public.coaches
--      set price_usd = coalesce(price_usd, 50)
--    where id = (select id from public.coaches limit 1);
--   -- y que la derivada haya quedado coherente:
--   select id, price_usd, accepts_paypal, accepts_usdt, accepts_international
--     from public.coaches
--    where id = (select id from public.coaches limit 1);
-- rollback;
--
-- 3) 🔴 EL OTRO CASO: borrar una fila de datos de cobro (antes:
--    `record "new" is not assigned yet`). Solo corre si hay alguna fila.
--
-- begin;
--   delete from public.coach_payout_accounts
--    where coach_id = (select coach_id from public.coach_payout_accounts limit 1);
-- rollback;
--
-- 4) Que el upsert sin `method` entre. Esperado: inserta sin error.
--
-- begin;
--   insert into public.coach_payout_accounts (coach_id, accepts_paypal, paypal_email)
--   select id, true, 'coach@example.com' from public.coaches limit 1
--   on conflict (coach_id) do update set accepts_paypal = excluded.accepts_paypal;
-- rollback;
