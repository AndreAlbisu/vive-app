-- ============================================================
-- Vita — avisarle al coach cuando su recurso se publica o se rechaza
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE ANTES DE CORRER
-- Fecha: 2026-08-29
--
-- QUÉ RESUELVE
-- La moderación de `coach_resources` se hace a mano desde el editor de tablas
-- de Supabase (con 5 coaches no se justifica un panel de admin). Pero cuando el
-- admin cambia el `status` a 'published' o 'rejected', HOY no pasa nada del lado
-- del coach: sube un recurso, queda 'pending', y no se entera de que se aprobó
-- o rechazó salvo que entre a "Mis recursos" a mirar. Un cambio hecho por SQL
-- no dispara ningún código de la app — la única cosa que se entera es un
-- TRIGGER sobre esa tabla.
--
-- QUÉ HACE
--   1. Extiende el CHECK de `notifications.type` con dos tipos nuevos:
--      'recurso_publicado' y 'recurso_rechazado'.
--   2. Un trigger AFTER UPDATE OF status en `coach_resources` que, cuando el
--      estado pasa a 'published' o 'rejected', inserta:
--        · una fila en `notifications` para el PERFIL del coach (la app la
--          muestra en el badge y la pantalla de notificaciones; `notifications`
--          ya está en realtime, así que si el coach tiene la app abierta el
--          aviso aparece solo), y
--        · una fila en `analytics_events` ('recurso_aprobado'/'recurso_rechazado',
--          con {regla} en el rechazo) — la única vía de capturar estos eventos,
--          porque la aprobación no pasa por ningún código de cliente.
--
-- DECISIONES
--   · El CHECK se DROPEA y se RECREA con la lista completa, no se parchea el
--     string existente: la última vez que un script intentó anclar en un sufijo
--     del CHECK impreso (`]::text[]`) el guard abortó todo porque este Postgres
--     no imprime ese sufijo (ver add-coach-credentials.sql / changelog 28/08).
--     Recrear con la lista explícita no depende de cómo Postgres formatea nada.
--   · `coach_resources.coach_id` es `coaches.id`; el destinatario de la
--     notificación es `profiles.id` (a quien lee la app), así que el trigger
--     traduce vía `coaches.profile_id`.
--   · SECURITY DEFINER: el trigger escribe en `notifications`/`analytics_events`
--     sin depender del RLS de quien hizo el UPDATE (hoy es el service role del
--     editor de tablas, pero así queda robusto si algún día se modera de otra
--     forma).
--   · Solo 'published' y 'rejected' avisan. 'archived' suele hacerlo el propio
--     coach y no necesita aviso; y un update que no cambia el status no dispara
--     nada (`is distinct from`).
--
-- 📝 LO QUE NO INCLUYE: PUSH. El trigger deja el aviso IN-APP (badge + pantalla
--    de notificaciones), que es "el sistema de notificaciones que ya existe".
--    Mandar un push desde el trigger requiere `pg_net` (net.http_post a exp.host
--    con el push_token), más superficie en plpgsql — queda como decisión aparte
--    si hace falta que el coach se entere con la app cerrada.
-- ============================================================

-- 1) Los dos tipos nuevos. Se recrea el CHECK entero con la lista completa
--    (la actual + los dos nuevos). Ningún tipo existente puede violar esto —
--    la lista incluye todos los valores que ya estaban permitidos.
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
    'recurso_rechazado'
  ));

-- 2) La función del trigger.
create or replace function public.notify_resource_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_notif_type text;
  v_event      text;
  v_title      text;
  v_body       text;
begin
  -- Sin cambio de estado, o hacia un estado que no avisa, no se hace nada.
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('published', 'rejected') then
    return new;
  end if;

  select profile_id into v_profile_id
  from public.coaches
  where id = new.coach_id;

  if v_profile_id is null then
    return new;  -- sin perfil no hay a quién avisar
  end if;

  if new.status = 'published' then
    v_notif_type := 'recurso_publicado';
    v_event      := 'recurso_aprobado';
    v_title      := 'Tu recurso ya está publicado';
    v_body       := coalesce(new.title, 'Tu recurso')
      || ' ya aparece en la biblioteca. Ya lo pueden ver y usar.';
  else
    v_notif_type := 'recurso_rechazado';
    v_event      := 'recurso_rechazado';
    v_title      := 'Tu recurso necesita ajustes';
    v_body       := coalesce(new.title, 'Tu recurso')
      || case when new.rejection_rule is not null
              then ' no cumple la regla ' || new.rejection_rule || '.'
              else ' necesita ajustes.' end
      || ' Editalo y volvé a enviarlo.';
  end if;

  insert into public.notifications (recipient_id, type, title, body, read)
  values (v_profile_id, v_notif_type, v_title, v_body, false);

  insert into public.analytics_events (user_id, event_name, properties)
  values (
    v_profile_id,
    v_event,
    case when new.status = 'rejected' and new.rejection_rule is not null
         then jsonb_build_object('regla', new.rejection_rule)
         else '{}'::jsonb end
  );

  return new;
end;
$$;

-- 3) El trigger. `of status` para que solo dispare cuando esa columna cambia.
drop trigger if exists trg_notify_resource_status on public.coach_resources;
create trigger trg_notify_resource_status
  after update of status on public.coach_resources
  for each row
  execute function public.notify_resource_status_change();

-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) Los dos tipos entraron al CHECK:
--    select pg_get_constraintdef(oid) like '%recurso_publicado%'
--       and pg_get_constraintdef(oid) like '%recurso_rechazado%' as ok
--    from pg_constraint
--    where conrelid = 'public.notifications'::regclass and conname = 'notifications_type_check';
--
-- 2) El trigger existe:
--    select tgname from pg_trigger where tgrelid = 'public.coach_resources'::regclass
--      and tgname = 'trg_notify_resource_status';
--
-- 3) Prueba real sobre un recurso de prueba (elegí un id de coach_resources):
--    -- aprobar:
--    update public.coach_resources set status = 'published' where id = '<id>';
--    select type, title, body from public.notifications
--      where recipient_id = (select profile_id from public.coaches c
--                            join public.coach_resources r on r.coach_id = c.id
--                            where r.id = '<id>')
--      order by created_at desc limit 1;   -- debe decir 'recurso_publicado'
--    select event_name, properties from public.analytics_events
--      order by created_at desc limit 1;   -- 'recurso_aprobado'
--    -- rechazar con regla:
--    update public.coach_resources set status = 'rejected', rejection_rule = 3 where id = '<id>';
--    -- la notificación debe mencionar "regla 3", y el evento traer {"regla": 3}
--
-- ── Para volver atrás ────────────────────────────────────────────────────────
-- drop trigger if exists trg_notify_resource_status on public.coach_resources;
-- drop function if exists public.notify_resource_status_change();
-- (el CHECK con los dos tipos nuevos puede quedar — no molesta; para revertirlo
--  del todo, recrearlo sin las dos últimas líneas.)
