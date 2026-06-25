# CHANGELOG_SESIONES.md — Registro de sesiones de trabajo

> Antes de tocar código, leé la última entrada de quien no sea vos.
> Al terminar tu sesión, agregá tu propia entrada arriba de todo (orden cronológico inverso).

---

## 2026-06-25 — Joaquín (sesión 10)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachProfileScreen.tsx`, `screens/CoachAvailabilityScreen.tsx`, `screens/CoachWeeklyPatternScreen.tsx`, `screens/CoachNotificationsScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/CoachResourcesScreen.tsx`

**Resumen:**
- Completada la aplicación de estética aurora/glass a TODAS las pantallas del panel coach: 7 archivos editados en 2 grupos (commits e3ccdf43 y d794cc2a), ambos pusheados.
- Patrón uniforme aplicado: `AppBg` wrapper, headers `rgba(255,255,255,0.12)` + border, cards GLASS/GLASS_BORDER, texto blanco/rgba, eliminados todos los `cardShadow` + `Platform.select` de shadows. Modales de sheet con fondo `#1A0A26` y glass interior.
- Pantallas de tabs de usuario (`(tabs)/index.tsx`, `conexiones.tsx`, `recursos.tsx`) ya tenían AppBg aplicado de sesiones anteriores — confirmado sin regresiones.
- SCHEMA.md no se tocó (sin cambios de base de datos en esta sesión).

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (sigue abierto desde sesión 8).
- Push a `andre/main` sigue pendiente.
- Testear visualmente en dispositivo el panel coach completo con el fondo aurora.

---

## 2026-06-25 — Joaquín (sesión 9)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/SalaScreen.tsx`

**Resumen:**
- Auditoría post-merge con `andre/main`: se verificó qué cambios de sesiones anteriores sobrevivieron y cuáles se perdieron.
- Fix crítico: `BookingScreen_Confirm` no pasaba `salaId` a `booking-success`, entonces el botón "Ver mi sala" navegaba a `/sala` con `coach_id` vacío. Ahora Confirm pasa `salaId` y Success lo usa como `sala_id` (lookup directo en SalaScreen, sin vuelta extra a Supabase).
- Recuperado logging (`logError`) en `SalaScreen` y `BookingScreen_Confirm` — se había perdido en el merge. Reemplazó los `console.error`/`console.log` de los puntos de error.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (quedó abierto desde sesión 8).
- Revisar pantallas del panel coach (`(coach)/`) que puedan necesitar glass o estén con estilo plano.
- Push a `andre/main` sigue pendiente (esta sesión pusheó a `Joaquín/main`).

---

## 2026-06-25 — Joaquín (sesión 8)

**Tocado:** `screens/RegisterScreen.tsx`, `screens/SalaScreen.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/conexiones.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/ProfesionalScreen.tsx`

**Resumen:**
- Merge con `andre/main` completado: 15+ archivos con conflictos resueltos. Estrategia: `git checkout --theirs` para screens con cambios de lógica de Andre, luego re-aplicación de estética glass/aurora encima.
- Estética glass aplicada a todas las pantallas pendientes: aurora + AppBg + StatusBar dark, cards `rgba(255,255,255,0.14)` + border, inputs glass, botón CTA blanco + texto oscuro, texto blanco/rgba.
- `AuthContext` + `useAuth()` de Andre integrado en `RegisterScreen` y `LoginScreen` sin cambios de lógica (signUpWithEmail, signInWithGoogle, coach email check, terms modals).
- `conexiones.tsx` de Andre usa fetch real de coaches desde Supabase con `coaches + profiles!inner` — glass aplicado encima preservando toda la lógica.
- `index.tsx` de Andre usa `useAuth()` y fetch de próxima sesión — glass aplicado, cards de sesión/recursos/recomendación con rgba.

**Pendiente para la próxima sesión:**
- Verificar que `screens/BookingScreen_Time.tsx` (nuevo en sesión anterior) tiene los params correctos siendo pasados desde Calendar.
- Revisar si hay pantallas del panel coach (`(coach)/`) que necesiten glass o quedaron con estilo plano.
- Push a `andre/main` — quedó pendiente después del merge.

---

## 2026-06-24 — Joaquín (sesión 7)

**Tocado:** `lib/logging.ts` (nuevo), `package.json`, `screens/BookingScreen_Confirm.tsx`, `screens/DiarioScreen.tsx`, `screens/GratitudScreen.tsx`, `screens/SalaScreen.tsx`, `app/(tabs)/conexiones.tsx`, `screens/ProfesionalScreen.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Success.tsx`, `SCHEMA.md`

**Resumen:**
- Creado `lib/logging.ts` con `logError/logWarn/logInfo/readLog/clearLog` usando `expo-file-system` v19 (API nueva: `File` + `Paths`, no las funciones deprecadas). Wired en `BookingScreen_Confirm`, `DiarioScreen`, `GratitudScreen` y `SalaScreen`.
- Bug `coachId/profileId` resuelto: `conexiones.tsx` ahora fetchea coaches reales de Supabase al montar y pasa `coachId` (coaches.id) y `coachProfileId` (coaches.profile_id) por params a través de todo el chain hasta `BookingScreen_Confirm`. El lookup por specialty queda solo como fallback.
- Post-booking conectado a `/sala`: `BookingScreen_Success` navega a `/sala?sala_id=<uuid>` en vez de abrir `roomUrl` en browser externo. `BookingScreen_Confirm` ahora pasa `salaId` a `booking-success`.
- `saved_resources` verificado con `information_schema` y `SCHEMA.md` actualizado: `id`, `user_id`, `resource_id` (text), `pinned` (bool), `created_at`.
- Selector "Test:" en `SalaScreen` ya no existía en el historial de git — pendiente cerrado.

- Fix adicional: specialties hardcodeadas en `conexiones.tsx` no coincidían con Supabase — corregidas `'Psicólogo'` → `'Psicóloga clínica'` y `'Coach ejecutiva'` → `'Coach de hábitos'`.

**Pendiente para la próxima sesión:**
- `saved_resources` no tiene ninguna pantalla que la use todavía — decidir si se implementa o se descarta.

---

## 2026-06-23 — Claude (10ª entrada)

**Tocado:** `SCHEMA.md` (tabla nueva `reviews`, extensión de `notifications.type`,
regla nueva de auto-completado), SQL corrido en Supabase por Andre (no hay archivos
de código modificados en esta sesión).

**Resumen:**
- Sistema de reviews diseñado y schema corrido en Supabase. Bidireccional (usuario
  reviewea coach y viceversa), misma tabla para ambas direcciones. Una sola review por
  par `(reviewer_id, reviewed_id)`, editable pero no borrable. `reviewer_id` y
  `reviewed_id` apuntan siempre a `profiles.id` (para coaches: es `coaches.profile_id`,
  no `coaches.id`). Campo `is_private` para reviews que solo ve el destinatario.
- Trigger `reviews_before_update`: protege `reviewer_id`, `reviewed_id` y `booking_id`
  como inmutables (no puede reasignarse la review a otra persona) y actualiza
  `updated_at` en cada edición. Se usó trigger y no RLS porque `WITH CHECK` no tiene
  acceso a `OLD` para comparar valores anteriores.
- Mecanismo de auto-completado de sesiones: función `complete_confirmed_sessions()`
  + cron job pg_cron cada 5 minutos. Cualquier booking en `status='confirmada'` con
  `scheduled_date + scheduled_time + 20 minutos` ya pasado (en timezone
  `America/Argentina/Buenos_Aires`) se actualiza automáticamente a `'completada'` y
  genera notificaciones `'invitacion_review'` para ambas partes.
- Se descartó explícitamente la opción de botón manual del coach para marcar sesiones
  como completadas: incentivo perverso — podría omitir marcar las sesiones que salieron
  mal para evitar la invitación a review.
- CHECK constraint de `notifications.type` extendido para incluir `'invitacion_review'`
  (mismo patrón preventivo que el bug de `messages.sender_type` de sesiones anteriores —
  sin esta extensión, los inserts de la función habrían fallado silenciosamente).

