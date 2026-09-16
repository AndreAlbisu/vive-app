-- Publicar `session_notes` en `supabase_realtime` + REPLICA IDENTITY FULL.
--
-- ⚠️ El porqué completo vive en `scripts/publicar-notas-en-realtime.sql`, que es
-- donde el proyecto viene guardando su SQL. Este archivo existe solo porque es
-- la forma que tiene el CLI de aplicar SQL contra la base (`supabase db push`),
-- y deja constancia de que se aplicó. Resumen: sin la tabla publicada, el canal
-- de realtime que `SalaScreen` abre para las notas escucha un silencio.
--
-- Publicar NO saltea RLS: la policy del usuario es
-- `user_id = auth.uid() AND shared = true`, así que nunca le llega una privada.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_notes'
  ) then
    alter publication supabase_realtime add table public.session_notes;
    raise notice 'publicada: session_notes';
  else
    raise notice 'ya estaba: session_notes';
  end if;
end $$;

-- FULL porque el cliente filtra por `user_id`/`coach_id`, que no son la PK, y
-- porque corregir una nota ya compartida llega como UPDATE (unique + upsert).
alter table public.session_notes replica identity full;
