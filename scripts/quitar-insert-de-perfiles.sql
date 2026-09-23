-- quitar-insert-de-perfiles.sql
--
-- Auditoría de seguridad, tanda 4 (23/09/2026) — área: autenticación.
--
-- 🔴 HALLAZGO (latente, no explotable hoy): `authenticated` tenía INSERT sobre
-- **20 columnas de `profiles`, incluidas `is_admin` y `role`**, con la policy
-- `Users can insert their own profile` (`auth.uid() = id`). O sea: si a alguien
-- le faltara su fila de perfil, podía crearla **marcándose administrador** —y
-- `admin-actions`, el panel y las policies de admin confían en esa columna.
--
-- Por qué NO es explotable hoy, medido contra producción:
--   · el perfil lo crea el trigger `on_auth_user_created` (`handle_new_user`),
--     no la app: **ninguna pantalla inserta en `profiles`**;
--   · no hay ninguna cuenta de auth sin perfil (0 de 8), así que la fila ya
--     existe y un INSERT choca contra la PK;
--   · `profiles` **no tiene policy de DELETE**, así que nadie puede borrar la
--     suya para volver a crearla.
--
-- La ventana se abriría con que el trigger fallara una vez en un alta. El
-- privilegio no lo usa nadie, así que se saca: es gratis y cierra el peor caso.
--
-- Fecha: 2026-09-23

begin;

revoke insert on public.profiles from anon, authenticated;

-- La policy queda (no hace daño sin privilegio) con su motivo escrito.
comment on table public.profiles is
  'El perfil lo crea el trigger on_auth_user_created. authenticated NO tiene INSERT desde el 23/09/2026 (auditoría): podía nacer con is_admin=true. Ver scripts/quitar-insert-de-perfiles.sql.';

commit;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare v int; v_err text; v_uid uuid := gen_random_uuid();
begin
  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='profiles' and grantee in ('anon','authenticated')
     and privilege_type='INSERT';
  insert into _r values ('privilegios de INSERT que quedan (esperado 0)', v::text, v = 0);

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text,'role','authenticated')::text, true);
    insert into public.profiles (id, email, name, role, is_admin) values (v_uid, 'x@x.invalid', 'x', 'coach', true);
  exception when others then v_err := sqlerrm;
  end;
  reset role;
  delete from public.profiles where id = v_uid;  -- por si entrara, no queda nada

  insert into _r values ('🔴 crearse un perfil como admin ahora falla', coalesce(v_err,'NO FALLÓ'), v_err is not null);
  insert into _r values ('el alta normal la sigue haciendo el trigger', (select count(*)::text from pg_trigger where tgname='on_auth_user_created'), exists (select 1 from pg_trigger where tgname='on_auth_user_created'));
  insert into _r values ('cuentas de auth sin perfil (esperado 0)', (select count(*)::text from auth.users u left join public.profiles p on p.id=u.id where p.id is null), not exists (select 1 from auth.users u left join public.profiles p on p.id=u.id where p.id is null));
  insert into _r values ('admins (no cambió)', (select count(*)::text from public.profiles where is_admin), (select count(*) from public.profiles where is_admin) = 3);
end $$;

select * from _r;
