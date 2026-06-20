# SCHEMA.md — Esquema real de base de datos (Supabase)

> ⚠️ Este archivo describe lo que está REALMENTE en Supabase hoy.
> No es un diseño aspiracional — si algo cambia en la base, este archivo se actualiza el mismo día.
> Última actualización: 20 de junio 2026 — confirmado por Andre con information_schema

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
- `application_video_url` (text, nullable) — link al video de presentación que el coach pega al postularse (YouTube, Drive, etc.)

### `salas`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`)
- `coach_id` (uuid, FK → `profiles.id`) — es `coaches.profile_id`, NO `coaches.id`
- `room_url` (text) — generado automáticamente por trigger al insertar: `https://meet.jit.si/vita-<16hex>`
- `created_at`

### `messages`
- `id` (uuid, PK)
- `sala_id` (uuid, FK → `salas.id`)
- `sender_id` (uuid, FK → `profiles.id`)
- `content` (text) — encriptado con XOR+base64 antes de guardar (ver `lib/encryption.ts`)
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
- `created_at`

### `analytics_events`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`, nullable)
- `event_name` (text), `properties` (jsonb), `created_at`

### `journal_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `mood` (text), `created_at`

### `gratitude_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `created_at`

### `saved_resources`
- Existe en la base, columnas exactas pendientes de verificar

## Reglas críticas

1. **`coaches.id` ≠ `profiles.id`** — son valores distintos. El dato que conecta es `coaches.profile_id`.
2. **`salas.coach_id` → `profiles.id`** (= `coaches.profile_id`). **`bookings.coach_id` → `coaches.id`**. Son FKs distintas — mismo nombre de columna, tablas distintas. No asumir que se puede usar el mismo valor para ambas.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **`room_url` vive en `salas`**, generado por trigger al hacer INSERT. Leerlo siempre desde la sala, no desde `bookings` (la columna en `bookings` es redundante).
5. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY. Confirmado contra `information_schema` el 20/06/2026.
6. **Cualquier cambio estructural se revisa y corre entre Andre y Joaquín** — hay datos reales de testing en `salas`, `messages` y `bookings`.
7. **RLS en `coaches`**: existe la política `coaches_insert_own` (FOR INSERT, WITH CHECK `profile_id = auth.uid()`) — permite que un usuario autenticado cree su propia fila de coach al postularse. Sin políticas de INSERT, la tabla bloqueaba todo insert por RLS activado sin excepciones.