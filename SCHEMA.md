# SCHEMA.md — Esquema real de base de datos (Supabase)

> ⚠️ Este archivo describe lo que está REALMENTE en Supabase hoy.
> No es un diseño aspiracional — si algo cambia en la base, este archivo se actualiza el mismo día.
> Última actualización: 24 de junio 2026 — saved_resources confirmado por Andre con information_schema

## Tablas y relaciones

### `profiles`
- `id` (uuid, PK) — coincide con `auth.users.id`
- `email`, `name`, `role` (coach | user), `avatar_url`, `birth_date`, `gender`, `nationality`
- `accepted_terms` (bool), `push_token`, `created_at`
- Usuarios y coaches viven en la misma tabla, diferenciados por `role`

### `coaches`
- `id` (uuid, PK) ⚠️ — **NO es lo mismo que `profiles.id`**
- `profile_id` (uuid, FK → `profiles.id`) — el dato que conecta con el resto del sistema
- `specialty`, `bio`, `price_per_session`, `nationality`, `verified`, `created_at`
- `application_video_url` (text, nullable) — link al video de presentación que el coach pega al postularse (YouTube, Drive, etc.). Artefacto de revisión de la postulación, no se muestra a usuarios.
- `video_url` (text, nullable) — URL pública del video de perfil real, subido como archivo desde `CoachProfileScreen.tsx` a Supabase Storage (bucket `coach-videos`). Visible para cualquier usuario en `ProfesionalScreen.tsx`. Distinta de `application_video_url` a propósito: un reproductor nativo (`expo-video`) necesita una URL de archivo directa, no un link de YouTube/Drive. Agregada el 30/06/2026 (`scripts/add-coach-video-upload.sql`).

### `salas`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`)
- `coach_id` (uuid, FK → `profiles.id`) — es `coaches.profile_id`, NO `coaches.id`
- `room_url` (text) — generado automáticamente por trigger al insertar: `https://meet.jit.si/vita-<16hex>`
- `user_last_read_at` (timestamptz, nullable) — timestamp de la última vez que el usuario abrió la sala. NULL = nunca abrió. Se actualiza en `SalaScreen.init()` al entrar. Usado para el dot de "novedad" en el tab "Mis salas".
- `coach_last_read_at` (timestamptz, nullable) — ídem para el coach. Mismo mecanismo, actualizado cuando el coach entra a la sala desde su interfaz.
- `created_at`
- Filas existentes al 25/06/2026: backfill aplicado con `UPDATE salas SET user_last_read_at = now(), coach_last_read_at = now()` — arranque limpio sin dots falsos. Filas nuevas nacen con NULL (correcto: si llega un mensaje antes de la primera apertura, el dot muestra).

### `messages`
- `id` (uuid, PK)
- `sala_id` (uuid, FK → `salas.id`)
- `sender_id` (uuid, FK → `profiles.id`)
- `content` (text) — encriptado con XOR+base64 antes de guardar (ver `lib/encryption.ts`)
- `sender_type` (text, default 'user') — CHECK constraint extendido vía ALTER TABLE (23/06/2026). Valores válidos: 'user' | 'coach' | 'system' | 'system_confirmed' | 'system_cancelled'. `system_confirmed` se inserta al confirmar una reserva (fecha, hora y motivo del usuario en segunda línea). `system_cancelled` se inserta al cancelar desde SalaScreen o CoachReservasScreen, y al cancelar conflictos automáticamente. 'system' es fallback para mensajes anteriores al 22/06/2026 (render gris cursiva, sin pill). `sender_id` es NOT NULL incluso en mensajes de sistema — queda el id de quien disparó la acción. El render (pill o texto plano) lo determina `sender_type`, no el contenido.
- `created_at`

### `bookings`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`)
- `coach_id` (uuid, FK → `coaches.id`) ⚠️ — a diferencia de `salas.coach_id`, acá es el PK de `coaches`
- `sala_id` (uuid, FK → `salas.id`)
- `coach_name` (text)
- `coach_specialty` (text)
- `scheduled_date` (date)
- `scheduled_time` (text)
- `amount` (integer)
- `status` (text)
- `room_url` (text, nullable) — redundante, el room_url canónico está en `salas`
- `user_message` (text, nullable) — mensaje opcional que el usuario le escribe al coach antes de reservar
- `cancelled_by` (text, nullable) — quién canceló: `'usuario'` | `'coach'`. Null si no se canceló.
- `cancelled_late` (boolean, nullable) — `true` si el coach canceló con <24hs de anticipación; `false` si ≥24hs; `null` si canceló el usuario (no aplica) o si no se canceló.
- RLS para usuario: policy `users_cancel_own_booking` — permite UPDATE solo si `user_id = auth.uid()` y solo hacia `status='cancelada'`. Los coaches actualizan vía `coaches_can_update_own_bookings` (política preexistente).
- `created_at`