**Pendiente para la próxima sesión:**
- UI del flujo de review: pantalla para crear/editar review cuando llega la
  notificación `'invitacion_review'`, y display de rating promedio en ProfesionalScreen
  (hoy usa datos mock hardcodeados).
- Decidir si el coach ve las reviews que recibió en algún panel propio (CoachProfileScreen
  tiene un placeholder para esto).
- Verificar en producción que el cron job efectivamente dispara después de 20 minutos
  de una sesión confirmada (testear con un booking de prueba cuya hora ya pasó).

---

## 2026-06-23 — Claude (9ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`,
`lib/bookingHelpers.ts`, `SCHEMA.md`

**Resumen:**
- Cancelación por usuario en SalaScreen: `status='pendiente'` cancela siempre sin
  restricción; `status='confirmada'` solo con ≥24hs de anticipación. El botón en el
  banner de "Próxima sesión" se deshabilita con mensaje explicativo cuando no se cumple
  la condición. RLS `users_cancel_own_booking` aplicada en Supabase (UPDATE solo si
  `user_id = auth.uid()` y solo hacia `status='cancelada'`).
- Cancelación por coach sin restricción de tiempo. El UPDATE guarda `cancelled_by`
  ('coach'|'usuario') y `cancelled_late` (bool). Helper `isCancelLate()` extraído a
  `lib/bookingHelpers.ts` e importado en ambos screens (eliminada la copia local en
  CoachReservasScreen).
- Mensajes de sistema rediseñados: `sender_type` extendido a 5 valores (user, coach,
  system, system_confirmed, system_cancelled). Pills compactas con ícono (calendar-check /
  calendar-remove), fondo verde (`ViveColors.accent` al 28%) o rojo (`#E0525218`), título
  semibold + segunda línea tenue opcional. Contenido incluye fecha, hora y motivo de la
  sesión. Implementado en 5 puntos de inserción en CoachReservasScreen (confirmación,
  cancelación de conflicto, cancelación desde panel) y SalaScreen (cancelación por
  usuario, cancelación por coach desde la Sala). El fallback `sender_type='system'`
  conserva el render anterior (texto gris cursiva) para mensajes anteriores.
- Migraciones SQL corridas: (1) ALTER TABLE messages: extendió CHECK constraint de
  sender_type para incluir 'system_confirmed' y 'system_cancelled'; (2) ALTER TABLE
  bookings: columnas cancelled_by y cancelled_late; (3) RLS policy users_cancel_own_booking.

**Bugs encontrados y resueltos:**
1. **CHECK constraint en messages.sender_type**: los inserts con los valores nuevos
   fallaban silenciosamente — el error no era visible en el flujo normal, solo
   loggeando explícitamente el resultado del insert. Fix: ALTER TABLE extendió el
   constraint para aceptar los 5 valores.
2. **Race condition en accept() (CoachReservasScreen)**: la función leía `booking`
   del estado React (`bookings.find(b => b.id === id)`) después del UPDATE; el
   realtime subscription podía disparar `loadBookings()` en paralelo y reemplazar
   ese estado con datos de otra sala. Causó que el mensaje `system_confirmed` se
   insertara en el `sala_id` equivocado. Fix: leer desde el `.select()` del propio
   UPDATE en vez del estado local.
3. **Layout bug en pills (SalaScreen)**: `systemPillContent` tenía `flex: 1` dentro
   de un padre con `maxWidth` pero sin `width` explícito — el hijo flex colapsaba a
   0px de ancho. El ícono y el fondo verde eran visibles pero el texto era invisible.
   Fix: `flexShrink: 1` en vez de `flex: 1`.

**Pendiente para la próxima sesión:**
- Probar en dispositivo el flujo completo: confirmar reserva (pill verde con texto) →
  cancelar como usuario con >24hs → intentar cancelar con <24hs (debe bloquear) →
  cancelar como coach desde la Sala (sin restricción).
- Verificar en Supabase que `cancelled_by` y `cancelled_late` quedan con los valores
  correctos en los 3 escenarios.

---

## 2026-06-22 — Claude (8ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`

**Resumen:**
- Bug fix: el mensaje `system_confirmed` se insertaba con el `sala_id` equivocado. La causa raíz era que `accept()` leía `booking` desde el estado React (`bookings.find(b => b.id === id)`) DESPUÉS del UPDATE, y el realtime subscription disparaba `loadBookings()` en paralelo — el closure capturaba el estado stale de un render anterior que podía tener datos de otra sala.
- Fix: `.select('id, user_id, coach_id, sala_id, scheduled_date, scheduled_time, user_message')` en el UPDATE mismo, y `const booking = data[0]` en vez de `bookings.find()`. El `booking` ahora viene directamente de la DB, no del estado local.
- No hubo cambios en schema ni en SalaScreen.

**Pendiente para la próxima sesión:**
- Testear en el celular: confirmar una reserva desde CoachReservasScreen y verificar que la pill verde aparece con texto correcto (fecha/hora) en la sala correcta (la sala de "amazonalbisu", no la de "andre").
- Verificar también el flujo de cancelación de conflictos — si `booking.sala_id` estaba mal ahí también, el cancel de conflictos podría tener el mismo bug (pero el `conflicting` query sí usa `booking.scheduled_date`/`scheduled_time` del nuevo `data[0]`, así que debería estar bien).

---

## 2026-06-22 — Claude (7ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Mensajes de sistema en el chat rediseñados: nueva "pill" centrada con ícono + texto, fondo verde (`${ViveColors.accent}28`) para confirmación y rojo (`#E0525218`) para cancelación. El fallback `sender_type: 'system'` (mensajes anteriores) mantiene el render original gris/cursiva.
- Contenido de los mensajes de sistema actualizado en los 5 puntos de inserción: ahora incluyen fecha y hora de la sesión (`"Sesión reservada · lun 22 jun · 7:00 hs"` / `"El coach canceló la sesión\nlun 22 jun · 7:00 hs"`). Para confirmación, el motivo del usuario va en segunda línea si existe.
- Decisión de arquitectura: en vez de agregar columna `system_event_type`, se reutilizó `sender_type` con dos valores nuevos (`system_confirmed`, `system_cancelled`) — sin ALTER TABLE, compatible con mensajes viejos.
- SCHEMA.md actualizado con los valores nuevos de `sender_type` y la decisión de diseño.

**Pendiente para la próxima sesión:**
- Testear en el celular: confirmar una reserva desde CoachReservasScreen y verificar que la pill verde aparece con fecha y hora correctas en SalaScreen.
- Testear ambas cancelaciones (coach y usuario) y verificar pill roja.
- Los mensajes viejos con `sender_type: 'system'` van a seguir rindiendo como texto gris — si en algún momento se quiere migrarlos, habría que hacer un UPDATE en Supabase.

---

## 2026-06-22 — Claude (6ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`, `lib/bookingHelpers.ts` (nuevo)

**Resumen:**
- Bug fix: el banner de "próxima sesión" en SalaScreen bloqueaba la cancelación del coach con la restricción de 24hs del usuario. Se agregó `isCurrentUserCoach = !recipientIsCoach` (derivado del estado ya existente) para bifurcar tanto el banner como `handleCancelBooking()`.
- Para el coach: botón siempre habilitado, sin texto de 24hs, guarda `cancelled_by: 'coach'` y `cancelled_late` calculado; para el usuario: flujo existente sin cambios.
- Extraída `isCancelLate()` a `lib/bookingHelpers.ts` (helper compartido) e importada en ambos screens — eliminada la copia local de CoachReservasScreen.

**Pendiente para la próxima sesión:**
- Testear el flujo completo desde el celular: coach entra a la sala, ve el banner, toca "Cancelar sesión" — verificar que no se bloquea por tiempo y que el booking queda con `cancelled_by: 'coach'` y `cancelled_late` correcto en Supabase.
- Verificar que el flujo del usuario en la misma sala sigue bloqueando por 24hs correctamente.

---

