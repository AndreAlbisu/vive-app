-- ============================================================
-- Vita — cierre de la escalada por INSERT + estado de postulación + auditoría
-- Fecha: 2026-08-15
-- Requiere: scripts/lock-privileged-columns.sql ya corrido
--
-- Tres bloques que se corren juntos pero resuelven cosas distintas:
--   1. 🔴 Cierra la mitad de la escalada de privilegios que quedó abierta.
--   2. Le da a `coaches` un estado de revisión propio (pendiente/aprobada/rechazada).
--   3. Crea el log de auditoría del panel de administración.
--
-- ⚠️ ANTES DE CORRER: el bloque 1 rompe `CoachApplicationScreen` si la app
-- todavía manda `verified: false` en el INSERT. El cambio de código va en el
-- mismo commit — deployá la app o corré esto sabiendo que las postulaciones
-- nuevas van a fallar hasta que la versión nueva esté en el celular.
-- ============================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 — 🔴 La escalada de privilegios estaba cerrada a medias.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `lock-privileged-columns.sql` revocó el UPDATE de tabla completa sobre
-- `coaches` y re-otorgó 5 columnas nombradas, dejando `verified` afuera. Pero
-- **nunca tocó el privilegio de INSERT**, que siguió siendo de tabla completa.
-- Verificado en prod el 15/08/2026:
--
--   select privilege_type, column_name from information_schema.column_privileges
--   where grantee='authenticated' and table_name='coaches'
--     and privilege_type='INSERT' and column_name='verified';
--   -- devolvía: INSERT | verified
--
-- O sea que la cadena de tres pasos que documenta ese script se colapsaba en
-- una sola sentencia, y el arreglo anterior no la tocaba:
--
--   insert into coaches (profile_id, verified) values (auth.uid(), true)
--
-- `coaches_insert_own` valida la FILA (`profile_id = auth.uid()`), no las
-- columnas — es la misma distinción fila/columna que motivó el script original,
-- aplicada al verbo que quedó afuera. El resultado era idéntico: publicarse en
-- el catálogo sin que nadie revisara nada, porque `coachesCache` filtra por
-- `verified`.
--
-- Se cierra igual que el UPDATE: revocar la tabla y otorgar columnas nombradas.
-- El default explícito es lo que hace que el cliente ya no necesite mandarla.

alter table public.coaches alter column verified set default false;

revoke insert on public.coaches from authenticated;
grant insert (
  profile_id,             -- la fila es de quien la crea (lo valida la policy)
  specialty,
  bio,
  price_per_session,
  nationality,
  application_video_url   -- link al video que se revisa en el panel
) on public.coaches to authenticated;

-- Queda AFUERA del grant, a propósito: `verified` (lo escribe solo
-- `admin-actions` con service role), `mp_connected` (`mp-oauth-callback`),
-- `video_url`, `instant_booking`, `availability_status` (tienen default y se
-- editan por UPDATE, no al postularse) y las tres columnas del bloque 2.


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 — Estado de la postulación, separado de `verified`.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hasta ahora `verified = false` significaba dos cosas incompatibles: "nadie la
-- miró todavía" y "la miramos y no". El panel solo podía aprobar, porque
-- rechazar habría dejado la postulación exactamente igual que antes de
-- rechazarla y habría vuelto a aparecer en la cola para siempre.
--
-- ⚠️ NO se reusa `verified` para esto y la distinción importa: `verified` es
-- "¿aparece en el catálogo?" y `application_status` es "¿en qué estado está la
-- revisión?". Son independientes — despublicar a un coach aprobado por un
-- reporte lo deja en `verified=false` / `application_status='aprobada'`, que es
-- la verdad. Si fueran una sola columna, revocar y rechazar serían el mismo
-- acto y perderíamos por qué está afuera del catálogo.

alter table public.coaches
  add column if not exists application_status      text not null default 'pendiente',
  add column if not exists application_notes       text,
  add column if not exists application_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coaches_application_status_check'
  ) then
    alter table public.coaches add constraint coaches_application_status_check
      check (application_status in ('pendiente', 'aprobada', 'rechazada'));
  end if;
end $$;

-- Backfill. Quien ya está publicado fue aprobado de hecho, así que se registra.
-- Quien está en `verified=false` queda en 'pendiente' y NO en 'rechazada':
-- nadie los rechazó, simplemente no había con qué hacerlo. Mismo criterio que
-- `age_confirmed` — fabricar una constancia que no existió es peor que no
-- tenerla.
update public.coaches set application_status = 'aprobada' where verified = true;

-- Re-postulación: el coach necesita poder editar lo que se revisa. Ninguna de
-- las tres decide si aparece en el catálogo, así que otorgarlas no reabre nada.
-- Se suman a las 5 que ya otorgó lock-privileged-columns.sql.
grant update (
  specialty,
  nationality,
  application_video_url
) on public.coaches to authenticated;

