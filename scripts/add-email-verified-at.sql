-- ============================================================
-- Vita — dejar constancia de que un mail fue verificado de verdad
-- Correr en: Supabase Dashboard → SQL Editor
-- ✅ CORRIDO por Andre el 31/08/2026
-- Fecha: 2026-08-31
--
-- QUÉ RESUELVE
-- El alta de coach no verificaba el mail. Consecuencias, las dos reales:
--   · quien se equivoca al tipear su dirección queda con una cuenta que NO
--     PUEDE RECUPERAR NUNCA (`resetPassword` manda un mail a una dirección que
--     no existe) y sin forma de enterarse;
--   · Vita aprueba profesionales sin haber comprobado que la casilla desde la
--     que se postulan sea suya, que en una verificación de credenciales es
--     justamente el tipo de cosa que no se puede dar por sentada.
--
-- ⚠️ POR QUÉ UNA COLUMNA NUESTRA Y NO `auth.users.email_confirmed_at`
-- El proyecto tiene "Confirm email" APAGADO, así que Supabase auto-confirma a
-- todo el mundo en el alta: `email_confirmed_at` viene lleno siempre y no
-- distingue nada. Y prenderlo es del proyecto entero — se llevaría puesto
-- también el registro de usuarios, que a propósito NO se quiere frenar con un
-- muro de mail en el peor momento. Así que la verificación del coach se hace
-- por código OTP desde la app, y el resultado se anota acá.
--
-- QUÉ HACE
--   1. Agrega `profiles.email_verified_at` (timestamptz, nullable).
--
-- Nullable a propósito: null = nunca se verificó (todas las filas de hoy, y las
-- de los usuarios finales, que no pasan por este paso).
--
-- Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

COMMENT ON COLUMN public.profiles.email_verified_at IS
  'Cuándo la persona probó tener acceso a su casilla (código OTP en el alta de coach). NULL = nunca. No confundir con auth.users.email_confirmed_at, que con "Confirm email" apagado viene lleno siempre.';

-- Refrescar caché de PostgREST (si no, la columna nueva no existe para la app)
NOTIFY pgrst, 'reload schema';


-- ── Verificación ─────────────────────────────────────────────────────────────
-- Esperado: una fila, `tipo = timestamp with time zone`, `acepta_null = YES`.
--
-- select column_name, data_type as tipo, is_nullable as acepta_null
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name   = 'profiles'
--    and column_name  = 'email_verified_at';