## 2026-06-22 — Claude (5ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Cancelación de sesión confirmada por el coach implementada en CoachReservasScreen: función `cancelConfirmed()` + botón "Cancelar" en cada card de confirmada (layout derecho: badge + texto rojo)
- `isCancelLate()`: calcula si la cancelación ocurre con menos de 24hs de anticipación respecto a scheduled_date + scheduled_time — mismo patrón que `canCancelConfirmed()` en SalaScreen pero invertido (registra para métrica, no bloquea)
- UPDATE incluye `cancelled_by: 'coach'` y `cancelled_late: boolean`; agrega mensaje de sistema en sala ("El coach canceló la sesión.") y notificación push al usuario
- SalaScreen.tsx: agregado `cancelled_by: 'usuario'` al UPDATE de cancelación del usuario (era solo `{ status: 'cancelada' }`)
- SCHEMA.md actualizado con las 2 columnas nuevas de `bookings`
- **Migración SQL pendiente de correr en Supabase dashboard** (no destructiva):
  ```sql
  ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS cancelled_by text,
    ADD COLUMN IF NOT EXISTS cancelled_late boolean;
  ```

**Pendiente para la próxima sesión:**
- Correr la migración SQL en Supabase antes de testear (sin ella el UPDATE de `cancelled_by`/`cancelled_late` silenciosamente no escribe esas columnas pero no rompe nada)
- Probar en dispositivo: cancelar sesión confirmada como coach → verificar mensaje en sala + push al usuario
- RLS de `bookings` en UPDATE: confirmar que el coach puede hacer UPDATE con `cancelled_by`/`cancelled_late` (la política actual debería cubrirlo si permite UPDATE en general para el coach, pero verificar)

---

## 2026-06-22 — Claude (4ª entrada)

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Cancelación de reserva por el usuario implementada dentro del banner de sesión existente en SalaScreen — sin pantallas nuevas
- `ConfirmedBooking` type: agregado campo `status: 'pendiente' | 'confirmada'`; query de bookings cambió de `.eq('status', 'confirmada')` a `.in('status', ['pendiente', 'confirmada'])` para cubrir ambos casos cancelables
- Helper `canCancelConfirmed()`: devuelve true si faltan ≥24hs — mismo patrón que `calcVideoWindow` ya existente en el archivo
- Función `handleCancelBooking()`: valida elegibilidad → Alert de confirmación → UPDATE booking a 'cancelada' → mensaje de sistema encriptado en sala → notif + push al coach vía `profiles.push_token` del `recipientId`
- Liberación del slot en `coach_availability` es automática (BookingScreen_Calendar/Time filtran contra bookings con status='confirmada') — no se tocó esa tabla
- RLS aplicada previamente por Andre: `users_cancel_own_booking` con USING `user_id = auth.uid()` y WITH CHECK `status = 'cancelada'`

**Pendiente para la próxima sesión:**
- Probar en dispositivo: reserva pendiente → cancelar (siempre disponible) y reserva confirmada → cancelar con >24hs / intentar con <24hs (debe bloquear)
- Verificar que el coach recibe push notification y mensaje de sistema en la sala

---

## 2026-06-22 — Claude (3ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`

**Resumen:**
- Ventana de respuesta del coach reducida de 48hs a 24hs en todos los lugares donde aparecía
- Lógica real (`hoursLeftToRespond`): constante `48 * 60 * 60 * 1000` → `24 * 60 * 60 * 1000` en `CoachReservasScreen.tsx:64`
- Umbrales de `urgencyColor` ajustados proporcionalmente: naranja arranca en `<= 12hs` (antes `<= 24hs`); rojo a `<= 6hs` se mantuvo
- Texto de UI actualizado en los 3 archivos restantes: "48hs" → "24hs" en banner de CoachHomeScreen, aviso de BookingScreen_Confirm, y subtitle de BookingScreen_Success
- No hay cancelación automática por vencimiento de deadline — el deadline es puramente visual; la cancelación es por conflicto de horario en `accept()` y no se tocó

**Pendiente para la próxima sesión:**
- Confirmar en dispositivo que el countdown se muestra correctamente para reservas recientes (debería mostrar ~24hs para una reserva nueva)

---

## 2026-06-22 — Claude (2ª entrada)

**Tocado:** `screens/CoachAvailabilityScreen.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `coach_availability` (SQL)

**Resumen:**
- SQL corrido por Andre: `ALTER TABLE coach_availability ADD COLUMN blocked boolean NOT NULL DEFAULT false`
- `removeSlot()` ya no hace DELETE — hace `UPDATE SET blocked=true`; nueva `reactivateSlot()` hace `UPDATE SET blocked=false`
- Slot bloqueado se muestra con candado naranja en `CoachAvailabilityScreen`; tocarlo lo reactiva. Orden: reservado > bloqueado > libre.
- `BookingScreen_Calendar` y `BookingScreen_Time` filtran `.eq('blocked', false)` — slots bloqueados invisibles para el usuario
- `availabilityGenerator.ts` sin cambios: el `upsert ignoreDuplicates` ya ignora filas con `blocked=true`

**Pendiente para la próxima sesión:**
- Probar flujo en dispositivo: crear patrón → bloquear un slot → regenerar ventana → verificar que el slot no reaparece como libre

---

## 2026-06-22 — Claude

**Tocado:** `lib/availabilityGenerator.ts` (nuevo), `screens/CoachWeeklyPatternScreen.tsx` (nuevo), `app/coach-weekly-pattern.tsx` (nuevo), `screens/CoachAvailabilityScreen.tsx` (modificado), `package.json` / `package-lock.json` (dependencia nueva)

**Resumen:**
- SQL corrido por Andre en Supabase: tabla `coach_weekly_pattern` con RLS (coaches gestionan la propia, SELECT abierto). Agregado en SCHEMA.md.
- `lib/availabilityGenerator.ts`: función `generateWeeklySlots(coachId, supabase)` — itera los próximos 56 días, convierte JS `getDay()` a `day_of_week` DB (1=Lun…7=Dom), genera slots con `t < end_time` exclusivo, inserta con `upsert onConflict ignoreDuplicates` sobre el UNIQUE constraint existente.
- `CoachWeeklyPatternScreen`: lista los 7 días siempre visible, bloques existentes con delete (Alert), form inline por día con DateTimePicker modo "time" (iOS: spinner inline toggle; Android: dialog fuera del ScrollView). Botón "Guardar bloque" deshabilitado hasta que ambos tiempos estén seteados y `endTime > startTime`. Al montar y al guardar llama `generateWeeklySlots`.
- `CoachAvailabilityScreen`: agregado banner "Configurar horario semanal habitual" arriba del calendario que navega a `/coach-weekly-pattern`.
- Instalado `@react-native-community/datetimepicker` vía `expo install`.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear patrón semanal → verificar que `coach_availability` se pobla correctamente para las próximas 8 semanas
- Verificar que el DateTimePicker en iOS muestra correctamente en modo spinner (altura nativa 216px dentro del ScrollView)

---

## 2026-06-21 — Andre

**Tocado:** `screens/CoachProfileScreen.tsx`, `screens/CoachAvailabilityScreen.tsx` (nuevo), `app/coach-availability.tsx` (nuevo), `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/SalaScreen.tsx`, `screens/CoachChatsScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Sistema de disponibilidad real completado: SQL corrido (`coach_availability` con RLS), `CoachAvailabilityScreen` nueva pantalla (calendario + chips por fecha con add/delete en Supabase), `CoachProfileScreen` reemplazó grid mock por botón "Gestionar disponibilidad"
- `BookingScreen_Calendar` reemplazó `MOCK_UNAVAILABLE_DAYS` + bloqueo de fines de semana por queries reales: resuelve `coaches.id` desde `profile_id`, cruza `coach_availability` contra `bookings confirmadas`, sólo muestra días con al menos un slot libre
- `BookingScreen_Time` reemplazó `ALL_TIMES` hardcodeado por queries reales para el coach+fecha seleccionados; sort numérico para evitar orden alfabético erróneo ("10:00" < "9:00")
- Cleanup: eliminados 6 `console.log` diagnósticos de `SalaScreen` y `CoachChatsScreen` (del debugging del bug de RLS, ya resuelto); corregido TS error (`sender_type` faltaba en mensaje optimístico de `SalaScreen`)
- `SCHEMA.md` actualizado: tabla `coach_availability` documentada, Regla 9 agregada

