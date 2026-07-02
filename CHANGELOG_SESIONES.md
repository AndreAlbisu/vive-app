# CHANGELOG_SESIONES.md — Registro de sesiones de trabajo

> Antes de tocar código, leé la última entrada de quien no sea vos.
> Al terminar tu sesión, agregá tu propia entrada arriba de todo (orden cronológico inverso).

---

## 2026-07-02 — Joaquín (sesión 41)

**Tocado:** `app/(tabs)/recursos.tsx` (rediseño completo + bug fixes), `hooks/useResourceProgress.ts` (nuevo), `scripts/add-resource-completions.sql` (nuevo, corrido hoy), `SCHEMA.md`

**Resumen:**
- Rediseño completo de la pantalla Recursos: header con racha semanal (StreakChip), bloque de contexto según mood del día (MoodContextBlock con gradiente verde bosque), "Continuar donde dejaste" (ContinueCard, oculta si no hay datos), sección "De tu coach" rediseñada con avatar/badge/nota/checks, filter chips Todos/Guardados, 3 grupos de herramientas con título Fraunces + subtítulo. Toda la lógica existente (saved_resources, toggleSave, ToolCard) se mantuvo intacta. Probado en dispositivo — funciona.
- Nuevo hook `useResourceProgress`: calcula racha, actividad últimos 7 días, recurso a medias y completados recientes desde `resource_completions`.
- Bugs corregidos: mini-card de sugerencia en MoodContextBlock era tappable visualmente (tenía chevron) pero sin onPress — ahora navega a la herramienta. Filtro "Guardados" sin items dejaba el área vacía sin contexto — ahora muestra empty state con mensaje.
- Corridos en Supabase: `add-resource-completions.sql` (tabla nueva), `add-coach-instant-booking.sql` (columna `instant_booking`), `add-avatar-upload.sql` (bucket `avatars` — políticas de storage ya existían, solo faltaba `profiles_update_own`). SCHEMA.md actualizado.

**Pendiente para la próxima sesión:**
- Cablear escritura de progreso en `resource_completions` desde cada herramienta (Respiración, Meditación, etc.) para que la racha y el "continuar" se pueblen con datos reales.
- Verificar subida de foto de perfil en dispositivo físico (bucket `avatars` ya está listo).
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Joaquín (sesión 40)

**Tocado:** `app/(tabs)/conexiones.tsx`, `app/search3.tsx`, `lib/coachesCache.ts` (nuevo)

**Resumen:**
- Fix cards de temas en Conexiones: siempre devolvían 0 resultados porque los labels de UI ("Ansiedad y estrés") no coincidían con los subtemas reales de `coach_topics` ("Ansiedad", "Estrés físico"). Solución: cada card tiene `searchTopics: string[]` con strings exactos de AXES; se pasan como lista coma-separada a search3 que usa OR logic.
- Carga de subtemas en Supabase: script SQL para los 8 coaches reales (andre, María González, Martín Fuentes, Sofía Herrera, Lucas Méndez, Usuario 2, dardoalbisu, Coach Prueba).
- Performance: dos queries secuenciales colapsadas en una sola con join `coach_topics(topic)` en search3. Luego agregado prefetch en module cache (`lib/coachesCache.ts`): al abrir Conexiones se precarga en background; al tocar una card el resultado aparece instantáneo desde memoria.

**Pendiente para la próxima sesión:**
- Verificar subida de foto de perfil en dispositivo físico.
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Joaquín (sesión 39)

**Tocado:** `screens/CoachProfileScreen.tsx`, Supabase (SQL Editor — sin cambios de código)

**Resumen:**
- Fix botón "Editar perfil" en `CoachProfileScreen.tsx`: agregado `onPress={() => router.push('/edit-profile')}` — la pantalla ya existía, solo faltaba conectarla.
- Verificado `scripts/add-coach-topics.sql`: todas las políticas ya estaban aplicadas en Supabase (Andre las había corrido antes).
- Integrado commit de Andre (sesión 48 — subtemas de coaches) durante la sesión via merge.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: elegir subtemas como coach y verificar que aparecen en perfil y búsqueda.
- Decidir qué hacer con las 9 cards de temas de Conexiones (taxonomía distinta, ver SCHEMA.md regla 17).
- Verificar subida de foto de perfil en dispositivo físico.
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Andre (sesión 48)

**Tocado:** `screens/CoachTopicsScreen.tsx` (nuevo), `app/coach-topics.tsx` (nuevo), `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `app/search3.tsx`, `scripts/add-coach-topics.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre pidió hacer funcional la selección de subtemas de un coach (reflejado en perfil + filtro real en el buscador). La taxonomía ya existía completa en `constants/searchData.ts` (`AXES` — 3 ejes: Bienestar físico, Bienestar emocional y mental, Crecimiento y propósito; 28 subtemas en total) y ya se usaba en el flujo `search1.tsx → search2.tsx` para elegir un subtema — pero `search3.tsx` comparaba ese subtema contra `coaches.specialty` (texto libre, ej. "Coach de vida"), así que el filtro nunca matcheaba de verdad.
- Nueva tabla `coach_topics` (many-to-many coach↔subtema, `coach_id → coaches.id` mismo criterio que `coach_availability`).
- Nueva pantalla `screens/CoachTopicsScreen.tsx` (`/coach-topics`): los 28 subtemas agrupados por eje, multi-select con chips, guardado con criterio "reemplazar todo" (borra y reinserta). Enganchada desde "Temas que trabajo" en `CoachProfileScreen.tsx` (antes un chip "+ Agregar" sin `onPress`) — ahora muestra los subtemas reales elegidos como chips de solo lectura + el link para editar, refrescando con `useFocusEffect` al volver de la pantalla de edición (primer uso de ese hook en el proyecto).
- `ProfesionalScreen.tsx`: reemplazado el array de 5 temas hardcodeado (`DEFAULT_PROFESIONAL.topics`, igual para cualquier coach) por los subtemas reales del coach.
- `search3.tsx`: el filtro por `topic` (viene de `search2.tsx`) ahora compara por igualdad exacta contra los `coach_topics` reales de cada coach, en vez de la comparación rota contra `specialty`. De paso, la búsqueda libre por texto (`query`, desde `search1.tsx`) también matchea contra los subtemas del coach, no solo nombre/especialidad.
- **Hallazgo sin resolver, documentado en SCHEMA.md (regla 17):** los 9 "temas" que aparecen como cards en Conexiones (`TOPICS` en `conexiones.tsx`) son una taxonomía *distinta* y desconectada de los 28 subtemas de `AXES` — ningún label coincide textualmente. Tocar esas cards en Conexiones ya devolvía 0 resultados antes de esta sesión (comparaba contra `specialty`, tampoco coincidía nunca) y lo sigue haciendo ahora (compara contra `coach_topics`, tampoco coincide). No es una regresión de hoy — es un bug preexistente que quedó más visible. Requiere una decisión de producto (remapear, unificar, o descartar esa navegación) antes de tocarlo.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-topics.sql` en Supabase** — hasta entonces, elegir subtemas falla en silencio (tabla no existe) y el perfil/búsqueda no muestran nada.
- Probar en dispositivo: elegir subtemas como coach, confirmar que aparecen en `ProfesionalScreen.tsx`, y que buscar por ese subtema en `search1 → search2 → search3` trae al coach correcto.
- Decidir qué hacer con las 9 cards de temas de Conexiones (regla 17 de SCHEMA.md).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` (sesión 39) en cualquier ambiente que no lo haya corrido todavía.
## 2026-07-02 — Joaquín (sesión 38)

**Tocado:** Supabase (SQL Editor — sin cambios de código)

**Resumen:**
- Corridos los scripts pendientes de Andre en Supabase:
  - `favorite_coaches` — ya existía (Andre la había corrido antes)
  - `add-coach-instant-booking.sql` — columna `instant_booking boolean DEFAULT false` agregada a `coaches`
  - `add-avatar-upload.sql` — bucket `avatars` creado en Storage + 4 políticas RLS + política `profiles_update_own`
- Todos los features de Andre (fotos de perfil, reserva instantánea, favoritos) quedan operativos en producción.

**Pendiente para la próxima sesión:**
- Verificar subida de foto de perfil en dispositivo físico (coach y usuario).
- Con más días de check-in, verificar gráfico de mood en progreso.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-02 — Andre (sesión 48)

