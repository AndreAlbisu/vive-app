-- Límite de intentos para lo que el cliente escribe directo en la base
-- (24/09/2026, punto 9 de la checklist de seguridad).
--
-- 🔴 Hasta hoy, salvo los push (`claim_push`), la IA (`registrar_uso_ia`) y el
-- chequeo de USDT, nada tenía tope. Con una cuenta, o sin cuenta en la
-- analítica, un script podía:
--   · abrir reportes de sesión sin fin, y CADA UNO le manda un mail a cada admin;
--   · inundar `reports` o un chat;
--   · crear reservas en masa, que retienen horarios de la agenda de un
--     profesional hasta que vencen;
--   · llenar `analytics_events` con la anon key.
--
-- 📌 Mismo patrón que `claim_push`: una fila por (bucket, sujeto) con ventana
-- fija, así que la tabla no crece con cada intento. El sujeto es el usuario; sin
-- sesión, la IP que pone Cloudflare (`cf-connecting-ip`, que el cliente no puede
-- falsificar, a diferencia de `x-forwarded-for`). Si no hay ni usuario ni IP
-- (service role, crons, triggers internos) NO se limita: los topes son para el
-- cliente, no para el sistema.
--
-- Los números están pensados para no tocar nunca un uso normal. Son un techo
-- contra scripts, no una regla de producto.
--
-- Idempotente.

create table if not exists public.rate_limits (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 1,
  primary key (bucket, subject)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Suma un intento y dice si todavía entra en el tope.
create or replace function public.consume_rate_limit(p_bucket text, p_subject text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, now(), 1)
  on conflict (bucket, subject) do update set
    hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into n;
  return n <= p_max;
end $$;
revoke all on function public.consume_rate_limit(text, text, integer, interval) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, interval) to service_role;

-- La IP de quien llama por PostgREST, o null (llamadas internas).
create or replace function public.request_ip()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)
  ), '')
$$;
revoke all on function public.request_ip() from public, anon, authenticated;

-- Trigger genérico: TG_ARGV = (bucket, máximo, segundos de la ventana).
create or replace function public.tg_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sujeto text;
begin
  sujeto := coalesce(auth.uid()::text, 'ip:' || request_ip());
  if sujeto is null then
    return new;
  end if;
  if not consume_rate_limit(tg_argv[0], sujeto, tg_argv[1]::integer, make_interval(secs => tg_argv[2]::integer)) then
    raise exception 'rate_limited'
      using errcode = 'P0001', hint = 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  end if;
  return new;
end $$;
revoke all on function public.tg_rate_limit() from public, anon, authenticated;

-- Cada reporte le manda un mail a cada admin: 5 por hora sobra.
drop trigger if exists trg_rate_limit on public.session_issues;
create trigger trg_rate_limit before insert on public.session_issues
  for each row execute function public.tg_rate_limit('session_issue', '5', '3600');

drop trigger if exists trg_rate_limit on public.reports;
create trigger trg_rate_limit before insert on public.reports
  for each row execute function public.tg_rate_limit('report', '10', '3600');

-- Un chat rápido son unos pocos mensajes por minuto; 40 es un script.
drop trigger if exists trg_rate_limit on public.messages;
create trigger trg_rate_limit before insert on public.messages
  for each row execute function public.tg_rate_limit('message', '40', '60');

-- Cada reserva retiene un horario hasta que vence. Reintentar un pago crea
-- reservas nuevas, así que el tope deja margen para eso.
drop trigger if exists trg_rate_limit on public.bookings;
create trigger trg_rate_limit before insert on public.bookings
  for each row execute function public.tg_rate_limit('booking', '12', '3600');

-- La analítica acepta escrituras sin cuenta: acá el sujeto suele ser la IP. El
-- onboarding emite decenas de eventos; 300 cada 5 minutos no lo roza.
drop trigger if exists trg_rate_limit on public.analytics_events;
create trigger trg_rate_limit before insert on public.analytics_events
  for each row execute function public.tg_rate_limit('analytics', '300', '300');

-- Limpieza: una fila por sujeto y bucket no crece rápido, pero tampoco hace
-- falta guardar ventanas de hace días.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-rate-limits') then
    perform cron.unschedule('purge-rate-limits');
  end if;
  perform cron.schedule('purge-rate-limits', '37 5 * * *',
    $q$delete from public.rate_limits where window_start < now() - interval '2 days'$q$);
end $$;

-- ── VERIFICACIÓN
-- Como usuario real, con rollback: el sexto reporte de sesión en una hora se
-- frena, y el trigger no toca inserts sin usuario ni IP (service role).
create temp table _res(chequeo text, resultado text);
do $$
declare
  b record;
  i int;
  ok int := 0;
  err text := null;
begin
  select bk.id, bk.user_id into b from bookings bk order by bk.created_at desc limit 1;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    for i in 1..6 loop
      begin
        insert into session_issues (booking_id, motivo) values (b.id, 'otro');
        ok := ok + 1;
        -- Se cierra para que el índice de "un caso abierto" no frene antes que el tope.
        reset role;
        update session_issues set estado = 'resuelto' where booking_id = b.id and estado <> 'resuelto';
        set local role authenticated;
      exception when others then
        err := sqlerrm;
        exit;
      end;
    end loop;
    reset role;
    raise exception 'fin';
  exception when others then
    reset role;
    insert into _res values ('reportes aceptados antes del tope (esperado 5)', ok::text),
                            ('el sexto (esperado rate_limited)', coalesce(err, 'no frenó'));
  end;

  -- Sin usuario ni IP: no se limita.
  begin
    perform set_config('request.jwt.claims', '', true);
    for i in 1..8 loop
      insert into reports (reporter_id, reported_id, reason)
      select b.user_id, b.user_id, 'otro';
    end loop;
    raise exception 'ok';
  exception when others then
    insert into _res values ('8 inserts internos seguidos (esperado ok)', sqlerrm);
  end;
end $$;
insert into _res select 'triggers instalados (esperado 5)', count(*)::text from pg_trigger where tgname = 'trg_rate_limit';
insert into _res select 'filas de prueba en rate_limits (esperado 0)', count(*)::text from rate_limits where bucket = 'session_issue';
insert into _res select 'cliente puede llamar consume_rate_limit (esperado false)',
  has_function_privilege('authenticated', 'public.consume_rate_limit(text,text,integer,interval)', 'execute')::text;
insert into _res select 'cron de limpieza', count(*)::text from cron.job where jobname = 'purge-rate-limits';
select * from _res;
