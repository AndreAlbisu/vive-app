-- ============================================================
-- Vita — títulos y matrículas de los profesionales, verificados por Vita
-- Correr en: Supabase Dashboard → SQL Editor
-- ⚠️  REVISAR CON ANDRE ANTES DE CORRER
-- Fecha: 2026-08-28
--
-- QUÉ RESUELVE
-- Hoy no hay NADA de respaldo documental: la postulación pide un video y una
-- bio, y `verified` se decide a ojo. Se aprueban psicólogos sin que quede
-- registrado en qué se basó la aprobación.
--
-- 🔴 LA DECISIÓN CENTRAL: EL DOCUMENTO NO ES CONTENIDO PÚBLICO.
-- El coach sube el archivo, un admin lo mira, y lo que se publica es el DATO EN
-- TEXTO con una marca de verificado. El archivo nunca se sirve a un usuario.
-- Tres motivos, y ninguno es teórico:
--   1. Un diploma o una credencial de matrícula lleva nombre completo, muchas
--      veces DNI, firma y a veces domicilio. Publicarlo expone datos personales
--      del profesional a cualquier visitante, y es descargable por cualquiera.
--   2. Una imagen es un canal de texto que NINGÚN regex puede moderar: alcanza
--      con poner el WhatsApp en una esquina del certificado para saltarse
--      `contactInfoGuard`, que existe justamente porque eso pasa.
--   3. Un JPEG no prueba nada — cualquiera sube cualquier imagen. Mostrarlo tal
--      cual sería que Vita preste credibilidad a algo que no chequeó, sobre la
--      afirmación de más riesgo del producto. Lo que verifica de verdad a un
--      psicólogo en Argentina es la MATRÍCULA, que es un número consultable.
--
-- Por eso este script trae dos cosas que el proyecto no tenía:
--   · el primer bucket PRIVADO (los cinco que existen son públicos), y
--   · una vista pública que expone solo las columnas seguras de las filas
--     verificadas — porque RLS es por fila y una policy de SELECT pública sobre
--     la tabla dejaría `file_path` y `review_notes` a la vista de cualquiera.
-- ============================================================

-- ── 1) La tabla ──────────────────────────────────────────────────────────────
create table if not exists public.coach_credentials (
  id                  uuid primary key default gen_random_uuid(),
  -- ⚠️ `coaches.id`, NO `coaches.profile_id`. Son dos ids distintos con nombres
  -- parecidos y es la trampa recurrente de este proyecto.
  coach_id            uuid not null references public.coaches(id) on delete cascade,

  kind                text not null check (kind in ('titulo', 'matricula', 'certificacion')),
  title               text not null check (length(btrim(title)) between 2 and 120),
  institution         text check (institution is null or length(btrim(institution)) <= 120),
  year                smallint check (year is null or year between 1950 and 2100),
  -- El número de matrícula (M.N. / M.P.). Es lo ÚNICO de acá que un tercero
  -- puede verificar por su cuenta, así que vale más que el escaneo.
  registration_number text check (registration_number is null or length(btrim(registration_number)) <= 40),

  -- Path dentro del bucket privado. Nunca se devuelve al público (ver la vista).
  file_path           text,

  status              text not null default 'pendiente'
                        check (status in ('pendiente', 'verificada', 'rechazada')),
  -- Le llega al coach: es el motivo del rechazo, igual que `application_notes`.
  review_notes        text,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_coach_credentials_coach on public.coach_credentials(coach_id);
-- Para la cola del panel: las pendientes, más viejas primero.
create index if not exists idx_coach_credentials_pendientes
  on public.coach_credentials(created_at)
  where status = 'pendiente';

-- ── 2) RLS ───────────────────────────────────────────────────────────────────
alter table public.coach_credentials enable row level security;

-- El coach ve las suyas, TODAS (incluidas las rechazadas: necesita leer el
-- motivo para corregir). El público no lee esta tabla — lee la vista.
drop policy if exists coach_credentials_select_own on public.coach_credentials;
create policy coach_credentials_select_own on public.coach_credentials
  for select to authenticated
  using (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
  );

drop policy if exists coach_credentials_insert_own on public.coach_credentials;
create policy coach_credentials_insert_own on public.coach_credentials
  for insert to authenticated
  with check (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
  );

drop policy if exists coach_credentials_update_own on public.coach_credentials;
create policy coach_credentials_update_own on public.coach_credentials
  for update to authenticated
  using (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
  )
  with check (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
  );