**Pendiente para la próxima sesión:**
- Probar el flujo completo en dispositivo: coach agrega slots → usuario ve calendario real → reserva → slot queda bloqueado
- Bug conocido sin fix: `BookingScreen_Success` "Ver mi sala" usa `coach_id: ''` porque `BookingScreen_Confirm` no pasa `coachId` al navegar

---

## 2026-06-20 (continuación 5) — Andre

**Tocado:** RLS en `messages`, `screens/CoachReservasScreen.tsx`

**Resumen:**
- Bug crítico encontrado y corregido: la política RLS de SELECT en
  `messages` ("Users can view messages in their salas") tenía la condición
  `auth.uid() = sender_id` — esto permitía a cada usuario ver SOLO los
  mensajes que él mismo envió, nunca los que recibió. Por eso los chats
  nunca sincronizaban entre usuario y coach (cada lado veía una
  conversación distinta, solo con sus propios mensajes salientes).
  Corregido: la política ahora compara contra `sala_id IN (SELECT id FROM
  salas WHERE user_id = auth.uid() OR coach_id = auth.uid())`. Confirmado
  funcionando en el dispositivo en ambos sentidos (usuario↔coach).
- Se corrigió el orden de loadBookings() en CoachReservasScreen.tsx,
  función accept() — antes se llamaba antes de que terminara la lógica de
  cancelación de conflictos, mostrando datos parciales hasta un refresh
  manual. Ahora corre al final, una sola vez, con el resultado completo.
- Se descartó la hipótesis de "salas duplicadas" como causa del problema
  de sincronización (confirmado con SQL: no hay duplicados para ningún
  par user_id+coach_id — son 3 salas legítimas con distintos usuarios).

**Pendiente para la próxima sesión:**
- Bug menor identificado, no corregido: app/(tabs)/index.tsx usa columnas
  date/time en vez de scheduled_date/scheduled_time (mismo patrón
  recurrente del día) — el botón "Ver sala" en Home nunca funciona.
- Bug menor identificado, no corregido: SessionsScreen.tsx muestra el
  lastMessage sin desencriptar (debería pasar por decryptMessage()).
- Feature grande de disponibilidad por coach sigue pendiente (ver entrada
  anterior del mismo día — tabla coach_availability, pantalla de
  configuración para el coach, lógica de slots en Calendar/Time).

---

