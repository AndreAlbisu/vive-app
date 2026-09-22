-- fix-search-path.sql — CORRIDO Y VERIFICADO el 21/09/2026.
--
-- Le fija el `search_path` a las 26 funciones que no lo tenían.
--
-- 🔴 **Qué evita.** Una función sin `search_path` fijo resuelve los nombres con
--    el del que la llama. Si alguien puede crear un esquema propio y ponerlo
--    primero, una llamada a `lower(x)` o a una tabla sin calificar puede
--    terminar ejecutando **código suyo con los privilegios del dueño de la
--    función**, que en las `security definer` es el superusuario. En Supabase el
--    que llama no puede crear esquemas, así que hoy no es explotable: es defensa
--    en profundidad, y es gratis.
--
-- 📌 Va `public, extensions` y no `''`. Con la lista vacía habría que calificar
--    a mano cada nombre dentro de cada cuerpo, que en bloque es mucho más
--    riesgoso; y varias usan funciones que en Supabase viven en `extensions`.
--
-- 📌 Las firmas salieron de `p.oid::regprocedure` y no escritas a mano: varias
--    toman parámetros y `alter function x()` falla con "does not exist".
--
-- ⚠️ `alter function` **no reescribe el cuerpo**, así que no hay riesgo de
--    perder lógica. Verificado después igual: los triggers siguen disparándose,
--    el cron sigue corriendo `expire_pending_bookings` y
--    `complete_confirmed_sessions`, y `pedir_reagendado`, `mi_codigo_referido`,
--    `tiene_descuento_referido` y `send_session_reminders` siguen respondiendo.

alter function complete_confirmed_sessions() set search_path = public, extensions;
alter function enfoques_requieren_matricula() set search_path = public, extensions;
alter function expire_pending_bookings() set search_path = public, extensions;
alter function fn_generate_room_url() set search_path = public, extensions;
alter function fn_pinned_resources_max_four() set search_path = public, extensions;
alter function fn_resource_proposals_protect_review_fields() set search_path = public, extensions;
alter function fn_salas_room_url() set search_path = public, extensions;
alter function inicio_de_sesion(date,text) set search_path = public, extensions;
alter function mark_refund_on_cancel() set search_path = public, extensions;
alter function normalize_hhmm(text) set search_path = public, extensions;
alter function nuevo_codigo_referido() set search_path = public, extensions;
alter function reset_application_on_edit() set search_path = public, extensions;
alter function reset_credential_on_edit() set search_path = public, extensions;
alter function reviews_before_update() set search_path = public, extensions;
alter function revisar_ajustes(uuid,text) set search_path = public, extensions;
alter function revisar_aprobar(uuid,text[],text[]) set search_path = public, extensions;
alter function revisar_descartar(uuid,text) set search_path = public, extensions;
alter function send_session_reminders() set search_path = public, extensions;
alter function slugify(text) set search_path = public, extensions;
alter function tg_normalize_availability_time() set search_path = public, extensions;
alter function tg_normalize_booking_time() set search_path = public, extensions;
alter function tg_normalize_pattern_time() set search_path = public, extensions;
alter function touch_app_version_gate() set search_path = public, extensions;
alter function touch_coach_payout_updated_at() set search_path = public, extensions;
alter function touch_next_session_suggestion() set search_path = public, extensions;
alter function touch_session_call_feedback() set search_path = public, extensions;
