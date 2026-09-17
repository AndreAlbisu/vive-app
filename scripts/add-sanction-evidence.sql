-- add-sanction-evidence.sql
--
-- Adjuntos de evidencia para las sanciones (capturas, PDFs) — y el cierre de una
-- fuga que tenía la versión anterior.
--
-- ✅ CORRIDO y VERIFICADO el 16/09/2026 desde el CLI. 9 de 9, y la que importa es
--    una prueba ACTUANDO como un coach real con sesión (set role authenticated +
--    su JWT): leer `evidencia` rebota con `permission denied`, y el mismo coach
--    sigue leyendo nivel/motivo/hasta — o sea que el aviso de su Inicio sigue
--    andando. `admin-actions` v31 deployada con las tres acciones nuevas.
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- Andre (16/09/2026): *"no puedo adjuntar nada en las evidencias"*. La evidencia
-- era un campo de texto, y la evidencia real de una fuga es casi siempre una
-- captura de pantalla: el chat donde el coach pasó su WhatsApp, el comprobante
-- de una transferencia por fuera. Describir una captura con palabras no le sirve
-- a nadie que revise el caso después.
--
-- ── 🔴 La fuga que se cierra de paso ─────────────────────────────────────────
--
-- `add-coach-sanctions.sql` le dio al coach una policy para LEER sus sanciones
-- —es la transparencia del sistema— y la tabla heredó el GRANT SELECT de tabla
-- que Supabase pone por defecto. Resultado: **el coach sancionado podía leer por
-- la API la columna `evidencia`** de su propia sanción, aunque la app no se la
-- muestre. Verificado el 16/09/2026 contra `role_table_grants`.
--
-- Y la evidencia no es del coach. Casi siempre sale de lo que contó OTRA
-- persona: el cliente que reportó, sus mensajes, su comprobante. Dársela al
-- sancionado es exponer a quien denunció a una represalia, y regalarle datos de
-- un tercero. **El coach tiene que saber POR QUÉ lo sancionaron (el motivo); no
-- tiene derecho a ver CON QUÉ se probó.**
--
-- El arreglo es por columna: se revoca el SELECT de tabla y se devuelve solo lo
-- que la app del coach usa. Un revoke de columna sobre un permiso de tabla no
-- hace nada en Postgres (es lo que pasó con `anon` y `suspendido_hasta`), así
-- que tiene que ser en este orden: primero la tabla entera, después las columnas.
--
-- ── Cómo se sube y cómo se mira, sin segunda puerta ──────────────────────────
--
-- Mismo criterio que `coach-credentials`: **ninguna policy de storage para
-- admins.** Una policy con `is_admin()` sería una segunda puerta que mantener
-- sincronizada con `profiles.is_admin`. En su lugar, `admin-actions` (que ya
-- valida al admin contra el JWT) emite:
--   · para SUBIR, una URL de subida firmada a un path que elige ella;
--   · para MIRAR, una URL firmada de 5 minutos, y ese acto queda auditado.
-- Así el bucket no tiene ninguna policy y ningún cliente lo toca directo.

begin;

-- ── 1) El bucket privado ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sanction-evidence',
  'sanction-evidence',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2) Qué adjunto pertenece a qué sanción ───────────────────────────────────
create table if not exists public.coach_sanction_evidence (
  id          uuid primary key default gen_random_uuid(),
  sancion_id  uuid not null references public.coach_sanctions(id) on delete cascade,
  -- `<sancion_id>/<uuid>.<ext>`. Lo arma `admin-actions`, nunca el cliente.
  file_path   text not null unique,
  mime        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists coach_sanction_evidence_sancion_idx
  on public.coach_sanction_evidence (sancion_id, created_at);

-- RLS prendido y SIN policies: solo service role. Y además sin grants, para que
-- no dependa de que nadie agregue una policy por error algún día.
alter table public.coach_sanction_evidence enable row level security;
revoke all on public.coach_sanction_evidence from anon, authenticated;

-- ── 3) La fuga: el coach deja de poder leer la evidencia ─────────────────────
revoke select on public.coach_sanctions from anon, authenticated;

-- Solo lo que la app del coach necesita. `revocada_motivo` entra porque ya se le
-- manda en la notificación al levantarla. Quedan AFUERA: `evidencia`,
-- `created_by` y `revocada_por` (quién del equipo decidió no es asunto del
-- sancionado, y es lo que lo expondría a presionar a una persona concreta).
grant select (id, coach_id, nivel, motivo, hasta, created_at, revocada_at, revocada_motivo)
  on public.coach_sanctions to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) 🔴 La fuga cerrada: `authenticated` NO tiene `evidencia`. Esperado: 0 filas.
select grantee, column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'coach_sanctions'
  and privilege_type = 'SELECT' and grantee in ('authenticated', 'anon')
  and column_name in ('evidencia', 'created_by', 'revocada_por');

-- 2) Y sigue pudiendo leer lo que la app usa. Esperado: las 8 columnas.
select column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'coach_sanctions'
  and privilege_type = 'SELECT' and grantee = 'authenticated'
order by column_name;

-- 3) El bucket es PRIVADO y no tiene ninguna policy.
select b.public,
       (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects'
           and (p.qual ilike '%sanction-evidence%' or p.with_check ilike '%sanction-evidence%')) as policies
from storage.buckets b where b.id = 'sanction-evidence';

-- 4) La tabla de adjuntos no la lee nadie más que el service role.
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'coach_sanction_evidence'
  and grantee in ('anon', 'authenticated');