**Tocado:** `screens/CoachTopicsScreen.tsx` (nuevo), `app/coach-topics.tsx` (nuevo), `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `app/search3.tsx`, `scripts/add-coach-topics.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre pidió hacer funcional la selección de subtemas de un coach (reflejado en perfil + filtro real en el buscador). La taxonomía ya existía completa en `constants/searchData.ts` (`AXES` — 3 ejes: Bienestar físico, Bienestar emocional y mental, Crecimiento y propósito; 28 subtemas en total) y ya se usaba en el flujo `search1.tsx → search2.tsx` para elegir un subtema — pero `search3.tsx` comparaba ese subtema contra `coaches.specialty` (texto libre, ej. "Coach de vida"), así que el filtro nunca matcheaba de verdad.
- Nueva tabla `coach_topics` (many-to-many coach↔subtema, `coach_id → coaches.id` mismo criterio que `coach_availability`).
- Nueva pantalla `screens/CoachTopicsScreen.tsx` (`/coach-topics`): los 28 subtemas agrupados por eje, multi-select con chips, guardado con criterio "reemplazar todo" (borra y reinserta). Enganchada desde "Temas que trabajo" en `CoachProfileScreen.tsx` (antes un chip "+ Agregar" sin `onPress`) — ahora muestra los subtemas reales elegidos como chips de solo lectura + el link para editar, refrescando con `useFocusEffect` al volver de la pantalla de edición (primer uso de ese hook en el proyecto).
- `ProfesionalScreen.tsx`: reemplazado el array de 5 temas hardcodeado por los subtemas reales del coach.
- `search3.tsx`: el filtro por `topic` ahora compara contra `coach_topics` reales de cada coach. La búsqueda libre también matchea subtemas del coach.
- **Hallazgo sin resolver (SCHEMA.md regla 17):** los 9 "temas" de Conexiones son una taxonomía distinta y desconectada de los 28 subtemas de `AXES` — requiere decisión de producto antes de tocarlo.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-topics.sql` en Supabase** — hasta entonces, elegir subtemas falla en silencio.
- Decidir qué hacer con las 9 cards de temas de Conexiones (regla 17 de SCHEMA.md).

---

## 2026-07-02 — Joaquín (sesión 37)

**Tocado:** merge de `andre/main` → `main` (fast-forward, sin conflictos)

**Resumen:**
- Integrados 11 commits de Andre: fotos de perfil para coaches y usuarios (visibles en chat, reservas, búsquedas y Destacados), favoritos de coaches funcionales, reserva instantánea implementada, bloqueo de doble reserva al mismo horario, chat de Sala congelado mientras reserva está pendiente, fix de reviews unidireccionales, fix visual card de Sofía en Conexiones, frase del día sacada del hardcode en home.
- Scripts SQL nuevos en `scripts/`: `add-avatar-upload.sql`, `add-coach-instant-booking.sql`, `add-favorite-coaches.sql`, `complete-confirmed-sessions.sql` — verificar cuáles ya fueron corridos en Supabase.

**Pendiente para la próxima sesión:**
- Revisar qué scripts SQL de Andre ya están aplicados en Supabase y cuáles faltan.
- Con más días de check-in, verificar gráfico de mood en progreso.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Andre (sesión 47)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- A pedido de Andre, se sacó la frase del día hardcodeada ("Todas las respuestas están en vos.") que aparecía debajo del saludo en la home. Quedó eliminada la constante `dailyPhrase`, la línea de JSX y el estilo `dailyPhrase` sin uso. El bloque de saludo ahora solo tiene las dos líneas ("¡Buen día!" / "¿cómo estás hoy?").

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 46)

**Tocado:** `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Bug reportado por Andre: se podía chatear libremente en la Sala aunque la reserva siguiera `'pendiente'` (el coach todavía no aceptó ni rechazó). Esto contradice una decisión de producto ya documentada en Notion ("Mensaje previo a la aceptación del coach"): el chat es unidireccional antes de aceptar (solo existe el mensaje opcional que el usuario deja al reservar) — nunca se había implementado esa restricción en `SalaScreen.tsx`.
- Fix: `isChatFrozen = confirmedBooking?.status === 'pendiente'`. Mientras es `true`, el input y botón de enviar se reemplazan por un aviso explicando por qué está congelado (texto distinto para usuario y coach), y `sendMessage()` corta temprano como defensa en profundidad. El estado vacío de la lista de mensajes también cambia de copy si está congelado, para no invitar a "empezar la conversación" cuando en realidad está bloqueada.
- Se destranca solo — apenas el booking pasa a `'confirmada'` (el coach acepta) o deja de haber un `'pendiente'` activo (se cancela/rechaza y eventualmente se pide otro horario), el chat vuelve a funcionar normal, sin código nuevo necesario (ya lee `confirmedBooking` en tiempo real vía la suscripción existente).
- `SCHEMA.md` regla nueva 16, citando la decisión de Notion.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear una reserva pendiente, confirmar que el chat queda congelado para ambos lados (usuario y coach), y que se destranca solo al aceptar/rechazar.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 45)

**Tocado:** `app/(tabs)/conexiones.tsx`, `screens/ProfesionalScreen.tsx`, `hooks/useFavoriteCoaches.ts` (nuevo), `screens/FavoritosScreen.tsx` (nuevo), `app/favoritos.tsx` (nuevo), `app/_layout.tsx`, `scripts/add-favorite-coaches.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre preguntó si favoritos funciona en Conexiones — no: eran dos `useState` locales, puramente visuales y **desconectados entre sí** (la estrella en "Destacados de la semana" y el botón "Guardar en favoritos" de `ProfesionalScreen.tsx`). Ninguno persistía nada; se perdía todo al recargar, y marcar un coach de favorito en un lugar no lo reflejaba en el otro.
- Implementado de punta a punta: tabla nueva `favorite_coaches` (mismo patrón RLS que `saved_resources`), y un hook compartido `hooks/useFavoriteCoaches.ts` (mismo criterio que `hooks/useMoodHistory.ts`) que es ahora la única fuente de verdad — usado en `conexiones.tsx` y `ProfesionalScreen.tsx`, así que favoritear un coach en cualquiera de los dos lugares se refleja en el otro.
- Nueva pantalla `screens/FavoritosScreen.tsx` (`/favoritos`) con la lista real de coaches guardados — accesible desde un ícono de estrella nuevo en el header de Conexiones, junto a la campana. Empty state si no hay ninguno guardado todavía.
- Alcance deliberadamente acotado: el doc conceptual de Notion ("CONEXIONES" → "Favoritos") menciona también "notificación cuando un coach guardado tiene nueva disponibilidad" — no se implementó, es una feature separada y más grande (requeriría comparar altas en `coach_availability` contra las listas de favoritos de cada usuario). Queda anotado como pendiente, no construido.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-favorite-coaches.sql` en Supabase** — hasta entonces, favoritear un coach falla en silencio (tabla no existe).
- Probar en dispositivo: favoritear un coach desde su perfil, confirmar que aparece marcado también en Destacados y en `/favoritos`; sacarlo de favoritos desde `/favoritos` y confirmar que desaparece de los tres lugares.
- Considerar si vale la pena la notificación de "nueva disponibilidad de un coach guardado" del doc conceptual, o se descarta para esta etapa.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 44)

**Tocado:** `screens/ReviewScreen.tsx`, `scripts/complete-confirmed-sessions.sql` (nuevo, corrido en Supabase por Andre el 01/07/2026), `SCHEMA.md`

**Resumen:**
- Punto de partida: Andre preguntó si el sistema de reviews funciona. Se encontró que la mitad coach→usuario nunca se construyó en UI, y que ya había una decisión de producto documentada en Notion (1 de julio 2026, "Decisiones estratégicas" → "Reviews: unidireccionales") confirmando que reviews es usuario→coach exclusivamente, por diseño — no por limitación técnica.
- **Hallazgo mayor durante la investigación:** `complete_confirmed_sessions()` — la función que marca bookings como `'completada'` y dispara la invitación a review — **nunca existió realmente en la base**, pese a estar documentada desde el 23/06 como "✅ completada y verificada en Supabase". Confirmado con tres queries de diagnóstico corridas por Andre en el SQL Editor: `pg_get_functiondef` no la encontró, ninguna función con nombre parecido existe en `pg_proc`, y ninguna función en toda la base contiene el string `'invitacion_review'` en su cuerpo. El cron job (`complete-sessions`) sí estaba agendado y activo desde esa fecha, así que **cada corrida (cada 5 minutos, durante más de una semana) fallaba en silencio** — ningún booking se completó nunca automáticamente, y no se generó ninguna notificación de review para nadie, ni usuario ni coach. Mismo patrón que el incidente ya documentado del 19/06 (código documentado como corrido que en realidad nunca se ejecutó). El CHECK constraint de `notifications.type` sí incluía `'invitacion_review'` — esa parte del 23/06 sí había corrido, solo faltaba la función.
- **Fix de la función:** `scripts/complete-confirmed-sessions.sql` — creación (no modificación, no había nada previo), ya con la regla unidireccional incorporada desde el día uno: solo inserta la notificación `invitacion_review` para `bookings.user_id`, nunca para el coach. No hizo falta tocar `cron.job` — ya estaba bien agendado, solo faltaba que la función existiera.
- **Fix de defensa en profundidad:** `ReviewScreen.tsx` ahora chequea `role` de `useAuth()` al montar y redirige cualquier coach a `/(coach)/reservas` en vez de mostrar el formulario. Antes de este fix, un coach que llegara a `/review?booking_id=X` (ej. por una notificación vieja, mal generada, o un tap de push futuro) habría insertado una review con `reviewer_id = reviewed_id` (revieweándose a sí mismo) — ni la constraint UNIQUE ni las RLS de `reviews` lo hubieran impedido, porque son genéricas por diseño. En la práctica nunca se disparó porque la función que generaba la notificación tampoco existía.
- `SCHEMA.md` actualizado: regla 10 (hallazgo completo + fix), regla nueva 15 (reviews unidireccionales + guard de rol), descripción de `notifications.type` y de la tabla `reviews` actualizadas para reflejar la decisión de producto.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear un booking de prueba con `scheduled_date`/`scheduled_time` ya pasado + 20 min, confirmar que el cron lo marca `'completada'` y que la notificación de review le llega solo al usuario.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 43)

**Tocado:** `app/(tabs)/conexiones.tsx`

**Resumen:**
- Andre notó que la sección "Destacados de la semana" tampoco mostraba la foto real del coach — mismo bug que `search3.tsx` (sesión 40): el query a `coaches` no traía `avatar_url`.
- Fix: join cambiado a `profiles!inner(id, name, avatar_url)`, y la card de coach ahora muestra la foto real (con `overflow: hidden` en el contenedor para respetar el borde redondeado superior) o el ícono genérico si no subió foto.

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 42)

**Tocado:** `app/(tabs)/conexiones.tsx`

**Resumen:**
- Bug reportado por Andre: la última card de Conexiones ("¿No sabés qué necesitás? Te ayudo a encontrarlo") aparecía muy abajo, pegada al tab bar.
- Causa: a diferencia de todas las otras pantallas con tab bar (`index.tsx`, `recursos.tsx`, `SessionsScreen.tsx`, `CoachReservasScreen.tsx`, etc.), que envuelven su contenido en un `ScrollView` con un espaciador `<View style={{ height: TAB_BAR_CLEARANCE }} />` al final, `conexiones.tsx` usaba un `View` fijo no scrollable sin ese espaciador — la card quedaba pegada al borde inferior real de la pantalla, debajo del tab bar flotante, en vez de tener el margen que sí tienen las demás pantallas.
- Fix: convertido el `View` contenedor en `ScrollView` (mismo patrón que el resto de la app) y agregado el espaciador `TAB_BAR_CLEARANCE` al final. Los ScrollViews horizontales anidados (temas, destacados) siguen funcionando igual.

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 41)