## 2026-06-20 (continuación 4) — Andre

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`,
tabla `messages` (sender_type), pull-to-refresh en Reservas

**Resumen:**
- Bug encontrado (mismo patrón recurrente del día): SalaScreen.tsx usaba
  columnas `date`/`time` en vez de `scheduled_date`/`scheduled_time` para
  buscar la reserva confirmada de una sala — causaba que el banner de
  sesión y el motivo del usuario (user_message) nunca aparecieran, aunque
  la reserva existiera y estuviera confirmada. Corregido en 4 lugares:
  tipo ConfirmedBooking, calcVideoWindow, la query en init(), y el JSX
  del banner.
- Confirmado (mediante SQL, no era bug): la confusión de "no aparece nada"
  en varias pruebas de hoy fue reiteradamente por mezclar cuentas de coach
  de prueba (`viveappp@gmail.com` = "Coach Prueba", `dardoalbisu@gmail.com`,
  `steamsteam335@gmail.com` eran todas cuentas distintas usadas sin
  registrar cuál se usaba en cada prueba). Se limpiaron todas las tablas
  de prueba (messages, notifications, bookings, salas) para arrancar fresco.
- Nueva feature: mensajes de sistema en el chat. Se agregó columna
  `sender_type` ('user'|'coach'|'system') a `messages`. Cuando el coach
  acepta una reserva, se inserta automáticamente un mensaje de sistema en
  la sala con el motivo que el usuario escribió al reservar (o "Sesión
  confirmada" si no escribió nada) — visible para ambos, estilo visual
  distinto (centrado, sin burbuja, sin avatar). El banner fijo de la Sala
  ya NO muestra el motivo (se sacó esa línea), solo fecha/hora — el motivo
  vive únicamente como mensaje en el chat.
- Nueva feature: cancelación automática de horarios conflictivos. Cuando
  el coach acepta una reserva, todas las OTRAS reservas pendientes para el
  mismo coach+fecha+hora se cancelan automáticamente (status='cancelada'),
  con notificación + push + mensaje de sistema en la sala de cada usuario
  afectado, avisando que el horario ya no está disponible.
- Se agregó pull-to-refresh (RefreshControl) en CoachReservasScreen.tsx
  como red de seguridad ante posibles fallos de Realtime.

**Pendiente para la próxima sesión — FEATURE GRANDE, requiere diseño:**

Sistema de disponibilidad real por coach. Hoy BookingScreen_Calendar.tsx y
BookingScreen_Time.tsx son 100% mock/hardcodeado (MOCK_UNAVAILABLE_DAYS y
ALL_TIMES son constantes fijas, no consultan Supabase, no usan coachId para
nada real). Decisiones YA TOMADAS sobre cómo debe funcionar:

1. Cada coach define sus PROPIOS días y horarios de atención (no son los
   mismos 7 slots fijos para todos los coaches como hoy) — requiere tabla
   nueva, por ejemplo `coach_availability` (día de semana, hora inicio,
   hora fin, por coach).
2. Un horario queda NO seleccionable para nuevos usuarios SOLO cuando ya
   tiene una reserva con status='confirmada' para ese coach+fecha+hora.
   Mientras haya solo reservas 'pendiente' compitiendo por el mismo
   horario, sigue apareciendo disponible para todos (la resolución de
   conflictos ya está resuelta vía cancelación automática al aceptar,
   ver arriba).
3. Si todos los horarios de un día específico ya están confirmados/no
   disponibles, ese día completo debe aparecer bloqueado en el calendario
   (no solo el horario puntual).

Falta diseñar/construir:
- Tabla `coach_availability` (esquema a definir)
- Pantalla para que el coach configure su disponibilidad (probablemente
  dentro de CoachProfileScreen, donde ya existe "Editar perfil")
- Lógica en BookingScreen_Calendar.tsx: cruzar coach_availability con
  bookings

---

## 2026-06-20 (continuación 4) — Claude

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, tabla `messages` (nueva columna)

**Resumen:**
- Se agregó columna `sender_type text NOT NULL DEFAULT 'user' CHECK (...)` a la tabla `messages` (valores: 'user', 'coach', 'system'). SQL corrido por Andre.
- Al aceptar una reserva en CoachReservasScreen (`accept()`), se inserta automáticamente un mensaje de sistema en la sala: contenido = `user_message` del booking (o "Sesión confirmada" si está vacío), con `sender_type='system'`.
- En SalaScreen: tipo `Message` actualizado con `sender_type`; `rowToMessage()` lo propaga desde la fila (con fallback `'user'` para mensajes viejos); el render de mensajes tiene rama especial para system — centrado, sin burbuja, texto gris cursiva, sin avatar; se eliminó el `user_message` del banner (solo queda fecha/hora).
- Fix de sesión anterior aplicado también: query de `confirmedBooking` corregida de `date`/`time` a `scheduled_date`/`scheduled_time` (bug que causaba "Sin sesión programada" aunque hubiera reserva confirmada).

**Pendiente para la próxima sesión:**
- Testear el flujo completo en Expo Go: coach acepta reserva → mensaje de sistema aparece en la sala del usuario.
- Evaluar si el realtime de `messages` en SalaScreen también necesita actualizar `confirmedBooking` cuando el status cambia (hoy lo hace solo en init).

---

## 2026-06-20 (continuación 3) — Andre

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`,
`screens/SalaScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, tabla `bookings`
(RLS + constraint), tabla `profiles` (RLS)

**Resumen:**
- Implementadas las 4 piezas de mejora de la interfaz de coach: (1) pestaña
  fija de Reservas en el tab bar con badge numérico (antes solo accesible
  vía banner condicional cuando había pendientes); (2) al aceptar/rechazar
  una reserva se inserta una notificación en la tabla `notifications` y se
  manda push; el banner de sesión en SalaScreen ahora lee la reserva
  confirmada real en vez de un SESSION_LABEL hardcodeado; (3) el botón de
  videollamada ahora respeta una ventana de 5 minutos antes de la sesión
  (calcVideoWindow), no solo si existe room_url; (4) campana de
  notificaciones en CoachHomeScreen con pantalla propia (coach-notifications.tsx).
- Se creó la tabla `notifications` (recipient_id, type, booking_id, title,
  body, read, created_at) con RLS (notifications_select_own,
  notifications_update_own, notifications_insert_authenticated).
- Bug grave encontrado: bookings.status se insertaba como 'pendiente'
  (español) pero 8 lugares distintos del código filtraban buscando 'pending'/
  'confirmed' (inglés) — las reservas nunca aparecían en ninguna pantalla
  del coach. Se corrigieron los 9 archivos para usar consistentemente
  español. Se descubrió que el constraint bookings_status_check en la base
  SOLO permite 'pendiente'/'confirmada'/'completada'/'cancelada' — no existe
  'rechazada', se usa 'cancelada' para ambos casos (rechazo de pendiente y
  cancelación de confirmada).
- Bug encontrado: CoachReservasScreen y CoachHomeScreen leían columnas
  `date`/`time` que no existen en bookings (las reales son `scheduled_date`/
  `scheduled_time`) — causaba fechas vacías en las tarjetas y un error
  silencioso de PostgREST en CoachHomeScreen. Corregido.
- Bug de seguridad/RLS encontrado y corregido: la tabla `bookings` no tenía
  ninguna política de SELECT ni UPDATE — los coaches no podían leer NINGUNA
  reserva (ni siquiera las suyas) desde la app, aunque sí existieran en la
  base (visible solo vía SQL Editor, que corre como postgres sin RLS). Se
  agregaron 3 políticas: coaches_can_select_own_bookings,
  coaches_can_update_own_bookings, users_can_select_own_bookings.
- Segundo bug de RLS encontrado: profiles solo tenía políticas de SELECT
  para "ver tu propio perfil" o "coaches visibles para todos" — un coach
  no podía leer el nombre de los usuarios que le reservaban, mostrando
  siempre el fallback "Usuario". Se agregó coaches_can_view_their_users_profiles
  (coach puede ver profiles de usuarios con los que tiene booking o sala).
- SalaScreen.tsx: eliminada la constante COACH hardcodeada (María González/
  Psicóloga) que se mostraba siempre sin importar quién entrara a la sala.
  Ahora resuelve el perfil real del destinatario (recipientId), distinguiendo
  si es coach (muestra specialty, navega a /profesional al tocar el header)
  o usuario (sin specialty, header no clickeable). Se eliminó también el
  indicador "En línea" (isOnline hardcodeado, sin sistema de presencia real).

**Pendiente para la próxima sesión:**
- Verificar si la pantalla /profesional tolera bien rating/reviewCount/
  priceFrom vacíos cuando un coach navega ahí desde la Sala (hoy se le pasan
  strings vacíos porque esos datos no existen para un perfil de usuario/coach
  visto desde este contexto).
- Probar el flujo completo de Pieza 4 (notificaciones) de punta a punta —
  se implementó pero no se confirmó visualmente en el dispositivo todavía.
- Considerar si bookings_status_check debería tener un valor separado para
  "rechazada" vs "cancelada" en el futuro (limitación de schema, no bloqueante).

---

## 2026-06-20 (continuación 7) — Claude

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Eliminado el objeto `COACH` hardcodeado ("María González") que se mostraba igual para todos los usuarios
- Agregados estados `recipientProfile` y `recipientIsCoach`: al resolver la sala se determina si el destinatario es coach o usuario, y se hace query a `profiles` (y a `coaches` por `profile_id` si es coach) para traer nombre real y especialidad
- Header ahora muestra nombre/especialidad reales con skeleton mientras carga; dot "En línea" eliminado (no hay presencia real)
- `onPress` del header es condicional: solo navega a `/profesional` si el destinatario es coach; si es usuario, no es clickeable
- Iniciales en avatar grande y pequeño usan `buildInitials()` sobre el nombre real
- Tooltip cambiado a texto neutral que no asume rol ("Tu espacio de comunicación. Escribí mensajes y coordiná tus sesiones.")
- Renombrado `recipientProfile` → `recipientPushData` dentro de `sendMessage()` para evitar shadowing del estado

**Pendiente para la próxima sesión:**
- `handleHeaderPress` pasa `rating: ''`, `reviewCount: ''`, `priceFrom: ''` a `/profesional` — confirmar si esa pantalla maneja strings vacíos o necesita ajuste

---

## 2026-06-20 (continuación 6) — Claude

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/SalaScreen.tsx`, `screens/ProfileOwnScreen.tsx`, `app/(tabs)/index.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug raíz: el constraint `bookings_status_check` en Supabase solo permite `'pendiente'`, `'confirmada'`, `'completada'`, `'cancelada'` (español). Todo el código JS/TS usaba inglés (`'pending'`, `'confirmed'`, `'rejected'`), causando silently failing updates y queries vacías
- Unificación a español: 13 cambios en 7 archivos — inserts, queries Supabase, filtros JS en memoria, y TypeScript types
- `'rejected'` mapeado a `'cancelada'` porque `'rechazada'` no existe en el constraint; la lógica de notificaciones (`type: 'reserva_rechazada'`, texto push) es independiente del status y no se tocó

**Pendiente para la próxima sesión:**
- Si hay filas en producción con status en inglés (`'pending'`, `'confirmed'`, `'rejected'`) que entraron antes de este fix, migrarlas con SQL: `UPDATE bookings SET status = 'pendiente' WHERE status = 'pending'`, etc.

---

## 2026-06-20 (continuación 5) — Claude

**Tocado:** `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- Bug encontrado: `bookings.status` se insertaba como `'pendiente'` (español) en BookingScreen_Confirm, mientras que el resto del proyecto (8 queries + 2 filtros JS) filtraba por `'pending'`/`'confirmed'` (inglés) — las reservas nuevas nunca aparecían en la pantalla del coach
- Unificación a inglés: cambiado `status: 'pendiente'` → `status: 'pending'` en línea 127
- No hay otros valores en español en el codebase (`confirmada`, `rechazada`, `cancelada` no aparecen en ningún lado)

**Pendiente para la próxima sesión:**
- Correr en Supabase: `UPDATE bookings SET status = 'pending' WHERE status = 'pendiente';` para migrar filas existentes (Andre lo tiene que correr manualmente)

---

## 2026-06-20 (continuación 4) — Claude

**Tocado:** `app/(coach)/_layout.tsx`, `app/(coach)/reservas.tsx` (nuevo), `app/coach-notifications.tsx` (nuevo), `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/SalaScreen.tsx`, `screens/CoachNotificationsScreen.tsx` (nuevo)

**Resumen:**
- **Reservas como pestaña fija:** agregada pestaña "Reservas" en el tab navigator de `(coach)` (5 pestañas: Inicio / Reservas / Chats / Recursos / Perfil). El layout resuelve su propio `coachId` y mantiene suscripción Realtime para el badge numérico de pendientes. `CoachReservasScreen` detecta con `useSegments()` si está en tab o en stack, y oculta el back button cuando es pestaña. El banner de CoachHomeScreen que navegaba a `/coach-reservas` (stack) ahora usa `router.navigate('/reservas')` para hacer switch de pestaña.
- **Notificaciones al aceptar/rechazar:** `accept()` y `confirmReject()` en `CoachReservasScreen` insertan en la tabla `notifications` (`type: reserva_confirmada` / `reserva_rechazada`) en el mismo `Promise.all` que manda el push. Mismo texto en DB y en push.
- **Banner dinámico en Sala:** eliminada la constante `SESSION_LABEL` hardcodeada. El `init()` de `SalaScreen` fetchea la reserva confirmada más próxima (de hoy en adelante, `status='confirmed'`) para esa `sala_id` y la muestra en el banner fijo. Si hay `user_message`, lo muestra en cursiva debajo.
- **Ventana de video de 5 minutos:** botón de video en Sala requiere `roomUrl && isInVideoWindow`. La ventana abre 5 minutos antes de la sesión y no tiene límite superior. Un `setInterval` de 30s recalcula el estado mientras la pantalla esté abierta.
- **Campana de notificaciones:** `CoachHomeScreen` muestra ícono de campana con punto rojo si hay `notifications.read=false` para el coach (suscripción Realtime). Navega a nueva pantalla `CoachNotificationsScreen` que lista notificaciones ordenadas por `created_at DESC`, marca todas como leídas al montar (en background para preservar el estado visual inicial), y navega a la pestaña Reservas si el ítem tiene `booking_id`.

