-- add-ai-usage.sql
--
-- `ai_usage` — cuántas veces por día llamó cada persona a una feature de IA.
--
-- ⚠️ PENDIENTE DE CORRER (escrito el 09/09/2026).
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- 🔴 `weekly-reflection` llama a la API de Anthropic y **no tiene ningún tope
-- por usuario**. Está bien defendida en lo que se propuso defender: exige token
-- de usuario real y no la anon key (el comentario en la función explica que si
-- no, cualquiera con la clave pública quema la cuota), y valida las entradas
-- contra listas cerradas para que no entre texto libre al prompt.
--
-- Pero el único freno de FRECUENCIA es un caché en `AsyncStorage`
-- (`hooks/useDailyReflection.ts`), o sea **en el teléfono**: una llamada por día
-- por señal. Un script con un token válido la llama las veces que quiera, y
-- cada llamada es plata.
--
-- 📌 El CAPTCHA del alta encarece esto de rebote —conseguir mil tokens válidos
-- deja de ser gratis— pero no lo cierra: una sola cuenta legítima alcanza.
--
-- 📌 Y es el vector realista para un proyecto de este tamaño: lo que se cae no
-- es el servidor, es **la factura**. Supabase aguanta el tráfico.
--
-- ── Por qué una tabla y no contar de `analytics_events` ──────────────────────
--
-- Esa tabla existe para medir, crece sin techo y se consulta por otros motivos.
-- Colgar un límite de gasto de un índice que está para analítica ata dos cosas
-- que van a evolucionar por separado. Acá una fila por persona/día/feature, que
-- es exactamente el dato que la decisión necesita y nada más.
--
-- ── Por qué el tope se pasa por parámetro ────────────────────────────────────
--
-- El número vive en la edge function (`REFLECTION_TOPE_DIARIO`), no acá: se
-- ajusta con `supabase secrets set` y sin migración. La tabla cuenta; quién
-- decide cuánto es demasiado es la aplicación.

begin;

create table if not exists public.ai_usage (
  user_id   uuid not null references auth.users(id) on delete cascade,
  -- Fecha de Argentina, no UTC: es la misma ventana que ve la persona, y el
  -- supuesto de que el usuario está en Argentina ya es transversal en el
  -- esquema. Con UTC, el día se cortaría a las 21:00 hora local.
  dia       date not null,
  feature   text not null check (feature in ('weekly_reflection')),
  llamadas  integer not null default 0,
  primary key (user_id, dia, feature)
);

comment on table public.ai_usage is
  'Tope de gasto por persona y por día en features que llaman a un modelo. La escribe SOLO la edge function con service role, vía registrar_uso_ia(). No es analítica: si se necesita medir uso, esa pregunta va a analytics_events.';

-- ─────────────────────────────────────────────────────────────────────────────
-- El contador, atómico
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 🔴 Suma y contesta EN LA MISMA sentencia. Leer y después escribir desde la
-- función dejaría una ventana entre las dos, y dos llamadas simultáneas leerían
-- el mismo número y pasarían las dos — que es justo lo que hace quien abusa.
--
-- ⚠️ SUMA ANTES DE PREGUNTAR, a propósito: el intento rechazado también cuenta.
-- Si no, quien se pasa del tope puede seguir golpeando gratis todo el día, y
-- cada golpe es una consulta igual. El costo de eso lo paga el que abusa, no
-- alguien de buena fe: nadie de buena fe llega al tope.
create or replace function public.registrar_uso_ia(
  p_user    uuid,
  p_feature text,
  p_tope    integer
)
returns table (permitido boolean, usadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  insert into public.ai_usage (user_id, dia, feature, llamadas)
  values (
    p_user,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    p_feature,
    1
  )
  on conflict (user_id, dia, feature)
    do update set llamadas = public.ai_usage.llamadas + 1
  returning public.ai_usage.llamadas into v_n;

  return query select v_n <= p_tope, v_n;
end;
$$;

comment on function public.registrar_uso_ia is
  'Suma una llamada y dice si estaba dentro del tope, en una sola sentencia atómica. La llama la edge function con service role; no es para el cliente.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: nadie toca esto desde el cliente
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 🔴 Sin políticas y con RLS prendido, `authenticated` y `anon` no leen ni
-- escriben NADA. El service role no pasa por RLS, que es como entra la edge
-- function. Es deliberado que el titular tampoco lea: saber cuánto le queda del
-- tope solo le sirve a quien lo quiere agotar.
--
-- ⚠️ El `revoke` incluye `truncate, references, trigger` — el permiso sobrante
-- que documenta SCHEMA.md y que un `revoke insert, update, delete` no saca.
alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.ai_usage from anon, authenticated;

-- La función es del service role, no del cliente.
revoke all on function public.registrar_uso_ia(uuid, text, integer) from public, anon, authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La tabla existe con RLS prendido. Esperado: 1 fila, rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'ai_usage';

-- 2) 🔴 Sin políticas. Esperado: 0 filas. Si aparece alguna, alguien abrió la
--    tabla al cliente y el tope pasa a ser falsificable por quien lo sufre.
select policyname from pg_policies
where schemaname = 'public' and tablename = 'ai_usage';

-- 3) 🔴 Ni anon ni authenticated tienen permisos. Esperado: 0 filas.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'ai_usage'
  and grantee in ('anon', 'authenticated');

-- 4) El contador suma y corta. Esperado: primera llamada (true, 1), y con tope
--    1 la segunda del mismo día (false, 2). Correr con un user_id real y
--    después borrar la fila.
-- select * from public.registrar_uso_ia('<UUID>', 'weekly_reflection', 1);
-- select * from public.registrar_uso_ia('<UUID>', 'weekly_reflection', 1);
-- delete from public.ai_usage where user_id = '<UUID>';

-- 5) Cuando esté en producción: quién se está acercando al tope.
select dia, count(*) as personas, max(llamadas) as tope_alcanzado
from public.ai_usage
where feature = 'weekly_reflection'
group by dia
order by dia desc
limit 14;