**Tocado:** `screens/EditProfileScreen.tsx`, `screens/ProfileOwnScreen.tsx`, `app/(tabs)/index.tsx`, `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/SessionsScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Extensión de la foto de perfil (sesión 39) a usuarios normales, no solo coaches. Andre eligió el alcance "en todos lados" ante la pregunta de dónde debía reflejarse.
- `EditProfileScreen.tsx`: el botón "Cambiar foto" (existía sin `onPress`) ahora sube a Storage (mismo bucket `avatars`, path `{user.id}/avatar.jpg`) y guarda en `profiles.avatar_url` — mismo patrón que `CoachProfileScreen.tsx` de la sesión 39, sin extraer a un helper compartido (dos pantallas, poca lógica, no vale la pena la abstracción todavía).
- Foto real reemplaza iniciales/ícono genérico en: `ProfileOwnScreen.tsx` (perfil propio) y el avatar del top bar en `app/(tabs)/index.tsx`; y donde una parte ve a la otra — `SalaScreen.tsx` (chat, avatar grande del header y chico de mensajes), `CoachReservasScreen.tsx` (usuario que reservó, en pendientes y confirmadas), `CoachChatsScreen.tsx` y `SessionsScreen.tsx` (listas de chat). Todos con fallback a iniciales/ícono si no subió foto.
- No hizo falta ningún cambio de schema — reutiliza el mismo bucket `avatars` y la misma columna `profiles.avatar_url` de la sesión 39, así que `scripts/add-avatar-upload.sql` no cambió.
- `SCHEMA.md` actualizado: la entrada de `avatar_url` y la regla 14 ya no dicen "solo coach", listan todas las pantallas que la usan ahora.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: subir foto como usuario normal desde `EditProfileScreen.tsx`, y confirmar que se ve en las 7 pantallas listadas arriba, especialmente del lado del coach (`CoachReservasScreen.tsx`, `SalaScreen.tsx`, `CoachChatsScreen.tsx`).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 40)

**Tocado:** `app/search3.tsx`

**Resumen:**
- Andre probó la foto de perfil de la sesión anterior: se ve bien en `ProfesionalScreen.tsx`, pero faltaba en la lista de resultados del buscador — seguía mostrando el ícono genérico de persona.
- `search3.tsx` ahora trae `avatar_url` en el join a `profiles!inner(id, name, avatar_url)` y muestra la foto real en la card de cada coach si existe, con el mismo fallback al ícono genérico si no la subió.
- Alcance acotado a `search3.tsx` (la única pantalla que lista coaches con avatar) — no se tocaron `BookingScreen_*`, `SessionsScreen.tsx` ni otras pantallas que también muestran coaches, quedan con el placeholder genérico salvo que se pida extenderlo.

**Pendiente para la próxima sesión:**
- Seguir sin correr `scripts/add-avatar-upload.sql` en algún ambiente que no lo tenga corrido todavía (en este ya se corrió, confirmado por Andre).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 39)

**Tocado:** `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `scripts/add-avatar-upload.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Feature pedida por Andre: que el coach pueda subir su foto de perfil y que los usuarios la vean en el perfil público del coach.
- `profiles.avatar_url` ya existía en la tabla (sin uso hasta ahora) — no hizo falta columna nueva, solo bucket de Storage.
- `CoachProfileScreen.tsx`: el botón de cámara sobre la foto (antes sin `onPress`, según pendiente de sesiones previas) ahora abre selector cámara/galería, sube a Storage (bucket `avatars`, path `{user.id}/avatar.jpg`, mismo patrón que `video_url` de la sesión 30/06), y guarda la URL en `profiles.avatar_url` con el mismo chequeo de `data` post-update para detectar bloqueo silencioso de RLS.
- `ProfesionalScreen.tsx`: si el coach tiene `avatar_url`, se muestra esa foto en vez del ícono de persona genérico. El query a `coaches` ahora hace join a `profiles!inner(name, avatar_url)`.
- `scripts/add-avatar-upload.sql`: bucket `avatars` (público, 5MB, solo imágenes) + RLS de storage, y una política de UPDATE en `profiles` creada solo si no existía ninguna ya (no había ninguna documentada en scripts previos — primera vez que se confirma explícitamente que existe).
- Alcance deliberadamente acotado a lo pedido: otras pantallas que muestran coaches (`search3.tsx`, booking, `SessionsScreen.tsx`) siguen con el ícono genérico, sin tocar.
- `SCHEMA.md` actualizado (columna `profiles.avatar_url` documentada, regla nueva 14).

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-avatar-upload.sql` en Supabase** — hasta entonces la subida de foto falla (bucket no existe) y posiblemente el guardado en `profiles` también, si resulta que no había política de UPDATE previa.
- Probar en dispositivo físico: subir foto como coach, verificar que se ve recortada en cuadrado, y que otro usuario la ve reflejada en `ProfesionalScreen.tsx`.
- Decidir si vale la pena mostrar la foto también en `search3.tsx` y otras listas de coaches, para consistencia visual.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 38)

**Tocado:** `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Calendar.tsx`, `SCHEMA.md`

**Resumen:**
- Bug reportado por Andre al probar la reserva con "Coach Prueba": mandaba una solicitud, y el mismo horario seguía apareciendo disponible para volver a reservarlo — un usuario podía enviar 2 solicitudes al mismo slot. Causa: ambas pantallas solo marcaban un horario ocupado si había una reserva `'confirmada'`, ignorando las `'pendiente'` por completo.
- Fix: un horario ahora se marca ocupado también si el usuario logueado ya tiene una reserva `'pendiente'` propia ahí — pero **solo para él**. Las solicitudes `'pendiente'` de otros usuarios NO bloquean el slot a propósito, porque el diseño existente permite que varios usuarios compitan por el mismo horario y el coach elige a cuál acepta (la cancelación automática de las demás ya vivía en `CoachReservasScreen.tsx → accept()`, sin tocar).
- `SCHEMA.md` regla 9 actualizada con el criterio nuevo de disponibilidad.
- (Nota de contexto para la próxima sesión: el error "No encontramos el profesional" que reportó Andre en la sesión anterior era por no haber corrido todavía `scripts/add-coach-instant-booking.sql` en Supabase — sigue pendiente, ver sesión 37.)

**Pendiente para la próxima sesión:**
- Seguir sin correr `scripts/add-coach-instant-booking.sql` en Supabase — bloqueante para probar la modalidad instantánea y para que el booking normal no tire error al hacer `select('instant_booking')`.
- Probar en dispositivo: mandar una solicitud pendiente y confirmar que ese mismo horario aparece ocupado solo para ese usuario, no para otro usuario distinto logueado con otra cuenta.

---

## 2026-07-01 — Andre (sesión 37)

**Tocado:** `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/CoachProfileScreen.tsx`, `scripts/add-coach-instant-booking.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Bug encontrado por Andre: el booking permitía reservar horarios de hoy que ya pasaron (ej. 7am reservable a las 5pm del mismo día). `BookingScreen_Time.tsx` marcaba un slot como disponible únicamente chequeando si estaba reservado, sin comparar la hora contra el momento actual. Fix: si la fecha elegida es hoy, cualquier horario `<= ahora` se marca no disponible. Mismo criterio aplicado en `BookingScreen_Calendar.tsx` para que el día de hoy no quede seleccionable si a todos sus slots restantes ya les pasó la hora.
- Feature: la "modalidad de reserva" (Instantánea / Con confirmación) existía como switch puramente visual en `CoachProfileScreen.tsx` desde el rediseño VITA (sesión 31) — sin persistencia ni columna en la base. Se implementó de punta a punta:
  - **DB:** nueva columna `coaches.instant_booking` (boolean, default false) — script en `scripts/add-coach-instant-booking.sql`, **pendiente de correr en Supabase**.
  - El switch en `CoachProfileScreen.tsx` ahora lee y persiste el valor real (mismo patrón que `savePrice()`: chequea `data` post-update para detectar bloqueo silencioso de RLS).
  - `BookingScreen_Confirm.tsx`: si el coach tiene `instant_booking=true`, el booking se crea directo con `status='confirmada'` (no `'pendiente'`), y se replican ahí mismo los efectos que hoy dispara `CoachReservasScreen.tsx → accept()` — notificación `reserva_confirmada` al usuario, mensaje `system_confirmed` en la sala, y cancelación automática de otras reservas `'pendiente'` que compitan por el mismo horario. Lógica duplicada a propósito, no extraída a un helper compartido, para no tocar `accept()` (tiene datos reales de testing).
  - Copy condicional según el modo en `BookingScreen_Confirm.tsx` (texto de modalidad, aviso de cobro, pregunta del mensaje opcional) y en `BookingScreen_Success.tsx` (título, subtítulo y badge de estado).
- `SCHEMA.md` actualizado: columna `coaches.instant_booking` documentada, y regla nueva (13) explicando la duplicación de lógica y que la columna todavía no está corrida en producción.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-instant-booking.sql` en el SQL Editor de Supabase** — hasta entonces el switch de modalidad falla en silencio (0 filas afectadas) y todo coach sigue funcionando en modo "con confirmación" de hecho, aunque el `select` de `instant_booking` puede además tirar error de columna inexistente.
- Probar en dispositivo físico el flujo instantáneo completo: activar el switch como coach, reservar como usuario, confirmar que la sala recibe el mensaje `system_confirmed` y que un segundo usuario compitiendo por el mismo horario recibe la cancelación automática.
- Con más días de check-in acumulados, verificar que el gráfico de mood en progreso se lea bien.
- Considerar leyenda de colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 36)

**Tocado:** `app/(tabs)/index.tsx`, `app/(tabs)/_layout.tsx`

**Resumen:**
- Fix recurrente de canal realtime: al volver a home después de un booking, `notif-bell` y `user-tab-dot` crasheaban con "cannot add postgres_changes callbacks after subscribe()". Solución: sufijo aleatorio (`Math.random().toString(36).slice(2)`) en ambos nombres de canal para que cada montaje cree un canal único.

**Pendiente para la próxima sesión:**
- Con más días de check-in acumulados, verificar que el gráfico de mood en progreso se lea bien.
- Considerar leyenda de colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 35)

