-- add-reports.sql
--
-- Reportes de usuarios y coaches (moderación/seguridad).
--
-- Bidireccional: un usuario puede reportar a un coach y un coach a un usuario.
-- reporter_id/reported_id son ambos profiles.id — la dirección se deduce de
-- profiles.role, no hace falta guardarla. El equipo VIVE revisa a mano vía SQL
-- (no hay panel admin todavía); no hay bloqueo automático de la cuenta.
--
-- reason es un slug libre (sin CHECK): la lista de motivos vive en el front
-- (lib/reports.ts REPORT_REASONS), mismo criterio que coach_topics/saved_resources
-- — no vale la rigidez de un enum en la base para una lista que cambia en la UI.

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reported_id  uuid not null references public.profiles(id) on delete cascade,
  reason       text not null,
  details      text,
  sala_id      uuid references public.salas(id) on delete set null,  -- contexto si vino del chat
  status       text not null default 'pendiente'
               check (status in ('pendiente', 'revisado', 'accionado', 'descartado')),
  created_at   timestamptz not null default now()
);

-- Consulta típica del equipo: lo pendiente, más nuevo primero.
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- INSERT: solo como uno mismo (no se puede reportar en nombre de otro).
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- SELECT: solo los reportes propios (para poder mostrar "ya reportado" y evitar
-- spam desde la UI). Nadie ve los reportes que le hicieron a él.
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- Sin políticas de UPDATE/DELETE a propósito: el cliente no edita ni borra
-- reportes. El equipo gestiona el status con el service role (bypassa RLS).
