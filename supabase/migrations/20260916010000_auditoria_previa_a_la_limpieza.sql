-- Auditoría de solo lectura, previa a `scripts/limpiar-datos-de-prueba.sql`.
--
-- ⚠️ ESTE ARCHIVO NO CAMBIA NADA. No hay un solo INSERT, UPDATE, DELETE ni DDL:
-- son SELECT que se imprimen con `raise notice`.
--
-- 🔴 POR QUÉ EXISTE, Y POR QUÉ ES FEO. Hace falta mirar la base antes de borrar
-- 185 reservas, y desde acá no hay forma limpia de leerla:
--   · la anon key solo ve las tablas públicas (RLS devuelve 0 sin error, y ese
--     0 ya nos hizo sacar dos conclusiones falsas);
--   · `supabase db dump` necesita Docker, que no está instalado;
--   · `supabase inspect db` trae consultas fijas, ninguna con contenido de filas;
--   · `supabase db` no tiene un `execute`/`sql`.
-- La única vía que quedaba era una migración, y las migraciones quedan en el
-- historial. Por eso va TODO en un solo archivo: una entrada, no diez.
--
-- Si esto se vuelve a necesitar seguido, conviene resolver el acceso de verdad
-- (Docker, o la contraseña de la base) en vez de repetir este truco.

do $$
declare
  r record;
begin
  raise notice '── RESERVAS por estado ────────────────────────────────';
  for r in
    select status, payment_status, count(*) as n,
           min(scheduled_date) as desde, max(scheduled_date) as hasta
      from public.bookings
     group by status, payment_status
     order by n desc
  loop
    raise notice '  % / % → % (del % al %)', r.status, r.payment_status, r.n, r.desde, r.hasta;
  end loop;

  raise notice '';
  raise notice '── RESERVAS con plata que se movió de verdad ──────────';
  for r in
    select payment_provider, payment_status, count(*) as n, sum(coalesce(charged_amount, 0)) as total
      from public.bookings
     where payment_status is not null and payment_status <> 'pendiente'
     group by payment_provider, payment_status
     order by n desc
  loop
    raise notice '  % / % → % reservas, total cobrado %', r.payment_provider, r.payment_status, r.n, r.total;
  end loop;

  raise notice '';
  raise notice '── RESERVAS por coach (slug) ──────────────────────────';
  for r in
    select c.slug, count(b.id) as n
      from public.bookings b
      join public.coaches c on c.id = b.coach_id
     group by c.slug
     order by n desc
     limit 40
  loop
    raise notice '  % → %', r.slug, r.n;
  end loop;

  raise notice '';
  raise notice '── PERFILES: cuántos son, y cuántos tienen actividad ──';
  for r in
    select count(*) as total,
           count(*) filter (where role = 'coach') as coaches,
           count(*) filter (where age_confirmed) as declararon_edad
      from public.profiles
  loop
    raise notice '  perfiles: % (coaches: %, declararon edad: %)', r.total, r.coaches, r.declararon_edad;
  end loop;

  for r in
    select p.id, p.name, p.role,
           (select count(*) from public.bookings b where b.user_id = p.id) as reservas,
           (select count(*) from public.journal_entries j where j.user_id = p.id) as diario,
           (select count(*) from public.mood_entries m where m.user_id = p.id) as animos
      from public.profiles p
     order by reservas desc, diario desc
     limit 25
  loop
    raise notice '  % · % (%) → reservas=% diario=% animos=%',
      left(r.id::text, 8), coalesce(r.name, '(sin nombre)'), coalesce(r.role, '-'),
      r.reservas, r.diario, r.animos;
  end loop;

  raise notice '';
  raise notice '── LO QUE SE LLEVARÍA la limpieza (conservando "andre") ─';
  for r in
    select
      (select count(*) from public.coaches where slug is null or slug <> 'andre') as coaches,
      (select count(*) from public.bookings b
         where b.coach_id in (select id from public.coaches where slug is null or slug <> 'andre')) as reservas,
      (select count(*) from public.salas sa
         where sa.coach_id in (select profile_id from public.coaches where slug is null or slug <> 'andre')) as salas
  loop
    raise notice '  coaches=%  reservas=%  salas=%', r.coaches, r.reservas, r.salas;
  end loop;
end $$;
