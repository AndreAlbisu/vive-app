-- Tres escuelas más para psicología (02/10/2026, pedido de Andre): terapias de
-- tercera ola (ACT, DBT, mindfulness), EMDR e interpersonal.
--
-- Por qué: las seis de antes cubrían lo más común en Argentina, pero un
-- psicólogo de tercera ola tenía que elegir "cognitivo conductual" (pariente,
-- no lo mismo), y quien trabaja con EMDR no tenía cómo decirlo. Selia muestra
-- las dos en los perfiles de sus psicólogos. La interpersonal tiene muy buena
-- evidencia para depresión aunque acá se practique poco.
-- El texto que ve la persona vive en `lib/enfoque.ts`.
--
-- 1. El CHECK suma los tres valores (tope de 3, igual que antes).
-- 2. `trg_enfoques_requieren_matricula` los suma a la lista de psicología: un
--    coach o una nutricionista que los marque los pierde, como con las demás.
--
-- Sin grants nuevos: `enfoques` ya está en el UPDATE de `authenticated`.
-- Idempotente.

begin;

alter table public.coaches drop constraint if exists coaches_enfoques_check;
alter table public.coaches add constraint coaches_enfoques_check
  check (
    enfoques <@ array[
      -- psicología
      'psicoanalitico', 'cognitivo_conductual', 'sistemico',
      'gestaltico', 'humanistico', 'integrativo',
      'tercera_ola', 'emdr', 'interpersonal',
      -- coaching
      'coach_ontologico', 'coach_sistemico', 'coach_cognitivo_conductual',
      'coach_salud_habitos', 'coach_mindfulness', 'coach_integrativo',
      -- nutrición
      'nutri_sin_dietas', 'nutri_plan', 'nutri_deportiva',
      'nutri_plantas', 'nutri_condiciones'
    ]::text[]
    and coalesce(array_length(enfoques, 1), 0) <= 3
  );

create or replace function public.enfoques_requieren_matricula()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
declare
  permitidos text[];
begin
  permitidos := case new.profesion
    when 'psicologia' then array['psicoanalitico', 'cognitivo_conductual', 'sistemico',
                                 'gestaltico', 'humanistico', 'integrativo',
                                 'tercera_ola', 'emdr', 'interpersonal']
    when 'nutricion'  then array['nutri_sin_dietas', 'nutri_plan', 'nutri_deportiva',
                                 'nutri_plantas', 'nutri_condiciones']
    else                   array['coach_ontologico', 'coach_sistemico', 'coach_cognitivo_conductual',
                                 'coach_salud_habitos', 'coach_mindfulness', 'coach_integrativo']
  end;
  -- Se queda con lo de su lista, en el orden en que lo eligió.
  new.enfoques := coalesce(
    array(select e from unnest(new.enfoques) with ordinality as t(e, i)
           where e = any(permitidos) order by i),
    '{}'::text[]);
  return new;
end $function$;

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
insert into _res select 'escuelas antes de las pruebas', coalesce(string_agg(id::text || '=' || array_to_string(enfoques, ','), ' | '), 'ninguno')
  from coaches where cardinality(enfoques) > 0;

-- Pruebas con rollback: se fuerza un error al final de cada una y se lee el
-- mensaje. Cada una sobre un perfil real, sin dejar nada.
do $$
declare
  cid uuid;
  r text;
begin
  -- Un psicólogo guarda las tres nuevas: quedan las tres.
  select id into cid from coaches where profesion = 'psicologia' limit 1;
  begin
    update coaches set enfoques = array['tercera_ola','emdr','interpersonal'] where id = cid;
    select array_to_string(enfoques, ',') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('psicólogo guarda las nuevas (esperado r:tercera_ola,emdr,interpersonal)', sqlerrm);
  end;

  -- Un coach sin matrícula que marca una nueva la pierde.
  select id into cid from coaches where profesion is null limit 1;
  begin
    update coaches set enfoques = array['coach_ontologico','emdr','tercera_ola'] where id = cid;
    select array_to_string(enfoques, ',') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('coach marca nuevas (esperado r:coach_ontologico)', sqlerrm);
  end;
end $$;

insert into _res select 'escuelas después de las pruebas (igual que antes)', coalesce(string_agg(id::text || '=' || array_to_string(enfoques, ','), ' | '), 'ninguno')
  from coaches where cardinality(enfoques) > 0;
select * from _res;
