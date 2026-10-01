-- Límites al cambio de nombre (Claude, 01/10/2026, decidido por Andre: "me
-- cierra así").
--
-- Hasta hoy cualquiera cambiaba `profiles.name` cuantas veces quisiera desde
-- "Editar perfil". Dos reglas nuevas:
--
-- 1. Profesional aprobado: no cambia su nombre. Es el nombre que Vita revisó
--    (postulación, matrícula), el que firma sus reseñas y el que acompaña a su
--    link `/c/<slug>`, que a propósito no sigue al nombre. Si necesita una
--    corrección, la hace un admin desde el panel (`admin-actions`,
--    `set_profile_name`).
-- 2. Usuario: un cambio cada 30 días. El profesional lo ve en reservas y chats;
--    un nombre que cambia seguido confunde. Bloqueos y reportes van por id, así
--    que esto no es para esquivarlos, es para que el nombre sea estable.
--
-- Reemplazar el placeholder 'Usuario' del alta (`saveAppleName`) no cuenta como
-- cambio: es completar el nombre, no cambiarlo.
--
-- Va en la base y no solo en la pantalla porque `authenticated` tiene UPDATE
-- sobre la columna `name`: un límite que viviera en la app se saltea con la API.
-- Las escrituras con service role (admin-actions, delete-account) y el editor
-- SQL no pasan por los límites.

begin;

alter table public.profiles
  add column if not exists name_changed_at timestamptz;

-- Columna nueva en `profiles`: como los grants son por columna, nace sin
-- SELECT ni UPDATE para `authenticated`. La pantalla la lee del propio perfil
-- con `get_my_profile()` (security definer, `select *`), así que no hace falta
-- abrirla a nadie más.

-- La pregunta "¿es profesional aprobado?" va aparte y con security definer:
-- `authenticated` no puede leer `coaches.application_status` (grants por
-- columna). El trigger, en cambio, tiene que seguir siendo security invoker,
-- porque decide por `current_user` si quien escribe es la app o el service role.
-- Lo encontró la verificación del 01/10: con todo invoker, el trigger fallaba
-- con "permission denied for table coaches" y no dejaba cambiar el nombre a nadie.
create or replace function public.es_profesional_aprobado(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.coaches c
     where c.profile_id = p_profile_id
       and c.application_status = 'aprobada'
  );
$$;

-- `authenticated` la necesita porque el trigger corre con sus permisos. Solo
-- dice si alguien es profesional aprobado, que ya es público (el catálogo).
revoke all on function public.es_profesional_aprobado(uuid) from public, anon;
grant execute on function public.es_profesional_aprobado(uuid) to authenticated;

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
    -- Nadie más que este trigger escribe la fecha.
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

drop trigger if exists trg_limitar_cambio_de_nombre on public.profiles;
create trigger trg_limitar_cambio_de_nombre
  before update on public.profiles
  for each row execute function public.limitar_cambio_de_nombre();

commit;
