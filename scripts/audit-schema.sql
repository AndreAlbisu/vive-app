-- audit-schema.sql
-- Reconciliación: ¿qué scripts de scripts/ están realmente aplicados en Supabase?
--
-- Corré TODO este archivo en el SQL Editor de Supabase (rol postgres/service).
-- Devuelve una fila por objeto ESPERADO con su estado (OK / FALTA) y el script
-- que lo crea. Ordena los FALTA primero: esos son los scripts sin correr.
--
-- Cubre tablas, vistas, columnas, funciones, triggers y buckets de Storage.
-- Los cron jobs (pg_cron) van aparte al final (query separada y guardada, porque
-- referenciar cron.job rompe si la extensión no está instalada).

with expected(kind, ident, script) as (
  values
    -- ── Tablas ────────────────────────────────────────────────────────────
    ('table', 'coach_topics',            'add-coach-topics.sql'),
    ('table', 'favorite_coaches',        'add-favorite-coaches.sql'),
    ('table', 'pinned_resources',        'add-pinned-resources.sql'),
    ('table', 'mood_entries',            'create-mood-entries.sql'),
    ('table', 'user_quiz_answers',       'add-user-quiz-answers.sql'),
    ('table', 'resources',               'add-resources.sql'),
    ('table', 'resource_axes',           'add-resource-axes.sql'),
    ('table', 'resource_topics',         'add-resource-topics.sql'),
    ('table', 'resource_tags',           'add-resource-tags.sql'),
    ('table', 'resource_tag_links',      'add-resource-tag-links.sql'),
    ('table', 'resource_proposals',      'add-resource-proposals.sql'),
    ('table', 'resource_feedback',       'add-resource-feedback.sql'),
    ('table', 'resource_completions',    'add-resource-completions.sql'),
    ('table', 'analytics_events',        'supabase-bookings-setup.sql'),
    -- ── Vistas ────────────────────────────────────────────────────────────
    ('view',  'coach_rebooking_stats',   'add-coach-rebooking-stats.sql'),
    ('view',  'coach_trending_stats',    'add-coach-trending-stats.sql (nuevo 11/07)'),
    ('view',  'cola_revision',           'add-review-functions.sql'),
    -- ── Columnas (tabla.columna) ──────────────────────────────────────────
    ('column','coaches.instant_booking',        'add-coach-instant-booking.sql'),
    ('column','coaches.video_url',              'add-coach-video-upload.sql'),
    ('column','coaches.availability_status',    'add-coaches-availability-status.sql'),
    ('column','coaches.bio',                    '(pre-existente)'),
    ('column','bookings.duration_minutes',      'add-duration-minutes-meeting-url.sql'),
    ('column','bookings.meeting_url',           'add-duration-minutes-meeting-url.sql'),
    ('column','resources.retired_at',           'add-resources-retired-at.sql'),
    ('column','resource_proposals.topic',       'add-resource-proposals-topic.sql'),
    ('column','resource_proposals.axes',        'add-resource-proposals-axes-tags.sql'),
    ('column','resource_proposals.tags',        'add-resource-proposals-axes-tags.sql'),
    ('column','salas.room_url',                 'add-salas-room-url.sql'),
    ('column','profiles.avatar_url',            '(pre-existente / add-avatar-upload.sql)'),
    ('column','profiles.push_token',            'SIN SCRIPT — verificar (lo usa lib/notifications.ts)'),
    -- ── Funciones ─────────────────────────────────────────────────────────
    ('function','complete_confirmed_sessions',              'complete-confirmed-sessions.sql'),
    ('function','expire_pending_bookings',                  'expire-pending-bookings.sql'),
    ('function','fn_pinned_resources_max_four',             'add-pinned-resources.sql'),
    ('function','fn_resource_feedback_milestone',           'add-resource-feedback-milestone.sql'),
    ('function','fn_resource_proposals_protect_review_fields','add-resource-proposals.sql'),
    ('function','get_my_resource_feedback_summary',         'add-resource-feedback.sql / fix-resource-feedback-summary-grant.sql'),
    ('function','revisar_aprobar',                          'add-review-functions.sql'),
    ('function','revisar_ajustes',                          'add-review-functions.sql'),
    ('function','revisar_descartar',                        'add-review-functions.sql'),
    -- ── Triggers ──────────────────────────────────────────────────────────
    ('trigger','trg_pinned_resources_max_four',    'add-pinned-resources.sql'),
    ('trigger','trg_resource_feedback_milestone',  'add-resource-feedback-milestone.sql'),
    ('trigger','trg_resource_proposals_protect',   'add-resource-proposals.sql'),
    -- ── Buckets de Storage ────────────────────────────────────────────────
    ('bucket','avatars',        'add-avatar-upload.sql'),
    ('bucket','coach-videos',   'add-coach-video-upload.sql'),
    ('bucket','resource-audio', 'add-resource-audio-storage.sql'),
    ('bucket','resource-video', 'add-resource-video-storage.sql')
)
select
  case when present then '✅ OK' else '❌ FALTA' end as estado,
  e.kind,
  e.ident,
  e.script
from expected e
cross join lateral (
  select case e.kind
    when 'table'    then exists (select 1 from information_schema.tables  t where t.table_schema='public' and t.table_name = e.ident)
    when 'view'     then exists (select 1 from information_schema.views   v where v.table_schema='public' and v.table_name = e.ident)
    when 'column'   then exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name = split_part(e.ident,'.',1) and c.column_name = split_part(e.ident,'.',2))
    when 'function' then exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname = e.ident)
    when 'trigger'  then exists (select 1 from pg_trigger tg where not tg.tgisinternal and tg.tgname = e.ident)
    when 'bucket'   then exists (select 1 from storage.buckets b where b.id = e.ident)
    else false
  end as present
) chk
order by present asc, e.kind, e.ident;

-- ── Cron jobs (pg_cron) — correr SOLO si usás pg_cron ─────────────────────────
-- Descomentá y corré por separado:
-- select jobname, schedule, active from cron.job order by jobname;
-- Esperados: complete_confirmed_sessions y expire_pending_bookings cada ~5 min.
