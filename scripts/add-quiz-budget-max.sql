-- add-quiz-budget-max.sql
--
-- El presupuesto del quiz pasa de cuatro rangos ("Hasta $5.000", "$5.000–
-- $10.000"…) a una barra deslizable (pedido de Andre, 21/09/2026). Se guarda el
-- tope en pesos. null = sin límite.
--
-- `budget` (low | mid | high | flex) queda y se sigue leyendo en respuestas
-- viejas: el quiz lo traduce a un tope al volver.
--
-- Fecha: 2026-09-21

begin;

alter table public.user_quiz_answers
  add column if not exists budget_max integer;

alter table public.user_quiz_answers drop constraint if exists uqa_budget_max_check;
alter table public.user_quiz_answers add constraint uqa_budget_max_check
  check (budget_max is null or budget_max between 0 and 1000000);

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;
  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='user_quiz_answers' and column_name='budget_max' and data_type='integer';
  insert into _res values ('columna budget_max integer', v::text, v = 1);
  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='user_quiz_answers' and grantee='authenticated'
     and column_name='budget_max' and privilege_type in ('INSERT','UPDATE','SELECT');
  insert into _res values ('authenticated: insert/update/select (esperado 3)', v::text, v = 3);
end $$;
select * from _res;