### `coach_availability`
- `id` (uuid, PK)
- `coach_id` (uuid, FK → `coaches.id`) ⚠️ — usa el PK de `coaches`, no `profile_id`
- `date` (date) — fecha puntual para la que el coach habilita horarios
- `time` (text) — horario en formato "9:00", "10:00", etc.
- `blocked` (boolean, NOT NULL DEFAULT false) — si es `true`, el slot no aparece para usuarios aunque exista; el coach puede reactivarlo desde CoachAvailabilityScreen (ícono de candado naranja).
- `created_at` (timestamptz)
- UNIQUE(coach_id, date, time) — un coach no puede tener el mismo slot dos veces
- RLS: SELECT abierto (anyone_can_view_availability) · ALL solo para el coach dueño (coaches_manage_own_availability, WITH CHECK `coach_id IN (SELECT id FROM coaches WHERE profile_id = auth.uid())`)

### `coach_weekly_pattern`
- `id` (uuid, PK)
- `coach_id` (uuid, FK → `coaches.id`) ⚠️ — mismo FK que `coach_availability`, no `profile_id`
- `day_of_week` (int) — 1=Lunes … 7=Domingo (CHECK BETWEEN 1 AND 7)
- `start_time` (text) — formato "H:MM" (ej: "9:00", "13:30"), igual que `coach_availability.time`
- `end_time` (text) — ídem; el end NO se incluye como slot de inicio en la generación
- `slot_duration_minutes` (int, default 60) — duración de cada turno generado
- `created_at` (timestamptz)
- RLS: SELECT abierto (anyone_can_view_pattern) · ALL solo para el coach dueño (coaches_manage_own_pattern, WITH CHECK `coach_id IN (SELECT id FROM coaches WHERE profile_id = auth.uid())`)
- Generación: `lib/availabilityGenerator.ts → generateWeeklySlots()` pobla `coach_availability` para los próximos 56 días con upsert ignorando duplicados

### `reviews`
- `id` (uuid, PK)
- `booking_id` (uuid, FK → `bookings.id`) — booking que originó la review; queda fijo en la creación aunque la review se edite en sesiones futuras (auditoría)
- `reviewer_id` (uuid, FK → `profiles.id`) — quien escribe la review
- `reviewed_id` (uuid, FK → `profiles.id`) — quien recibe la review
- `rating` (int, NOT NULL) — CHECK BETWEEN 1 AND 5
- `comment` (text, nullable) — comentario público por default
- `is_private` (boolean, NOT NULL DEFAULT false) — si true, solo visible para autor y destinatario
- `created_at` (timestamptz, NOT NULL DEFAULT now())
- `updated_at` (timestamptz, NOT NULL DEFAULT now()) — actualizado automáticamente por trigger
- UNIQUE(`reviewer_id`, `reviewed_id`) — una sola review por par, editable pero NO borrable
- Trigger `reviews_before_update` (BEFORE UPDATE): rechaza cambios en `reviewer_id`, `reviewed_id` y `booking_id` (inmutables); actualiza `updated_at`. Se usó trigger y no RLS porque `WITH CHECK` no tiene acceso a `OLD`.
- RLS: SELECT público para `is_private=false`; privadas solo visibles para autor o destinatario. INSERT solo si `reviewer_id = auth.uid()`. UPDATE solo si `reviewer_id = auth.uid()`. Sin política de DELETE → borrado bloqueado por RLS.

**Diseño:** bidireccional (usuario reviewea coach Y coach reviewea usuario, misma tabla). `reviewed_id` apunta siempre a `profiles.id` — para coaches: es `coaches.profile_id`, NO `coaches.id`. Una review por par: el UNIQUE sobre `(reviewer_id, reviewed_id)` permite editar pero no crear una segunda. `updated_at` deja rastro de ediciones — un coach no puede pedirle a un usuario que *borre* una review negativa (imposible por RLS), solo que la edite, lo cual queda registrado.

### `analytics_events`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`, nullable)
- `event_name` (text), `properties` (jsonb), `created_at`

### `notifications`
- `id` (uuid, PK)
- `recipient_id` (uuid, FK → `profiles.id`)
- `type` (text) — CHECK constraint activo. Valores válidos: `'reserva_nueva'` | `'reserva_confirmada'` | `'reserva_rechazada'` | `'reserva_cancelada'` | `'recordatorio_sesion'` | `'invitacion_review'`. `'invitacion_review'` se inserta automáticamente por `complete_confirmed_sessions()` cuando un booking pasa a `'completada'`.
- `booking_id` (uuid, nullable)
- `title` (text), `body` (text)
- `read` (boolean, DEFAULT false)
- `created_at` (timestamptz)

