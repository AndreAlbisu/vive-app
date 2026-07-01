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
- `avatar_url` (text, nullable) — columna vieja, sin uso hasta el 01/07/2026. Ahora es la foto de perfil real de cualquier `profiles` (coach o usuario), subida como archivo a Supabase Storage (bucket `avatars`, path `{auth.uid()}/avatar.jpg`, upsert siempre true). Coaches suben desde `CoachProfileScreen.tsx`, usuarios desde `EditProfileScreen.tsx` (mismo patrón). Se muestra en: `ProfesionalScreen.tsx` y `app/search3.tsx` (coach visto por un usuario), `ProfileOwnScreen.tsx` y el avatar del top bar en `app/(tabs)/index.tsx` (perfil propio), y donde cualquiera de los dos roles ve a la otra parte — `SalaScreen.tsx` (chat, ambos avatares), `CoachReservasScreen.tsx` (usuario que reservó), `CoachChatsScreen.tsx` y `SessionsScreen.tsx` (listas de chat). Todos con fallback a iniciales/ícono genérico si `avatar_url` es null. Requiere `scripts/add-avatar-upload.sql` (bucket + RLS de storage + política de UPDATE en `profiles`), **pendiente de correr en Supabase** en cualquier ambiente que no lo haya corrido todavía.

### `coaches`
- `id` (uuid, PK) ⚠️ — **NO es lo mismo que `profiles.id`**
- `profile_id` (uuid, FK → `profiles.id`) — el dato que conecta con el resto del sistema
- `specialty`, `bio`, `price_per_session`, `nationality`, `verified`, `created_at`
- `application_video_url` (text, nullable) — link al video de presentación que el coach pega al postularse (YouTube, Drive, etc.). Artefacto de revisión de la postulación, no se muestra a usuarios.
- `video_url` (text, nullable) — URL pública del video de perfil real, subido como archivo desde `CoachProfileScreen.tsx` a Supabase Storage (bucket `coach-videos`). Visible para cualquier usuario en `ProfesionalScreen.tsx`. Distinta de `application_video_url` a propósito: un reproductor nativo (`expo-video`) necesita una URL de archivo directa, no un link de YouTube/Drive. Agregada el 30/06/2026 (`scripts/add-coach-video-upload.sql`).
- `instant_booking` (boolean, NOT NULL DEFAULT false) — modalidad de reserva del coach, editable desde el switch "Modalidad de reserva" en `CoachProfileScreen.tsx`. Si es `true`, las reservas nuevas de ese coach nacen con `bookings.status = 'confirmada'` directo (sin pasar por `'pendiente'` ni por aceptación manual). Agregada el 01/07/2026 (`scripts/add-coach-instant-booking.sql`, pendiente de correr en Supabase).

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

**Diseño:** el schema/trigger/RLS son genéricos y soportan bidireccionalidad por simetría técnica (`reviewer_id`/`reviewed_id` son ambos `profiles.id`, sin ninguna columna ni constraint que distinga dirección), pero **el producto es unidireccional a propósito: usuario reviewea coach, nunca al revés** (decisión de producto, 01/07/2026 — ver Notion "Decisiones estratégicas", sección "Reviews: unidireccionales"). Un coach no reviewea usuarios ni siquiera en formato liviano/interno — VIVE no es un marketplace bidireccional tipo Airbnb/Uber, y no existe ningún mecanismo downstream que use una calificación de usuario. El único INSERT a `reviews` en todo el código es `ReviewScreen.tsx` (usuario → coach); `ReviewScreen.tsx` además redirige a cualquier coach que llegue ahí (por notificación vieja o mal generada) a `/(coach)/reservas` en vez de mostrar el formulario. `reviewed_id` apunta siempre a `profiles.id` — para coaches: es `coaches.profile_id`, NO `coaches.id`. Una review por par: el UNIQUE sobre `(reviewer_id, reviewed_id)` permite editar pero no crear una segunda. `updated_at` deja rastro de ediciones — un coach no puede pedirle a un usuario que *borre* una review negativa (imposible por RLS), solo que la edite, lo cual queda registrado.

### `analytics_events`
- `id` (uuid, PK)
- `user_id` (uuid, FK → `auth.users.id`, nullable)
- `event_name` (text), `properties` (jsonb), `created_at`

