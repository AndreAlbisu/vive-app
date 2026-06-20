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

### `salas`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`)
- `coach_id` (uuid, FK → `profiles.id`) — es `coaches.profile_id`, NO `coaches.id`
- `created_at`
- ⏳ `room_url` — pendiente: se agrega con `scripts/add-salas-room-url.sql` (revisar con Andre antes de correr)

### `messages`
- `id` (uuid, PK)
- `sala_id` (uuid, FK → `salas.id`)
- `sender_id` (uuid, FK → `profiles.id`)
- `content` (text) — encriptado con XOR+base64 antes de guardar (ver `lib/encryption.ts`)
- `created_at`

### `bookings`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`)
- `coach_id` (uuid) — debe ser `coaches.profile_id` (= `profiles.id` del coach)
- `sala_id` (uuid, FK → `salas.id`)
- `date` (date)
- `time` (text)
- `status` (text)
- `user_message` (text, nullable)
- ⚠️ NO tiene: `room_url`, `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount`

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
2. **`salas.coach_id` y `bookings.coach_id` usan `profiles.id`**, no `coaches.id`. Siempre usar `coaches.profile_id`.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **`room_url` no existe en ninguna tabla todavía** — está pendiente de `scripts/add-salas-room-url.sql` con Andre.
5. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY.
6. **Cualquier cambio estructural se revisa y corre con Andre** — hay datos reales de testing en salas, messages y bookings.
