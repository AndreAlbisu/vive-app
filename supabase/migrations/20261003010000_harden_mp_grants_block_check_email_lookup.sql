-- Endurecimiento del 03/10/2026 (fase 1 de la auditoría: `supabase db advisors`).
-- Ninguno de los tres era explotable; son segundas cerraduras.

-- 1. `coach_mp_accounts` guarda los tokens de Mercado Pago de cada profesional.
--    La protegía solo el RLS (habilitado y sin policies): la tabla conservaba
--    los grants por defecto de Supabase. Solo la lee el service role.
revoke all on table public.coach_mp_accounts from anon, authenticated;

-- 2. `are_blocked` le contestaba a cualquier cuenta si dos personas CUALESQUIERA
--    estaban bloqueadas entre sí. Ahora a un usuario común solo le contesta si
--    es una de las dos. Los triggers, el service role, el cron y los admins
--    (`pares_que_dejaron_de_reservar`) siguen viendo todo.
create or replace function public.are_blocked(a uuid, b uuid) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select (coalesce(auth.role(), '') <> 'authenticated'
          or auth.uid() in (a, b)
          or public.is_admin())
     and exists (
       select 1 from public.blocked_users
       where (blocker_id = a and blocked_id = b)
          or (blocker_id = b and blocked_id = a)
     );
$$;

-- 3. `email_es_de_coach` la puede llamar cualquiera sin cuenta (la usa el alta)
--    y no tenía tope: servía para probar listas de mails contra el padrón de
--    profesionales. 20 consultas por hora por IP. La pantalla de alta ya trata
--    el error como "no sé" y sigue (el alta falla sola si el mail existe).
create or replace function public.email_es_de_coach(p_email text) returns boolean
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare ip text := request_ip();
begin
  if ip is not null and not consume_rate_limit('email_es_de_coach', 'ip:' || ip, 20, interval '1 hour') then
    raise exception 'rate_limited'
      using errcode = 'P0001', hint = 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  end if;
  return exists (
    select 1
    from profiles p
    join coaches c on c.profile_id = p.id
    where lower(p.email) = lower(trim(p_email))
  );
end $$;
