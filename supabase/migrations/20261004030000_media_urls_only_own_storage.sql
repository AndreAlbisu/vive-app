-- Fase 3 de la auditoría, tanda 3 (04/10/2026).
--
-- `profiles.avatar_url`, `coaches.video_url` y `coaches.application_video_url`
-- las escribe el cliente, y la base aceptaba cualquier dirección. La app sube
-- la foto y el video a nuestro Storage, pero por la API alguien podía apuntar
-- su foto o su video a un servidor propio: cada persona que abre ese perfil
-- (en la app o en /c, sin cuenta) le pide el archivo a ese servidor y le deja
-- su IP y la hora. Probado en el proyecto de prueba.
--
-- Desde el cliente, foto y video solo pueden vivir en nuestro Storage, en la
-- carpeta de la propia cuenta. El video de la postulación sigue siendo un link
-- externo (Drive, YouTube), con la misma forma que ya exige
-- `submit_coach_application`. El alta con Google o Apple (`handle_new_user`,
-- security definer) y el service role no pasan por acá.

begin;

-- ⚠️ Lleva el ref del proyecto: en otro proyecto de Supabase hay que cambiarlo.
create or replace function public.base_de_archivos()
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select 'https://ggygiihhnkjrerpinhha.supabase.co/storage/v1/object/public/'::text $$;
revoke all on function public.base_de_archivos() from public, anon;
grant execute on function public.base_de_archivos() to authenticated, service_role;

create or replace function public.guard_profile_media()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and left(new.avatar_url, length(public.base_de_archivos() || 'avatars/' || new.id::text || '/'))
         <> public.base_de_archivos() || 'avatars/' || new.id::text || '/' then
    raise exception 'FOTO_FUERA_DE_VITA'
      using errcode = 'P0001', hint = 'La foto de perfil se sube desde la app.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_media() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_media on public.profiles;
create trigger trg_guard_profile_media
  before update of avatar_url on public.profiles
  for each row execute function public.guard_profile_media();

create or replace function public.guard_coach_media()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  base text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  base := public.base_de_archivos() || 'coach-videos/' || new.profile_id::text || '/';
  if (tg_op = 'INSERT' or new.video_url is distinct from old.video_url)
     and new.video_url is not null
     and left(new.video_url, length(base)) <> base then
    raise exception 'VIDEO_FUERA_DE_VITA'
      using errcode = 'P0001', hint = 'El video de presentación se sube desde la app.';
  end if;
  if (tg_op = 'INSERT' or new.application_video_url is distinct from old.application_video_url)
     and new.application_video_url is not null
     and new.application_video_url !~* '^https://[^/[:space:]]+(/[^[:space:]]*)?$' then
    raise exception 'postulacion_invalida' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_coach_media() from public, anon, authenticated;

drop trigger if exists trg_guard_coach_media on public.coaches;
create trigger trg_guard_coach_media
  before insert or update of video_url, application_video_url on public.coaches
  for each row execute function public.guard_coach_media();

commit;
