-- Profesión como dato, no como palabra en un texto (punto 1 de docs/investigacion-producto-2026-09-23.md).
--
-- 🔴 Hasta hoy la app decidía "Psicólogo" o "Nutricionista" buscando palabras
-- en `coaches.specialty`, un texto libre que escribe el propio profesional, más
-- `has_matricula`, que dice que hay UNA matrícula verificada pero no de qué. Un
-- nutricionista matriculado que escribiera "psicología" en su especialidad
-- aparecía bajo el filtro Psicólogo, que es el que usa quien busca terapia.
--
-- Ahora:
--   · `coach_credentials.profesion` — de qué profesión es una matrícula. La
--     pone QUIEN VERIFICA (admin, vía `review_credential`), mirando el
--     documento. El profesional no la escribe.
--   · `coaches.profesion` — derivada de las matrículas verificadas, igual que
--     `has_matricula`, con su UPDATE cerrado. Es lo único que la app mira para
--     el tipo de profesional.
--   · Las escuelas (`enfoques`) piden matrícula de PSICOLOGÍA, no cualquiera:
--     son escuelas de psicología.
--
-- Idempotente: se puede correr de nuevo.

alter table public.coach_credentials
  add column if not exists profesion text
  check (profesion is null or profesion in ('psicologia', 'nutricion', 'otra'));

alter table public.coaches
  add column if not exists profesion text
  check (profesion is null or profesion in ('psicologia', 'nutricion'));

-- Editar una credencial revisada la devuelve a 'pendiente' (ya existía). Ahora
-- también borra la profesión: la vuelve a decidir quien revise.
create or replace function public.reset_credential_on_edit()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
begin
  -- Solo si cambió algo que la revisión miró. Un update que no toca ninguno de
  -- estos campos no tiene por qué volver a la cola.
  if (new.kind, new.title, new.institution, new.year, new.registration_number, new.file_path)
     is distinct from
     (old.kind, old.title, old.institution, old.year, old.registration_number, old.file_path)
  then
    new.status := 'pendiente';
    new.reviewed_at := null;
    new.profesion := null;
    -- `review_notes` se conserva: es el contexto de quien revisa la 2ª vuelta.
  end if;
  return new;
end;
$function$;

-- La misma función que mantiene `has_matricula`, ahora también la profesión.
-- Psicología gana a nutrición si hubiera las dos: es la que habilita escuelas
-- y el filtro que busca terapia, y quien tiene ambas matrículas es psicólogo.
create or replace function public.sync_has_matricula()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nuevo uuid;
  v_viejo uuid;
begin
  if TG_OP = 'DELETE' then
    v_viejo := old.coach_id;
  elsif TG_OP = 'UPDATE' then
    v_nuevo := new.coach_id;
    if old.coach_id is distinct from new.coach_id then
      v_viejo := old.coach_id;
    end if;
  else
    v_nuevo := new.coach_id;
  end if;

  update public.coaches c
     set has_matricula = exists (
           select 1 from public.coach_credentials cc
            where cc.coach_id = c.id
              and cc.kind = 'matricula'
              and cc.status = 'verificada'
         ),
         profesion = (
           select case
             when bool_or(cc.profesion = 'psicologia') then 'psicologia'
             when bool_or(cc.profesion = 'nutricion') then 'nutricion'
           end
           from public.coach_credentials cc
           where cc.coach_id = c.id
             and cc.kind = 'matricula'
             and cc.status = 'verificada'
         )
   where c.id in (v_nuevo, v_viejo);

  return null;
end;
$function$;

-- Escuelas: solo con matrícula de psicología.
create or replace function public.enfoques_requieren_matricula()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
begin
  -- Sin matrícula de psicología verificada no hay escuela que mostrar. Se vacía
  -- en silencio en vez de rechazar: el caso normal no es alguien haciendo
  -- trampa, es una revocación de credencial, y ahí fallar rompería la revocación.
  if coalesce(new.profesion, '') <> 'psicologia' then
    new.enfoques := '{}'::text[];
  end if;
  return new;
end $function$;

