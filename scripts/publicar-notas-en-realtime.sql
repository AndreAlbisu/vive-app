-- Publicar `session_notes` para que las notas lleguen en vivo
-- ---------------------------------------------------------------------------
-- 🔴 EL PROBLEMA: una nota compartida no se comportaba como un mensaje. La
-- suscripción de `SalaScreen` escucha solo `messages`, así que el coach
-- compartía una nota y del otro lado no aparecía nada mientras el chat estaba
-- abierto. SCHEMA.md ya lo tenía anotado desde el 31/08/2026 ("una nota escrita
-- por el coach le aparece al usuario recién al reabrir el chat") — y era peor
-- que eso: tampoco aparecía al reabrir, porque `fetchNotes` no dependía de
-- `refreshKey` y las notas se traían una sola vez, al montar la pantalla.
--
-- La parte del cliente ya está arreglada (canal propio para `session_notes` +
-- recarga al volver a la pantalla). Falta el transporte: sin la tabla publicada,
-- Postgres no manda esos cambios por la réplica lógica y el canal escucha un
-- silencio. Es exactamente lo que pasaba con las otras cuatro tablas antes del
-- 28/08 — ver `scripts/habilitar-realtime.sql`.
--
-- ⚠️ Publicar NO saltea RLS. La policy del usuario es
-- `user_id = auth.uid() AND shared = true`, así que por más que la tabla esté
-- publicada, al cliente **nunca le va a llegar una nota privada**. Lo que se
-- habilita es el transporte, no el permiso.

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

-- 🔴 REPLICA IDENTITY FULL, por el mismo motivo que `messages`: el cliente
-- filtra por `user_id`/`coach_id`, que no son la PK. Con la identidad por
-- defecto un UPDATE viaja sin los valores viejos y el filtro se evalúa a medias.
-- Y acá los UPDATE importan de verdad: la tabla tiene `unique (booking_id,
-- shared)` y el sheet hace upsert, así que **corregir una nota ya compartida
-- llega como UPDATE, no como INSERT**.
alter table public.session_notes replica identity full;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Esperado: una fila, con `identidad = f`.
--
-- select t.tablename,
--        c.relreplident as identidad,
--        case when c.relreplident = 'f' then 'OK' else '⚠️ no es FULL' end as veredicto
--   from pg_publication_tables t
--   join pg_class c on c.oid = format('public.%I', t.tablename)::regclass
--  where t.pubname = 'supabase_realtime' and t.tablename = 'session_notes';
--
-- Y la prueba de verdad, que no la da ninguna consulta: con el chat abierto del
-- lado del cliente, que el coach comparta una nota y que aparezca sola.