**Pendiente para la próxima sesión:**
- La inserción en `notifications` con `type='reserva_nueva'` (cuando un usuario hace una reserva) no está implementada — el coach no recibirá notificaciones en la campana hasta que se agregue ese insert en el flujo de booking del usuario
- `app/coach-reservas.tsx` queda como ruta de stack pero ya no es el acceso principal — decidir si se mantiene como deeplink fallback o se elimina
- El banner de Sala muestra "Sin sesión programada" cuando no hay reserva confirmada futura — evaluar si conviene mostrar la última sesión pasada o directamente ocultar el banner

---

## 2026-06-20 (continuación 3) — Claude

**Tocado:** `screens/ProfileOwnScreen.tsx`, `screens/CoachProfileScreen.tsx`, `context/AuthContext.tsx`

**Resumen:**
- Eliminado el botón "Cambiar a vista coach" de `ProfileOwnScreen` y su mirror "Cambiar a vista usuario" de `CoachProfileScreen` — eran un agujero de seguridad real: cualquier usuario podía auto-elevarse a `/(coach)` sin que `profiles.role` lo avalara
- Eliminada `switchRole()` completamente de `AuthContext`: del tipo `AuthContextType`, del contexto default, de la implementación y del valor que expone el provider
- El estado `role` en AuthContext ahora es inmutable desde el cliente — solo puede cambiar vía `fetchRole()` (consulta `profiles.role` en Supabase) o `signOut()`
- Confirmado que `app/index.tsx` y `app/_layout.tsx` (AuthRedirect) ya usaban exclusivamente el `role` de `fetchRole()` y no necesitaron cambios
- Decisión de arquitectura: coach y usuario son cuentas completamente separadas — si un coach quiere usar VIVE como usuario necesita otra cuenta

**Pendiente para la próxima sesión:**
- Nada abierto de esta tarea; el flujo de roles quedó cerrado y limpio

---

## 2026-06-20 (continuación 2) — Claude

**Tocado:** `screens/CoachHomeScreen.tsx`, `screens/CoachReservasScreen.tsx`

**Resumen:**
- Corregido bug crítico: las 3 queries de `bookings` en pantallas de coach comparaban `user.id` (`profiles.id` / `auth.uid()`) directamente contra `bookings.coach_id`, pero esa columna espera `coaches.id` (el PK de la tabla `coaches`, distinto del `profile_id`). Resultado: el coach veía siempre 0 reservas aunque existieran registros reales.
- Patrón de fix: cada pantalla ahora resuelve `coaches.id` una sola vez al montar (via `useEffect` + `useState coachId`, lookup `coaches.select('id').eq('profile_id', user.id)`), y usa ese valor en todos los `.eq('coach_id', ...)` de bookings y en el filtro de la suscripción Realtime.
- `CoachChatsScreen` no tenía el bug: `salas.coach_id` apunta a `profiles.id`, que sí coincide con `user.id`.
- SCHEMA.md no cambió — el esquema ya documentaba esta distinción correctamente.

**Pendiente para la próxima sesión:**
- Verificar en dispositivo que el coach ve sus reservas y que el Realtime funciona al crear una nueva booking.

---

## 2026-06-20 (continuación) — Andre

**Tocado:** `screens/SalaScreen.tsx`, `app/_layout.tsx`, `screens/CoachLoginScreen.tsx`,
`screens/RegisterScreen.tsx`, `screens/OnboardingScreen2.tsx`, `screens/OnboardingScreen5.tsx`,
nuevas pantallas de coach, tabla `coaches` (esquema + RLS)

**Resumen:**
- Resuelto merge en SalaScreen.tsx: se combinó la versión completa de Andre
  (chat real con Realtime, encriptación, búsqueda/creación de sala, push
  notifications) con la idea de Joaquín de conectar el botón de video al
  `room_url` real de la sala vía Linking.openURL. Se sacó el selector "Test:"
  (locked/soon/live) y el MEET_LINK hardcodeado — ya no hacían falta.
- Mismo bug de styles/s que en LoginScreen apareció también en RegisterScreen.tsx
  (líneas 128-129, copy-paste heredado) — corregido: styles.logoRow → s.logoWrap,
  styles.logo → s.logo.
- Se construyó el flujo completo de aplicación de coaches, ya decidido en
  sesiones anteriores de producto:
  - Nueva pantalla de bifurcación (onboarding-bifurcacion.tsx) entre la
    bienvenida y el onboarding de usuario: "Quiero crecer" / "Quiero acompañar"
  - CoachLoginScreen.tsx: login/registro simple para coach, navega a
    coach-application.tsx
  - coach-application.tsx: formulario (especialidad, bio, precio, nacionalidad,
    link de video) que inserta en `coaches` con verified: false
  - Se agregó columna `application_video_url` (text) a `coaches` vía ALTER TABLE
  - Se agregó política RLS de INSERT en `coaches` (coaches_insert_own) — sin
    ella, el insert fallaba con "new row violates row-level security policy"
- Se implementó ruteo por rol: AuthContext ahora tiene fetchRole(), y
  AuthRedirect en _layout.tsx redirige a /(coach) o /(tabs) según
  profiles.role al loguearse.
- Se implementaron validaciones cruzadas: una cuenta no puede ser coach y
  usuario al mismo tiempo bajo el mismo mail, en ningún estado (pendiente,
  aprobado, o usuario normal). CoachLoginScreen y RegisterScreen ahora
  verifican esto antes de dejar avanzar.
- Bug encontrado y corregido (segunda vez en el día, mismo patrón que
  index.tsx): AuthRedirect redirigía a CUALQUIER usuario sin sesión que
  estuviera en /(tabs) de vuelta a onboarding-bifurcacion — esto rompía la
  regla de "explorás libremente, te registrás cuando querés actuar". Se
  corrigió para que /(tabs) sea accesible sin cuenta; solo /(coach) requiere
  sesión. Un primer intento de fix (mandar todo a /register) fue revertido
  por contradecir esa regla de producto.
- OnboardingScreen2: las opciones "explorar" y "sé qué necesito" ahora van a
  /(tabs) sin pedir cuenta (la segunda era un dead end conocido, ahora resuelto).
  "No sé por dónde empezar" sigue el flujo guiado de 3 pasos, que termina en
  /register al llegar a una acción concreta (correcto, según la regla).

**Pendiente para la próxima sesión:**
- Probar el flujo completo de coach (postulación → aprobación manual →
  acceso a /(coach)) de punta a punta una vez más con el SalaScreen actualizado.
- AuthRedirect: confirmar si segments[0] === '(coach)' funciona como se
  espera en expo-router (sospecha de sesiones anteriores, sin confirmar).
- Pensar la interfaz de /(coach) en sí — qué ve un coach aprobado al entrar
  (panel, reservas entrantes, etc.) — todavía no se construyó nada de eso.
- Avisar a Joaquín sobre el cambio de política RLS en coaches y el ALTER
  TABLE de application_video_url (se corrieron sin esperar confirmación
  explícita dado el contexto del día — revisar si está de acuerdo).

---

## 2026-06-20 — Joaquín (sesión 2)

