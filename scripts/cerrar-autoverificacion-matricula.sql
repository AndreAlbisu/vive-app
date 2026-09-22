-- cerrar-autoverificacion-matricula.sql
--
-- 🔴 **UN PROFESIONAL PODÍA DARSE A SÍ MISMO LA MATRÍCULA VERIFICADA.**
--
--    `coach_credentials` tenía `status` (y `reviewed_at`, y `review_notes`) en la
--    lista de columnas que `authenticated` puede INSERTAR. La policy de insert
--    solo exige que la credencial sea de uno mismo, así que alcanzaba con crear
--    la fila directamente con `status = 'verificada'`.
--
--    **Probado contra producción con rollback**, con un coach real que tenía
--    `has_matricula = false`: después del insert quedó en **true**, y la
--    credencial inventada aparece en `coach_credentials_public`, que es la vista
--    que pinta la ficha pública.
--
-- ── Por qué es el peor hallazgo de la auditoría ──────────────────────────────
--
-- En una app de salud mental, ese sello es la línea entre un acompañante y un
-- psicólogo. De él dependen: el sello visible en el perfil, que el buscador y el
-- quiz lo puedan mostrar como psicólogo, y la pregunta de "enfoque" (que desde
-- el 17/09 exige matrícula justamente para que nadie insinúe una profesión que
-- no chequeamos). Todo eso se apoyaba en una columna que el propio interesado
-- podía escribir.
--
-- ── El arreglo ───────────────────────────────────────────────────────────────
--
-- `status` vuelve a su default (`'pendiente'`) y no se puede escribir desde el
-- cliente. Quien lo mueve es `admin-actions` (acción `review_credential`), que
-- corre con service role detrás del portón de admin. El UPDATE del cliente ya
-- estaba bien acotado (title, institution, kind, year, registration_number,
-- file_path): esto le da al INSERT el mismo criterio.
--
-- 📌 La app no se rompe: `CoachCredentialsScreen` inserta kind, title,
--    institution, registration_number, year y file_path, y ninguno de esos se
--    toca. El `status` lo pone el default.

-- 🔴 **Y acá está la trampa que hizo fallar el primer intento.** Revocar por
--    COLUMNA no resta nada cuando el permiso está dado a nivel TABLA: en la ACL
--    se veía `authenticated=ardm`, o sea INSERT sobre la tabla entera. Un
--    `revoke insert (status)` no hace nada contra eso. Hay que revocar el
--    permiso de tabla y volver a darlo columna por columna.
--
--    Se descubrió porque el test de rollback siguió diciendo `has_matricula =
--    true` después de "arreglarlo". Es el mismo tipo de verificación que salvó
--    el revoke de las funciones RPC anteayer.

revoke insert, update on public.coach_credentials from authenticated, anon;

-- Exactamente las que escribe `lib/coachCredentials.ts`, ni una más.
grant insert (coach_id, kind, title, institution, year, registration_number, file_path)
  on public.coach_credentials to authenticated;
grant update (kind, title, institution, year, registration_number, file_path)
  on public.coach_credentials to authenticated;

-- ⚠️ `anon` no vuelve a recibir NADA de escritura: no hay ningún camino donde
--    alguien sin cuenta cargue una credencial. Hoy lo frenaba solo la RLS.