**Tocado:** `app/progreso.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- Agregada sección "Estado de ánimo" en `progreso.tsx`: gráfico de línea SVG de 14 días (puntos coloreados por `ViveMoodColors`, línea que salta días sin dato) + 3 métricas (promedio de mood, racha actual, mejor día de la semana).
- Card "Sobre ti" en la home es ahora un `TouchableOpacity` que navega a `/progreso`. Se eliminó el `onPress` separado que tenía el ícono Venn — toda la card actúa como una unidad.

**Pendiente para la próxima sesión:**
- Con más días de check-in acumulados, verificar que el gráfico se lea bien en distintos tamaños de pantalla.
- Considerar agregar una leyenda de los 5 colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 34)

**Tocado:** `scripts/create-mood-entries.sql` (nuevo, corrido en Supabase), `constants/theme.ts`, `hooks/useMoodHistory.ts` (nuevo), `lib/moodInsights.ts` (nuevo), `components/MoodCheckIn.tsx` (nuevo), `app/(tabs)/index.tsx`

**Resumen:**
- Implementado widget "Check-in de hoy" en la home: 5 círculos de color sólido con animaciones de escala y opacidad, microcopy de confirmación con fade+slide, preload del estado de hoy desde Supabase al montar.
- Nueva tabla `mood_entries` con constraint UNIQUE (user_id, entry_date) — upsert para que re-tocar un círculo actualice el mismo row, no duplique. RLS con 4 políticas. SQL en `scripts/create-mood-entries.sql`.
- `useMoodHistory(userId, days)` en `hooks/` — hook reutilizable para cualquier pantalla que necesite historial de mood.
- `lib/moodInsights.ts` con variantes de copy en `MOOD_COPY` (ajustables sin tocar lógica) y `getSobreTiInsight()` que genera texto dinámico según streak, tendencia y promedio de los últimos 7 días.
- "Sobre ti" en home reemplaza texto estático por insight generado del historial real. Fallback si hay menos de 3 check-ins.
- `ViveMoodColors` agregado a `constants/theme.ts` (global, disponible para otras pantallas).

**Pendiente para la próxima sesión:**
- Verificar comportamiento del widget cuando el usuario no está logueado (debe llamar `requestAuth()` al tocar, no crashear).
- Considerar mostrar un mini historial de los últimos 7 días de mood en alguna pantalla de progreso o perfil.
- Google OAuth sigue pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 33)

**Tocado:** `scripts/add-saved-resources-rls.sql` (corrido en Supabase), SQL en `coach_availability` (INSERT directo desde SQL Editor), `app/diario.tsx`, `app/gratitud.tsx`, `app/search3.tsx`, `screens/BookingScreen_Calendar.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/recursos.tsx`

**Resumen:**
- Corrido el script RLS de `saved_resources` en Supabase — las 4 políticas quedaron activas.
- Investigado por qué el calendario de booking no mostraba fechas: toda la disponibilidad existente era solo de "Coach Prueba" y con fechas pasadas (junio). Confirmado con el dump completo de `coach_availability`.
- Cargada disponibilidad para todos los coaches: lunes a viernes, 6 slots diarios (09:00–17:00), del 7 al 31 de julio. Booking funciona correctamente después del INSERT.
- Batch fix de texto invisible (oliva sobre oliva): `diario.tsx`, `gratitud.tsx`, `search3.tsx` tenían `backgroundColor: '#565E32'` en tarjetas y encabezados — reemplazado por crema `rgba(255,248,240,0.80)` y `#F7EFE4`. Patrón recurrente del redesign previo que no se había limpiado.
- `BookingScreen_Calendar.tsx`: `dayTextSelected.color` era `'#565E32'` (oliva sobre terracota seleccionado) → corregido a `'#F7EFE4'`.
- `app/(tabs)/_layout.tsx`: canal realtime renombrado a `user-tab-dot-${user.id}` para evitar crash `cannot add postgres_changes callbacks after subscribe()`.
- `recursos.tsx`: color del ícono bookmark sin guardar corregido a `#87835C` (era casi invisible).

**Pendiente para la próxima sesión:**
- Verificar que el botón bookmark dentro de ScaleCard no dispara el onPress de la tarjeta en dispositivo físico.
- Home con exactamente 1 recurso guardado: decidir si se completa con un default o se muestra 1 card full-width.
- Google OAuth sigue sin funcionar en Expo Go (requiere dev build o configurar redirect URI en Supabase).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress` — pendiente implementar.

---

## 2026-07-01 — Joaquín (sesión 32)

**Tocado:** `app/(tabs)/recursos.tsx`, `app/(tabs)/index.tsx`, `scripts/add-saved-resources-rls.sql` (nuevo)

**Resumen:**
- Implementado `saved_resources`: cada herramienta en Recursos tiene ahora un botón bookmark (outline → filled al guardar). Optimistic update — respuesta inmediata sin esperar DB.
- Nueva sección "Mis recursos" en Recursos: aparece solo si hay algo guardado, con chips horizontales que muestran ícono + nombre + botón para quitar.
- Home ahora muestra los 2 últimos recursos guardados en "Recursos útiles" (dinámico desde Supabase). Si no hay ninguno guardado, sigue mostrando los defaults (Respiración + Gratitud). El botón "+" navega a la pestaña Recursos.
- Script `scripts/add-saved-resources-rls.sql` con las 4 políticas RLS necesarias — **hay que correrlo en el SQL Editor de Supabase antes de probar en producción**.

**Pendiente para la próxima sesión:**
- Correr `scripts/add-saved-resources-rls.sql` en Supabase Dashboard (aún no ejecutado).
- Probar en dispositivo físico: verificar que el bookmark dentro de la ScaleCard no dispara el onPress de la tarjeta.
- Home: si el usuario tiene exactamente 1 recurso guardado, "Recursos útiles" muestra 1 card (full width). Decidir si se prefiere completar con un default o dejarlo así.

---

## 2026-07-01 — Joaquín (sesión 31)

**Tocado:** `theme/tokens.ts` (nuevo), `constants/theme.ts`, `components/ui/AppBg.tsx`, `components/ui/GlassCard.tsx`, `components/ui/ProgressToggle.tsx`, `components/ui/VitaHeader.tsx`, `components/ui/SegmentedPill.tsx` (nuevo), `components/ui/IconChip.tsx` (nuevo), `components/ui/SectionTitle.tsx` (nuevo), `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `app/(tabs)/conexiones.tsx`, todos los screens en `screens/` (31 archivos), `app/progreso.tsx`, `app/search1.tsx`, `app/search2.tsx`, `app/search3.tsx`, `app/diario.tsx`, `app/gratitud.tsx`, `app/ia.tsx`, `scripts/apply_vita_theme.py` y v2/v3/v4.

**Resumen:**
- Rediseño visual completo de toda la app al sistema VITA: fondo crema cálido (LinearGradient `#F7EFE4→#EDE0CF`), texto oliva (`#565E32`/`#87835C`), acento terracota (`#C1694F`), glass cards con `rgba(255,248,240,0.55)` + border `rgba(255,255,255,0.65)`.
- Creado `theme/tokens.ts` con todos los tokens de diseño (colores, radii, blur, fonts). `ViveColors` actualizado para reflejar la nueva paleta.
- Todos los `rgba(255,255,255,X)` oscuros/semitransparentes reemplazados por equivalentes oliva; todos los `barStyle="light-content"` → `"dark-content"`. Overlays oscuros (`rgba(15,10,40,0.80)`) en footers de booking → crema opaca.
- Texto en avatares/botones coloreados (terracota, apple dark button) revertido correctamente a blanco. Texto en botones CTA oliva → crema `#F7EFE4`. Sin cambios en lógica, navegación ni datos.
- Commit: `ffd928e4` — pusheado a `origin` y `andre`.

**Pendiente para la próxima sesión:**
- Testing visual en dispositivo físico: verificar contraste en todos los estados (hover, selected, disabled) especialmente en chips de horario, dots de paginación y tab bar.
- Si Andre tiene pantallas propias (`ia.tsx`, video en ProfesionalScreen) verificar que el diseño nuevo se vea bien con su contenido.
- Decidir si usar `Fraunces_500Medium`/`_600SemiBold` además del `_700Bold` ya cargado, para afinar el wordmark.

---

## 2026-06-30 — Andre (sesión 30)

**Tocado:** `context/AuthContext.tsx`, `screens/LoginScreen.tsx`, `components/AuthModal.tsx`

**Resumen:**
- Bug reportado: explorando la app como usuario (botón "Quiero explorar la app" → `(tabs)` sin login) y después iniciando sesión con el email de un coach, la app crasheaba. Reproducido con captura del LogBox: `Uncaught (in promise) Error: Attempted to navigate before mounting the Root Layout component` en `LoginScreen.tsx:88`, más dos `Render Error` secundarios ("cannot add `postgres_changes` callbacks ... after `subscribe()`") en `(tabs)/_layout.tsx:112` y `(tabs)/index.tsx:114`.
- Causa raíz: `LoginScreen.tsx` y `AuthModal.tsx` hacían `router.replace('/(tabs)')` apenas el login era exitoso, sin mirar el rol de la cuenta. `app/_layout.tsx` tiene un `AuthRedirect` separado que escucha `user`/`role` y corrige a `/(coach)` si corresponde — pero como `AuthContext` actualizaba `user` y `role` en dos pasos (`setUser` primero, `await fetchRole()` después), `AuthRedirect` podía disparar su propio `replace('/(coach)')` casi al mismo tiempo que el `replace('/(tabs)')` explícito de la pantalla de login, dos navegaciones a destinos distintos pisándose. Los errores de `postgres_changes` eran consecuencia en cascada: el doble montaje/desmontaje de `(tabs)` por la pelea de navegación hacía que sus canales realtime (`'user-tab-dot'`, `notif-bell-*`) se intentaran resuscribir sobre un canal que ya estaba `subscribe()`d.
- Fix de raíz, no parche puntual:
  1. `AuthContext.tsx`: en el efecto inicial (`getSession`) y en `onAuthStateChange`, ahora se resuelve el rol (`await fetchRole(u.id)`) **antes** de llamar a `setRole`/`setUser`, y ambos se setean en el mismo tick — React los batchea en un solo render, así que `AuthRedirect` nunca ve un `user` ya logueado con un `role` todavía desactualizado.
  2. `LoginScreen.tsx` y `AuthModal.tsx`: se sacó el `router.replace('/(tabs)')` explícito post-login en ambos. Ahora `AuthRedirect` es la única fuente de verdad para a dónde navegar después de loguearse — ya tenía toda la lógica necesaria (`destination = role === 'coach' ? '/(coach)' : '/(tabs)'`), solo hacía falta dejar de competir con ella.
- `CoachLoginScreen.tsx` (login desde el flujo de postulación a coach) no tenía este bug — ya hace su propio chequeo de `profile.role` antes de navegar, en vez de delegar en `AuthRedirect`. No se tocó.
- Type-check limpio en los 3 archivos (`npx tsc --noEmit`).

**Pendiente para la próxima sesión:**
- No probado todavía en dispositivo real con un mail de coach real desde el flujo "explorar como usuario" — confirmar que ya no crashea y que aterriza directo en `(coach)` sin pasar visualmente por `(tabs)`.
- Si en el futuro vuelve a aparecer el error de `postgres_changes ... after subscribe()` en algún `_layout.tsx` sin que haya un crash de navegación de por medio, sospechar de Fast Refresh o de StrictMode montando el efecto dos veces — los nombres de canal (`'user-tab-dot'`, `'coach-tab-badge'`) no son únicos por instancia de mount, así que un doble-montaje real (no solo el de este bug) los rompería de la misma forma.

---

## 2026-06-30 — Andre (sesión 29)

**Tocado:** `screens/CoachProfileScreen.tsx`, `scripts/add-coaches-update-policy.sql` (nuevo, corrido en Supabase por Andre el 30/06/2026), `SCHEMA.md`