### `notifications`
- `id` (uuid, PK)
- `recipient_id` (uuid, FK → `profiles.id`)
- `type` (text) — CHECK constraint activo. Valores válidos: `'reserva_nueva'` | `'reserva_confirmada'` | `'reserva_rechazada'` | `'reserva_cancelada'` | `'recordatorio_sesion'` | `'invitacion_review'`. `'invitacion_review'` se inserta automáticamente por `complete_confirmed_sessions()` cuando un booking pasa a `'completada'` — **solo para `bookings.user_id`, nunca para el coach** (reviews son unidireccionales, ver punto 15). Ver punto 10 para el hallazgo de que esta función no existió realmente hasta el 01/07/2026 pese a estar documentada como corrida desde el 23/06.
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

### `favorite_coaches`
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, FK → `auth.users.id` ON DELETE CASCADE)
- `coach_profile_id` (uuid, NOT NULL, FK → `profiles.id` ON DELETE CASCADE) ⚠️ — mismo criterio que `salas.coach_id`: es `profiles.id` (= `coaches.profile_id`), **NO** `coaches.id`
- `created_at` (timestamptz, NOT NULL DEFAULT now())
- UNIQUE(`user_id`, `coach_profile_id`) — no se puede favoritear el mismo coach dos veces
- RLS: SELECT/INSERT/DELETE solo si `user_id = auth.uid()`. Sin política de UPDATE (no hay nada que actualizar, solo agregar/quitar filas)
- Agregada 01/07/2026 (`scripts/add-favorite-coaches.sql`) — reemplaza dos `useState` locales y desconectados entre sí (`conexiones.tsx` y `ProfesionalScreen.tsx`) que no persistían nada. Estado unificado vía `hooks/useFavoriteCoaches.ts`, usado en ambas pantallas y en la nueva `screens/FavoritosScreen.tsx` (`/favoritos`, accesible desde el ícono de estrella en el header de Conexiones).

## Reglas críticas