**Tocado:**
- `context/AuthContext.tsx` — `role` ahora viene de `profiles.role` en Supabase
- `app/_layout.tsx` — `AuthRedirect` bifurca a `/(coach)` o `/(tabs)` según el rol real
- `app/index.tsx` — redirect inicial respeta el rol
- `screens/CoachLoginScreen.tsx` — agrega `validateAndNavigate()` con chequeo de rol cruzado
- `screens/RegisterScreen.tsx` — agrega chequeo de coach antes de `signUpWithEmail`

**Resumen:**
- Implementado routing basado en `profiles.role`: al hacer login, `AuthContext` hace `SELECT role FROM profiles` y `AuthRedirect` redirige a `/(coach)` o `/(tabs)` según corresponda. Antes todo el mundo iba a `/(tabs)`.
- Validaciones cruzadas para impedir que un mismo mail tenga rol de usuario y coach al mismo tiempo: `CoachLoginScreen` bloquea usuarios normales con mensaje claro; `RegisterScreen` bloquea emails que ya tienen fila en `coaches`. Si un coach con `verified=true` llega a `coach-login`, se lo redirige a `/(coach)` con un Alert.

**Pendiente para la próxima sesión:**
- Correr en Supabase si no se corrió: `ALTER TABLE coaches ADD COLUMN application_video_url text;`
- Probar el flujo completo en Expo Go: usuario normal intenta entrar a coach-login (debe ser bloqueado), coach verificado en coach-login (debe redirigir a /(coach)), registro normal con mail de coach (debe ser bloqueado)
- Definir qué ve un coach en `/(coach)` una vez aprobado — el grupo existe pero puede estar vacío

---

## 2026-06-20 — Joaquín

**Tocado:**
- `screens/OnboardingBifurcacion.tsx` (nuevo)
- `screens/CoachLoginScreen.tsx` (nuevo)
- `screens/CoachApplicationScreen.tsx` (nuevo)
- `app/onboarding-bifurcacion.tsx` (nuevo)
- `app/coach-login.tsx` (nuevo)
- `app/coach-application.tsx` (nuevo)
- `screens/OnboardingScreen1.tsx` — cambia navegación post-splash
- `app/_layout.tsx` — registra nuevas rutas y ONBOARDING_SCREENS
- `SCHEMA.md` — documenta columna nueva `coaches.application_video_url`

**Resumen:**
- Nuevo flujo de aplicación de coaches: pantalla de bifurcación "¿Cómo llegás a VIVE?" inserta entre el splash (index) y el onboarding de usuario (onboarding2). La opción "Quiero acompañar" lleva a coach-login → coach-application.
- `CoachLoginScreen` intenta signIn primero; si falla prueba signUp con nombre derivado del email. Navega a coach-application al autenticarse.
- `CoachApplicationScreen` inserta en `coaches` con `verified: false` y muestra confirmación inline. Maneja el caso de inserción duplicada (code 23505).
- `application_video_url` no existía en `coaches` — hay que correr el ALTER TABLE antes de probar el formulario (ver SCHEMA.md).

**Pendiente para la próxima sesión:**
- Correr en Supabase: `ALTER TABLE coaches ADD COLUMN application_video_url text;`
- Probar el flujo completo en Expo Go (bifurcación → coach-login → coach-application → confirmación)
- Definir qué ve un coach en `/(tabs)` una vez aprobado (`verified: true`) — hoy cae al mismo home de usuario

---

## 2026-06-20 — Andre

**Tocado:** `bookings` (esquema), `SCHEMA.md`

**Resumen:**
- Se agregó la columna `user_message` (text, nullable) a `bookings` vía
  `ALTER TABLE` — necesaria para guardar el mensaje opcional que el usuario le
  escribe al coach antes de reservar (la UI ya existía en
  BookingScreen_Confirm.tsx, pero la columna no estaba en el esquema
  actualizado, causando el error "Could not find the 'user_message' column").
- Cambio no destructivo (agrega columna nullable, no afecta filas existentes),
  corrido directamente sin bloquear en avisar a Joaquín dado el bajo riesgo.

**Pendiente para la próxima sesión:**
- Confirmar que el flujo completo de reserva funciona de punta a punta con
  esta columna agregada.

---

## 2026-06-20 — Andre

**Tocado:** `SCHEMA.md`, `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- Resuelto merge con cambios de Joaquín (commit relacionado a `beae3d88`). La base de datos real cambió desde la última verificación — confirmado con `information_schema` que `bookings` ya tiene `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount`, `room_url` (Joaquín los agregó). `SCHEMA.md` actualizado con el estado real y confirmado.
- Confirmado con SQL: `bookings.coach_id` → `coaches.id`, mientras que `salas.coach_id` → `profiles.id` (= `coaches.profile_id`). Son dos FKs distintas con el mismo nombre de columna — quedó documentado en SCHEMA.md como regla crítica para no repetir el bug.
- `salas.room_url` ya existe en la base — el trigger de Jitsi Meet que charlamos con Joaquín ya está corrido y activo.
- En `BookingScreen_Confirm.tsx`: se corrigió que el código buscaba el coach por `specialty` en vez de por su ID real — esto podía reservar con el coach equivocado si dos coaches compartían especialidad. Ahora busca por `coachId`/`profileId` que llega desde la navegación, resolviendo `coaches.id` y `coaches.profile_id` en una sola query.
- Se mantuvo en la versión final: notificación push al coach, mensaje opcional del usuario, y se sumó el `roomUrl` de la sala para pasarlo a `booking-success`.

**Pendiente para la próxima sesión:**
- Resolver `CLAUDE.md` (1 conflicto) y confirmar que el protocolo de cierre de sesión quedó bien definido para ambos.
- Probar el flujo completo de reserva de punta a punta con esta versión corregida — todavía no se confirmó en el dispositivo que el bug de coachId esté resuelto.
- Sacar el selector "Test:" (locked/soon/live) de `SalaScreen.tsx` antes de producción.
- Confirmar si `AuthRedirect` (`segments[0] === '(coach)'`) funciona como se espera en expo-router — sospecha sin confirmar de sesión anterior.
- Conectar el botón de video de `SalaScreen.tsx` al `room_url` real (ya tiene el dato disponible, falta el `Linking.openURL` y sacar el `MEET_LINK` hardcodeado).
## 2026-06-20 — Joaquín (sesión 6)

**Tocado:** `screens/SalaScreen.tsx`, `CLAUDE.md`, `CHANGELOG_SESIONES.md`

**Resumen:**
- Tarea 4 completada y verificada: botón de video en SalaScreen ahora fetcha `room_url` real de `salas` por `sala_id` param y lo abre con `Linking.openURL()`. Probado end-to-end con sala real.
- Botón deshabilitado visualmente cuando no hay `room_url` (sala sin trigger corrido o sin `sala_id` en params).
- Agregado protocolo de cierre de sesión automático a `CLAUDE.md` — Claude actualiza el CHANGELOG sin que haya que pedirlo.

**Pendiente para la próxima sesión:**
- Andre tiene que conectar la navegación a `/sala?sala_id=<uuid>` desde algún punto del flujo real (lista de chats del coach, post-booking, etc.).
- Al mergear la versión completa de Andre de SalaScreen (con `init()` y `coach_id` fallback), verificar que `room_url` también se setea en esos paths.

---

## 2026-06-20 — Joaquín (sesión 5)

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Botón de video en SalaScreen conectado a Supabase: acepta `sala_id` por params de navegación,
  fetcha `room_url` de la tabla `salas`, y lo abre con `Linking.openURL()`.
- Botón deshabilitado visualmente (color tenue, sin onPress activo) cuando no hay `sala_id`
  o la sala no tiene `room_url` todavía.
- Sin cambios estructurales: mensajes y datos del coach siguen hardcodeados — la integración
  completa de mensajes reales es trabajo de Andre en su rama.

**Estado:** botón de video probado end-to-end con sala real (UUID `25e048d3`). Abre Jitsi correctamente.

**Pendiente (coordinar con Andre):**
- Nada navega todavía a `/sala` con un `sala_id` real desde el flujo de usuario. Andre tiene
  que conectarlo desde la lista de chats del coach o desde otro punto de entrada.
- Cuando Andre mergee su versión más completa de SalaScreen (con `init()`, `coach_id` fallback,
  `handleVideoPress`), verificar que `room_url` también se pasa al estado `roomUrl` en esos paths.

---

## 2026-06-20 — Joaquín (sesión 4)

**Tocado:** `SCHEMA.md`, `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- SCHEMA.md reescrito con el esquema real confirmado por Andre (information_schema).
  Correcciones clave vs. versión anterior: bookings tiene date/time (no scheduled_date/time),
  no tiene coach_name/amount/room_url; salas no tiene room_url todavía; coach_id en salas
  y bookings es profiles.id (no coaches.id).
