-- add-chat-indexes.sql
--
-- Tres índices para abrir un chat. Ningún dato cambia.
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- 🔴 `messages` no tenía NINGÚN índice salvo su clave primaria. La consulta que
--    dibuja un chat es `where sala_id = … order by created_at`, así que la base
--    recorría **todos los mensajes de toda la plataforma** y después ordenaba.
--
-- 🔴 Y se multiplicaba por la RLS. La policy de SELECT de `messages` pregunta
--    `sala_id in (select id from salas where user_id = auth.uid() or coach_id =
--    auth.uid())`, y **`salas` tampoco tenía índices** más que su PK: un
--    recorrido completo adentro de otro recorrido completo, en cada apertura.
--
-- 📌 Hoy no se nota (≈154 mensajes, ≈53 salas el 21/09/2026) y el retraso que se
--    percibe al entrar a un chat es otra cosa: seis consultas de red antes de
--    dibujar. Esto no es por lo que duele hoy, es para que no duela nunca. El
--    costo de ponerlo ahora es cero; el de ponerlo tarde es una migración sobre
--    una tabla con conversaciones de gente real adentro.
--
-- ⚠️ Los dos de `salas` van por separado y no en uno compuesto a propósito: la
--    policy pregunta por `user_id` OR `coach_id`, no por los dos juntos, y un
--    índice compuesto solo serviría para el primero de los dos.
--
-- Idempotente (`if not exists`): volver a correrlo no hace nada.

create index if not exists messages_sala_created_idx
  on public.messages (sala_id, created_at);

create index if not exists salas_user_idx
  on public.salas (user_id);

create index if not exists salas_coach_idx
  on public.salas (coach_id);
