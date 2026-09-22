-- add-quiz-budget-max-usd.sql
--
-- Si la persona elige pagar SOLO en dólares (PayPal y/o cripto), la barra de
-- presupuesto del quiz pasa a dólares y se compara contra `coaches.price_usd`
-- (21/09/2026). Se guarda aparte de `budget_max` (pesos) para no perder uno al
-- cambiar de medio de pago. Mismo criterio: 1000000 = sin límite.
--
-- Fecha: 2026-09-21

begin;

alter table public.user_quiz_answers
  add column if not exists budget_max_usd integer;

alter table public.user_quiz_answers drop constraint if exists uqa_budget_max_usd_check;
alter table public.user_quiz_answers add constraint uqa_budget_max_usd_check
  check (budget_max_usd is null or budget_max_usd between 0 and 1000000);

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;
  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='user_quiz_answers' and column_name='budget_max_usd' and data_type='integer';
  insert into _res values ('columna budget_max_usd integer', v::text, v = 1);
  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='user_quiz_answers' and grantee='authenticated'
     and column_name='budget_max_usd' and privilege_type in ('INSERT','UPDATE','SELECT');
  insert into _res values ('authenticated: insert/update/select (esperado 3)', v::text, v = 3);
end $$;
select * from _res;
