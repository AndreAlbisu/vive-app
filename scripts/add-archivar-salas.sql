-- Archivar conversaciones a voluntad (lado coach)
-- ---------------------------------------------------------------------------
-- Hasta ahora el archivado era **solo automático**: una sala caía en
-- "Archivados" si su último mensaje era del sistema y tenía más de 30 días. Es
-- una regla razonable para conversaciones muertas, pero el coach no tenía forma
-- de decidir por su cuenta — ni de archivar algo vivo que ya no quiere ver, ni
-- de rescatar algo que la regla se llevó.
--
-- 🔴 La columna es de TRES estados a propósito, y por eso es `boolean` NULLABLE
-- y no `not null default false`:
--
--     true   → el coach lo archivó
--     false  → el coach lo sacó de archivados, y ahí se queda aunque la regla
--              automática diga lo contrario
--     null   → nunca opinó: manda la regla automática
--
-- Con `not null default false` el tercer estado no existe, y entonces la regla
-- automática **dejaría de funcionar el día uno** para todas las salas: todas
-- nacerían diciendo "el coach quiere verla activa".
--
-- ⚠️ Es del lado del COACH, no de la sala. Si el coach archiva, el usuario sigue
-- viendo su conversación normal — son dos bandejas distintas sobre la misma
-- fila. El día que el usuario quiera lo mismo, la columna se llama
-- `user_archived` y esta lógica no se toca.

alter table public.salas
  add column if not exists coach_archived boolean;

comment on column public.salas.coach_archived is
  'Archivado de la bandeja del COACH. true = archivado por él, false = sacado de archivados por él (gana sobre la regla automática), null = manda la regla automática (último mensaje del sistema con más de 30 días). No afecta lo que ve el usuario.';


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) La columna existe y es nullable (los tres estados):
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_name = 'salas' and column_name = 'coach_archived';
--   -- esperado: boolean / YES / null
--
-- 2) 🔴 El coach puede escribirla. `salas` no tiene grants por columna
--    (no aparece en lock-privileged-columns.sql), así que debería alcanzar con
--    la policy que ya deja escribir `coach_last_read_at` — pero conviene
--    confirmarlo y no asumirlo. Suplantando a un coach, dentro de UNA
--    transacción, y mirando que afecte 1 fila:
--
-- begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', (
--       select c.profile_id from public.coaches c
--         join public.profiles p on p.id = c.profile_id
--        where p.name = 'Coach Prueba' limit 1))::text, true);
--
--   with tocada as (
--     update public.salas set coach_archived = true
--      where coach_id = (select c.profile_id from public.coaches c
--                          join public.profiles p on p.id = c.profile_id
--                         where p.name = 'Coach Prueba' limit 1)
--      returning id)
--   select count(*) as filas_actualizadas from tocada;   -- esperado: > 0
-- rollback;
