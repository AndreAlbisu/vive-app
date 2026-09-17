-- add-coach-enfoque.sql
--
-- M14 (docs/problemas-abiertos.md): "cómo trabaja" el profesional.
--
-- Sale de la observación de Andre sobre el quiz de Selia: además de preguntar si
-- querés un psicólogo, pregunta QUÉ TIPO DE ACOMPAÑAMIENTO querés (su "enfoque",
-- opcional). Hoy Vita no puede preguntarlo: no hay un solo campo que diga cómo
-- trabaja cada profesional. Lo único parecido es `coaches.specialty`, que es
-- texto libre escrito por él, el mismo camino que ya falló dos veces al decidir
-- "Psicólogo/a" (buscador 03/09, quiz 17/09). Por eso esto va estructurado.
--
-- Son DOS cosas distintas a propósito:
--
--   `estilo`    Lo que se le pregunta a la PERSONA, en sus palabras: querés que
--               te escuche y te ayude a entenderte, o que te dé herramientas y
--               ejercicios para practicar. Lo contesta cualquier profesional
--               (coach, psicólogo o nutricionista) y es lo único que usa el quiz
--               para ordenar y explicar.
--
--   `enfoques`  La escuela, con su nombre técnico. La elige el profesional, se
--               muestra en su perfil y le sirve para diferenciarse. NO se le
--               pregunta a la persona: quien busca ayuda por primera vez no sabe
--               qué es "sistémico", y esa pregunta expulsa. Selia la deja
--               opcional justamente por eso.
--
-- Las dos nacen vacías. Nadie queda mal clasificado por no haber contestado:
-- un perfil sin `estilo` no se filtra ni se penaliza, simplemente no gana esa
-- razón en el quiz.
--
-- Fecha: 2026-09-17

begin;

alter table public.coaches
  add column if not exists estilo text,
  add column if not exists enfoques text[] not null default '{}'::text[];

alter table public.coaches drop constraint if exists coaches_estilo_check;
alter table public.coaches add constraint coaches_estilo_check
  check (estilo is null or estilo in ('escucha', 'herramientas', 'ambos'));

-- `<@` = "está contenido en". Una escuela que no esté en la lista no entra, y
-- el tope de 3 evita el perfil que marca todas para aparecer siempre.
alter table public.coaches drop constraint if exists coaches_enfoques_check;
alter table public.coaches add constraint coaches_enfoques_check
  check (
    enfoques <@ array[
      'psicoanalitico', 'cognitivo_conductual', 'sistemico',
      'gestaltico', 'humanistico', 'integrativo'
    ]::text[]
    and coalesce(array_length(enfoques, 1), 0) <= 3
  );

-- 🔴 El UPDATE de `coaches` para `authenticated` NO es a nivel tabla: está
-- acotado a una lista blanca de columnas (hoy application_video_url,
-- availability_status, bio, instant_booking, nationality, price_per_session,
-- price_usd, specialty, video_url). Una columna nueva NO queda editable sola:
-- sin este grant el profesional guardaba y la app no daba error visible, pero
-- no se escribía nada. Toda columna nueva que edite el profesional tiene que
-- sumarse acá.
grant update (estilo, enfoques) on public.coaches to authenticated;

comment on column public.coaches.estilo is
  'M14: cómo acompaña, en palabras de la persona (escucha | herramientas | ambos). Es lo que matchea el quiz.';
comment on column public.coaches.enfoques is
  'M14: escuelas con su nombre técnico, hasta 3. Solo para mostrar en el perfil; el quiz no pregunta por esto.';

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v_cols int; v_def text; v_estilo boolean; v_enf boolean; v_grant int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;

  select count(*) into v_cols from information_schema.columns
   where table_schema='public' and table_name='coaches' and column_name in ('estilo','enfoques');
  insert into _res values ('columnas nuevas (esperado 2)', v_cols::text, v_cols = 2);

  select column_default into v_def from information_schema.columns
   where table_schema='public' and table_name='coaches' and column_name='enfoques';
  insert into _res values ('enfoques default', coalesce(v_def,'(null)'), v_def like '%{}%');

  select exists (select 1 from pg_constraint where conrelid='public.coaches'::regclass and conname='coaches_estilo_check')
    into v_estilo;
  insert into _res values ('check de estilo', case when v_estilo then 'existe' else 'FALTA' end, v_estilo);

  select exists (select 1 from pg_constraint where conrelid='public.coaches'::regclass and conname='coaches_enfoques_check')
    into v_enf;
  insert into _res values ('check de enfoques', case when v_enf then 'existe' else 'FALTA' end, v_enf);

  -- El grant de UPDATE es a nivel tabla, así que las columnas nuevas ya entran.
  select count(*) into v_grant from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and grantee='authenticated'
     and privilege_type='UPDATE' and column_name in ('estilo','enfoques');
  insert into _res values ('UPDATE de authenticated sobre las nuevas (esperado 2)', v_grant::text, v_grant = 2);
end $$;
select * from _res;
