-- Metodologías de coaching y enfoques de nutrición (25/09/2026,
-- docs/postulacion-preguntas.md, hueco 1).
--
-- Hasta hoy solo los psicólogos decían cómo trabajan (`coaches.enfoques`, las
-- seis escuelas). Ahora cada profesión tiene su lista, en la MISMA columna:
--   · psicología (matrícula verificada): las seis escuelas, sin cambios.
--   · nutrición (matrícula verificada): `nutri_*`.
--   · sin matrícula verificada (coach, como en `tipoProfesional`): `coach_*`.
-- Los valores y su texto viven en `lib/enfoque.ts`; la investigación y lo que
-- quedó afuera a propósito (PNL, trastornos alimentarios, etc.), en el doc.
--
-- 1. El CHECK acepta las tres listas (tope de 3, igual que antes).
-- 2. `trg_enfoques_requieren_matricula` ya no vacía todo lo que no sea
--    psicología: se queda con lo que es de la lista de SU profesión y descarta
--    el resto, en silencio. Sigue siendo trigger y no CHECK por lo mismo que
--    antes: al revocar una matrícula, la profesión cambia sola y lo declarado
--    tiene que poder limpiarse sin hacer fallar la revocación.
--
-- ✅ CORRIDO y VERIFICADO el 25/09/2026: 0 perfiles con valores fuera de su lista,
-- las escuelas del psicólogo de prueba intactas, y 6 pruebas con rollback (ver abajo).
--
-- Sin grants nuevos: `enfoques` ya estaba en el UPDATE de `authenticated` y en
-- el SELECT del catálogo. Idempotente.

begin;

alter table public.coaches drop constraint if exists coaches_enfoques_check;
alter table public.coaches add constraint coaches_enfoques_check
  check (
    enfoques <@ array[
      -- psicología
      'psicoanalitico', 'cognitivo_conductual', 'sistemico',
      'gestaltico', 'humanistico', 'integrativo',
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
                                 'gestaltico', 'humanistico', 'integrativo']
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

comment on column public.coaches.enfoques is
  'Cómo trabaja, hasta 3, de la lista de su profesión: escuelas (psicología), coach_* (sin matrícula) o nutri_* (nutrición). Solo se muestra en el perfil.';

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
insert into _res select 'con valores fuera de su lista (esperado 0)', count(*)::text
  from coaches c
 where cardinality(enfoques) > 0
   and exists (select 1 from unnest(c.enfoques) e
                where not (
                  (c.profesion = 'psicologia' and e in ('psicoanalitico','cognitivo_conductual','sistemico','gestaltico','humanistico','integrativo'))
                  or (c.profesion = 'nutricion' and e like 'nutri\_%')
                  or (c.profesion is null and e like 'coach\_%')));
insert into _res select 'escuelas del psicólogo de prueba intactas', coalesce(string_agg(array_to_string(enfoques, ','), ' | '), 'ninguno')
  from coaches where profesion = 'psicologia' and cardinality(enfoques) > 0;

-- Pruebas con rollback (se fuerza un error al final de cada una y se lee el
-- mensaje). Cada una sobre un coach real, sin dejar nada.
do $$
declare
  cid uuid;
  r text;
begin
  -- Un coach guarda una metodología suya, una escuela y un enfoque de nutrición:
  -- queda solo la suya.
  select id into cid from coaches where profesion is null limit 1;
  begin
    update coaches set enfoques = array['coach_ontologico','psicoanalitico','nutri_condiciones'] where id = cid;
    select array_to_string(enfoques, ',') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('coach mezcla tres listas (esperado r:coach_ontologico)', sqlerrm);
  end;

  -- Un valor inventado no llega a guardarse: el trigger (BEFORE) lo descarta
  -- por no ser de su lista antes de que el CHECK lo vea. El CHECK queda como
  -- segunda línea. (25/09: la primera versión de esta prueba esperaba el
  -- rechazo del CHECK y no tenía rollback; el coach no tenía nada cargado, así
  -- que no cambió ningún dato.)
  begin
    update coaches set enfoques = array['coach_pnl'] where id = cid;
    select coalesce(nullif(array_to_string(enfoques, ','), ''), 'vacío') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('valor inventado (esperado r:vacío)', sqlerrm);
  end;

  -- Más de tres, también.
  begin
    update coaches set enfoques = array['coach_ontologico','coach_sistemico','coach_mindfulness','coach_integrativo'] where id = cid;
    insert into _res values ('cuatro (esperado rechazo)', 'SE GUARDÓ');
  exception when check_violation then
    insert into _res values ('cuatro (esperado rechazo)', 'rechazado por el CHECK');
  end;

  -- Una nutricionista (se simula con una matrícula verificada de nutrición):
  -- guarda lo suyo y pierde la metodología de coaching.
  begin
    insert into coach_credentials (coach_id, kind, title, registration_number, status, profesion)
      values (cid, 'matricula', 'Lic. en Nutrición', 'MN 999', 'verificada', 'nutricion');
    update coaches set enfoques = array['coach_ontologico','nutri_plantas'] where id = cid;
    select coalesce(profesion,'null') || '/' || array_to_string(enfoques, ',') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('nutricionista (esperado r:nutricion/nutri_plantas)', sqlerrm);
  end;

  -- Al psicólogo se le cae la matrícula (vuelve a pendiente): la profesión se
  -- borra sola y las escuelas se van con ella, sin que falle nada.
  select id into cid from coaches where profesion = 'psicologia' and cardinality(enfoques) > 0 limit 1;
  begin
    update coach_credentials set status = 'pendiente'
     where coach_id = cid and kind = 'matricula' and status = 'verificada';
    select coalesce(profesion,'null') || '/' || coalesce(nullif(array_to_string(enfoques, ','), ''), 'vacío') into r from coaches where id = cid;
    raise exception 'r:%', r;
  exception when others then
    insert into _res values ('psicólogo pierde la matrícula (esperado r:null/vacío)', sqlerrm);
  end;
end $$;

insert into _res select 'escuelas intactas después de las pruebas', coalesce(string_agg(array_to_string(enfoques, ','), ' | '), 'ninguno')
  from coaches where profesion = 'psicologia' and cardinality(enfoques) > 0;
insert into _res select 'sin basura: matrículas MN 999 (esperado 0)', count(*)::text
  from coach_credentials where registration_number = 'MN 999';
select * from _res;
