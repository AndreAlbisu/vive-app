-- Fase 3 de la auditoría, tanda 2 (04/10/2026). Dos cierres en el alta y el
-- perfil de profesionales.

begin;

-- 1. `coaches.specialty` la podía escribir el propio profesional por la API,
--    con cualquier texto y en cualquier momento ("Psicóloga clínica y
--    psiquiatra" sin matrícula, probado). El perfil y el catálogo muestran la
--    etiqueta que sale de la matrícula verificada, pero Favoritos, "tus
--    profesionales", la reseña y Conexiones muestran este texto tal cual. Y la
--    exigencia de matrícula al aprobar depende de que diga exactamente
--    'Psicólogo/a' o 'Nutricionista'.
--
--    Desde el cliente: al crear la fila solo valen los tres valores del
--    formulario, y después no se cambia. `submit_coach_application` (security
--    definer) y el service role no pasan por acá.
create or replace function public.guard_coach_specialty()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.specialty is null or new.specialty not in ('Psicólogo/a', 'Coach', 'Nutricionista') then
      raise exception 'especialidad_invalida' using errcode = '23514';
    end if;
  elsif new.specialty is distinct from old.specialty then
    raise exception 'ESPECIALIDAD_BLOQUEADA'
      using errcode = 'P0001',
            hint = 'La especialidad se define en la postulación y la cambia Vita.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_coach_specialty() from public, anon, authenticated;

drop trigger if exists trg_guard_coach_specialty on public.coaches;
create trigger trg_guard_coach_specialty
  before insert or update of specialty on public.coaches
  for each row execute function public.guard_coach_specialty();

-- 2. La identidad verificada no quedaba atada al nombre: entre que se miraba el
--    DNI y se aprobaba la postulación, la persona podía cambiar el nombre de su
--    perfil, y `approve_coach_application` no lo compara. Ahora el nombre queda
--    fijo desde que se envían las fotos (fila en `identity_verifications`,
--    pendiente o verificada). Las correcciones van por `set_coach_name`.
create or replace function public.limitar_cambio_de_nombre()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  proximo timestamptz;
begin
  if new.name is not distinct from old.name then
    if current_user in ('authenticated', 'anon') then
      new.name_changed_at := old.name_changed_at;
    end if;
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.name_changed_at := old.name_changed_at;
  if public.es_profesional_aprobado(old.id) then
    raise exception 'NOMBRE_BLOQUEADO_PROFESIONAL'
      using errcode = 'P0001',
            hint = 'El nombre de un profesional aprobado lo cambia Vita.';
  end if;
  -- La fila propia es visible por RLS (`identity_verifications_select_own`).
  if exists (select 1 from public.identity_verifications iv where iv.profile_id = old.id) then
    raise exception 'NOMBRE_BLOQUEADO_IDENTIDAD'
      using errcode = 'P0001',
            hint = 'El nombre queda fijo desde que se envía la verificación de identidad.';
  end if;
  if old.name is null or btrim(old.name) = '' or old.name = 'Usuario' then
    return new;
  end if;
  if old.name_changed_at is not null then
    proximo := old.name_changed_at + interval '30 days';
    if now() < proximo then
      raise exception 'NOMBRE_CAMBIADO_HACE_POCO'
        using errcode = 'P0001',
              detail = to_char(proximo at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
    end if;
  end if;
  new.name_changed_at := now();
  return new;
end;
$$;
revoke all on function public.limitar_cambio_de_nombre() from public, anon, authenticated;

commit;
