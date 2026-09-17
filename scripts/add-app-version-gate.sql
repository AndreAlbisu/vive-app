-- add-app-version-gate.sql
--
-- La versión mínima obligatoria: qué versión de la app hace falta para usarla.
--
-- ✅ CORRIDO y VERIFICADO el 16/09/2026 desde el CLI: las dos filas en 1.0.0, se
--    lee SIN sesión por la API (como la app antes del login), y un intento de
--    cambiarla con la anon key rebota con `permission denied` y el valor queda
--    igual.
--
-- ── Por qué ahora, con cero usuarios ─────────────────────────────────────────
--
-- 🔴 Es lo único de su tipo que NO se puede agregar después. Una app que ya está
-- instalada en el teléfono de alguien sin este mecanismo no se puede obligar a
-- actualizar nunca: quien no actualice por su cuenta se queda con esa versión
-- para siempre. Si la primera versión pública sale sin esto, el primer error
-- grave de pagos o de seguridad no se va a poder cortar para todos. Por eso va
-- ANTES de publicar en las tiendas (decisión de Andre, 16/09/2026).
--
-- ── Cómo se usa ──────────────────────────────────────────────────────────────
--
-- Subir `min_version` de una plataforma bloquea la app a todo el que tenga una
-- versión anterior, con una pantalla que lo manda a la tienda:
--
--   update public.app_version_gate
--      set min_version = '1.2.0', mensaje = 'Arreglamos un problema con los pagos.'
--    where platform in ('ios', 'android');
--
-- 🔴 Bloquea la app ENTERA, incluso a alguien con una sesión en diez minutos.
-- Subirla es para emergencias —la versión vieja cobra mal, expone datos, rompe
-- algo— y no para "salió una versión con mejoras". Para eso alcanza con que la
-- tienda la actualice sola.
--
-- ── Decisiones de diseño ─────────────────────────────────────────────────────
--
-- · Tabla y no una variable de las edge functions: se tiene que poder leer ANTES
--   de iniciar sesión (la pantalla de login también tiene que poder bloquearse),
--   así que la lee `anon` directo. Expone solo números de versión y links de las
--   tiendas, que son públicos igual.
-- · El link a la tienda vive ACÁ y no en el código. La app todavía no está
--   publicada y el link de la App Store no existe: cuando exista se carga con un
--   update, sin sacar una versión nueva. Android sí se puede armar desde ya con
--   el nombre del paquete.
-- · `mensaje` es opcional: una línea que explique por qué, para no bloquear a
--   alguien sin decirle nada.
-- · La app FALLA ABIERTA: si no puede leer esta tabla (sin señal, error), deja
--   pasar. Un control de versión que deja afuera a quien no tiene internet es
--   peor que no tenerlo.

begin;

create table if not exists public.app_version_gate (
  platform     text primary key check (platform in ('ios', 'android')),
  -- Tres números separados por punto, como `version` en app.json.
  min_version  text not null check (min_version ~ '^\d+\.\d+\.\d+$'),
  store_url    text check (store_url is null or store_url ~ '^https://'),
  mensaje      text check (mensaje is null or length(mensaje) <= 200),
  updated_at   timestamptz not null default now()
);

-- Arranca en 1.0.0, la versión de hoy: no bloquea a nadie hasta que se suba.
insert into public.app_version_gate (platform, min_version, store_url) values
  ('ios', '1.0.0', null),
  ('android', '1.0.0', 'https://play.google.com/store/apps/details?id=com.andrealbisu.viveapp')
on conflict (platform) do nothing;

create or replace function public.touch_app_version_gate()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_version_gate on public.app_version_gate;
create trigger trg_touch_app_version_gate
  before update on public.app_version_gate
  for each row execute function public.touch_app_version_gate();

alter table public.app_version_gate enable row level security;

-- La lee cualquiera, logueado o no. Nadie la escribe desde la app: se cambia con
-- SQL (lo corre Claude desde el CLI) o desde el dashboard.
drop policy if exists app_version_gate_select_all on public.app_version_gate;
create policy app_version_gate_select_all on public.app_version_gate
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.app_version_gate from anon, authenticated;
grant select on public.app_version_gate to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) Las dos filas, en 1.0.0.
select platform, min_version, store_url, mensaje from public.app_version_gate order by platform;

-- 2) 🔴 Nadie la puede escribir desde la app. Esperado: 0 filas.
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'app_version_gate'
  and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT';
