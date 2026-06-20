# CHANGELOG_SESIONES.md — Registro de sesiones de trabajo

> Antes de tocar código, leé la última entrada de quien no sea vos.
> Al terminar tu sesión, agregá tu propia entrada arriba de todo (orden cronológico inverso).

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
