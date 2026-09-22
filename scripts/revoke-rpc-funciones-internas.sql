-- revoke-rpc-funciones-internas.sql
--
-- Le saca a `anon` y a `authenticated` el permiso de EJECUTAR funciones que
-- nunca debieron poder llamarse desde afuera. Ningún dato cambia.
--
-- 🔴 **Encontrado el 21/09/2026 con `supabase db advisors --linked --type
--    security`**, que hay que correr antes de cualquier auditoría de código:
--    esto no se ve leyendo archivos.
--
--    En Supabase, TODA función en `public` queda expuesta como endpoint REST
--    (`/rest/v1/rpc/<nombre>`). Con `security definer` encima, corren con los
--    privilegios de su dueño. O sea que cualquiera con la clave pública, que
--    viaja dentro de la app publicada, podía invocarlas.
--
-- ── Las dos que de verdad importaban ─────────────────────────────────────────
--
-- 🔴 `expire_pending_bookings()` — **cancela reservas pendientes y las pasa a
--    `reembolso_pendiente`**. Un desconocido podía disparar cancelaciones y
--    reembolsos masivos desde una línea de comando.
-- 🔴 `complete_confirmed_sessions()` — marca sesiones como completadas, que es
--    lo que habilita reseñas y mueve el tramo de comisión del par.
--
--    Las llama el cron, que corre como superusuario y **no pasa por estos
--    grants**: revocarlas no las afecta. Verificado después de correr esto.
--
-- ── Las doce de trigger ──────────────────────────────────────────────────────
--
-- 📌 Postgres **no chequea EXECUTE cuando dispara un trigger**: la función se
--    ejecuta por ser el trigger de la tabla, no porque quien escribe tenga
--    permiso sobre ella. Revocar no rompe ningún trigger. Probado con rollback
--    insertando filas que los disparan.
--
-- ── Lo que se deja como está, a propósito ───────────────────────────────────
--
-- ⚠️ `slots_libres(slug, dias)`: la necesita `anon`. Es la que dibuja los
--    horarios en la página pública `/c/<slug>`, donde quien mira todavía no
--    tiene cuenta, y existe justamente para no abrirle `bookings` a `anon`.
-- ⚠️ `email_es_de_coach(email)`: la llama la pantalla de registro ANTES de que
--    exista la cuenta. Es un vector de enumeración (permite preguntar si un mail
--    es de un profesional), pero acotado: los profesionales tienen perfil
--    público de todos modos. **Queda anotado para la auditoría**: la salida real
--    es moverlo adentro del alta, del lado del servidor, o ponerle límite de
--    frecuencia.

--
-- 🔴 **EL DETALLE QUE HACE QUE ESTO FUNCIONE O NO: hay que revocarle a `public`.**
--    Postgres le da EXECUTE a `public` (todos los roles) en CUALQUIER función
--    nueva, automáticamente. La primera versión de este script solo se lo
--    revocaba a `anon` y a `authenticated`, y **no cambió nada**: verificado
--    desde afuera con un POST real, que siguió devolviendo 204. En la ACL se ve
--    como `=X/postgres` (grantee vacío = `public`). Revocarle a los roles quita
--    permisos que en general ni siquiera tenían explícitamente.

-- ── Las que mueve el cron ────────────────────────────────────────────────────
revoke execute on function public.expire_pending_bookings()      from public, anon, authenticated;
revoke execute on function public.expire_unpaid_checkouts()      from public, anon, authenticated;
revoke execute on function public.complete_confirmed_sessions()  from public, anon, authenticated;

-- ── Las doce de trigger ──────────────────────────────────────────────────────
revoke execute on function public.coaches_set_slug()                    from public, anon, authenticated;
revoke execute on function public.fn_generate_room_url()                from public, anon, authenticated;
revoke execute on function public.fn_resource_feedback_milestone()      from public, anon, authenticated;
revoke execute on function public.fn_salas_room_url()                   from public, anon, authenticated;
revoke execute on function public.handle_new_user()                     from public, anon, authenticated;
revoke execute on function public.notify_resource_status_change()       from public, anon, authenticated;
revoke execute on function public.sync_accepts_international()          from public, anon, authenticated;
revoke execute on function public.sync_coach_suspension()               from public, anon, authenticated;
revoke execute on function public.sync_has_matricula()                  from public, anon, authenticated;
revoke execute on function public.tg_block_bookings_between_blocked()   from public, anon, authenticated;
revoke execute on function public.tg_block_bookings_coach_suspendido()  from public, anon, authenticated;
revoke execute on function public.tg_block_messages_between_blocked()   from public, anon, authenticated;