**Resumen:**
- Feature: el coach ahora puede fijar su precio por sesión desde su propio perfil. La sección "Precio y paquetes" antes solo mostraba `coaches.price_per_session` en modo lectura. Tocar la fila entra en modo edición inline (`TextInput` numérico con `$`, botones Guardar/Cancelar) y hace `update` a Supabase — mismo criterio de "edición in situ sin navegar a otra pantalla" que el video de perfil de la sesión 28.
- **Bug crítico encontrado al verificar el flujo completo (reportado por Andre: precio seteado en $10000 desde el perfil, pero en Conexiones seguía viendo $4500 para "Coach Prueba")**: la tabla `coaches` tiene RLS activado pero **nunca tuvo una política de UPDATE** — solo existía `coaches_insert_own` (FOR INSERT). Cualquier `update()` a `coaches` desde el cliente (precio, y también `video_url` de la sesión 28) afectaba 0 filas en silencio: Postgrest no devuelve `error` cuando RLS filtra todas las filas de un UPDATE sin `.select()` encadenado, así que el cliente creía haber guardado y actualizaba su estado local, pero la base nunca cambiaba. Confirmado con un script de diagnóstico (anon key, sin auth) que hizo `SELECT` directo a `coaches` y encontró `price_per_session: 4500` para "Coach Prueba" pese al cambio hecho desde la app.
- Fix de dos partes:
  1. `scripts/add-coaches-update-policy.sql` agrega `coaches_update_own` (FOR UPDATE, USING + WITH CHECK `profile_id = auth.uid()`). Corrido en Supabase por Andre el 30/06/2026.
  2. `savePrice()` y el `update` de `video_url` en `uploadVideo()` ahora encadenan `.select()` y chequean que `data` no esté vacío antes de considerar el guardado exitoso — así un futuro bloqueo de RLS se ve como error en la UI en vez de fallar en silencio.
- El precio no es editable si `noCoachProfile` es `true` (no existe fila en `coaches` para hacer `update`).
- `ProfesionalScreen.tsx` y `Conexiones` ya leen `price_per_session` fresco de Supabase en cada carga — no necesitaron cambios.
- `SCHEMA.md` regla 7 actualizada documentando el agujero de RLS y el fix.
- Type-check limpio (`npx tsc --noEmit`; los errores que tira el comando son preexistentes, de la carpeta duplicada `node_modules 2/wonka`, no relacionados).
- **Verificado end-to-end**: Andre seteó el precio en $11000 desde `CoachProfileScreen` con la cuenta de Coach Prueba; confirmado con un `SELECT` directo a Supabase (anon key, sin filtro) que `price_per_session` quedó en 11000 en la base — la política nueva funciona y el guardado ya persiste de verdad.

**Pendiente para la próxima sesión:**
- Mismo chequeo para video de perfil — re-subir un video y confirmar que `coaches.video_url` cambió de verdad en la base, no solo en el estado local (nunca se había verificado en dispositivo real desde que se agregó en la sesión 28, y tenía el mismo bug de RLS).
- El botón "Editar perfil" de esta misma pantalla sigue sin funcionalidad (no tiene `onPress`) — fuera de alcance de esta sesión.

---

## 2026-06-30 — Andre (sesión 28)

**Tocado:** `scripts/add-coach-video-upload.sql` (nuevo, corrido en Supabase), `app.json`, `lib/database.types.ts`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `package.json`, `SCHEMA.md`

**Resumen:**
- Feature nueva: el coach puede subir un video real (grabado o de galería) a su perfil, visible para cualquier usuario que vea su perfil público. Antes solo existía `coaches.application_video_url`, un link externo (YouTube/Drive) pegado una sola vez al postularse, nunca mostrado a nadie.
- Era una feature greenfield: no había Supabase Storage en uso en ningún lado del proyecto, ni libs de picker/video instaladas. Se sumaron `expo-image-picker`, `expo-video` y `expo-file-system` (SDK 54, versiones resueltas con `expo install`).
- Decisión de diseño: columna nueva `coaches.video_url`, separada de `application_video_url` — un reproductor nativo necesita una URL de archivo directa, no sirve un link de YouTube. `application_video_url` queda intacta como artefacto de revisión de postulación.
- `CoachProfileScreen.tsx`: botón "Grabar nuevo video" (antes un placeholder con `console.log`) ahora ofrece grabar o elegir de galería, sube a Supabase Storage (`coach-videos/{uid}/video.mp4`, `upsert:true` para no dejar huérfanos) y guarda la URL pública en `coaches.video_url`. Es el primer "guardar campo" real de esa pantalla — antes era de solo lectura salvo cerrar sesión.
- `ProfesionalScreen.tsx`: la sección "Video de introducción" (antes decorativa) ahora trae `video_url`, se oculta entera si el coach no subió nada, y reproduce con controles nativos (`expo-video`) al tocar el placeholder.
- `scripts/add-coach-video-upload.sql` corrido en Supabase por Andre el 30/06/2026 — agregó la columna `coaches.video_url`, el bucket `coach-videos` (público, 50MB, solo mime types de video) y la RLS para que cada coach solo pueda escribir su propia carpeta (`storage.foldername(name)[1] = auth.uid()::text`). `SCHEMA.md` actualizado con la regla 12 documentando esto.
- `app.json`: agregado el plugin `expo-image-picker` con los textos de permiso en español (cámara/galería/micrófono). El propio tooling de instalación sumó también `expo-video` al array de `plugins` — cambio de config nativa, hace falta un build nuevo de dev client (no alcanza con Expo Go ni un dev client viejo) para poder probar esto en el celular.
- `lib/database.types.ts`: sumado `video_url` al tipo `Coach`, y de paso `application_video_url` (ya existía en la base real pero faltaba en este tipo — deuda preexistente, se corrigió de una porque ya se estaba tocando el mismo tipo).
- Type-check limpio en los 5 archivos tocados (`npx tsc --noEmit`).

**Pendiente para la próxima sesión:**
- Generar un dev client nuevo (`eas build --profile development`) y probar en celular real (iOS y Android) — quedó explícitamente pospuesto para una sesión futura, no se hizo en esta. Probar: grabar/elegir video, ver el estado "Subiendo…", confirmar reproducción en `ProfesionalScreen`, re-subir un segundo video y confirmar en el Storage dashboard que no queda huérfano el archivo viejo.
- No verificado en esta sesión (sin dispositivo conectado): si el manejo en memoria de un video de ~60s causa lentitud en un Android viejo — si pasa, la salida es `FileSystem.uploadAsync()` (streaming a disco) en vez de cargar todo el archivo como `Uint8Array`.
- Confirmar adversarialmente que la RLS del bucket realmente bloquea a un coach de escribir en la carpeta de otro — es la única pieza de este cambio que no se pudo verificar sin ejecutar SQL real.

---

## 2026-06-30 — Andre (sesión 27)

**Tocado:** `scripts/expire-pending-bookings.sql` (nuevo), `SCHEMA.md`

**Resumen:**
- Bug reportado: cuando vence el plazo de 24hs para que un coach responda una solicitud, la tarjeta "Pendientes de respuesta" sigue apareciendo en `CoachReservasScreen.tsx` en vez de desaparecer.
- Causa: `hoursLeftToRespond()` calcula el countdown puramente en el cliente (`Math.max(0, ...)`) y nunca escribe en la base — `bookings.status` se queda en `'pendiente'` para siempre, clampeado en "0hs para responder" indefinidamente.
- Fix: nueva función `expire_pending_bookings()` en Supabase (agendada con `pg_cron` cada 5 minutos, mismo cadence que `complete_confirmed_sessions()`), que pasa a `'cancelada'` cualquier pendiente con más de 24hs y notifica al usuario (`type='reserva_rechazada'`, sin mensaje de sala ni push, igual alcance que el rechazo manual del coach).
- Corrida en Supabase por Andre el 30/06/2026. `SCHEMA.md` actualizado con la regla 11 documentando el comportamiento.
- No se tocó código de la app — el filtro `status === 'pendiente'` en `CoachReservasScreen.tsx` ya excluye automáticamente lo que la función pasa a `'cancelada'`, no hacía falta cambiar nada del lado cliente.

**Pendiente para la próxima sesión:**
- Confirmar en un caso real (o esperar a que pase una solicitud vieja) que la tarjeta efectivamente desaparece de "Pendientes de respuesta" tras los 5 minutos del próximo tick del cron.
- Evaluar si en algún momento conviene agregar push notification a este flujo (hoy no la tiene, a diferencia del rechazo manual que sí dispara push desde el cliente).

---

## 2026-06-30 — Andre (sesión 26)

**Tocado:** `app/(coach)/_layout.tsx`

**Resumen:**
- Ajuste fino del margen lateral del pill en `(coach)` (4 tabs tras sacar "Perfil" en la sesión 25): subir `left/right` de `44` a `56`/`70` no tenía ningún efecto visible en los íconos, aunque el fondo (`blurWrap`) sí se achicaba. Se diagnosticó con logs `[TABDEBUG-COACH]` temporales midiendo por separado el ancho del `blurWrap` y el de cada `tabItem` real.
- Causa raíz: la librería `@react-navigation/bottom-tabs` arma el contenedor real del tab bar con `start: 0, end: 0` (propiedades lógicas, conscientes de dirección de escritura) como base, y nuestro `tabBarStyle` solo sobreescribía `left`/`right` (propiedades físicas). Al ser ejes distintos para Yoga/RN, el override no cancelaba el valor lógico de forma confiable — el contenedor real de los botones quedaba con un ancho intermedio, inconsistente con el margen que pedíamos. Fix: agregar también `start`/`end` con los mismos valores en `styles.tabBar`.
- Ese fix expuso un segundo bug: `blurWrap` en `(coach)` tenía su propio `left/right` duplicado (en vez de llenar a su contenedor padre como hace `(tabs)` con `...StyleSheet.absoluteFillObject`). Una vez que el contenedor real empezó a achicarse correctamente, ese `left/right` duplicado lo volvía a achicar una segunda vez, dejando el pill demasiado angosto. Fix: `blurWrap` de `(coach)` ahora usa `...StyleSheet.absoluteFillObject` igual que `(tabs)`, sin redeclarar márgenes.
- Margen final: `56` (se había probado `70`, pero una vez arreglado el bug de fondo se sintió demasiado angosto).
- Tercer hallazgo: bajar `tabLabel.fontSize` de `11` a `10` (para que "Reservas"/"Recursos" no se truncaran con `numberOfLines={1}`) no se reflejó con Fast Refresh — quedó dos corridas seguidas con captura idéntica a pesar del valor correcto en disco. Hizo falta un hard reload completo (cerrar Expo Go y reabrir) para que tomara el cambio. Mismo patrón de "Fast Refresh no alcanza" que ya habíamos visto con cambios de layout en este mismo árbol de componentes (el tab bar de `@react-navigation/bottom-tabs`, con `Animated.View` internamente, parece no re-renderizar layout/texto de forma confiable solo con Fast Refresh).
- Confirmado por captura del usuario tras el hard reload: los 4 labels (`Inicio`, `Reservas`, `Chats`, `Recursos`) entran completos sin truncar, y los íconos quedaron visiblemente más agrupados.
- Logs `[TABDEBUG-COACH]` sacados del código una vez confirmado el fix.