-- Nadie la escribe a mano: la deriva el trigger (mismo criterio que
-- `has_matricula` y `accepts_international`). Se lee público: la usa el catálogo.
revoke insert (profesion), update (profesion) on public.coaches from anon, authenticated;
grant select (profesion) on public.coaches to anon, authenticated;
-- La del profesional sobre su credencial tampoco: la decide quien verifica.
revoke insert (profesion), update (profesion) on public.coach_credentials from anon, authenticated;

-- La vista pública suma la profesión, para decir "Matrícula de Psicología".
create or replace view public.coach_credentials_public as
 select id, coach_id, kind, title, institution, year, registration_number, reviewed_at, profesion
   from public.coach_credentials c
  where status = 'verificada';

-- Backfill: las matrículas verificadas que ya existen (hoy, 2 de prueba, las
-- dos de psicología por su título). Solo se completan las vacías, por palabra
-- en el título: es la única vez que se deduce algo del texto, y es sobre
-- documentos que un admin ya miró.
update public.coach_credentials
   set profesion = case
     when lower(title) ~ 'psic' then 'psicologia'
     when lower(title) ~ 'nutri' then 'nutricion'
     else 'otra' end
 where kind = 'matricula' and status = 'verificada' and profesion is null;

-- Recalcular `coaches.profesion` donde cambia: el trigger solo corre cuando
-- cambia una credencial.
-- ⚠️ SOLO las filas donde el valor cambia. `trg_reset_application_on_edit`
-- devuelve a 'pendiente' a un profesional rechazado ante CUALQUIER update: un
-- update masivo le reabriría la postulación a todos los rechazados.
with calc as (
  select c.id, (
    select case
      when bool_or(cc.profesion = 'psicologia') then 'psicologia'
      when bool_or(cc.profesion = 'nutricion') then 'nutricion'
    end
    from public.coach_credentials cc
    where cc.coach_id = c.id and cc.kind = 'matricula' and cc.status = 'verificada'
  ) as profesion
  from public.coaches c
)
update public.coaches c
   set profesion = calc.profesion
  from calc
 where calc.id = c.id and c.profesion is distinct from calc.profesion;

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
insert into _res select 'coaches con profesión', coalesce(string_agg(profesion || ':' || n, ', '), 'ninguno')
  from (select profesion, count(*) n from coaches where profesion is not null group by 1) x;
insert into _res select 'matrículas verificadas sin profesión (esperado 0)', count(*)::text
  from coach_credentials where kind = 'matricula' and status = 'verificada' and profesion is null;
insert into _res select 'has_matricula sin profesión reconocida', count(*)::text
  from coaches where has_matricula and profesion is null;
insert into _res select 'authenticated puede escribir coaches.profesion (esperado 0)', count(*)::text
  from information_schema.column_privileges
  where table_name = 'coaches' and column_name = 'profesion' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE');
insert into _res select 'authenticated puede escribir credencial.profesion (esperado 0)', count(*)::text
  from information_schema.column_privileges
  where table_name = 'coach_credentials' and column_name = 'profesion' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE');
insert into _res select 'anon lee coaches.profesion (esperado 1)', count(*)::text
  from information_schema.column_privileges
  where table_name = 'coaches' and column_name = 'profesion' and grantee = 'anon' and privilege_type = 'SELECT';
insert into _res select 'con escuelas y sin psicología (esperado 0)', count(*)::text
  from coaches where cardinality(enfoques) > 0 and coalesce(profesion, '') <> 'psicologia';

-- El caso del informe, con rollback: una matrícula de NUTRICIÓN verificada no
-- convierte en psicólogo a nadie, aunque su especialidad diga "psicología".
do $$
declare
  cid uuid;
  p text;
begin
  select id into cid from coaches where not has_matricula limit 1;
  begin
    update coaches set specialty = 'Psicología nutricional' where id = cid;
    insert into coach_credentials (coach_id, kind, title, registration_number, status, profesion)
      values (cid, 'matricula', 'Lic. en Nutrición', 'MN 999', 'verificada', 'nutricion');
    select profesion into p from coaches where id = cid;
    raise exception 'r:%', coalesce(p, 'null');
  exception when others then
    insert into _res values ('nutrición + "psicología" en el texto (esperado r:nutricion)', sqlerrm);
  end;
end $$;
select * from _res;
