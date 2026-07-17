-- add-resource-reminders.sql
--
-- Recordatorios que el PROPIO usuario configura para una herramienta de VITA o
-- un recurso de coach (ej. "Diario, lun/mié/vie a las 21:00"). Reemplaza el
-- botón del coach de "recordarle que lo abra" (era presión) por autonomía del
-- usuario. Las notificaciones son LOCALES (expo-notifications) — esta tabla es
-- la fuente de verdad que cada dispositivo re-agenda al abrir la app (las notis
-- locales se pierden al reinstalar; la tabla las reconstruye).
--
-- `ref` guarda el slug de la tool (ej. 'diario') o el uuid de coach_resources,
-- según `kind` — mismo patrón dual que saved_resources. `title` se cachea para
-- la notificación y la lista sin tener que resolver el recurso.

create table if not exists public.resource_reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  kind        text        not null check (kind in ('tool', 'coach_resource')),
  ref         text        not null,   -- slug de tool o uuid de coach_resources
  title       text        not null,   -- cache para la notificación y la lista
  days        smallint[]  not null,   -- días de la semana: 0=Dom .. 6=Sáb (subconjunto)
  hour        smallint    not null check (hour   between 0 and 23),
  minute      smallint    not null check (minute between 0 and 59),
  enabled     boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resource_reminders_user_idx on public.resource_reminders (user_id);

alter table public.resource_reminders enable row level security;

-- Cada usuario ve/gestiona solo los suyos.
drop policy if exists "own resource reminders" on public.resource_reminders;
create policy "own resource reminders" on public.resource_reminders
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
