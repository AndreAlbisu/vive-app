# SCHEMA.md — Esquema real de base de datos (Supabase)

> ⚠️ Este archivo describe lo que está REALMENTE corrido en Supabase hoy.
> No es un diseño aspiracional ni un plan — si algo cambia en la base, este archivo se actualiza el mismo día.
> Última actualización: 19 de junio 2026

## Tablas y relaciones

### `profiles`
- `id` (uuid, PK) — coincide con `auth.users.id`
- Usuarios y coaches viven en la misma tabla, diferenciados por `role`

### `coaches`
- `id` (uuid, PK)
- `profile_id` (uuid, FK → `profiles.id`) ⚠️ — NO es lo mismo que `coaches.id`
- `specialty` (text)
- `bio` (text)
- `price_per_session` (numeric)
- `nationality` (text)
- `verified` (boolean)
- `created_at` (timestamptz)

### `salas`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `profiles.id`)
- `coach_id` (uuid, FK → `profiles.id`) ⚠️ — apunta a `profiles.id`, NO a `coaches.id`
- `created_at` (timestamptz)
- Una sala por par usuario-coach (buscar antes de crear, no duplicar)

### `bookings`
- Columnas reales: `user_id`, `coach_id`, `sala_id`, `date`, `time`, `status`, `user_message` (opcional)
- `sala_id` (uuid, FK → `salas.id`)
- ⚠️ NO tiene: `room_url`, `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount` — esas columnas existen solo en un script SQL que nunca se corrió (`scripts/supabase-bookings-setup.sql`, propuesta de Joaquín, NO aplicada)

### `messages`
- `id` (uuid, PK)
- `sala_id` (uuid, FK → `salas.id`)
- `sender_id` (uuid, FK → `profiles.id`)
- `content` (text) — encriptado con XOR+base64 antes de guardar (ver `lib/encryption.ts`)
- `created_at` (timestamptz)

### `saved_resources`, `journal_entries`, `gratitude_entries`
- (completar cuando se confirme su esquema exacto — no verificado todavía)

## Reglas importantes para no repetir bugs

1. **`coaches.id` ≠ `profiles.id`** — siempre usar `profiles.id` (a veces llamado `profileId` en el código) cuando se referencia un coach desde `salas` o `bookings`.
2. **Antes de escribir un nuevo script SQL**, confirmar con el otro si ya hay datos reales en las tablas que tocaría — no correr scripts destructivos sin avisar.
3. **Scripts SQL en `/scripts`** pueden no estar corridos — este archivo es la verdad sobre qué existe HOY en la base real, los scripts son historial/propuestas.

## Pendiente de implementar (no confundir con lo ya existente)
- `room_url` en `salas` (no en `bookings`) — trigger de Jitsi Meet, propuesto, no aplicado aún. Ver detalle en Notion → Decisiones estratégicas.
