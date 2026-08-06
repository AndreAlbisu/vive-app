-- create-mood-suggestions.sql
--
-- Registro de la tarjeta "Para vos ahora" en Inicio (components/ResourceSuggestionCard):
-- una fila por cada vez que se muestra con check-in de hoy real, con el par de
-- recursos sugerido y en qué orden, y cuál eligió el usuario (NULL si no tocó ninguno).
--
-- Reemplaza a scripts/create-resource-recommendations.sql (04/08/2026), que intentaba
-- crear esta misma tabla con el nombre `resource_recommendations` — nombre que ya estaba
-- tomado por la recomendación coach → usuario de Recursos v2. Por esa colisión el
-- registro nunca funcionó: el INSERT mandaba mood_id/mood_label/suggested_* a una tabla
-- que no tiene esas columnas y que además tiene resource_id/coach_id/room_id NOT NULL.
-- El error se tragaba solo (el .then() del insert no maneja error), así que la tarjeta
-- se veía bien y no guardaba nada. Ver también scripts/fix-resource-recommendations-policies.sql.

create table if not exists public.mood_suggestions (
  id                uuid        not null default gen_random_uuid() primary key,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  mood_id           smallint    not null check (mood_id between 1 and 5),
  mood_label        text        not null,
  suggested_first   text        not null,   -- resource_id mostrado primero (slug: 'diario'/'gratitud'/'respiracion')
  suggested_second  text        not null,   -- resource_id mostrado segundo
  chosen            text,                   -- resource_id que tocó el usuario, o NULL
  constraint mood_suggestions_chosen_valid
    check (chosen is null or chosen in (suggested_first, suggested_second))
);

create index if not exists mood_suggestions_user_created_idx
  on public.mood_suggestions (user_id, created_at desc);

alter table public.mood_suggestions enable row level security;

-- 4 policies own-only, mismo patrón que mood_entries.
drop policy if exists mood_suggestions_select_own on public.mood_suggestions;
create policy mood_suggestions_select_own on public.mood_suggestions
  for select using (user_id = auth.uid());

drop policy if exists mood_suggestions_insert_own on public.mood_suggestions;
create policy mood_suggestions_insert_own on public.mood_suggestions
  for insert with check (user_id = auth.uid());

drop policy if exists mood_suggestions_update_own on public.mood_suggestions;
create policy mood_suggestions_update_own on public.mood_suggestions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mood_suggestions_delete_own on public.mood_suggestions;
create policy mood_suggestions_delete_own on public.mood_suggestions
  for delete using (user_id = auth.uid());