**Pendiente para la próxima sesión:**
- Si en el futuro un cambio de estilo en este tab bar (`(tabs)` o `(coach)`) "no se ve" pese a estar guardado en disco y con un solo proceso de Metro corriendo, probar hard reload completo antes de seguir diagnosticando como si fuera un bug de código — ya pasó dos veces en esta sesión con este componente puntual.
- Nada commiteado todavía de esta sesión 26 — el commit `9d5141f6` (sesión 24) sigue sin pushear por el problema de credenciales de git mencionado en la sesión 25.

---

## 2026-06-30 — Andre (sesión 25)

**Tocado:** `app/(coach)/_layout.tsx`, `screens/CoachHomeScreen.tsx`

**Resumen:**
- Cierre de los ajustes visuales de la tab bar que quedaron pendientes de la sesión 24: `bottom` volvió de `60` (valor de prueba) a `24` en `(tabs)/_layout.tsx`, y se restauró `overflow: 'hidden'` en `tabBar` (estaba comentado por una prueba de diagnóstico de recorte de texto que ya no aplicaba, porque ese recorte era el bug de `tabBarIconStyle` de la sesión 24, no el `overflow`).
- En el camino se probó achicar fuente/padding/márgenes en `(coach)/_layout.tsx` para que "Reservas" y "Recursos" no partieran en dos líneas con 5 tabs — pero quedó obsoleto por el cambio de fondo de abajo.
- **Cambio de fondo:** se sacó el tab "Perfil" de la tab bar fija del coach (`app/(coach)/_layout.tsx`), mismo criterio que "Tu progreso" del lado usuario — es configuración de cuenta/negocio, no algo de uso diario. La tab bar de coach queda con 4 tabs: Inicio, Reservas, Chats, Recursos.
- Importante: no se borró el `Tabs.Screen name="perfil"` — se dejó declarado con `href: null`, seguiendo el patrón ya usado en `(tabs)/_layout.tsx` para el tab "Comunidad" (`explore`). Quitarlo del todo arriesgaba que Expo Router lo siguiera auto-generando como tab al existir el archivo de ruta `app/(coach)/perfil.tsx` en el mismo grupo.
- El acceso a Perfil pasó a un avatar circular en el header de `screens/CoachHomeScreen.tsx` (junto a la campana de notificaciones), replicando el patrón ya usado en `app/(tabs)/index.tsx`: `LinearGradient` con los mismos colores (`#FF9A52` → `ViveColors.primary`), `avatarCircle` 40×40, inicial de `coachName` en `ViveFonts.frauncesSerif`. No se creó componente compartido — se copiaron los estilos tal cual, siguiendo el criterio del proyecto de no abstraer hasta la tercera repetición.
- Con la tab bar de coach en 4 tabs (mismo número que el lado usuario), se revirtieron los ajustes de la iteración anterior: margen lateral del pill de vuelta a `44` (era `30`), `fontSize` del label de vuelta a `11` (era `10`), `paddingHorizontal` del `tabItem` de vuelta a `10` (era `4`) — para igualar el patrón ya probado del lado usuario. Quedó `numberOfLines={1}` en el label como red de seguridad adicional.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en el celular: posición del pill (`bottom: 24`), esquinas redondeadas del blur, labels de coach en una sola línea sin truncar, y que el avatar nuevo en el header de Inicio coach navegue bien a `/perfil`.
- Verificar que no haya quedado ningún otro lugar de la app que linkeara directo al tab "Perfil" por su posición en la barra (en vez de por ruta) — no se encontró ninguno al revisar el código, pero vale confirmarlo al testear.
- Sin commitear todavía — el commit de la sesión 24 (`9d5141f6`) no se pusheó porque el hook de auto-push de `.claude/settings.json` falló por falta de credenciales de git para GitHub en este entorno (`could not read Username for 'https://github.com'`). Sigue pendiente resolver eso o pushear manualmente.

---

## 2026-06-30 — Andre (sesión 24)

**Tocado:** `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug: tras agregar labels debajo de los íconos del tab bar (`TabIcon` ahora renderiza ícono + `<Text>{label}</Text>`), el ancho del ícono no cambiaba aunque se probó `alignSelf: 'stretch'` y luego `width: '100%'` en `tabBarIconContainerStyle`. Logs `[TABDEBUG]` mostraban siempre `w=30.999996185302734`, idéntico en cada corrida.
- Primer sospechoso descartado: procesos zombies de `expo start` (3 corriendo en paralelo desde hacía más de 2 semanas, uno de ellos en el puerto 8081 con `--no-dev`, sirviendo bundle de producción al celular sin recargar). Se mataron los 3 y se confirmó un único proceso limpio — el bug persistió igual, así que no era esto.
- Causa real: `tabBarIconContainerStyle` **no existe** como prop en `@react-navigation/bottom-tabs@7.18.0` (la librería detrás de `<Tabs>` de expo-router). Se verificó contra `node_modules/@react-navigation/bottom-tabs/src/types.tsx` — la prop válida es `tabBarIconStyle`. Como TS/JS no tira error por una key extra en un objeto, el valor nunca se conectaba a ningún `style` array de la librería; por eso ningún cambio (`stretch`, `100%`) tenía efecto.
- Fix: renombrado a `tabBarIconStyle` en `(tabs)/_layout.tsx`. Confirmado por el usuario que ahora sí funciona. Se encontró el mismo bug duplicado en `(coach)/_layout.tsx` (mismo patrón de `tabBarIconContainerStyle`) y se corrigió también ahí antes de commitear, para no dejarlo vivo en el otro layout.
- De paso, dentro de este mismo cambio se sacaron los labels nativos (`tabBarShowLabel: false`) y se renderizan manualmente dentro de `TabIcon` (ícono + `<Text>` con `ViveFonts.medium`), y se movió `tabBarStyle` (`bottom: 60`, `left/right: 44`) — pendiente confirmar visualmente que el pill quedó bien posicionado tras este ajuste.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en el celular que los labels debajo de los íconos se ven bien (tamaño, recorte, espaciado) y que el pill con los nuevos márgenes (`bottom: 60`, `left/right: 44`) no rompió el layout de la sesión 23.
- Quitar los `console.log('[TABDEBUG]...')` una vez confirmado visualmente — son solo diagnóstico, no deberían quedar en el código final.
- Si vuelve a aparecer un caso de "cambié el estilo y no pasa nada", chequear primero si la prop existe de verdad en el tipo de la librería antes de sospechar de cache/procesos — los tipos de `screenOptions` en este archivo no parecen estar forzando error de compilación ante keys inválidas, vale la pena revisar por qué.

---

## 2026-06-30 — Andre (sesión 23)

**Tocado:** `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug: la tab bar flotante (pill con blur) tocaba los bordes de la pantalla a pesar de tener `left: 44, right: 44` en `tabBarStyle`. Los márgenes no se aplicaban visualmente.
- Diagnóstico: test con `backgroundColor: 'rgba(100,0,200,0.8)'` confirmó que `tabBarStyle` posiciona correctamente el contenedor — el problema era exclusivamente el `BlurView` pasado a `tabBarBackground`. En React Navigation v7 (Expo Router v4 / SDK 54), `tabBarBackground` se renderiza en un layer separado que NO hereda los bounds del contenedor que tiene `tabBarStyle`; por eso `StyleSheet.absoluteFill` en el BlurView cubría el ancho total de pantalla en vez de confinarse al pill.
- Solución: envolver el `BlurView` en un `View` con `styles.blurWrap` — mismo `position: 'absolute'`, `bottom: 24`, `left: 44`, `right: 44`, `height: 64`, `borderRadius: 32`, `overflow: 'hidden'` — posicionado de forma absoluta dentro del layer de `tabBarBackground`, coincidiendo exactamente con los bounds del pill.
- Aplicado en ambos layouts (`(tabs)` y `(coach)`) ya que comparten el mismo patrón.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en celu que el blur ahora aparece con los márgenes correctos (y no full-width).
- Si en alguna pantalla futura se usa `tabBarBackground`, recordar aplicar el mismo wrapper en vez de pasar `absoluteFill` directo al BlurView.

---

## 2026-06-29 — Andre (sesión 22)

**Tocado:** `app/(tabs)/index.tsx`, `app/ia.tsx` (nuevo)

**Resumen:**
- Venn SVG pasó a solo contorno (`fill="none"`, `stroke="rgba(255,255,255,0.7)"`, `strokeWidth={1.5}`). Antes tenía relleno semitransparente de colores.
- Racha de semanas activas (`🔥 X semanas`) eliminada de la tarjeta "Sobre ti" del Inicio. La racha sigue viva en `app/progreso.tsx` y `screens/ProfileOwnScreen.tsx` — no se tocaron. El import de `getSemanasActivas` y el estado `semanasActivas` fueron removidos de index.tsx.
- El Venn se convirtió en botón que navega a `/ia` (`router.push('/ia')`). Se reemplazó la animación pulse por `activeOpacity={0.8}`. Debajo del Venn aparece el label "vita IA" en lugar de la racha.
- Creado `app/ia.tsx` como pantalla placeholder: título "vita IA" (fuente Fraunces), texto "Próximamente", fondo `AppBg`, botón de volver atrás.

**Pendiente para la próxima sesión:**
- Definir qué va en la pantalla vita IA — flujo de chat, resumen de perfil, recomendaciones IA, etc.
- Conectar el mensaje "Sobre ti" a datos reales (sigue hardcodeado).

---

## 2026-06-29 — Andre (sesión 21)

**Tocado:** `lib/stats.ts` (nuevo), `app/(tabs)/index.tsx`, `app/progreso.tsx`, `screens/ProfileOwnScreen.tsx`

**Resumen:**
- Creado `lib/stats.ts` con función `getSemanasActivas(userId)`: query sobre `bookings` con `status = 'completada'`, agrupa por semana ISO (timestamp / 7 días), retorna el tamaño del Set de semanas distintas. Semana activa = semana calendario con al menos una sesión completada.
- Reemplazados los tres hardcodeados (`🔥 0 semanas` en index, `value: 12` en progreso, `WEEKS_ON_STREAK = 12` en ProfileOwnScreen) por el número real proveniente de `getSemanasActivas`. Constante `WEEKS_ON_STREAK` eliminada.
- Los tres puntos de llamada usan la misma función utilitaria — la definición de "semana activa" vive en un solo lugar.

