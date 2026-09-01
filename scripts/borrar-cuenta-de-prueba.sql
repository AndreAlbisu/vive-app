-- ============================================================
-- Vita — borrar UNA cuenta de prueba, a mano
-- Correr en: Supabase Dashboard → SQL Editor
-- 🔴 DESTRUCTIVO. Leer la parte 1 antes de correr la parte 2.
-- Fecha: 2026-08-31
--
-- POR QUÉ EXISTE
-- 🔴 Borrar desde el panel de Authentication NO alcanza y además rompe cosas:
-- borra `auth.users` y NO toca `profiles` (la FK entre las dos se dropeó el
-- 06/08/2026). La fila huérfana conserva el email, que es UNIQUE, así que ese
-- mail no se puede volver a usar NUNCA y el error que da al registrarse
-- ("Database error saving new user") no dice nada del verdadero motivo.
--
-- Este script borra las dos, y aborta si la cuenta tiene historia real.
-- ============================================================

-- ── PARTE 1 · Mirar qué hay antes de tocar nada ──────────────────────────────
-- Correr SOLO esto primero. Si alguno de los contadores de la derecha no es 0,
-- NO es una cuenta de prueba vacía: pará y miralo.

select
  u.id,
  u.email,
  u.created_at,
  p.name,
  p.role,
  (select count(*) from public.coaches   c where c.profile_id = u.id) as filas_coach,
  (select count(*) from public.bookings  b where b.user_id    = u.id) as reservas,
  (select count(*) from public.salas     s where s.user_id    = u.id
                                              or s.coach_id   = u.id) as salas,
  (select count(*) from public.messages  m where m.sender_id  = u.id) as mensajes,
  -- ⚠️ `reviews` NO tiene `user_id`: son dos columnas, quien escribe y quien
  -- recibe. Se cuentan las dos — cualquiera de las dos ata la fila a esta cuenta.
  (select count(*) from public.reviews   r where r.reviewer_id = u.id
                                              or r.reviewed_id = u.id) as resenas
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'pruebavita1234@gmail.com';


-- ── PARTE 2 · El borrado ─────────────────────────────────────────────────────
-- Recién después de mirar la parte 1. Aborta solo si hay reservas, salas,
-- mensajes o reseñas: eso ya no es una cuenta de prueba y borrarla a mano
-- dejaría huecos del lado del otro (el coach o el usuario que le escribió).

do $$
declare
  v_id    uuid;
  v_freno int;
begin
  select id into v_id from auth.users where email = 'pruebavita1234@gmail.com';

  if v_id is null then
    raise notice 'No hay ninguna cuenta con ese mail. Nada que borrar.';
    return;
  end if;

  select
      (select count(*) from public.bookings b where b.user_id  = v_id)
    + (select count(*) from public.salas    s where s.user_id  = v_id or s.coach_id = v_id)
    + (select count(*) from public.messages m where m.sender_id = v_id)
    + (select count(*) from public.reviews  r where r.reviewer_id = v_id or r.reviewed_id = v_id)
  into v_freno;

  if v_freno > 0 then
    raise exception 'La cuenta % tiene % filas de historia (reservas/salas/mensajes/reseñas). No se borra a mano: usá la baja de la app, que anonimiza en vez de romper.', v_id, v_freno;
  end if;

  -- El orden importa: lo que cuelga de `coaches` primero, después `profiles`,
  -- y `auth.users` al final. Al revés, una FK sin CASCADE aborta a la mitad.
  delete from public.coach_topics
   where coach_id in (select id from public.coaches where profile_id = v_id);
  delete from public.coaches  where profile_id = v_id;
  delete from public.profiles where id = v_id;
  delete from auth.users      where id = v_id;

  raise notice 'Cuenta % borrada entera (auth.users + profiles). El mail queda libre.', v_id;
end $$;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- Esperado: CERO filas. Si devuelve algo, quedó una mitad y el mail sigue roto.
--
-- select 'auth.users' as tabla, id::text from auth.users
--  where email = 'pruebavita1234@gmail.com'
-- union all
-- select 'profiles', id::text from public.profiles
--  where email = 'pruebavita1234@gmail.com';
