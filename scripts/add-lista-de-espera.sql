-- Lista de espera de la landing (25/09/2026).
--
-- Pre-lanzamiento: la app no está en las tiendas, así que los botones de
-- descarga de vitaapp.com.ar decían "Muy pronto" y no llevaban a ningún lado.
-- Quien entraba no tenía nada para hacer. Ahora deja su mail para que le
-- avisemos cuando salga, como persona que busca acompañamiento o como
-- profesional que quiere sumarse.
--
-- 📌 La web no tiene sesión: escribe con la anon key. Por eso NO hay grants
-- sobre la tabla (anon no la lee ni la escribe) y la única puerta es la
-- función `anotarse_lista_espera`, que valida, normaliza y pone tope por IP.
--
-- 🔒 La función responde SIEMPRE lo mismo, esté o no el mail anotado: no sirve
-- para averiguar si alguien ya dejó su dirección.
--
-- Idempotente.

create table if not exists public.lista_de_espera (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254),
  tipo text not null check (tipo in ('persona', 'profesional')),
  ref text check (ref is null or ref ~ '^[A-Za-z0-9_-]{1,32}$'),
  created_at timestamptz not null default now(),
  avisado_at timestamptz,
  unique (email, tipo)
);
alter table public.lista_de_espera enable row level security;
revoke all on public.lista_de_espera from anon, authenticated;
revoke all on sequence public.lista_de_espera_id_seq from anon, authenticated;

create or replace function public.anotarse_lista_espera(p_email text, p_tipo text, p_ref text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mail text := lower(btrim(coalesce(p_email, '')));
  ip text := request_ip();
  r text := nullif(btrim(coalesce(p_ref, '')), '');
begin
  if length(mail) > 254 or mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'email_invalido' using errcode = 'P0001';
  end if;
  if p_tipo not in ('persona', 'profesional') then
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;
  -- Un código de referido raro no frena la inscripción: se descarta.
  if r is not null and r !~ '^[A-Za-z0-9_-]{1,32}$' then
    r := null;
  end if;
  -- 5 por hora por IP alcanza para una familia o una oficina que comparten red.
  if ip is not null and not consume_rate_limit('lista_espera', 'ip:' || ip, 5, interval '1 hour') then
    raise exception 'rate_limited'
      using errcode = 'P0001', hint = 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  end if;

  insert into lista_de_espera (email, tipo, ref)
  values (mail, p_tipo, r)
  on conflict (email, tipo) do nothing;

  return 'ok';
end $$;
revoke all on function public.anotarse_lista_espera(text, text, text) from public, authenticated;
grant execute on function public.anotarse_lista_espera(text, text, text) to anon;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
do $$
declare
  v_filas text; v_norm text; v_mail text; v_tipo text; v_error text;
begin
  create temp table if not exists _res (chequeo text, resultado text);
  truncate _res;

  insert into _res select 'anon lee la tabla (esperado false)',
    has_table_privilege('anon', 'public.lista_de_espera', 'select')::text;
  insert into _res select 'anon inserta en la tabla (esperado false)',
    has_table_privilege('anon', 'public.lista_de_espera', 'insert')::text;
  insert into _res select 'authenticated lee la tabla (esperado false)',
    has_table_privilege('authenticated', 'public.lista_de_espera', 'select')::text;
  insert into _res select 'anon ejecuta la función (esperado true)',
    has_function_privilege('anon', 'public.anotarse_lista_espera(text, text, text)', 'execute')::text;
  insert into _res select 'authenticated ejecuta la función (esperado false)',
    has_function_privilege('authenticated', 'public.anotarse_lista_espera(text, text, text)', 'execute')::text;

  -- Prueba funcional con rollback: nada queda en la tabla. Los resultados se
  -- guardan en variables porque el rollback del bloque también deshace lo que
  -- se escriba en _res adentro.
  begin
    perform anotarse_lista_espera('  Prueba.Verificacion@Example.com ', 'persona', 'abc123');
    perform anotarse_lista_espera('prueba.verificacion@example.com', 'persona', null);
    perform anotarse_lista_espera('prueba.verificacion@example.com', 'profesional', 'mal ref!');
    select count(*)::text into v_filas from lista_de_espera where email = 'prueba.verificacion@example.com';
    select (exists (select 1 from lista_de_espera where email = 'prueba.verificacion@example.com' and tipo = 'profesional' and ref is null))::text into v_norm;
    begin
      perform anotarse_lista_espera('no-es-un-mail', 'persona', null);
      v_mail := 'NO (mal)';
    exception when others then
      v_mail := sqlerrm;
    end;
    begin
      perform anotarse_lista_espera('a@b.com', 'admin', null);
      v_tipo := 'NO (mal)';
    exception when others then
      v_tipo := sqlerrm;
    end;
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then
      v_error := sqlerrm;
    end if;
  end;
  insert into _res values ('filas tras 3 llamadas (esperado 2)', v_filas);
  insert into _res values ('mail normalizado + ref descartado (esperado true)', v_norm);
  insert into _res values ('mail inválido (esperado email_invalido)', v_mail);
  insert into _res values ('tipo inválido (esperado tipo_invalido)', v_tipo);
  insert into _res values ('error inesperado (esperado null)', coalesce(v_error, 'null'));

  insert into _res select 'filas de prueba que quedaron (esperado 0)', count(*)::text
    from lista_de_espera where email = 'prueba.verificacion@example.com';
end $$;
select * from _res;