drop policy if exists coach_credentials_delete_own on public.coach_credentials;
create policy coach_credentials_delete_own on public.coach_credentials
  for delete to authenticated
  using (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
  );

-- 🔴 RLS dice QUÉ FILAS, no QUÉ COLUMNAS. Sin esto, el coach podría hacer
-- `update ... set status='verificada'` sobre su propia fila y auto-verificarse,
-- que es exactamente lo que esta feature no puede permitir. Mismo mecanismo que
-- ya se usa en `coaches` para `verified`/`application_status`: se revoca el
-- privilegio de tabla entera y se otorgan columnas nombradas.
revoke update on public.coach_credentials from authenticated;
grant update (kind, title, institution, year, registration_number, file_path)
  on public.coach_credentials to authenticated;

-- ── 3) Editar una credencial la devuelve a revisión ──────────────────────────
-- 🔴 Sin esto, el camino de ataque es de un solo paso: cargar "Coach de
-- hábitos", esperar la verificación, y editarla a "Lic. en Psicología". La
-- marca de verificado seguiría puesta sobre un texto que nadie miró.
-- Mismo criterio (y mismo motivo) que `trg_reset_application_on_edit`.
create or replace function public.reset_credential_on_edit()
returns trigger
language plpgsql
as $$
begin
  -- Solo si cambió algo que la revisión miró. Un update que no toca ninguno de
  -- estos campos no tiene por qué volver a la cola.
  if (new.kind, new.title, new.institution, new.year, new.registration_number, new.file_path)
     is distinct from
     (old.kind, old.title, old.institution, old.year, old.registration_number, old.file_path)
  then
    new.status := 'pendiente';
    new.reviewed_at := null;
    -- `review_notes` se conserva: es el contexto de quien revisa la 2ª vuelta.
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_credential_on_edit on public.coach_credentials;
create trigger trg_reset_credential_on_edit
  before update on public.coach_credentials
  for each row
  execute function public.reset_credential_on_edit();

-- ── 4) La vista pública ──────────────────────────────────────────────────────
-- 🔴 Es una VISTA y no una policy de SELECT porque RLS filtra filas, no
-- columnas: una policy pública sobre la tabla dejaría `file_path` (el path del
-- documento) y `review_notes` legibles para cualquiera con la anon key.
-- Acá se elige columna por columna qué sale.
--
-- ⚠️ `security_invoker = false` (el default de una vista) es lo que la hace
-- funcionar: corre con los permisos del dueño y por eso puede leer la tabla que
-- el público no puede leer. Es a propósito, y el filtro `status = 'verificada'`
-- de adentro es entonces la ÚNICA cosa que separa lo verificado de lo que
-- todavía no miró nadie. No tocar ese where sin pensarlo dos veces.
create or replace view public.coach_credentials_public as
  select
    c.id,
    c.coach_id,
    c.kind,
    c.title,
    c.institution,
    c.year,
    c.registration_number,
    c.reviewed_at
  from public.coach_credentials c
  where c.status = 'verificada';

grant select on public.coach_credentials_public to anon, authenticated;

-- ── 5) El bucket privado ─────────────────────────────────────────────────────
-- 🔴 `public = false`. Es el PRIMERO del proyecto: `avatars`, `coach-videos`,
-- `resource-audio`, `resource-video` y el de recursos son todos públicos, así
-- que el patrón de `getPublicUrl` que se copia en toda la app NO aplica acá.
-- El admin lo mira con una URL firmada que emite `admin-actions` con service
-- role; nadie más lo lee.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-credentials',
  'coach-credentials',
  false,
  10 * 1024 * 1024,  -- 10MB: es un escaneo, no un video
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Escritura y lectura solo en la carpeta propia. Como `auth.uid() = profiles.id
-- = coaches.profile_id`, alcanza con el nombre de la carpeta y no hace falta
-- join a `coaches`. Mismo patrón que `coach-videos`.
drop policy if exists coach_credentials_insert on storage.objects;
create policy coach_credentials_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'coach-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists coach_credentials_update on storage.objects;
create policy coach_credentials_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'coach-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists coach_credentials_delete on storage.objects;
create policy coach_credentials_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'coach-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT solo el dueño. A propósito NO hay policy para admins: el panel pasa
-- por `admin-actions`, que usa service role y saltea RLS. Una policy de admin
-- acá sería una segunda puerta que mantener sincronizada con `profiles.is_admin`.
drop policy if exists coach_credentials_select on storage.objects;
create policy coach_credentials_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'coach-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 6) Dos tipos nuevos de notificación ──────────────────────────────────────
-- El coach tiene que enterarse del resultado, y sobre todo del motivo cuando lo
-- rechazan. `notifications.type` tiene un CHECK, así que hay que extenderlo.
--
-- 🔴 NO se asume ni el nombre de la constraint ni la lista de valores: se leen
-- de `pg_constraint` y se reescribe la definición agregando los dos nuevos.
-- Mismo criterio que `add-notifications-recurso-feedback-umbral.sql`. Si la
-- forma no es la esperada, ABORTA con un mensaje en vez de dejar el CHECK roto
-- o, peor, borrado.
do $$
declare
  cname text;
  cdef  text;
  nuevo text;
