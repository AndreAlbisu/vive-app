-- add-marcar-mail-verificado.sql
--
-- `marcar_mail_verificado()` — la única forma de escribir
-- `profiles.email_verified_at`, y la marca la pone el SERVIDOR.
--
-- ⚠️ PENDIENTE DE CORRER (escrito el 10/09/2026). Tiene que correr ANTES de que
-- alguien use un build con el cliente nuevo: sin la función, `verificar()` falla
-- cerrado y la persona no puede pasar el muro.
--
-- ── El bug que esto arregla ──────────────────────────────────────────────────
--
-- 🔴 **`email_verified_at` NUNCA se pudo escribir desde la app.** La columna se
-- agregó el 31/08, dos semanas y media DESPUÉS de `lock-privileged-columns.sql`
-- (13/08), que hace `revoke update on profiles` y re-otorga columna por columna.
-- Toda columna nueva nace de solo lectura, y nadie la agregó a esa lista.
-- `VerificarMailScreen` hacía el UPDATE sin mirar el error, así que fallaba en
-- silencio.
--
-- Confirmado contra prod el 10/09/2026: `authenticated` no tiene UPDATE sobre la
-- columna, y **0 de 82 perfiles la tenían escrita**. O sea que desde el 31/08:
--   · el alta de coach nunca dejó constancia de que el mail se comprobó;
--   · el gate de reserva le volvía a pedir el código a quien ya lo había puesto;
--   · y desde el muro del 09/09, **nadie que entre con mail podía pasar el muro**:
--     al reabrir la app, la base decía "sin verificar" otra vez.
--
-- ── Por qué una función y no un `grant update` ───────────────────────────────
--
-- Dar el permiso de columna arreglaba el síntoma y convertía la constancia en
-- una autodeclaración: cualquiera con su propio token haría
-- `update profiles set email_verified_at = now()` sin haber visto nunca un
-- código. Es exactamente el defecto que `lock-privileged-columns.sql` ya anota
-- para las columnas de aceptación de T&C.
--
-- Acá la prueba la da Supabase: el token de la sesión trae el claim `amr`, la
-- lista de cómo se abrió. `verifyOtp` con un código enviado al mail deja
-- `method = 'otp'` (confirmado en `auth.mfa_amr_claims` de prod el 10/09). La
-- única forma de tener una sesión así es haber leído un código de esa casilla.
-- La función se niega si la sesión no lo trae.
--
-- 📌 Se aceptan también `magiclink`, `email/signup` y `recovery`: los tres
-- prueban lo mismo —se abrió algo mandado a esa casilla— y aceptarlos evita que
-- un cambio de cómo Supabase rotula el OTP deje el muro cerrado para todos.

begin;

create or replace function public.marcar_mail_verificado()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_probado boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a
    where a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'recovery')
  ) into v_probado;

  if not v_probado then
    return false;
  end if;

  -- `coalesce`: si ya estaba, se conserva CUÁNDO se probó por primera vez.
  update public.profiles
     set email_verified_at = coalesce(email_verified_at, now())
   where id = auth.uid();

  return found;
end;
$$;

comment on function public.marcar_mail_verificado is
  'Escribe profiles.email_verified_at SOLO si la sesión se abrió con un código/link enviado al mail (claim amr). La única vía de escritura de esa columna: authenticated no tiene UPDATE sobre ella, a propósito.';

revoke all on function public.marcar_mail_verificado() from public, anon;
grant execute on function public.marcar_mail_verificado() to authenticated;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La función existe y la puede ejecutar authenticated. Esperado: 1 fila.
select routine_name
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'marcar_mail_verificado'
  and grantee = 'authenticated';

-- 2) 🔴 La columna SIGUE sin UPDATE para el cliente. Esperado: 0. Si da 1,
--    alguien la abrió y la constancia pasa a ser una autodeclaración.
select count(*) from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public'
  and table_name = 'profiles' and column_name = 'email_verified_at'
  and privilege_type = 'UPDATE';

-- 3) Después de la primera verificación desde un build con el cliente nuevo:
--    que se esté escribiendo. Esperado: > 0.
select count(*) as verificados from public.profiles where email_verified_at is not null;
