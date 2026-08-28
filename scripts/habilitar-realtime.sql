-- Publicar las tablas que la app escucha en vivo
-- ---------------------------------------------------------------------------
-- 🔴 EL PROBLEMA: ocho pantallas se suscriben a `postgres_changes` y NO LES
-- LLEGA NADA, porque la publicación `supabase_realtime` no tiene ninguna tabla.
-- Verificado contra la base el 28/08/2026:
--
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
--   → 0 filas
--
-- Sin la tabla publicada, Postgres no manda esos cambios por la réplica lógica y
-- el canal queda escuchando un silencio. El código del cliente está bien: nunca
-- recibió un evento.
--
-- Lo que estaba roto por esto:
--   · El CHAT no se actualiza solo. `SalaScreen` no hace polling de mensajes —
--     su único `setInterval` recalcula el estado de la sesión, no trae mensajes.
--     Mandabas uno y del otro lado no aparecía hasta salir y volver a entrar.
--   · El punto de Reservas del coach no se apagaba al aceptar (el bug que lo
--     destapó todo). Tenía además un error de conteo, arreglado aparte.
--   · El punto de mensajes sin leer, en las dos barras.
--   · La Home del coach, Reservas y Conexiones.
--   · La bandeja de personas del coach, que se hizo el 28/08 justamente para
--     actualizarse en vivo.
--
-- ⚠️ Publicar una tabla NO saltea RLS. Realtime evalúa las políticas del usuario
-- suscripto antes de entregarle una fila: nadie va a recibir cambios de filas
-- que no puede leer. Lo que se habilita es el transporte, no el permiso.

-- `add table` falla si ya está publicada, así que se agrega solo lo que falta.
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'bookings', 'salas', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'publicada: %', t;
    else
      raise notice 'ya estaba: %', t;
    end if;
  end loop;
end $$;

-- 🔴 `messages` y `bookings` necesitan REPLICA IDENTITY FULL. Con la de por
-- defecto (la PK), un UPDATE viaja sin los valores VIEJOS de las columnas — y
-- los filtros del cliente (`coach_id=eq.…`) se evalúan contra la fila que llega.
-- Para los INSERT no cambia nada; para los UPDATE es lo que hace que el filtro
-- funcione de verdad en vez de a veces.
alter table public.messages       replica identity full;
alter table public.bookings       replica identity full;
alter table public.salas          replica identity full;
alter table public.notifications  replica identity full;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- Esperado: las 4 filas, con `identidad = f` (full).
--
-- select t.tablename,
--        c.relreplident as identidad,
--        case when c.relreplident = 'f' then 'OK' else '⚠️ no es FULL' end as veredicto
--   from pg_publication_tables t
--   join pg_class c on c.oid = format('public.%I', t.tablename)::regclass
--  where t.pubname = 'supabase_realtime' and t.schemaname = 'public'
--  order by t.tablename;
