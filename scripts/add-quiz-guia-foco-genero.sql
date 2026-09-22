-- add-quiz-guia-foco-genero.sql
--
-- M14 ampliado (21/09/2026). El quiz medía una sola cosa de cómo trabaja el
-- profesional (`estilo`: escucha o herramientas). Selia mide cuatro con su test
-- del "viaje", y dos de las que nos faltaban son diferencias reales entre
-- profesionales que la persona puede contestar sin saber de escuelas:
--
--   `guia`    Cuánto conduce: propone el camino, o sigue el que elige la
--             persona. (Selia: "un guía que me muestra el camino" / "que me
--             acompaña en el camino que elijo".)
--   `focos`   Hacia dónde mira el trabajo: entender la historia, resolver algo
--             del presente, o repensar el rumbo. (Selia: "las huellas" / "un
--             obstáculo" / "mi rumbo".) Array: un profesional puede trabajar
--             más de uno.
--
-- Lo que NO se copia de Selia: el rótulo final ("Tu enfoque: Transpersonal").
-- Con estas respuestas se ORDENA y se EXPLICA en cada perfil, nunca se le pone
-- nombre de escuela a la persona. Ver `lib/enfoque.ts`.
--
-- Y en `user_quiz_answers` se guardan las respuestas nuevas del quiz, que hasta
-- hoy valían solo para esa corrida (el `estilo` se perdía al salir).
-- `genero_pref` es la preferencia de la persona sobre el género del
-- profesional; el dato del profesional ya existe (`profiles.gender`).
--
-- Todo nace vacío y todo es opcional. Nada de esto saca a nadie de la lista.
--
-- Fecha: 2026-09-21

begin;

-- ── coaches ────────────────────────────────────────────────────────────────
alter table public.coaches
  add column if not exists guia text,
  add column if not exists focos text[] not null default '{}'::text[];

alter table public.coaches drop constraint if exists coaches_guia_check;
alter table public.coaches add constraint coaches_guia_check
  check (guia is null or guia in ('guia', 'acompana', 'ambos'));

alter table public.coaches drop constraint if exists coaches_focos_check;
alter table public.coaches add constraint coaches_focos_check
  check (focos <@ array['historia', 'presente', 'rumbo']::text[]);

-- 🔴 El UPDATE de `coaches` está acotado a una lista blanca de columnas (ver
-- SCHEMA.md, M14). Sin esto el profesional guarda y no se escribe nada.
grant update (guia, focos) on public.coaches to authenticated;

comment on column public.coaches.guia is
  'M14: cuánto conduce el proceso (guia | acompana | ambos). Lo contesta cualquier profesional.';
comment on column public.coaches.focos is
  'M14: hacia dónde mira el trabajo (historia | presente | rumbo), uno o varios.';

-- ── user_quiz_answers ──────────────────────────────────────────────────────
alter table public.user_quiz_answers
  add column if not exists estilo text,
  add column if not exists guia text,
  add column if not exists foco text,
  add column if not exists genero_pref text;

alter table public.user_quiz_answers drop constraint if exists uqa_estilo_check;
alter table public.user_quiz_answers add constraint uqa_estilo_check
  check (estilo is null or estilo in ('escucha', 'herramientas', 'any'));
alter table public.user_quiz_answers drop constraint if exists uqa_guia_check;
alter table public.user_quiz_answers add constraint uqa_guia_check
  check (guia is null or guia in ('guia', 'acompana', 'any'));
alter table public.user_quiz_answers drop constraint if exists uqa_foco_check;
alter table public.user_quiz_answers add constraint uqa_foco_check
  check (foco is null or foco in ('historia', 'presente', 'rumbo', 'any'));
alter table public.user_quiz_answers drop constraint if exists uqa_genero_pref_check;
alter table public.user_quiz_answers add constraint uqa_genero_pref_check
  check (genero_pref is null or genero_pref in ('mujer', 'varon', 'any'));

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int; v_grant int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;

  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='coaches' and column_name in ('guia','focos');
  insert into _res values ('coaches: columnas nuevas (esperado 2)', v::text, v = 2);

  select count(*) into v from information_schema.columns
   where table_schema='public' and table_name='user_quiz_answers'
     and column_name in ('estilo','guia','foco','genero_pref');
  insert into _res values ('user_quiz_answers: columnas nuevas (esperado 4)', v::text, v = 4);

  select count(*) into v_grant from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and grantee='authenticated'
     and privilege_type='UPDATE' and column_name in ('guia','focos');
  insert into _res values ('grant update guia/focos (esperado 2)', v_grant::text, v_grant = 2);

  select count(*) into v from pg_constraint
   where conname in ('coaches_guia_check','coaches_focos_check','uqa_estilo_check',
                     'uqa_guia_check','uqa_foco_check','uqa_genero_pref_check');
  insert into _res values ('CHECKs (esperado 6)', v::text, v = 6);

  -- Los CHECK rechazan valores inventados (dentro de un subbloque que se deshace).
  begin
    update public.coaches set guia = 'inventado' where id = (select id from public.coaches limit 1);
    -- Si llegó acá no rechazó: se aborta el subbloque para que no quede escrito.
    raise exception 'no_rechazo';
  exception
    when check_violation then
      insert into _res values ('CHECK guia rechaza inventado', 'rechazó', true);
    when raise_exception then
      insert into _res values ('CHECK guia rechaza inventado', 'NO rechazó (deshecho)', false);
  end;
  begin
    update public.coaches set focos = array['futuro'] where id = (select id from public.coaches limit 1);
    -- Si llegó acá no rechazó: se aborta el subbloque para que no quede escrito.
    raise exception 'no_rechazo';
  exception
    when check_violation then
      insert into _res values ('CHECK focos rechaza inventado', 'rechazó', true);
    when raise_exception then
      insert into _res values ('CHECK focos rechaza inventado', 'NO rechazó (deshecho)', false);
  end;
end $$;
select * from _res;
