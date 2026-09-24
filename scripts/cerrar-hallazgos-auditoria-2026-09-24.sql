-- Cierre de hallazgos de la pasada completa de seguridad del 24/09/2026 (Claude).
-- Autorizado por Andre ("hacelo vos"). Estado: ver CHANGELOG_SESIONES.md.
--
-- 1. Chat sin reserva: los mensajes de texto libre ('user'/'coach') exigen que
--    el par tenga una sesión confirmada o completada, o una reserva pagada (así
--    una cancelación con reintegro no corta la conversación). La sala se sigue
--    pudiendo crear antes de la reserva porque BookingScreen_Confirm la
--    necesita para `bookings.sala_id`. Los avisos de sistema no cambian.
-- 2. Recomendaciones: exigen la misma relación que el chat y que `room_id` sea
--    la sala de ese par. El cliente solo puede tocar `opened_at`.
-- 3. Storage: fuera las policies `*_public_read` (dejaban LISTAR los buckets sin
--    cuenta). Un bucket público sirve sus archivos por URL sin policy; queda la
--    lectura del dueño (la necesita el upsert). resource-audio además deja leer
--    el audio de recursos publicados y a admins (`createSignedUrl` pasa por RLS).
-- 4. `anon` sin INSERT/UPDATE/DELETE/TRUNCATE a nivel tabla en `public`, salvo
--    INSERT en `analytics_events`. Las tablas y vistas nuevas nacen igual.

begin;

-- ── 1. messages ────────────────────────────────────────────────────────────
drop policy if exists messages_insert_participantes on public.messages;
create policy messages_insert_participantes on public.messages
  for insert to public
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.salas s
      where s.id = messages.sala_id
        and (s.user_id = auth.uid() or s.coach_id = auth.uid())
        and (
          (
            ((messages.sender_type = 'user' and s.user_id = auth.uid())
              or (messages.sender_type = 'coach' and s.coach_id = auth.uid()))
            and exists (
              select 1 from public.bookings b
              join public.coaches c on c.id = b.coach_id
              where b.user_id = s.user_id
                and c.profile_id = s.coach_id
                and (b.status in ('confirmada', 'completada')
                  or b.payment_status in ('aprobado', 'reembolso_pendiente', 'reembolsado'))
            )
          )
          or (messages.sender_type = 'system_confirmed' and exists (
            select 1 from public.bookings b where b.sala_id = s.id and b.status = 'confirmada'))
          or (messages.sender_type = 'system_cancelled' and exists (
            select 1 from public.bookings b where b.sala_id = s.id and b.status = 'cancelada'))
        )
    )
  );

-- ── 2. resource_recommendations ────────────────────────────────────────────
drop policy if exists resource_recommendations_insert on public.resource_recommendations;
create policy resource_recommendations_insert on public.resource_recommendations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.coaches c
      join public.salas s on s.id = resource_recommendations.room_id
      where c.id = resource_recommendations.coach_id
        and c.profile_id = auth.uid()
        and s.coach_id = c.profile_id
        and s.user_id = resource_recommendations.user_id
        and exists (
          select 1 from public.bookings b
          where b.coach_id = c.id
            and b.user_id = resource_recommendations.user_id
            and (b.status in ('confirmada', 'completada')
              or b.payment_status in ('aprobado', 'reembolso_pendiente', 'reembolsado'))
        )
    )
  );

revoke update on public.resource_recommendations from authenticated, anon;
grant update (opened_at) on public.resource_recommendations to authenticated;

-- ── 3. Storage ──────────────────────────────────────────────────────────────
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists coach_videos_public_read on storage.objects;
drop policy if exists resource_video_public_read on storage.objects;
drop policy if exists resource_audio_public_read on storage.objects;

create policy avatars_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy coach_videos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'coach-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy resource_video_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'resource-video' and (storage.foldername(name))[1] = auth.uid()::text);

-- ⚠️ Dos policies y no un OR con is_admin(): `anon` no puede ejecutar
-- is_admin() (revocado en add-admin-flag.sql) y la policy entera fallaba con
-- "permission denied" para quien escucha sin cuenta. La de admins es solo para
-- `authenticated`, así que a anon no se le evalúa.
create policy resource_audio_select on storage.objects
  for select to public
  using (
    bucket_id = 'resource-audio'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.coach_resources r
                 where r.storage_path = storage.objects.name and r.status = 'published')
    )
  );

create policy resource_audio_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'resource-audio' and public.is_admin());

-- ── 4. anon sin escritura a nivel tabla ────────────────────────────────────
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t.relname);
  end loop;
end $$;
grant insert on public.analytics_events to anon;

alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;

commit;
