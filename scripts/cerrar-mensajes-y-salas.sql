-- cerrar-mensajes-y-salas.sql
--
-- Dos agujeros más de la tanda 2, los dos probados contra producción con rollback.
--
-- ── 1. Se podía escribir en la conversación de dos desconocidos ──────────────
--
-- 🔴 La policy de INSERT de `messages` pedía **solo** `auth.uid() = sender_id`.
--    Nada miraba la sala. O sea que cualquiera con una cuenta podía insertar un
--    mensaje **en el chat entre un paciente y su psicólogo**, firmado con su
--    propio id. En una app de salud mental eso es lo más parecido a entrar a un
--    consultorio ajeno. Probado: el insert entró.
--
-- Ahora hay que ser parte de esa sala.
--
-- ⚠️ **Lo que esto NO cierra**: `sender_type` sigue siendo escribible, así que
--    un participante puede mandarse un mensaje disfrazado de sistema
--    ("Sesión cancelada"). Restringirlo rompe los avisos de sistema que hoy
--    escribe la app al cancelar y al confirmar. Sale cuando esos inserts se
--    muevan al servidor, junto con los de `notifications`.
--
-- ── 2. Se podía mudar la conversación a otro profesional ─────────────────────
--
-- 🔴 `salas` tenía `user_id`, `coach_id`, `room_url`, `id` y `created_at` entre
--    lo que el cliente puede escribir por UPDATE, y la policy no tiene WITH
--    CHECK propio. Con `user_id` quedándose en uno mismo, el `USING` seguía
--    pasando: alcanzaba para **cambiarle el `coach_id` a la sala** y meterle la
--    conversación a un profesional que nunca habló con esa persona.
--
-- La app solo actualiza `coach_archived` y las dos marcas de lectura. Se le deja
-- eso y nada más. El INSERT no se toca: crear la sala sí es del cliente y la
-- policy ya exige `user_id = auth.uid()`.

drop policy if exists "Users can send messages" on public.messages;

create policy messages_insert_participantes on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.salas s
      where s.id = messages.sala_id
        and (s.user_id = auth.uid() or s.coach_id = auth.uid())
    )
  );

-- Mismo criterio que con las credenciales: revocar el permiso de TABLA y volver
-- a darlo por columna. Revocar por columna sobre un grant de tabla no hace nada.
revoke update on public.salas from authenticated, anon;
grant update (coach_archived, user_last_read_at, coach_last_read_at)
  on public.salas to authenticated;