begin
  select conname, pg_get_constraintdef(oid)
    into cname, cdef
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type%'
  limit 1;

  if cname is null then
    raise exception 'No se encontró el CHECK de notifications.type. Revisar a mano antes de seguir.';
  end if;

  -- Ya corrido antes: no hay nada que hacer y volver a correrlo no rompe nada.
  if cdef like '%credencial_verificada%' then
    raise notice 'El CHECK ya incluye los tipos de credencial; no se toca.';
    return;
  end if;

  -- La forma esperada es: CHECK ((type = ANY (ARRAY['a'::text, ...])))
  if position(']::text[]' in cdef) = 0 then
    raise exception 'El CHECK de notifications.type no tiene la forma esperada (%). Extenderlo a mano.', cdef;
  end if;

  nuevo := replace(
    cdef,
    ']::text[]',
    ', ''credencial_verificada''::text, ''credencial_rechazada''::text]::text[]'
  );

  execute format('alter table public.notifications drop constraint %I', cname);
  execute format('alter table public.notifications add constraint %I %s', cname, nuevo);
  raise notice 'CHECK de notifications.type extendido con los tipos de credencial.';
end $$;

notify pgrst, 'reload schema';

-- ── Verificación ─────────────────────────────────────────────────────────────
--
-- 1) La tabla y su RLS:
--    select relrowsecurity from pg_class where relname = 'coach_credentials';
--    select polname, cmd from pg_policy
--    where polrelid = 'public.coach_credentials'::regclass order by polname;
--
-- 2) 🔴 LA QUE MÁS IMPORTA — que el coach NO pueda escribir `status`.
--    Tiene que devolver exactamente las 6 columnas otorgadas, sin `status`:
--
--    select column_name from information_schema.column_privileges
--    where table_name = 'coach_credentials' and grantee = 'authenticated'
--      and privilege_type = 'UPDATE' order by column_name;
--
-- 3) El bucket quedó PRIVADO (si esto dice true, la feature está rota):
--    select id, public, file_size_limit from storage.buckets
--    where id = 'coach-credentials';
--
-- 4) La vista no filtra nada de más ni de menos. Con una fila 'pendiente' y una
--    'verificada' del mismo coach, esto tiene que devolver solo la verificada:
--    select id, title from coach_credentials_public where coach_id = '<coach>';
--
-- 5) Que la vista NO exponga el documento — tiene que dar 0 filas:
--    select column_name from information_schema.columns
--    where table_name = 'coach_credentials_public'
--      and column_name in ('file_path', 'review_notes', 'status');
--
-- 6) El trigger de re-revisión. Sobre una fila ya 'verificada':
--    update coach_credentials set title = title || ' x' where id = '<id>';
--    select status from coach_credentials where id = '<id>';  -- 'pendiente'
--
-- 7) Los dos tipos nuevos entraron al CHECK:
--    select pg_get_constraintdef(oid) like '%credencial_verificada%' as ok
--    from pg_constraint where conrelid = 'public.notifications'::regclass
--      and contype = 'c' and pg_get_constraintdef(oid) like '%type%';
--
-- ── Para volver atrás ────────────────────────────────────────────────────────
-- drop view if exists public.coach_credentials_public;
-- drop table if exists public.coach_credentials;          -- borra las filas
-- drop function if exists public.reset_credential_on_edit();
-- delete from storage.buckets where id = 'coach-credentials';  -- vaciarlo antes