**Pendiente para la próxima sesión:**
- Conectar el mensaje "Sobre ti" a datos reales — actualmente sigue siendo texto hardcodeado en ambas pantallas. Requiere definir qué tabla/campo lo alimenta.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente sesiones anteriores).

---

## 2026-06-29 — Andre (sesión 20)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- Tarjeta "Sobre ti" hardcodeada del Inicio **reemplazada** por tarjeta con Venn interactivo + racha + mensaje. Layout horizontal: zona izquierda con diagrama de Venn SVG (3 círculos Cuerpo/Mente/Alma, colores naranja/verde/azul de la paleta) + "🔥 0 días" debajo; zona derecha con label "SOBRE TI" y mensaje.
- El Venn tiene animación pulse (scale 1.15 → spring back) al tocarlo — único elemento interactivo de la tarjeta.
- Racha muestra **"🔥 0 semanas"** como placeholder. La unidad es semanas activas, no días. La lógica real se calculará desde `bookings`: semanas consecutivas con al menos una sesión `completada` para el usuario. No existe esa query todavía.
- `screens/ProfileOwnScreen.tsx` no se tocó — la tarjeta del perfil queda exactamente como está.
- Nota: tanto el mensaje "Sobre ti" como las semanas en `ProfileOwnScreen` siguen siendo hardcodeados — no había datos reales de Supabase para ese campo.

**Pendiente para la próxima sesión:**
- Implementar lógica real de racha de semanas: query sobre `bookings` donde `status = 'completada'`, agrupar por semana ISO, contar semanas consecutivas hasta hoy. Mostrar "🔥 X semanas".
- Conectar el mensaje "Sobre ti" a datos reales — actualmente hardcodeado en ambas pantallas (Inicio y Perfil). Requiere definir qué tabla/campo lo alimenta antes de implementar.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente sesiones anteriores).

---

## 2026-06-29 — Andre (sesión 19)

**Tocado:** `app/(tabs)/index.tsx`, `screens/ProfileOwnScreen.tsx`

**Resumen:**
- "Tu progreso" (selector Hoy/Mes + tarjeta "Sobre ti") movido del Inicio al Perfil del usuario. Se insertó entre la sección de identidad y "Mi actividad". Constantes `WEEKS_ON_STREAK` y `SOBRE_TI_TEXT` definidas como módulo-level en `ProfileOwnScreen.tsx`, no como globales movidas.
- "Frase del día" eliminada como card independiente. La frase ahora aparece como texto integrado debajo del saludo (sin tarjeta, sin ícono), con `ViveFonts.regular` a 15px y opacidad 0.55.
- Código muerto en `index.tsx` eliminado completo: constantes, state `progressTab`, animaciones a2/a3 (renumeradas), ambos bloques JSX de progreso y frase, y todos los estilos asociados. No se tocó la base de datos.

**Pendiente para la próxima sesión:**
- `WEEKS_ON_STREAK` y `SOBRE_TI_TEXT` siguen hardcodeados — cuando se construya la lógica real de progreso, hay que reemplazarlos con queries reales.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente de sesión 18).

---

## 2026-06-29 — Joaquín (sesión 18)

**Tocado:** `app/(tabs)/index.tsx`, `screens/CoachProfileScreen.tsx`

**Resumen:**
- Realtime en campana de Home: reemplazado el fetch único por una suscripción Supabase Realtime filtrada por `recipient_id = user.id`. Cualquier INSERT/UPDATE/DELETE re-fetchea el count (head: true). El dot aparece/desaparece sin que el usuario salga de la pantalla.
- `CoachProfileScreen`: reemplazado el placeholder "Estadísticas / Próximamente" por un panel real de reseñas recibidas. Summary card (promedio + total), lista completa con avatar inicial, nombre, estrellas, fecha y comentario. Reviews privadas muestran ícono de candado. Estado vacío si no hay reseñas todavía.

**Pendiente para la próxima sesión:**
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push para que el tap handler del OS funcione end-to-end.
- Validar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach sobre el pill.
- `saved_resources`: decidir si se implementa una pantalla o se descarta la tabla.

---

## 2026-06-29 — Joaquín (sesión 17)

**Tocado:** `screens/UserNotificationsScreen.tsx` (nuevo), `app/notifications.tsx` (nuevo), `app/_layout.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- `UserNotificationsScreen`: lista todas las notificaciones del usuario. Íconos y colores por tipo. Tap en `invitacion_review` → `/review`; tap en otras con `booking_id` → resuelve `sala_id` desde `bookings` y navega a `/sala`. Marca como leídas al abrir.
- Home screen: campana en el top bar entre logo y avatar. Muestra `bell-outline` sin sin leer, `bell` filled + dot rojo `#E05252` cuando hay sin leer. Count vía query `head: true` (sin bajar data).
- Ruta `/notifications` registrada en `_layout.tsx`.

**Pendiente para la próxima sesión:**
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push para que el tap handler funcione end-to-end.
- El unread count de la campana no se refresca en tiempo real (solo al montar); si llega un push mientras la Home está abierta, el dot no aparece hasta que el usuario salga y vuelva. Agregar Realtime subscription si se quiere live.
- Confirmar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach.

---

## 2026-06-29 — Joaquín (sesión 16)

**Tocado:** `screens/ReviewScreen.tsx` (nuevo), `app/review.tsx` (nuevo), `app/_layout.tsx`, `screens/ProfesionalScreen.tsx`

**Resumen:**
- Pantalla `ReviewScreen`: permite al usuario crear o editar su review post-sesión. Recibe `booking_id`, resuelve el `coach_profile_id` vía `bookings.coach_id → coaches.id → coaches.profile_id`. Crea si no existe (INSERT); si ya existe la review para ese par reviewer/reviewed, edita solo `rating` y `comment` (respeta el trigger que bloquea cambiar `booking_id`).
- `ProfesionalScreen`: eliminado el array `REVIEWS` hardcodeado y el rating `4.9` del `DEFAULT_PROFESIONAL`. Ahora fetchea reviews reales (`is_private=false`) con nombres de reviewers en batch. Muestra promedio real; si no hay reseñas muestra un estado vacío elegante.
- `_layout.tsx`: agregado `addNotificationResponseReceivedListener` — si la push contiene `data.type === 'invitacion_review'` con `booking_id`, navega directo a `/review`. (Si el cron no envía data, el tap hace el comportamiento default del OS.)

**Pendiente para la próxima sesión:**
- Pantalla de notificaciones para el usuario (equivalente a `CoachNotificationsScreen` para el lado coach): listar todas las notificaciones, tap en `invitacion_review` → `/review?booking_id=xxx`. Actualmente el deep-link desde push funciona si el cron manda el data; si no, el usuario no tiene forma de llegar a ReviewScreen salvo desde push.
- Confirmar que `complete_confirmed_sessions()` incluye `booking_id` y `type` en el payload de push para que el tap handler funcione.
- Confirmar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach.

---

## 2026-06-27 — Joaquín (sesión 15)

**Tocado:** `app/(tabs)/index.tsx`, `.claude/settings.json`

**Resumen:**
- Bug fix: `index.tsx` navegaba a `/(tabs)/coaches` (ruta inexistente) en la card "sin próxima sesión". Corregido a `/(tabs)/conexiones`.
- Hook de sincronización automática configurado en `.claude/settings.json`: después de cada `git commit`, fetcha ambos remotes, mergea si hay cambios de Andre, y pushea a `origin` y `andre` en background.
- Revisión de los cambios de Andre (sesiones 14–18): tab bar glassmorphism, dot en "Mis salas", `TAB_BAR_CLEARANCE = 110`, `user_last_read_at`/`coach_last_read_at` en `salas`. Todo integrado sin regressions.

**Pendiente para la próxima sesión:**
- Agregar `specialty` del coach en cada row de "Mis salas" (`SessionsScreen`) — Andre lo marcó como diferido.
- Confirmar visualmente en dispositivo: pill de tab bar, dot de "Mis salas", botón "Cerrar sesión" de CoachProfileScreen sobre el pill.
- UI del flujo de reviews (sigue abierto desde sesión 23/06).

---

## 2026-06-27 — Joaquín (sesión 14)

**Tocado:** `screens/SalaScreen.tsx`, `screens/BookingScreen_Time.tsx`

**Resumen:**
- Bug fix: `SalaScreen.handleHeaderPress` no pasaba `profileId` al navegar a `/profesional`. Cuando el usuario tocaba el header del coach en la Sala e intentaba reservar, Calendar recibía `coachId: ''` y no podía fetchear disponibilidad — calendario vacío, botón "Seguimos" nunca habilitado. Fix: agregar `profileId: recipientId` en los params (el valor ya estaba disponible en el estado, solo no se pasaba). Como efecto secundario, `ProfesionalScreen` ahora también fetchea precio/specialty desde Supabase correctamente en este path.
- Fix visual: `BookingScreen_Time` usaba `<View>` como raíz (fondo transparente) en lugar de `<AppBg>`, diferenciándose visualmente de Calendar y Confirm. Reemplazado por `<AppBg>`.
- Pendiente de la sesión 8 cerrado: la cadena Calendar → Time de params ya estaba correcta; el problema real era el path SalaScreen → ProfesionalScreen, no el paso Calendar → Time en sí.

**Pendiente para la próxima sesión:**
- UI del flujo de reviews: pantalla para crear/editar review al llegar notificación `'invitacion_review'`, y display de rating promedio real en `ProfesionalScreen` (hoy usa mock hardcodeado).
- Decidir si el coach ve sus reviews recibidas en algún panel propio (`CoachProfileScreen` tiene un placeholder).
- Verificar en producción que el cron job `complete_confirmed_sessions()` dispara a los 20 minutos.

---
## 2026-06-25 — Claude (sesión 18)

**Tocado:** `constants/theme.ts`, `screens/CoachProfileScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `screens/CoachReservasScreen.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `screens/SessionsScreen.tsx`

