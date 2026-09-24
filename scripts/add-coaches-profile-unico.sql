-- add-coaches-profile-unico.sql
--
-- Una postulación por cuenta (24/09/2026).
--
-- 🔴 El código ya lo creía: `CoachApplicationScreen` dice *"el UNIQUE de
-- `profile_id` hace que un INSERT falle con 23505"* y sobre esa creencia decide
-- si el alta es una postulación nueva o la corrección de una rechazada.
-- **Ese UNIQUE no existía**: `coaches` solo tenía únicos en `id` y en `slug`.
--
-- Por la app nadie llegaba a duplicar (el guard de `CoachLoginScreen` corta con
-- "Solicitud en revisión" y cierra la sesión), pero la RLS de INSERT solo pide
-- `profile_id = auth.uid()`, así que desde la API una misma cuenta podía crear
-- N postulaciones. Dos daños concretos:
--   · la cola de revisión se llena de repetidas;
--   · y le rompe la app a esa misma persona: `CoachLoginScreen`,
--     `CoachEnfoqueScreen` y `coachVisibilityData` piden su fila con
--     `maybeSingle()`, que con dos filas devuelve error. Su panel deja de cargar.
--
-- Hoy hay 38 filas y 38 `profile_id` distintos, así que el índice entra sin
-- tocar datos. Si alguna vez hubiera duplicados, este script FALLA en vez de
-- borrar: elegir cuál sobrevive no es decisión de una migración.
--
-- Fecha: 2026-09-24

begin;

create unique index if not exists coaches_profile_id_uniq on public.coaches (profile_id);

comment on index public.coaches_profile_id_uniq is
  'Una postulación por cuenta. El alta lo asume desde siempre (ver CoachApplicationScreen); hasta el 24/09/2026 no estaba.';

commit;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare v int; v_err text; v_prof uuid; v_id uuid;
begin
  select count(*) into v from pg_indexes where tablename='coaches' and indexname='coaches_profile_id_uniq';
  insert into _r values ('el índice existe', v::text, v = 1);

  select count(*) into v from (select profile_id from public.coaches group by 1 having count(*) > 1) q;
  insert into _r values ('cuentas con más de una postulación (esperado 0)', v::text, v = 0);

  -- Una segunda postulación de la misma cuenta ahora choca. Se prueba con la
  -- primera fila real y se deshace.
  select profile_id into v_prof from public.coaches limit 1;
  begin
    insert into public.coaches (profile_id, specialty, bio, price_per_session, nationality)
    values (v_prof, '[PRUEBA]', '[PRUEBA]', 1, 'Argentina') returning id into v_id;
    raise exception 'no_rechazo';
  exception
    when unique_violation then
      insert into _r values ('🔴 una segunda postulación de la misma cuenta ahora falla', 'rechazó', true);
    when others then
      v_err := sqlerrm;
      insert into _r values ('🔴 una segunda postulación de la misma cuenta ahora falla', 'NO por el índice: ' || v_err, false);
  end;

  delete from public.coaches where specialty = '[PRUEBA]';
  insert into _r values ('limpieza ok', (select count(*)::text from public.coaches where specialty = '[PRUEBA]'),
    not exists (select 1 from public.coaches where specialty = '[PRUEBA]'));
end $$;

select * from _r;