- BookingScreen_Confirm corregido:
  - Lookup coach: ahora solo pide profile_id (no coaches.id — era incorrecto)
  - INSERT salas: sin cambios (ya usaba coachProfileId correctamente)
  - INSERT bookings: usa date/time, coach_id = coachProfileId (profiles.id), sin coach_name/amount
  - Si coach no encontrado: error explícito en vez de crear sala sin coach
  - room_url: se pide pero queda vacío hasta que corra add-salas-room-url.sql

**Pendiente (requiere Andre):**
- Correr `scripts/add-salas-room-url.sql` para activar room_url en salas
- Confirmar si bookings.coach_id tiene FK explícita a profiles o es solo una convención
- SalaScreen botón de video (esperando decisión sobre cómo compartir el link)

---

## 2026-06-20 — Joaquín (sesión 3)

**Tocado:** `scripts/add-salas-room-url.sql` (nuevo), `screens/BookingScreen_Confirm.tsx`, `CHANGELOG_SESIONES.md`

**Resumen:**
- Creado `scripts/add-salas-room-url.sql` — script idempotente para que Andre revise antes de correr. Agrega `salas.room_url` y el trigger Jitsi. NO fue ejecutado.
- Removido `ensureAnonSession` de `BookingScreen_Confirm` (regla de producto: booking requiere sesión real). Reemplazado con `supabase.auth.getSession()` + redirect a `/login` si no hay sesión.

**Revisión de commits post-merge — qué está y qué falta:**

✅ Ya aplicado y correcto en main:
- Loading/error states + Alert en BookingScreen_Confirm
- `registrarEvento('reserva_iniciada' | 'reserva_confirmada')`
- Lookup coach por specialty → `coaches.id` + `coaches.profile_id` (para salas)
- Crear/buscar sala por `user_id + coach_id (profile_id)`
- INSERT booking con `sala_id`
- `roomUrl` (de la sala) pasado a BookingScreen_Success
- `Linking.openURL(roomUrl)` en BookingScreen_Success

✅ Aplicado en esta sesión:
- Booking requiere sesión real (no anónima) — redirect a /login si no hay sesión

⏳ Pendiente de coordinación con Andre:
- `SalaScreen.tsx` botón de video → abrir `salas.room_url` real en vez del link hardcodeado. La lógica está clara pero Andre define cómo se comparte el link (solo usuario, ambos, notificación).
- Revisar si `ensureAnonSession` dev-fallback con email hardcodeado debe removerse de `lib/supabase.ts` (Diario y Gratitud lo siguen usando — decisión de producto).
- Confirmar con Andre que `scripts/add-salas-room-url.sql` refleja el estado real de la base antes de correrlo.

---

## 2026-06-20 — Joaquín (sesión 2)

**Tocado:** `SCHEMA.md`, `CHANGELOG_SESIONES.md` (trigger Jitsi en `salas`)

**Resumen:**
- Adaptado el trigger de Jitsi Meet para correr sobre `salas` en vez de `bookings`, siguiendo la arquitectura de Andre.
- `ALTER TABLE salas ADD COLUMN room_url text` + trigger `fn_salas_room_url` corrido y verificado.
- Cada nueva sala generada automáticamente recibe `https://meet.jit.si/vita-<16hex>`.
- Decisión arquitectural confirmada: `salas` es la fuente del `room_url`, no `bookings`.

**Pendiente:**
- Reconectar el flujo de reserva en la app (BookingScreen_Confirm) a la arquitectura de Andre: crear/buscar sala primero, luego booking con `sala_id`.
- El `bookings` actual en prod todavía tiene nuestro schema viejo (room_url, coach_name, etc.) — decidir si migrar o limpiar.

---

## 2026-06-20 — Joaquín

**Tocado:** `lib/supabase.ts`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `scripts/supabase-bookings-setup.sql`, `scripts/supabase-bookings-setup.sql` (trigger Jitsi), `SCHEMA.md`, `CHANGELOG_SESIONES.md`, `CLAUDE.md`

**Resumen:**
- Conectado el flujo de reserva completo a Supabase: INSERT en `bookings`, lookup de `coach_id` por specialty, analytics events (`reserva_iniciada`, `reserva_confirmada`), loading/error states con Alert.
- Creada tabla `analytics_events` con RLS.
- Recreada tabla `bookings` con schema nuevo (DROP CASCADE + CREATE): agrega `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount`, `room_url`. Elimina el schema anterior de Andre (`sala_id`, `date`, `time`, `user_message`).
- Trigger `trg_booking_room_url` genera sala Jitsi Meet automáticamente (`https://meet.jit.si/vita-<16hex>`) al insertar un booking.
- `BookingScreen_Success` abre la sala real con `Linking.openURL(roomUrl)`.
- `ensureAnonSession()` tiene fallback al usuario de diagnóstico (`test_vita_diag@example.com`) cuando anon sign-in está rate limited en desarrollo.
- Flujo probado end-to-end: reserva guardada, sala Jitsi generada y abierta correctamente.

**⚠️ Conflicto con diseño de Andre:**
- El schema de `bookings` que Andre describía (con `sala_id`, `date`, `time`, `user_message`) NO existe en la base actual — fue reemplazado por el nuestro.
- `salas` y `messages` de Andre SÍ existen y no fueron tocadas.
- Decidir si `bookings` debería tener `sala_id` como FK a `salas` (requiere migración).

**Pendiente:**
- Quitar fallback de email de diagnóstico de `ensureAnonSession()` antes de producción.
- Decidir con Andre si `bookings` se vincula a `salas` con `sala_id`.
- Verificar columnas de `saved_resources`.

---

## 2026-06-19 — Andre

**Tocado:** `lib/supabase.ts`, `BookingScreen_Confirm`, `BookingScreen_Success`, `app/_layout.tsx`, `context/AuthContext.tsx`, `screens/LoginScreen.tsx`, `package-lock.json`

**Resumen:**
- Resuelto merge con varios conflictos de Joaquín (commit `94aa144d` y anteriores). Se priorizó el esquema real de la base (ver SCHEMA.md) sobre código que asumía un esquema distinto.
- Bug encontrado y arreglado: `AuthProvider` no envolvía el árbol en `app/_layout.tsx` — causaba colgado silencioso en pantalla de inicio.
- Bug encontrado y arreglado: `styles` no definido en `LoginScreen.tsx` (debía ser `s`), más una llave huérfana en el StyleSheet.
- Bug encontrado, NO arreglado todavía: el flujo de reserva pasa `profileId` mal en algún punto de la cadena Conexiones → ProfesionalScreen → booking-calendar → booking-confirm, cayendo al fallback hardcodeado de coachId. Quedó con logs de debug puestos, falta confirmar el valor real.
- Confirmado con SQL: `salas.coach_id` y `salas.user_id` son FK a `profiles.id`, NO a `coaches.id`.
- Descubierto: Joaquín tiene un script SQL (`scripts/supabase-bookings-setup.sql`) que diseña una arquitectura distinta (bookings fusionado con salas, trigger de Jitsi Meet automático) — en ese momento sin correr contra la base real.

**Pendiente para la próxima sesión:**
- Terminar de rastrear el bug de coachId/profileId en el flujo de reserva (logs ya puestos en ProfesionalScreen.tsx y BookingScreen_Confirm.tsx — recordar sacarlos después).
- Decidir con Joaquín si se adopta el trigger de Jitsi Meet (adaptado a `salas`, no a `bookings`).
- Sacar el selector "Test:" (locked/soon/live) de `SalaScreen.tsx` antes de producción.