**Resumen:**
- Diagnóstico: la tab bar flotante (`position: absolute`, `bottom: 24`, `height: 64`) ya no reserva espacio en el layout, por lo que los ScrollViews con contenido largo tapaban el último elemento detrás del pill.
- Constante `TAB_BAR_CLEARANCE = 110` agregada a `constants/theme.ts` (pill 88px + ~22px de aire). Un solo lugar para actualizar si cambia la altura del pill.
- 8 pantallas corregidas: las 5 screens de coach tabs (Perfil, Inicio, Chats, Recursos, Reservas) y 3 del lado usuario (tabs/index, tabs/recursos, SessionsScreen/mis-salas). Todas pasaron de 32–64px de clearance a 110px usando la constante.
- `conexiones.tsx` descartada: usa `paddingBottom: 100` en View no scrollable (solo ScrollViews horizontales), el pill a 88px no interfiere.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en dispositivo real que el botón "Cerrar sesión" de CoachProfileScreen (el caso original del bug) queda cómodo por encima del pill.
- Si en alguna pantalla el aire visual se siente excesivo (especialmente las que antes tenían 100px), se puede ajustar bajando `TAB_BAR_CLEARANCE` — pero hay un solo número para tocar.

---

## 2026-06-25 — Claude (sesión 17)

**Tocado:** `app/(coach)/_layout.tsx`, `app/_layout.tsx`

**Resumen:**
- Tab bar del coach migrada a glassmorphism flotante, idéntico al layout de usuario: `BlurView intensity={60} tint="light"`, pill `position: absolute`, `bottom: 24`, `left/right: 16`, `borderRadius: 32`, `overflow: hidden`.
- `TabIcon` con `activeBubble` (52×36px, `borderRadius: 18`, `rgba(255,255,255,0.25)`) duplicado directamente en `(coach)/_layout.tsx` — decisión explícita de no extraer componente compartido dado que solo hay dos layouts y son completamente distintos en lógica.
- `PendingBadge` en "Reservas" preservado sin cambios — el badge naranja sigue funcionando igual, ahora anclado dentro del `TabIcon`.
- Fix en `app/_layout.tsx`: faltaba `<Stack.Screen name="(coach)" options={{ headerShown: false }} />` — sin esto el grupo coach mostraba el header del Stack raíz.

**Pendiente para la próxima sesión:**
- Testear en dispositivo real (coach): confirmar blur, burbuja activa, badge de Reservas posicionado correctamente dentro del TabIcon.
- Confirmar con Joaquín si el color activo blanco en coach (igual al usuario) es correcto, o si prefieren mantener `ViveColors.primary` como tinte activo para diferenciar los dos modos.

---

## 2026-06-25 — Claude (sesión 16)

**Tocado:** `app/(tabs)/_layout.tsx`

**Resumen:**
- Tab bar rediseñada a estilo glassmorphism flotante: pill centrada con márgenes (16px laterales, 24px del borde inferior), `borderRadius: 32`, fondo glass con `<BlurView intensity={60} tint="light">` de `expo-blur` (ya estaba instalada).
- Tab activo con burbuja de fondo: `View` de 52×36px, `borderRadius: 18`, `rgba(255,255,255,0.25)` detrás del ícono — primer pase, pendiente ajuste fino con Joaquín.
- Todos los 4 tabs ahora usan el mismo estilo glass. El override anterior de "Conexiones" (fondo blanco sólido, colores terracota/verde) fue unificado. El código original queda comentado en el archivo para revertir en 3 líneas si Joaquín confirma que el estilo distinto era intencional.
- Dot de notificación de "Mis salas" preservado sin cambios de lógica; posición relativa intacta.

**Pendiente para la próxima sesión:**
- Testear en dispositivo: blur real (expo-blur no se ve en simulador), posición del pill, burbuja activa, dot sobre "Mis salas".
- Confirmar con Joaquín si Conexiones debe volver a tener estilo propio (fondo blanco sólido). Si sí, descomentar 3 líneas en `<Tabs.Screen name="conexiones">`.
- Posible ajuste de intensidad de blur (60), tamaño de burbuja (52×36), o color de burbuja según revisión visual conjunta.

---

## 2026-06-25 — Claude (sesión 15)

**Tocado:** `app/(tabs)/_layout.tsx`, `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Dot de "novedad" rojo (`#E05252`) sobre el ícono del tab "Mis salas". Se muestra cuando (a) hay mensajes de la otra persona más nuevos que `user_last_read_at` en cualquier sala del usuario, o (b) hay una sesión confirmada para hoy. Sin número, solo punto — decisión de tono de VITA (calma, sin ansiedad de notificaciones).
- Schema: `user_last_read_at` y `coach_last_read_at` (timestamptz, nullable) agregadas a `salas`. Backfill con `now()` al momento del ALTER TABLE para evitar dots falsos en salas existentes. Nuevo comportamiento: entrar a `SalaScreen` actualiza el campo correspondiente al rol del usuario, lo que dispara el listener realtime del layout y apaga el dot.
- Query del dot: 2 queries siempre (salas + mensajes acotados por min(last_read_at)), 3 si no hay unread y hay que chequear bookings de hoy. Nunca N+1 — escala a múltiples salas por usuario.
- Realtime: suscripción en `_layout.tsx` a INSERT en `messages`, UPDATE en `salas`, y `*` en `bookings`. Mismo patrón que el badge del layout de coaches.

**Pendiente para la próxima sesión:**
- Testear en dispositivo: dot aparece con mensaje nuevo, desaparece al entrar a la sala, reaparece con sesión de hoy.
- Agregar `specialty` del profesional en cada row de "Mis salas" (diferido desde sesión 14).

---

## 2026-06-25 — Claude (sesión 14)

**Tocado:** `app/(tabs)/mis-salas.tsx` (nuevo), `app/(tabs)/_layout.tsx`, `screens/SessionsScreen.tsx`

**Resumen:**
- Navegación cambiada de 3 tabs a 4 tabs: se revierte la decisión anterior de embeber "Mis salas" dentro de Inicio. Ahora hay tab fijo en posición 2 (Inicio → **Mis salas** → Recursos → Conexiones).
- `SessionsScreen.tsx` adaptado de pantalla de push a pantalla de tab: se quitó el botón de volver del header, se cambió el título a "Mis salas", se actualizó el copy del estado vacío al nuevo texto acordado, se limpiaron estilos y el import `Platform` que quedaron huérfanos.
- `app/(tabs)/mis-salas.tsx` creado como thin wrapper de `SessionsScreen` (mismo patrón que `app/sessions.tsx`).
- `app/sessions.tsx` queda como ruta huérfana en `/sessions` — no se borró, pendiente decisión del usuario (ver Pendiente).
- Sin cambios de schema ni base de datos — solo navegación/UI.

**Pendiente para la próxima sesión:**
- Decidir qué hacer con `app/sessions.tsx`: dejarlo como alias, redirigir a `/(tabs)/mis-salas`, o borrarlo.
- Agregar `specialty` del profesional en cada row de "Mis salas" (quedó diferido intencionalmente en esta sesión).
- Testear en dispositivo: tab bar de 4 items, navegación Mis salas → sala específica, estado vacío.

---

## 2026-06-25 — Joaquín (sesión 13)

**Tocado:** `app/(tabs)/index.tsx`, `app/progreso.tsx` (navegación), todos los archivos del fix de errores

**Resumen:**
- Pantalla **Progreso** conectada a la tarjeta "Sobre ti" del Home (navegación `/progreso`).
- Fix completo de todos los errores de TypeScript y lint de la app: 0 errores TS, 0 warnings lint. Ver commit d6dbe656 para detalle.
- Merge con `andre/main`: integrado `expo-blur` que Andre agregó + su entrada de auditoría en CHANGELOG. Ambos repos (`origin` y `andre`) quedaron sincronizados.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (abierto desde sesión 8).
- Testear visualmente en dispositivo Home + Progreso.

---

## 2026-06-25 — Joaquín (sesión 12)

**Tocado:** `app/progreso.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- Pantalla `/progreso` existente completada: conectada con datos reales de Supabase (historial de sesiones pasadas: bookings con `status='completada'` o `status='confirmada'` y fecha anterior a hoy, con coach name + specialty via `Promise.all`). El stat "Sesiones completadas" también viene de Supabase; semanas y áreas quedan como placeholders con TODO.
- Navegación del Home corregida: la tarjeta "Sobre ti" ahora apunta a `/progreso` en vez de `/sessions`.
- Sin cambios de schema ni de base de datos.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (abierto desde sesión 8).
- Testear visualmente Home + Progreso en dispositivo.

---

## 2026-06-25 — Joaquín (sesión 11)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- Rediseño completo del layout del Home screen para replicar la distribución de la imagen de referencia (app UMANO), manteniendo colores aurora/glass/palette de VITA intactos.
- 8 secciones nuevas: barra superior con logo "vita" izquierda + avatar circular derecha; saludo grande standalone; "Tu progreso" con toggle Hoy/Mes (estado local); tarjeta grande "Sobre ti" con `12 / Semanas` a la izquierda y texto descriptivo a la derecha; tarjeta "Frase del día" glass con ícono shimmer; sección "Recursos útiles" en fila horizontal con cards compactas (ícono circular + título + botón "+"); tarjeta "Tu próxima sesión" con especialidad del coach (nuevo fetch a tabla `coaches`); tarjeta "Para vos hoy" con label RECOMENDACIÓN + tipo + flecha.
- Nueva consulta a `coaches.specialty` vía `Promise.all` junto al fetch existente de `profiles.name`. No se tocó el schema.
- Todas las animaciones fadeUp/stagger conservadas; toda la navegación y lógica de Supabase intacta.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (sigue abierto desde sesión 8).
- Testear visualmente en dispositivo la nueva pantalla Home.

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

---

## 2026-06-25 — Andre (auditoría post-merge sesión 8)

**Tocado:** ningún archivo modificado (sesión de auditoría solamente)

**Resumen:**
- Auditoría completa de los 6 puntos críticos de la sesión 7 (Joaquín) post-merge
  glass de la sesión 8. Los 6 sobrevivieron intactos sin pérdidas:
  1. **Cancelación usuario/coach** — flujo y lógica preservados.
  2. **Columnas `cancelled_by` / `cancelled_late`** — presentes en schema y en código.
  3. **Mensajes de sistema** (incluyendo los 2 bugs resueltos en sesión 7) — código
     intacto, correcciones no revertidas por el merge.
  4. **Push notifications** — lógica y wiring sin cambios.
  5. **Archivos de coordinación** (`SCHEMA.md`, `CHANGELOG_SESIONES.md`) — consistentes
     con el estado real del código.
  6. **`lib/logging.ts`** y el chain `coachId`/`coachProfileId` — presentes y sin
     regresiones.

**Pendiente para la próxima sesión:**
- Ninguno abierto por esta auditoría; los pendientes vigentes son los de la sesión 8
  (panel coach con glass, params de BookingScreen_Time).

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
