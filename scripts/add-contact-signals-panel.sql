-- add-contact-signals-panel.sql
--
-- Dos cosas para que la detección de contacto sirva para algo:
--   1. cerrar un agujero que dejaba INVENTAR avisos a nombre de otra persona;
--   2. el tipo de notificación para avisarle a la persona que su profesional
--      dejó de tomar reservas.
--
-- ✅ CORRIDO y VERIFICADO el 16/09/2026 desde el CLI, con la prueba ANTES y
--    DESPUÉS sobre dos cuentas reales: antes "A anota a nombre de B" se pudo;
--    después rebota con `new row violates row-level security policy`, y A sigue
--    pudiendo anotar a su propio nombre. Quedan las dos policies correctas y el
--    tipo nuevo está en el CHECK. `admin-actions` v32 deployada.
--
-- ── 1) 🔴 Cualquier usuario podía anotar eventos a nombre de otro ────────────
--
-- `analytics_events` tenía tres policies de INSERT, y las policies permisivas se
-- suman (alcanza con que UNA deje pasar). Dos eran correctas —anon solo con
-- `user_id` null, y authenticated con `user_id` null o propio— pero la tercera,
-- `analytics_insert_auth`, solo pedía estar logueado: con ella, **cualquier
-- cuenta podía insertar un evento con el `user_id` de otra**. Verificado el
-- 16/09/2026 con dos cuentas reales: "A anota a nombre de B" → se pudo.
--
-- Mientras los eventos eran solo métricas, daba igual. Deja de dar igual ahora:
-- el panel de Sanciones va a mostrar "este coach intentó mandar su CBU" para
-- decidir si se lo sanciona, y con este agujero **cualquiera podía fabricarle
-- avisos a un coach**. Se borra la policy; las otras dos ya cubren todo lo
-- legítimo — `registrarEvento` es el único que escribe la tabla, y siempre con
-- el id de la sesión o null.
--
-- ⚠️ Aun cerrado, el panel no confía a ciegas: un evento con `role: 'coach'` solo
-- cuenta si lo escribió ese coach, y uno con `role: 'user'` si lo escribió esa
-- persona (`admin-actions` → `list_contact_signals`). Las propiedades del evento
-- las arma el teléfono; lo único que garantiza la base es QUIÉN lo escribió.
--
-- ── 2) El aviso a la persona ─────────────────────────────────────────────────
--
-- Cuando un profesional queda suspendido o dado de baja, la gente que lo tenía
-- se enteraba porque dejaba de encontrarlo. `profesional_no_disponible` es el
-- aviso. 🔴 **No dice que hubo una sanción**: solo que no está tomando reservas
-- nuevas, y que las sesiones ya agendadas siguen en pie. Contarle a un cliente
-- que su profesional fue sancionado lo expone por algo que el cliente no
-- necesita saber y que puede revertirse.

begin;

drop policy if exists analytics_insert_auth on public.analytics_events;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reserva_nueva',
    'reserva_confirmada',
    'reserva_rechazada',
    'reserva_cancelada',
    'recordatorio_sesion',
    'invitacion_review',
    'recurso_feedback_umbral',
    'propuesta_publicada',
    'propuesta_ajustes',
    'postulacion_aprobada',
    'postulacion_rechazada',
    'credencial_verificada',
    'credencial_rechazada',
    'recurso_publicado',
    'recurso_rechazado',
    'sancion_aplicada',
    'sancion_levantada',
    'profesional_no_disponible'
  ));

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) Quedan solo las dos policies correctas.
select policyname, roles::text, with_check from pg_policies
where schemaname = 'public' and tablename = 'analytics_events';

-- 2) El tipo nuevo está en el CHECK.
select pg_get_constraintdef(oid) ilike '%profesional_no_disponible%' as ok
from pg_constraint where conname = 'notifications_type_check';
