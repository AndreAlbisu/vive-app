-- get-last-messages-per-sala.sql
--
-- SessionsScreen (usuario, tab Mensajes) y CoachChatsScreen (coach, tab Chats)
-- traían el último mensaje de cada sala con un Promise.all de N queries (una
-- por sala) — con varias salas eso es N round-trips en serie, y como esa
-- pantalla ahora carga apenas se hace lazy-mount al entrar/swipear al tab, el
-- lag se sentía fuerte en la primera visita. Esta función devuelve el último
-- mensaje de cada sala pedida en un solo round-trip (DISTINCT ON, sin agregar
-- índices nuevos — sala_id + created_at ya cubren bien este acceso).
--
-- Sin SECURITY DEFINER a propósito: messages ya tiene RLS que permite a un
-- usuario autenticado leer los mensajes de sus propias salas (así funciona
-- hoy el fetch per-sala) — corriendo como invoker esa misma política sigue
-- aplicando sola, no hay que reimplementar la autorización a mano acá.
create or replace function public.get_last_messages_per_sala(sala_ids uuid[])
returns table (
  sala_id uuid,
  content text,
  sender_type text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select distinct on (m.sala_id)
    m.sala_id,
    m.content,
    m.sender_type,
    m.metadata,
    m.created_at
  from public.messages m
  where m.sala_id = any(sala_ids)
  order by m.sala_id, m.created_at desc;
$$;

revoke all on function public.get_last_messages_per_sala(uuid[]) from public;
revoke execute on function public.get_last_messages_per_sala(uuid[]) from anon;
grant execute on function public.get_last_messages_per_sala(uuid[]) to authenticated;