### `journal_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `mood` (text), `created_at`

### `gratitude_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `created_at`

### `saved_resources`
- `id` (uuid, PK)
- `user_id` (uuid, nullable) — FK implícita a `auth.users.id`
- `resource_id` (text, NOT NULL) — ID del recurso guardado
- `pinned` (bool, nullable) — si el usuario lo fijó
- `created_at` (timestamptz, nullable)

## Reglas críticas

1. **`coaches.id` ≠ `profiles.id`** — son valores distintos. El dato que conecta es `coaches.profile_id`.
2. **`salas.coach_id` → `profiles.id`** (= `coaches.profile_id`). **`bookings.coach_id` → `coaches.id`**. Son FKs distintas — mismo nombre de columna, tablas distintas. No asumir que se puede usar el mismo valor para ambas.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **`room_url` vive en `salas`**, generado por trigger al hacer INSERT. Leerlo siempre desde la sala, no desde `bookings` (la columna en `bookings` es redundante).
5. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY. Confirmado contra `information_schema` el 20/06/2026.
6. **Cualquier cambio estructural se revisa y corre entre Andre y Joaquín** — hay datos reales de testing en `salas`, `messages` y `bookings`.
7. **RLS en `coaches`**: existe la política `coaches_insert_own` (FOR INSERT, WITH CHECK `profile_id = auth.uid()`) — permite que un usuario autenticado cree su propia fila de coach al postularse. Sin políticas de INSERT, la tabla bloqueaba todo insert por RLS activado sin excepciones. Hasta el 30/06/2026 NO existía política de UPDATE — cualquier `update()` a `coaches` desde el cliente (precio, video, bio, etc.) afectaba 0 filas en silencio, sin que Postgrest devolviera error (solo se nota si se encadena `.select()` y se chequea que `data` no esté vacío). Fix: `scripts/add-coaches-update-policy.sql` agrega `coaches_update_own` (FOR UPDATE, USING + WITH CHECK `profile_id = auth.uid()`).
8. **Cancelación automática de horarios conflictivos**: cuando un coach acepta una reserva, todas las demás reservas 'pendiente' para el mismo `coach_id` + `scheduled_date` + `scheduled_time` se cancelan automáticamente (`status='cancelada'`), con notificación al usuario afectado. Esta lógica vive en `CoachReservasScreen.tsx`, función `accept()`.
9. **Sistema de disponibilidad real**: `coach_availability` almacena slots puntuales por coach+fecha. Un día aparece disponible en el calendario si tiene al menos un slot sin reserva confirmada en `bookings` para ese coach+fecha+horario. La gestión (agregar/eliminar slots) vive en `CoachAvailabilityScreen`, la lectura en `BookingScreen_Calendar` y `BookingScreen_Time`.
10. **`bookings.status = 'completada'` es automático, nunca manual.** La función `complete_confirmed_sessions()` (pg_cron, cada 5 minutos) marca como completado cualquier booking `'confirmada'` cuyo `scheduled_date + scheduled_time` haya superado 20 minutos (timezone `America/Argentina/Buenos_Aires`). Se descartó deliberadamente un botón manual del coach: si pudiera marcar sesiones como completadas, tendría incentivo para omitir las que salieron mal y así evitar la invitación a review. El umbral de 20 minutos es corto a propósito — invitar a reviewear mientras la sesión está fresca.
11. **Solicitudes pendientes vencen automáticamente a las 24hs.** La función `expire_pending_bookings()` (pg_cron, cada 5 minutos — ver `scripts/expire-pending-bookings.sql`, corrida en Supabase el 30/06/2026) pasa a `status='cancelada'` cualquier booking `'pendiente'` cuyo `created_at` supere 24hs, e inserta una notificación `'reserva_rechazada'` para el usuario. Antes de esto, `CoachReservasScreen.tsx` calculaba el countdown "Xhs para responder" solo en el cliente y nunca actualizaba la base — la tarjeta de pendiente quedaba viva para siempre, clampeada en "0hs". No manda mensaje a la sala ni push notification (mismo alcance que el rechazo manual del coach, que tampoco manda mensaje a sala).
12. **Bucket de Storage `coach-videos`** (público, 50MB, solo mime types de video — ver `scripts/add-coach-video-upload.sql`, corrido en Supabase el 30/06/2026). Path convención: `{auth.uid()}/video.mp4` (carpeta por usuario, filename fijo, siempre `upsert:true` para no dejar huérfanos al re-subir). RLS: SELECT público para cualquiera; INSERT/UPDATE/DELETE solo si `(storage.foldername(name))[1] = auth.uid()::text` — como `auth.uid() = profiles.id = coaches.profile_id`, un coach solo puede escribir su propia carpeta, sin necesidad de join a `coaches`. Es el primer uso de Supabase Storage en el proyecto.