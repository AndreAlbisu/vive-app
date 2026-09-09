-- add-email-es-de-coach.sql
--
-- `email_es_de_coach(text)` — contesta si un mail ya pertenece a una cuenta de
-- profesional, sin exponer ningún mail.
--
-- ✅ CORRIDO el 08/09/2026, y VERIFICADO desde afuera con la anon key:
--   · la RPC es llamable por `anon` y devuelve **false** para un mail
--     inventado, también con espacios y mayúsculas de más (el `lower(trim())`
--     hace lo suyo);
--   · `profiles.email` sigue devolviendo **42501** — la función no reabrió la
--     columna por la ventana;
--   · el catálogo sigue dando 200 con los perfiles embebidos.
--
-- ⚠️ **El caso POSITIVO no se pudo probar desde afuera, y eso es la prueba de
-- que el arreglo funciona**: para verificarlo haría falta el mail de un coach, y
-- justamente ya no hay forma de conseguirlo con la anon key. Se prueba con la
-- verificación 2 de abajo (desde el editor SQL) o registrándose con el mail de
-- una cuenta de profesional y viendo el mensaje correcto.
--
-- ── Por qué existe: un chequeo que rompí yo ──────────────────────────────────
--
-- `restrict-anon-profiles-columns.sql` (08/09/2026) le sacó a `anon` el SELECT
-- sobre `profiles.email`. Correcto — pero `RegisterScreen.tsx:116` **filtraba**
-- por esa columna:
--
--   supabase.from('profiles').select('id').eq('email', …)
--
-- 🔴 **Y filtrar por una columna exige privilegio de SELECT sobre esa columna**,
-- no solo sobre las que se piden. Esa consulta pasó a devolver
-- `42501 permission denied`.
--
-- 📌 **Falló ABIERTO, no cerrado, y por eso no se vio**: el código hace
-- `const { data: existingProfile } = await …` y **descarta el error**. Con `data`
-- en null el `if` no entra, y el registro sigue. O sea que no se rompió el alta:
-- se rompió **el aviso** de que ese mail ya es de un profesional. La persona
-- llegaba igual a `signUpWithEmail` y recibía el error genérico de auth
-- ("User already registered") en vez de *"Esta cuenta ya está registrada como
-- profesional"*. Un error de permisos que se ve como un mensaje peor: exactamente
-- la clase de falla que este proyecto viene anotando.
--
-- ── Por qué una función y no devolverle el grant ─────────────────────────────
--
-- Devolverle `email` a `anon` reabre el agujero entero: era eso lo que dejaba
-- bajarse el roster de coaches con sus mails. La pregunta que la pantalla
-- necesita hacer no es *"dame los mails"* sino *"¿este mail ya es de un
-- profesional?"*, que es un booleano.
--
-- `security definer` para que corra con los privilegios del dueño y pueda mirar
-- `profiles.email` aunque quien llama no pueda. `search_path` fijo porque sin eso
-- una función definer es escalable por quien controle el path de la sesión.
--
-- ⚠️ **Lo que sigue siendo posible, dicho de frente**: alguien puede probar
-- mails de a uno y averiguar si son de un coach. Es enumeración, y es MUCHO más
-- débil que el volcado que había antes — hay que conocer el mail para preguntar.
-- Y es la misma información que el alta de Supabase filtra igual al responder
-- "User already registered". Si algún día molesta, se le pone rate limit.

begin;

create or replace function public.email_es_de_coach(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from profiles p
    join coaches c on c.profile_id = p.id
    where lower(p.email) = lower(trim(p_email))
  );
$$;

-- Nadie por default; solo quien la necesita. `anon` porque el registro ocurre
-- sin sesión, y `authenticated` porque la pantalla también se puede abrir con
-- una sesión colgada.
revoke all on function public.email_es_de_coach(text) from public;
grant execute on function public.email_es_de_coach(text) to anon, authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) Existe, es definer y tiene el search_path fijo.
--    Esperado: 1 fila, `prosecdef = true`, y `proconfig` con search_path=public.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'email_es_de_coach';

-- 2) Contesta lo que tiene que contestar. Esperado: t en el mail de un coach
--    real, f en uno inventado.
select
  public.email_es_de_coach((select p.email from profiles p join coaches c on c.profile_id = p.id limit 1)) as un_coach_real,
  public.email_es_de_coach('no-existe-jamas@ejemplo.invalid')                                             as inventado;

-- 3) 🔴 Y lo que NO tiene que pasar: que `anon` haya recuperado el acceso a la
--    columna por la ventana. Esperado: 0 filas.
select column_name
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'SELECT'
  and column_name = 'email';
