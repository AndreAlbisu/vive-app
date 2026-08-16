-- Alta de perfil: traer nombre y foto de los proveedores sociales
-- ---------------------------------------------------------------
-- El trigger de alta escribía (id, email, name, role) y nunca `avatar_url`.
-- Google manda la foto en la metadata del usuario desde el primer login, pero
-- se quedaba en `auth.users.raw_user_meta_data` y no llegaba a `profiles` —
-- y TODAS las pantallas leen `profiles.avatar_url`, ninguna lee la metadata.
-- Resultado: quien se registraba con Google veía sus iniciales teniendo la
-- foto disponible.
--
-- `avatar_url` guarda la URL pública completa (ver `getPublicUrl` en
-- EditProfileScreen/CoachProfileScreen), no un path de Storage, así que una URL
-- de googleusercontent entra sin adaptar nada del lado de la app.
--
-- Dos claves distintas a propósito: Supabase escribe la foto de Google como
-- `avatar_url`, pero el claim OIDC crudo se llama `picture` y según el proveedor
-- aparece uno, el otro, o los dos. Mismo criterio con `name` / `full_name`.
-- El `nullif` es porque estos campos vienen como string vacío, no NULL, cuando
-- el proveedor no los da — y '' no lo corta un `coalesce`.

-- Guarda: si el trigger de auth.users no apunta a esta función, reemplazarla
-- crea una función huérfana y el alta sigue usando la vieja, en silencio.
do $$
declare fn text;
begin
  select p.pronamespace::regnamespace || '.' || p.proname
    into fn
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
   where t.tgrelid = 'auth.users'::regclass
     and not t.tgisinternal;

  if fn is distinct from 'public.handle_new_user' then
    raise exception
      'El trigger de auth.users apunta a %, no a public.handle_new_user. Corregí el nombre en este script antes de correrlo.', fn;
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      'Usuario'
    ),
    'user',
    coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      nullif(new.raw_user_meta_data->>'picture', '')
    )
  );
  return new;
end;
$$;

-- Backfill: cuentas sociales ya creadas que tienen la foto en la metadata y
-- `profiles.avatar_url` vacío. Solo toca filas en NULL — nunca pisa una foto
-- que la persona haya subido, ni revive una lápida de baja de cuenta.
update public.profiles p
   set avatar_url = coalesce(
         nullif(u.raw_user_meta_data->>'avatar_url', ''),
         nullif(u.raw_user_meta_data->>'picture', '')
       )
  from auth.users u
 where u.id = p.id
   and p.avatar_url is null
   and p.deleted_at is null
   and coalesce(
         nullif(u.raw_user_meta_data->>'avatar_url', ''),
         nullif(u.raw_user_meta_data->>'picture', '')
       ) is not null;

-- Verificación
-- select id, email, name, avatar_url is not null as tiene_foto
--   from public.profiles order by created_at desc limit 10;
