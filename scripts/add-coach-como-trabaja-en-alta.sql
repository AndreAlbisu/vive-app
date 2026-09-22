-- add-coach-como-trabaja-en-alta.sql
--
-- "Cómo trabajo" pasa a pedirse en la postulación (decisión de Andre,
-- 21/09/2026): estilo, guía y focos son obligatorios en el alta.
--
-- 1. 🔴 El INSERT de `coaches` para `authenticated` también está acotado por
--    columnas (igual que el UPDATE, ver SCHEMA.md M14), y estas tres solo tenían
--    UPDATE. Sin este grant, mandar cualquiera de ellas en el alta hace fallar
--    la postulación ENTERA con 42501. `enfoques` no se suma: la escuela pide
--    matrícula verificada, que llega después del alta.
--
-- 2. `focos` hasta 2 de 3. Marcar los tres coincide con cualquier pedido y no
--    dice nada: es la forma de "aparecer siempre" que el tope de 3 escuelas ya
--    cierra en `enfoques`.
--
-- Fecha: 2026-09-21

begin;

grant insert (estilo, guia, focos) on public.coaches to authenticated;

alter table public.coaches drop constraint if exists coaches_focos_check;
alter table public.coaches add constraint coaches_focos_check
  check (
    focos <@ array['historia', 'presente', 'rumbo']::text[]
    and coalesce(array_length(focos, 1), 0) <= 2
  );

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;

  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and grantee='authenticated'
     and privilege_type='INSERT' and column_name in ('estilo','guia','focos');
  insert into _res values ('grant insert estilo/guia/focos (esperado 3)', v::text, v = 3);

  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and grantee='authenticated'
     and privilege_type='INSERT' and column_name = 'enfoques';
  insert into _res values ('enfoques sigue sin insert (esperado 0)', v::text, v = 0);

  begin
    update public.coaches set focos = array['historia','presente','rumbo'] where id = (select id from public.coaches limit 1);
    raise exception 'no_rechazo';
  exception
    when check_violation then insert into _res values ('focos rechaza 3', 'rechazó', true);
    when raise_exception then insert into _res values ('focos rechaza 3', 'NO rechazó (deshecho)', false);
  end;

  begin
    update public.coaches set focos = array['historia','rumbo'] where id = (select id from public.coaches limit 1);
    raise exception 'ok_deshacer';
  exception
    when check_violation then insert into _res values ('focos acepta 2', 'rechazó', false);
    when raise_exception then insert into _res values ('focos acepta 2', 'aceptó (deshecho)', true);
  end;
end $$;
select * from _res;
