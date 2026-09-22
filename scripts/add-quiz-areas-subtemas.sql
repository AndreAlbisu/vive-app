-- add-quiz-areas-subtemas.sql
--
-- Quiz en dos niveles (21/09/2026, tomado de Selia): la persona elige hasta 2
-- áreas ("Emociones y ánimo") y después, adentro, hasta 3 temas concretos
-- ("Duelo"). Los temas concretos son los mismos que marca cada profesional en
-- `coach_topics`, así que el match es directo.
--
-- `topic` (una sola área) se sigue escribiendo con la primera: lo lee
-- `useRecommendedResource` y no se toca.
--
-- `subtemas` va sin CHECK a propósito, igual que `coach_topics.topic`: la lista
-- vive en `constants/searchData.ts` (AXES) y un CHECK la duplicaría.
--
-- Fecha: 2026-09-21

begin;

alter table public.user_quiz_answers
  add column if not exists areas text[],
  add column if not exists subtemas text[];

alter table public.user_quiz_answers drop constraint if exists uqa_areas_check;
alter table public.user_quiz_answers add constraint uqa_areas_check
  check (areas is null or (
    areas <@ array['emocion','relaciones','trabajo','salud','proposito']::text[]
    and coalesce(array_length(areas, 1), 0) <= 2
  ));

alter table public.user_quiz_answers drop constraint if exists uqa_subtemas_check;
alter table public.user_quiz_answers add constraint uqa_subtemas_check
  check (subtemas is null or coalesce(array_length(subtemas, 1), 0) <= 3);

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;

  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='user_quiz_answers' and column_name in ('areas','subtemas');
  insert into _res values ('columnas nuevas (esperado 2)', v::text, v = 2);

  select count(*) into v from pg_constraint where conname in ('uqa_areas_check','uqa_subtemas_check');
  insert into _res values ('CHECKs (esperado 2)', v::text, v = 2);

  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='user_quiz_answers' and grantee='authenticated'
     and column_name in ('areas','subtemas') and privilege_type in ('INSERT','UPDATE','SELECT');
  insert into _res values ('authenticated: insert/update/select (esperado 6)', v::text, v = 6);
end $$;
select * from _res;
