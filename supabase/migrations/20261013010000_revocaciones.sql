-- Solicitudes del botón de arrepentimiento (13/10/2026).
-- ✅ CORRIDO y VERIFICADO en producción el 13/10/2026.
--
-- Hasta hoy el botón era un enlace que abría un correo: el código de
-- identificación de la revocación que la Res. 424/2020 pide mandar dentro de las
-- 24 horas dependía de que alguien leyera esa casilla y contestara a mano. Ahora
-- la página tiene un formulario y el código lo emite la función `revocacion` en
-- el momento.
--
-- 📌 La página no tiene sesión (la norma prohíbe pedir registro). Por eso no hay
-- grants sobre la tabla: `anon` y `authenticated` no la leen ni la escriben, y
-- la única puerta es la edge function, que escribe con service role después de
-- validar y de pasar por `consume_rate_limit` (bucket `revocacion`).
--
-- Idempotente.

create table if not exists public.revocaciones (
  id bigint generated always as identity primary key,
  -- La constancia que recibe la persona. Lo genera la función.
  codigo text not null unique check (codigo ~ '^REV-[0-9]{8}-[A-Z0-9]{6}$'),
  nombre text not null check (length(nombre) between 2 and 120),
  email text not null check (length(email) <= 254),
  -- Lo que la persona cuenta para ubicar la reserva (fecha, profesional).
  detalle text check (detalle is null or length(detalle) <= 600),
  created_at timestamptz not null default now(),
  mail_enviado_at timestamptz,
  -- La marca Vita cuando la reserva quedó dada de baja y reintegrada.
  resuelta_at timestamptz
);
alter table public.revocaciones enable row level security;
revoke all on public.revocaciones from anon, authenticated;
revoke all on sequence public.revocaciones_id_seq from anon, authenticated;

-- Política de Privacidad §10: tres años desde la solicitud y después se borran.
create extension if not exists pg_cron;
select cron.unschedule('purge-revocaciones')
 where exists (select 1 from cron.job where jobname = 'purge-revocaciones');
select cron.schedule(
  'purge-revocaciones',
  '37 6 * * *',   -- 03:37 en Argentina, fuera de cualquier uso
  $$
    delete from public.revocaciones
     where created_at < now() - interval '3 years';
  $$
);

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
do $$
begin
  create temp table if not exists _res (chequeo text, resultado text);
  truncate _res;
  insert into _res select 'anon lee la tabla (esperado false)',
    has_table_privilege('anon', 'public.revocaciones', 'select')::text;
  insert into _res select 'anon inserta en la tabla (esperado false)',
    has_table_privilege('anon', 'public.revocaciones', 'insert')::text;
  insert into _res select 'authenticated lee la tabla (esperado false)',
    has_table_privilege('authenticated', 'public.revocaciones', 'select')::text;
  insert into _res select 'authenticated inserta en la tabla (esperado false)',
    has_table_privilege('authenticated', 'public.revocaciones', 'insert')::text;
  insert into _res select 'RLS activa (esperado true)',
    (select relrowsecurity::text from pg_class where oid = 'public.revocaciones'::regclass);
  insert into _res select 'borrado programado (esperado 1)',
    (select count(*)::text from cron.job where jobname = 'purge-revocaciones');
  insert into _res select 'filas en la tabla', (select count(*)::text from public.revocaciones);
end $$;
select * from _res;