1. **`coaches.id` ≠ `profiles.id`** — son valores distintos. El dato que conecta es `coaches.profile_id`.
2. **`salas.coach_id` → `profiles.id`** (= `coaches.profile_id`). **`bookings.coach_id` → `coaches.id`**. Son FKs distintas — mismo nombre de columna, tablas distintas. No asumir que se puede usar el mismo valor para ambas.
3. **`messages.content` está encriptado** — nunca guardar texto plano en esa columna.
4. **`room_url` vive en `salas`**, generado por trigger al hacer INSERT. Leerlo siempre desde la sala, no desde `bookings` (la columna en `bookings` es redundante).
5. **Scripts SQL en `/scripts` pueden no estar corridos** — este archivo es la verdad sobre qué existe HOY. Confirmado contra `information_schema` el 20/06/2026.
6. **Cualquier cambio estructural se revisa y corre entre Andre y Joaquín** — hay datos reales de testing en `salas`, `messages` y `bookings`.
7. **RLS en `coaches`**: existe la política `coaches_insert_own` (FOR INSERT, WITH CHECK `profile_id = auth.uid()`) — permite que un usuario autenticado cree su propia fila de coach al postularse. Sin políticas de INSERT, la tabla bloqueaba todo insert por RLS activado sin excepciones. Hasta el 30/06/2026 NO existía política de UPDATE — cualquier `update()` a `coaches` desde el cliente (precio, video, bio, etc.) afectaba 0 filas en silencio, sin que Postgrest devolviera error (solo se nota si se encadena `.select()` y se chequea que `data` no esté vacío). Fix: `scripts/add-coaches-update-policy.sql` agrega `coaches_update_own` (FOR UPDATE, USING + WITH CHECK `profile_id = auth.uid()`).
8. **Cancelación automática de horarios conflictivos**: cuando un coach acepta una reserva, todas las demás reservas 'pendiente' para el mismo `coach_id` + `scheduled_date` + `scheduled_time` se cancelan automáticamente (`status='cancelada'`), con notificación al usuario afectado. Esta lógica vive en `CoachReservasScreen.tsx`, función `accept()`.
9. **Sistema de disponibilidad real**: `coach_availability` almacena slots puntuales por coach+fecha. La gestión (agregar/eliminar slots) vive en `CoachAvailabilityScreen`, la lectura en `BookingScreen_Calendar` y `BookingScreen_Time`. Un slot deja de estar disponible en dos casos distintos (agregado 01/07/2026): (a) para **cualquier usuario**, si ya tiene una reserva `'confirmada'` de otro; (b) para **ese mismo usuario únicamente**, si él ya tiene una reserva `'pendiente'` ahí — evita que un usuario mande dos solicitudes al mismo horario, sin bloquear que usuarios distintos compitan por el mismo slot 'pendiente' (ver punto 8, que resuelve esa competencia cuando el coach acepta). `BookingScreen_Calendar` también excluye horarios de hoy ya pasados (comparación contra la hora local del dispositivo, sin manejo de zona horaria explícito).
10. **`bookings.status = 'completada'` es automático, nunca manual.** La función `complete_confirmed_sessions()` (pg_cron, cada 5 minutos, ver `scripts/complete-confirmed-sessions.sql`) marca como completado cualquier booking `'confirmada'` cuyo `scheduled_date + scheduled_time` haya superado 20 minutos (timezone `America/Argentina/Buenos_Aires`), e inserta una notificación `'invitacion_review'` **solo para el usuario** (nunca para el coach — reviews son unidireccionales, ver punto 15). Se descartó deliberadamente un botón manual del coach: si pudiera marcar sesiones como completadas, tendría incentivo para omitir las que salieron mal y así evitar la invitación a review. El umbral de 20 minutos es corto a propósito — invitar a reviewear mientras la sesión está fresca.
    - ⚠️ **Hallazgo del 01/07/2026:** esta función se documentó el 23/06/2026 como "✅ completada y verificada en Supabase" junto con el cron job (`complete-sessions`, ya agendado y activo desde esa fecha), pero la función en sí **nunca quedó persistida en la base** — confirmado con `pg_get_functiondef` (no existía), búsqueda por nombre en `pg_proc` (no existía) y búsqueda por contenido `'invitacion_review'` en cualquier función de la base (no existía en ningún lado). Resultado: desde que se agendó el cron, cada corrida fallaba en silencio durante más de una semana — ningún booking se completó automáticamente nunca, y no se generó ninguna invitación a review para nadie. El CHECK constraint de `notifications.type` sí incluía `'invitacion_review'` (esa parte del 23/06 sí corrió). Corregido el 01/07/2026 corriendo `scripts/complete-confirmed-sessions.sql` — mismo patrón de incidente que el del 19/06 (documentado en Notion), vale la pena, ante cualquier función/trigger "documentado como corrido", confirmarlo con una query directa a `pg_proc`/`pg_get_functiondef` antes de asumir que existe.
