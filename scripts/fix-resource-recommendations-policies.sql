-- fix-resource-recommendations-policies.sql
--
-- Saca 4 policies que quedaron colgadas de `resource_recommendations` (la tabla
-- de Recursos v2: recomendación coach → usuario por chat).
--
-- Cómo llegaron: `scripts/create-resource-recommendations.sql` (04/08/2026) creaba
-- una tabla DISTINTA con el mismo nombre para registrar la tarjeta "Para vos ahora".
-- Su `CREATE TABLE IF NOT EXISTS` no hizo nada porque la tabla ya existía, pero los
-- `CREATE POLICY` de abajo sí se aplicaron —sobre la tabla equivocada—. Verificado
-- en prod el 06/08/2026: la tabla tiene el schema de v2 y 7 policies.
--
-- Qué rompían:
--   _delete_own → v2 NO tenía policy de DELETE a propósito; con esta, el usuario
--                 puede borrar las recomendaciones que le mandó su coach.
--   _insert_own → el INSERT era exclusivo del coach; con esta, un usuario puede
--                 fabricar filas poniéndose como user_id y cualquier coach_id.
--   _select_own / _update_own → redundantes con las originales, inofensivas, pero
--                 se van también para no dejar policies duplicadas.
--
-- Las 3 originales de v2 (_select, _insert, _update) NO se tocan.
-- La tabla de la tarjeta de mood ahora vive en `mood_suggestions`
-- (ver scripts/create-mood-suggestions.sql).

drop policy if exists resource_recommendations_delete_own on public.resource_recommendations;
drop policy if exists resource_recommendations_insert_own on public.resource_recommendations;
drop policy if exists resource_recommendations_select_own on public.resource_recommendations;
drop policy if exists resource_recommendations_update_own on public.resource_recommendations;

-- Verificación: deben quedar exactamente 3 (_select, _insert, _update).
-- select polname, polcmd from pg_policy
-- where polrelid = 'public.resource_recommendations'::regclass order by polname;
