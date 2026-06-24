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
- `coach_id` (uuid, FK → `coaches.id`) — a diferencia de salas, acá es el PK de coaches
- `sala_id` (uuid, FK → `salas.id`)
- `coach_name` (text)
- `scheduled_date` (date)
- `scheduled_time` (text)
- `amount` (integer)
- `status` (text)
- `room_url` (text, nullable) — redundante, el room_url canónico está en `salas`
- ⚠️ NO tiene: `date`, `time`, `user_message` (eran el schema que Andre describió pero no está corrido)

### `analytics_events`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`, nullable)
- `event_name` (text), `properties` (jsonb), `created_at`

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
2. **`salas.coach_id` → `profiles.id`** (= `coaches.profile_id`). **`bookings.coach_id` → `coaches.id`**. Son FKs distintas.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **`room_url` vive en `salas`**, generado por trigger al hacer INSERT. Leerlo siempre desde la sala, no desde bookings.
5. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY.
6. **Cualquier cambio estructural se revisa y corre con Andre** — hay datos reales de testing en salas, messages y bookings.
