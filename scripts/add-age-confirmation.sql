-- add-age-confirmation.sql
--
-- Declaración de mayoría de edad en el alta.
--
-- T&C §3.1 dice que el Usuario "declara" ser mayor de 18 años, y la Política
-- §11 que no se recolectan datos de menores. Hasta hoy no se le preguntaba
-- nada a nadie: `birth_date` es opcional para el usuario y obligatoria solo
-- para el coach, y en ningún caso se validaba que fueran 18. O sea que la
-- cláusula afirmaba una declaración que nunca se pedía.
--
-- Esta columna es la constancia de esa declaración, con el mismo criterio que
-- `accepted_terms`: sin registro no es oponible.
--
-- ⚠️ NO se backfillea a true. Las cuentas anteriores al 13/08/2026 quedan en
-- false porque efectivamente nunca declararon nada — poner true sería fabricar
-- una constancia que no existió, que es peor que no tenerla. Si en algún
-- momento hace falta, se le pide la declaración a los existentes desde la app.

alter table public.profiles
  add column if not exists age_confirmed boolean not null default false;

comment on column public.profiles.age_confirmed is
  'El Usuario declaró tener 18 años o más al crear la cuenta (T&C §3.1). false en cuentas previas al 13/08/2026, donde no se preguntaba.';

-- Sin RLS nueva: `profiles` ya tiene `profiles_update_own` (id = auth.uid()),
-- que es la política por la que se escribe `accepted_terms` desde el cliente.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name = 'age_confirmed';
--   -- esperado: 1 fila, boolean, NO, false
