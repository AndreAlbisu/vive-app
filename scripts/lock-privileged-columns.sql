-- lock-privileged-columns.sql
--
-- 🔴 CIERRA UNA ESCALADA DE PRIVILEGIOS REAL.
--
-- El RLS de Postgres es por FILA, no por COLUMNA. Las dos políticas de UPDATE
-- que tenemos son de la forma "esta fila es tuya":
--
--   coaches_update_own   USING/WITH CHECK (profile_id = auth.uid())
--   profiles_update_own  USING/WITH CHECK (id = auth.uid())
--
-- o sea que autorizan a escribir CUALQUIER columna de la propia fila. Eso
-- incluye `coaches.verified`, que es el flag por el que `coachesCache` filtra
-- (`.eq('verified', true)`) para decidir quién aparece en el catálogo.
--
-- Con la anon key, cualquier persona autenticada podía hacer:
--
--   1. update profiles  set role = 'coach'      where id = auth.uid()
--   2. insert into coaches (profile_id, ...)     -- coaches_insert_own ya existe
--   3. update coaches   set verified = true      where profile_id = auth.uid()
--
-- y quedar publicada como profesional verificada sin que nadie revisara nada.
-- Un panel de administración para aprobar postulaciones no sirve de nada
-- mientras el aprobado pueda aprobarse solo.
--
-- ── El arreglo ───────────────────────────────────────────────────────────────
-- Postgres SÍ tiene privilegios por columna. Se revoca el UPDATE de tabla
-- completa a `authenticated` y se re-otorga solo sobre las columnas que el
-- cliente escribe de verdad. El RLS sigue aplicando encima: la GRANT dice QUÉ
-- columnas, la policy dice QUÉ filas. Hacen falta las dos.
--
-- Las listas de abajo salieron de auditar todos los `.update()` del cliente,
-- no de suponer. Si mañana una pantalla necesita escribir una columna nueva,
-- hay que agregarla acá o el update va a fallar — que es exactamente el
-- comportamiento que queremos (falla ruidosa, no permiso de más).
--
-- ⚠️ No se toca `service_role`: las edge functions siguen escribiendo todo
-- (`mp-oauth-callback` escribe `coaches.mp_connected`, `delete-account` escribe
-- la lápida de `profiles`, `guarantee-claim` escribe `bookings`).

-- ── coaches ──────────────────────────────────────────────────────────────────
-- Fuera de la lista queda `verified` (el flag de revisión) y `mp_connected`
-- (lo escribe mp-oauth-callback con service role). `specialty`, `nationality` y
-- `application_video_url` se escriben en el INSERT de la postulación, no por
-- UPDATE, así que tampoco entran.
revoke update on public.coaches from authenticated;
grant update (
  availability_status,   -- toggle Disponible / En pausa
  bio,                   -- editor de presentación
  instant_booking,       -- switch de modalidad de reserva
  price_per_session,     -- editor de precio
  video_url              -- subida del video de perfil
) on public.coaches to authenticated;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Fuera de la lista queda `role` (nadie lo escribe desde el cliente: lo pone el
-- trigger de alta o se asigna a mano), `email`, `id`, `created_at` y
-- `deleted_at` (la lápida la escribe `delete-account` con service role).
revoke update on public.profiles from authenticated;
grant update (
  name,
  gender,
  nationality,
  birth_date,
  avatar_url,            -- subida de foto de perfil
  push_token,            -- registro de notificaciones
  -- Constancia de aceptación. ⚠️ Ver la nota de abajo: quedan escribibles por
  -- el cliente porque hoy las escribe el propio alta desde AuthContext.
  accepted_terms,
  accepted_terms_at,
  accepted_terms_version,
  age_confirmed
) on public.profiles to authenticated;

-- ⚠️ LIMITACIÓN CONOCIDA, no resuelta acá.
-- Las 4 columnas de aceptación las escribe el cliente (`acceptanceFields()` en
-- AuthContext), así que siguen siendo falsificables por su propio titular: una
-- persona podría escribir una `accepted_terms_version` vieja para sostener que
-- aceptó otro texto. El daño es acotado —solo puede tocar su propia fila— pero
-- debilita justo el valor probatorio para el que existen. Cerrarlo del todo
-- exige moverlas a una edge function en el alta. Anotado en
-- docs/legal-instrucciones.md.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar DE A UNA en el SQL editor:
-- muestra solo el resultado de la última sentencia).
--
-- 1) Qué columnas puede actualizar `authenticated` (esperado: solo las de arriba)
--
--   select table_name, column_name
--   from information_schema.column_privileges
--   where grantee = 'authenticated' and privilege_type = 'UPDATE'
--     and table_schema = 'public' and table_name in ('coaches','profiles')
--   order by table_name, column_name;
--   -- esperado: 5 filas de coaches + 10 de profiles. `verified` y `role` NO
--   -- deben aparecer.
--
-- 2) Prueba real de que la escalada quedó cerrada. Desde la app, logueado como
--    un coach de prueba, en la consola:
--
--      await supabase.from('coaches').update({ verified: true })
--        .eq('profile_id', TU_ID).select('id')
--
--    Esperado AHORA: error de permiso (42501). Antes devolvía la fila.
