-- Prueba de que la sesión ocurrió — D10, segunda mitad
-- ---------------------------------------------------
-- 🔴 Hoy no existe NINGUNA prueba de que una sesión haya pasado. Hay
-- `meeting_url` y `duration_minutes`, pero nada guarda quién entró ni cuándo.
--
-- Sobre una videollamada, la disputa que va a llegar es **"el servicio no se
-- prestó"**, y hoy no habría nada que presentar. No es un caso débil: es no tener
-- evidencia. Daily sí produce esos datos; simplemente no se estaban guardando.
--
-- ⚠️ ESTO ES METADATO, NO CONTENIDO: quién entró, cuándo y cuánto duró. Nunca
-- audio, video ni transcripción. Aun así **hay que declararlo en la política de
-- privacidad** — es una sesión de salud mental y la 25.326 aplica. La política
-- todavía tiene placeholders esperando al abogado; el ítem va con ellos.

create table if not exists public.session_attendance (
  booking_id     uuid primary key references public.bookings(id) on delete cascade,
  room_name      text not null,
  checked_at     timestamptz not null default now(),

  -- Resumen, derivado como MEJOR ESFUERZO de la respuesta de Daily.
  -- 🔴 Si alguno de estos queda en null, la evidencia NO se perdió: está entera
  -- en `raw`. El resumen existe para poder consultar sin abrir el JSON, no para
  -- reemplazarlo. Si algún día cambia la forma de la respuesta, se recalcula
  -- desde `raw` sin volver a pedirle nada a Daily.
  meetings_count      integer,
  participants_count  integer,
  max_simultaneous    integer,
  first_join_at       timestamptz,
  total_seconds       integer,

  -- La respuesta cruda. **Es la evidencia**: lo que se presenta en una disputa
  -- no es nuestro resumen sino lo que dijo el proveedor de la videollamada.
  raw jsonb
);

comment on table public.session_attendance is
  'Metadato de participación en la videollamada, traído de Daily. Prueba de que la sesión ocurrió, para disputas. NUNCA contenido: ni audio, ni video, ni transcripción.';
comment on column public.session_attendance.raw is
  'Respuesta cruda de Daily. Es la evidencia; el resumen de arriba se deriva de acá y se puede recalcular.';

-- 📝 `participants_count = 0` NO es un dato faltante: es la constancia de que
-- **nadie entró**, que es exactamente lo que hace falta para el caso inverso —
-- alguien que reclama una sesión que no dio. Por eso la función solo escribe un
-- cero cuando ya pasó tiempo suficiente como para que sea concluyente.

-- ── RLS: solo el panel ───────────────────────────────────────────────────────
-- No se le muestra al coach ni al cliente. Es material para resolver una
-- disputa, y exponerlo invita a discutir el dato en vez del hecho.
alter table public.session_attendance enable row level security;

drop policy if exists attendance_select_admin on public.session_attendance;
create policy attendance_select_admin on public.session_attendance
  for select to authenticated
  using (public.is_admin());

revoke all on public.session_attendance from anon;

-- ── El cron ──────────────────────────────────────────────────────────────────
-- Cada hora. La ventana de disputa de PayPal es de meses, pero **la retención de
-- Daily no está verificada**, así que se trae temprano y se guarda en nuestra
-- base. Lo que importa es tenerlo acá durante esos meses, no allá.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    raise exception 'Falta el secret service_role_key en el Vault. Corré scripts/add-refund-cron.sql primero.';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
     like '%PEGAR_SERVICE_ROLE_KEY%' then
    raise exception 'El secret service_role_key tiene el placeholder sin reemplazar.';
  end if;
end $$;

select cron.schedule(
  'session-attendance',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/session-attendance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) La tabla y su RLS:
--    select relrowsecurity from pg_class where relname = 'session_attendance';
--    select polname from pg_policy where polrelid = 'public.session_attendance'::regclass;
--
-- 2) El cron quedó agendado:
--    select jobname, schedule, active from cron.job where jobname = 'session-attendance';
--
-- 3) 🔴 La que vale — disparar a mano y mirar la RESPUESTA, no que figure activo:
--    select net.http_post(
--      url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/session-attendance',
--      headers := jsonb_build_object('Content-Type','application/json',
--        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
--      body    := '{}'::jsonb);
--    -- unos segundos después:
--    select status_code, content from net._http_response order by created desc limit 3;
--    -- esperado: 200 {"revisadas":N,"guardadas":M,...}
--
-- 4) Lo que quedó guardado:
--    select booking_id, participants_count, total_seconds, first_join_at from public.session_attendance;

-- ── Revertir ─────────────────────────────────────────────────────────────────
--   select cron.unschedule('session-attendance');
--   drop table if exists public.session_attendance;
