# SCHEMA.md — Esquema real de base de datos (Supabase)

> ⚠️ Este archivo describe lo que está REALMENTE en Supabase hoy.
> No es un diseño aspiracional — si algo cambia en la base, este archivo se actualiza el mismo día.
> Última actualización: 20 de junio 2026 (sesión 3)

## Tablas y relaciones

### `profiles`
- `id` (uuid, PK) — coincide con `auth.users.id`
- `email`, `name`, `role` (coach | user), `avatar_url`, `birth_date`, `gender`, `nationality`
- `accepted_terms` (bool), `push_token`, `created_at`
- Usuarios y coaches viven en la misma tabla, diferenciados por `role`

### `coaches`
- `id` (uuid, PK)
- `profile_id` (uuid, FK → `profiles.id`) ⚠️ — NO es lo mismo que `coaches.id`
- `specialty`, `bio`, `price_per_session`, `nationality`, `verified`, `created_at`

### `salas`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`) ⚠️ apunta a `profiles.id`, NO a `coaches.id`
- `coach_id` (uuid, FK → `profiles.id`) ⚠️ idem — es el `profile_id` del coach, no su `coaches.id`
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
- `coach_id` (uuid, FK → `coaches.id`, nullable)
- `sala_id` (uuid, FK → `salas.id`, nullable) — vincula el booking a su sala
- `coach_name` (text), `coach_specialty` (text)
- `scheduled_date` (date), `scheduled_time` (text)
- `amount` (integer), `status` (pendiente | confirmada | completada | cancelada)
- `created_at`
- ⚠️ `room_url` vive en `salas`, no en `bookings` — leerlo siempre desde la sala

### `analytics_events`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`, nullable)
- `event_name` (text), `properties` (jsonb), `created_at`

### `journal_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `mood` (text), `created_at`

### `gratitude_entries`
- `id` (uuid, PK), `user_id`, `content` (text), `created_at`

### `saved_resources`
- Existe en la base, columnas exactas no verificadas aún

## Reglas críticas

1. **`coaches.id` ≠ `profiles.id`** — en `salas`, tanto `user_id` como `coach_id` apuntan a `profiles.id`. En `bookings`, `coach_id` apunta a `coaches.id`.
2. **El trigger `trg_booking_room_url`** genera `room_url` automáticamente — no pasarlo en el INSERT.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY.
5. **Antes de scripts destructivos** (DROP, ALTER), confirmar con el otro developer — la base es compartida.