-- `application_status`, `application_notes` y `application_reviewed_at` NO se
-- otorgan ni para INSERT ni para UPDATE. Nacen protegidas por lo mismo que
-- protegió a `is_admin`: al haber revocado el privilegio de tabla completa y
-- otorgado columnas NOMBRADAS, una columna nueva no queda otorgada.


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2b — Volver a postularse después de un rechazo, por TRIGGER.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El coach no puede escribir `application_status` (bloque 2), así que editar su
-- postulación no puede devolverla a la cola por sí solo. Un trigger lo hace por
-- él: es aditivo, no depende de que el cliente se acuerde, y aplica venga de
-- donde venga el UPDATE. Mismo criterio que los triggers de `blocked_users`.
--
-- Solo se dispara desde 'rechazada'. Editar el precio estando ya aprobado NO
-- devuelve a nadie a la cola — sería despublicar a un coach activo por tocar un
-- campo, que es justo lo que no queremos.
--
-- ⚠️ Se dispara con CUALQUIER update de la fila, no solo con el de las columnas
-- que se revisan. La versión angosta (mirar specialty/bio/price/video) tiene un
-- modo de falla peor: si a alguien lo rechazaron por los temas que eligió, esos
-- viven en `coach_topics` —otra tabla— y corregirlos no tocaría ninguna columna
-- vigilada. La postulación se quedaría en 'rechazada' para siempre, sin volver
-- a la cola y sin que nada se lo diga. Al revés, el peor caso de la versión
-- ancha es que un update no relacionado la devuelva a revisión y haya que
-- rechazarla de nuevo: visible y barato. Se prefiere el error ruidoso.

create or replace function public.reset_application_on_edit()
returns trigger
language plpgsql
as $$
begin
  if old.application_status = 'rechazada' then
    new.application_status      := 'pendiente';
    new.application_reviewed_at := null;
    -- `application_notes` se CONSERVA: es el motivo del rechazo anterior y es
    -- justo el contexto que necesita quien revisa la segunda vuelta para saber
    -- si la persona corrigió lo que se le señaló.
  end if;
  return new;
end $$;

drop trigger if exists trg_reset_application_on_edit on public.coaches;
create trigger trg_reset_application_on_edit
  before update on public.coaches
  for each row execute function public.reset_application_on_edit();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 — Auditoría del panel.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `reports.status` y `guarantee_claims.resolved_by` dejan rastro; `verified` no
-- dejaba ninguno más que el `console.log` de la edge function, que se rota y no
-- se puede consultar. Con dos personas con `is_admin` eso ya no alcanza para
-- responder "¿quién publicó a este coach?".
--
-- `admin_id` es nullable y con `on delete set null`, y además se guarda el mail
-- desnormalizado: un log de auditoría tiene que sobrevivir a que se borre la
-- cuenta de quien actuó. Si el FK fuera NOT NULL, borrar un admin borraría su
-- historial o bloquearía la baja.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  admin_email text,                    -- desnormalizado a propósito (ver arriba)
  action      text        not null,    -- 'set_coach_verified' | 'reject_coach_application' | 'resolve_report' | 'guarantee_approve' | 'guarantee_reject'
  target_type text        not null,    -- 'coach' | 'report' | 'booking'
  target_id   uuid,
  details     jsonb,                   -- payload de la acción (motivo, status previo, etc.)
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id);

alter table public.admin_audit_log enable row level security;

-- Los admins LEEN el log. Nadie lo escribe desde el cliente: la única vía es
-- `admin-actions` con service role. Un log que su propio actor puede editar no
-- es auditoría, es una nota.
revoke all on public.admin_audit_log from authenticated, anon;
grant select on public.admin_audit_log to authenticated;

drop policy if exists admin_audit_log_select_admin on public.admin_audit_log;
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4 — Tipos de notificación para el resultado de la postulación.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Mismo patrón defensivo que `add-notifications-propuesta-types.sql`: se busca
-- el nombre real de la constraint en `pg_constraint` en vez de asumirlo.
--
-- Se agregan los DOS resultados, no solo el rechazo. Aprobar sin avisar deja al
-- coach descubriendo por casualidad que ya puede trabajar; es el mismo insert
-- en el mismo código y no avisarlo sería peor.

do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'notifications'
    and con.contype = 'c'
    and att.attname = 'type'
  limit 1;

  if con_name is not null then
    execute format('alter table public.notifications drop constraint %I', con_name);
  end if;

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
      'postulacion_rechazada'
    ));
end $$;

notify pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr.
-- ⚠️ Pegar DE A UNA: el SQL editor de Supabase muestra solo el resultado de la
-- última sentencia cuando se corren varias juntas.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1) La escalada por INSERT quedó cerrada (esperado: 6 filas, sin `verified`)
--
--   select column_name from information_schema.column_privileges
--   where grantee = 'authenticated' and table_name = 'coaches'
--     and privilege_type = 'INSERT' and table_schema = 'public'
--   order by column_name;
--
-- 2) Las columnas nuevas existen y ninguna es escribible por el cliente
--    (esperado: 0 filas)
--
--   select privilege_type, column_name from information_schema.column_privileges
--   where grantee = 'authenticated' and table_name = 'coaches'
--     and column_name like 'application\_%' and column_name <> 'application_video_url';
--
-- 3) El backfill respetó el criterio (esperado: ninguna 'rechazada')
--
--   select application_status, verified, count(*)
--   from public.coaches group by 1, 2 order by 1, 2;
--
-- 4) El trigger está montado (esperado: 1 fila)
--
--   select tgname from pg_trigger
--   where tgrelid = 'public.coaches'::regclass and tgname = 'trg_reset_application_on_edit';
--
-- 5) El log existe y solo tiene la policy de SELECT (esperado: 1 fila, SELECT)
--
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'admin_audit_log';
--
-- 6) Los tipos de notificación nuevos entran (esperado: no lanza error;
--    hace rollback, no deja la fila)
--
--   begin;
--   insert into public.notifications (recipient_id, type, title, body)
--   select id, 'postulacion_rechazada', 'test', 'test' from public.profiles limit 1;
--   rollback;