11. **Solicitudes pendientes vencen automáticamente a las 24hs.** La función `expire_pending_bookings()` (pg_cron, cada 5 minutos — ver `scripts/expire-pending-bookings.sql`, corrida en Supabase el 30/06/2026) pasa a `status='cancelada'` cualquier booking `'pendiente'` cuyo `created_at` supere 24hs, e inserta una notificación `'reserva_rechazada'` para el usuario. Antes de esto, `CoachReservasScreen.tsx` calculaba el countdown "Xhs para responder" solo en el cliente y nunca actualizaba la base — la tarjeta de pendiente quedaba viva para siempre, clampeada en "0hs". No manda mensaje a la sala ni push notification (mismo alcance que el rechazo manual del coach, que tampoco manda mensaje a sala).
12. **Bucket de Storage `coach-videos`** (público, 50MB, solo mime types de video — ver `scripts/add-coach-video-upload.sql`, corrido en Supabase el 30/06/2026). Path convención: `{auth.uid()}/video.mp4` (carpeta por usuario, filename fijo, siempre `upsert:true` para no dejar huérfanos al re-subir). RLS: SELECT público para cualquiera; INSERT/UPDATE/DELETE solo si `(storage.foldername(name))[1] = auth.uid()::text` — como `auth.uid() = profiles.id = coaches.profile_id`, un coach solo puede escribir su propia carpeta, sin necesidad de join a `coaches`. Es el primer uso de Supabase Storage en el proyecto.
13. **Modalidad de reserva instantánea (`coaches.instant_booking`)**: si está en `true`, `BookingScreen_Confirm.tsx` inserta el booking directo con `status='confirmada'` y replica ahí mismo los efectos que normalmente dispara `CoachReservasScreen.tsx → accept()` (notificación `reserva_confirmada` al usuario, mensaje `system_confirmed` en la sala, y cancelación automática + notificación `reserva_cancelada` de otras reservas `'pendiente'` que compitan por el mismo coach+fecha+horario). Es lógica duplicada a propósito — no se extrajo a un helper compartido para no tocar `accept()`, que ya tiene datos reales de testing (ver punto 6). Columna agregada vía `scripts/add-coach-instant-booking.sql`, **pendiente de correr en Supabase** — hasta entonces, cualquier `.select('instant_booking')` fallará o el switch en `CoachProfileScreen.tsx` guardará en 0 filas (mismo síntoma silencioso del punto 7).
14. **Bucket de Storage `avatars`** (público, 5MB, solo mime types de imagen — ver `scripts/add-avatar-upload.sql`, **pendiente de correr en Supabase**). Mismo patrón que `coach-videos` (punto 12), pero apuntando a `profiles.avatar_url` en vez de `coaches.video_url` — sirve para cualquier rol, coach o usuario, mismo bucket y misma política. Este script también crea `profiles_update_own` (FOR UPDATE, `id = auth.uid()`) **solo si no existe ya una política de UPDATE en `profiles`** — no había ninguna documentada, así que es la primera vez que se confirma explícitamente. Desde el 01/07/2026 la foto real reemplaza el ícono/iniciales genérico en todas las pantallas que muestran un perfil (ver detalle en la entrada de `profiles.avatar_url` más arriba) — no queda ningún placeholder sin actualizar salvo que el usuario/coach nunca haya subido foto (fallback intacto en todos lados).
15. **Reviews son unidireccionales (usuario → coach) por decisión de producto, no por limitación técnica** (01/07/2026 — ver Notion "Decisiones estratégicas", sección "Reviews: unidireccionales", y punto 10 más arriba para el hallazgo de `complete_confirmed_sessions()`). El schema/trigger/RLS de `reviews` son genéricos y soportarían la dirección coach→usuario sin cambios, pero nunca se construyó esa UI, y ahora está bloqueada explícitamente: `ReviewScreen.tsx` chequea `role` de `useAuth()` al montar y redirige cualquier coach a `/(coach)/reservas` en vez de mostrar el formulario — protección contra cualquier notificación `invitacion_review` vieja, mal generada, o alcanzada por una vía no prevista (ej. tap de push, deep link futuro), no solo contra el flujo normal. Antes de este fix, `app/_layout.tsx` (listener global de tap-en-push) y `ReviewScreen.tsx` no chequeaban rol — un coach que llegara a esa pantalla habría insertado una review con `reviewer_id = reviewed_id` (se reviewea a sí mismo), sin que la constraint UNIQUE ni las RLS lo impidieran. En la práctica nunca se disparó porque el mecanismo que generaba la notificación (`complete_confirmed_sessions()`) tampoco existía — ver punto 10.
16. **El chat de la Sala está congelado mientras la reserva esté `'pendiente'`** — decisión de producto ya documentada en Notion ("Mensaje previo a la aceptación del coach": *"Es unidireccional — no hay chat antes de aceptar, lo que evita que coach y usuario intercambien contactos y se salgan de VIVE"*), implementada recién el 01/07/2026 (antes, `SalaScreen.tsx` permitía escribir y mandar mensajes libremente sin importar el estado de la reserva). `SalaScreen.tsx` deriva `isChatFrozen = confirmedBooking?.status === 'pendiente'`: mientras es `true`, el input y botón de enviar se reemplazan por un aviso (`"El chat se habilita cuando el coach acepte tu solicitud"` del lado usuario, `"Aceptá o rechazá la solicitud desde Reservas..."` del lado coach), y `sendMessage()` también corta temprano como defensa en profundidad (RLS de `messages` no valida esto — es un chequeo de UI/cliente, no de base). El único canal antes de la aceptación sigue siendo el mensaje unidireccional opcional de `bookings.user_message`, mostrado en `CoachReservasScreen.tsx`. La comunicación se destranca sola apenas el booking pasa a `'confirmada'` o `'cancelada'` (deja de haber un booking `'pendiente'` activo).