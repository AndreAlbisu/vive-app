-- add-quiz-pagos.sql
--
-- El quiz pregunta cómo le gustaría pagar a la persona (21/09/2026). Se
-- descartó preguntar "desde dónde pagás": alguien en Argentina puede preferir
-- PayPal o cripto (observación de Andre). Varias opciones: 'mp', 'paypal',
-- 'usdt'; o 'any' = "me da igual". null = no contestó.
--
-- Fecha: 2026-09-21

begin;

alter table public.user_quiz_answers
  add column if not exists pagos text[];

alter table public.user_quiz_answers drop constraint if exists uqa_pagos_check;
alter table public.user_quiz_answers add constraint uqa_pagos_check
  check (pagos is null or pagos <@ array['mp', 'paypal', 'usdt', 'any']::text[]);

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;
  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='user_quiz_answers' and column_name='pagos';
  insert into _res values ('columna pagos', v::text, v = 1);
  select count(*) into v from pg_constraint where conname = 'uqa_pagos_check';
  insert into _res values ('CHECK pagos', v::text, v = 1);
  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='user_quiz_answers' and grantee='authenticated'
     and column_name='pagos' and privilege_type in ('INSERT','UPDATE','SELECT');
  insert into _res values ('authenticated: insert/update/select (esperado 3)', v::text, v = 3);
end $$;
select * from _res;
