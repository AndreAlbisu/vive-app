# Etiquetas de privacidad de las tiendas — Vita

Respuestas para las **App Privacy labels** de App Store Connect y el **Formulario
de seguridad de los datos** de Google Play Console. Armadas auditando `SCHEMA.md`,
el código y `app.json` el 06/08/2026.

**Regla que no hay que romper:** esto tiene que ser consistente con
`docs/politica-de-privacidad.md`. Si cambia lo que recolecta la app, se actualizan
los tres: el código, la Política y este documento. **Declarar de menos es causal de
rechazo**, y en el caso de Apple también de baja posterior.

Dos criterios que se aplicaron en todo el documento:
- **"Vinculado a la identidad" = sí** en casi todo, porque cada fila está atada a
  `profiles.id` (= `auth.users.id`). No hay recolección anónima.
- **"Usado para seguimiento" (tracking) = NO en todo.** Vita no tiene SDK de
  publicidad, ni analítica de terceros, ni compartición con data brokers. Esto
  permite responder que **la app no hace tracking**, lo que evita el prompt de ATT
  en iOS. Mantenerlo así es una ventaja real: si algún día se suma un SDK de
  publicidad o analítica de terceros, esta respuesta cambia.

---

## Apple — App Privacy (App Store Connect)

### Datos recolectados

| Categoría Apple | Qué es en Vita | Vinculado | Tracking | Finalidad |
|---|---|---|---|---|
| **Contact Info › Email Address** | `profiles.email` (registro) | Sí | No | Funcionalidad de la app |
| **Contact Info › Name** | `profiles.name` | Sí | No | Funcionalidad de la app |
| **User Content › Photos or Videos** | `profiles.avatar_url` (bucket `avatars`); video de presentación del profesional | Sí | No | Funcionalidad de la app |
| **User Content › Audio Data** | audios que sube un profesional como recurso (`resource_proposals`) | Sí | No | Funcionalidad de la app |
| **User Content › Customer Support** | `reports` (reportes de usuarios/profesionales) | Sí | No | Soporte, moderación |
| **User Content › Other User Content** | mensajes (`messages`), diario (`journal_entries`), gratitud (`gratitude_entries`), reseñas (`reviews`), notas de sesión (`session_notes`), respuestas del quiz (`user_quiz_answers`) | Sí | No | Funcionalidad de la app |
| **Health & Fitness › Health** | **check-ins de estado de ánimo (`mood_entries`, `mood_suggestions`)** y hábitos (`user_habits`) | Sí | No | Funcionalidad de la app |
| **Sensitive Info** | contenido de diario y mensajes que puede revelar salud o vida emocional | Sí | No | Funcionalidad de la app |
| **Identifiers › User ID** | `profiles.id` / `auth.users.id` | Sí | No | Funcionalidad de la app |
| **Purchases › Purchase History** | `bookings` (reservas, montos, estados, `payment_id`) | Sí | No | Funcionalidad de la app |
| **Usage Data › Product Interaction** | `analytics_events`, `resource_events`, `resource_completions` | Sí | No | Analítica **propia** |
| **Other Data** | `profiles.push_token` (Expo), `birth_date`, `gender`, `nationality` | Sí | No | Funcionalidad de la app |

### Datos NO recolectados — responder "No" explícitamente
- **Location** (ni precisa ni aproximada) — la app no usa `expo-location`, verificado.
- **Contacts** — no se accede a la agenda.
- **Browsing History**, **Search History** fuera de la app.
- **Financial Info › Payment Info** — ⚠️ **importante: los datos de tarjeta los recolecta Mercado Pago, no Vita.** El checkout ocurre en el flujo de Mercado Pago; la app **no almacena datos completos de tarjetas**, solo identificadores y estado de la transacción (eso va en *Purchase History*, no en *Payment Info*).
- **Diagnostics / Crash Data** — no hay Sentry ni Crashlytics.
- **Advertising Data** — no hay publicidad.

### Permisos que pide la app (justificación, ya en `app.json`)
- **Cámara y Fotos** — foto de perfil y video de presentación del profesional.
- **Micrófono** — video de presentación y grabación de recursos de audio.
- **Calendario** — agregar las sesiones reservadas al calendario del usuario.
- **Notificaciones** — recordatorios de sesión y avisos del servicio.

---

## Google Play — Formulario de seguridad de los datos

### Recolectados y compartidos

| Tipo de dato (Google) | Recolectado | Compartido | Obligatorio | Finalidad |
|---|---|---|---|---|
| **Información personal › Nombre** | Sí | No | Sí | Funciones de la app |
| **Información personal › Dirección de correo** | Sí | No | Sí | Funciones de la app, gestión de cuenta |
| **Información personal › ID de usuario** | Sí | No | Sí | Funciones de la app |
| **Información personal › Otra info** (fecha de nacimiento, género, nacionalidad) | Sí | No | **No** (opcional) | Personalización |
| **Info financiera › Historial de compras** | Sí | No | Sí | Funciones de la app |
| **Salud y ejercicio › Info de salud** | Sí | No | **No** (opcional) | Funciones de la app, personalización |
| **Mensajes › Otros mensajes en la app** | Sí | No | **No** (opcional) | Funciones de la app |
| **Fotos y videos** | Sí | No | **No** (opcional) | Funciones de la app |
| **Archivos de audio › Grabaciones de voz o sonido** | Sí | No | **No** (opcional) | Funciones de la app |
| **Actividad en la app › Interacciones** | Sí | No | Sí | Analítica |

"Compartido = No" en todos: los proveedores (Supabase, Mercado Pago, Daily.co,
Expo) son **encargados de tratamiento que procesan por cuenta de Vita**, lo que
Google clasifica como procesamiento, no como compartir con terceros.

### Prácticas de seguridad
- **¿Se cifran los datos en tránsito?** **Sí** — todo va por HTTPS (Supabase, Mercado Pago, Daily.co, Expo).
- **¿El usuario puede pedir la eliminación de sus datos?** **Sí** — escribiendo a `vitaappar@gmail.com` (Política §9). ⚠️ **Google exige además una URL de solicitud de eliminación de cuenta**; hoy el mecanismo es solo por correo. Ver pendientes.
- **¿Se siguió el programa Play Families?** No aplica: la app es para mayores de 18 (T&C §3.1).

---

## Pendientes antes de completar los formularios

- [ ] **URL de eliminación de cuenta (Google).** Play exige una URL pública donde el usuario pueda pedir la baja de su cuenta y sus datos, incluso sin tener la app instalada. Hoy solo existe el correo. Se resuelve con una página simple junto a las de `web/legal/`.
- [ ] **⚠️ No hay borrado de cuenta dentro de la app.** Apple lo **exige** para cualquier app que permita crear cuenta (guideline 5.1.1(v)). Verificado: no existe esa función. **Esto sí bloquea la publicación en iOS** y es más grande que completar un formulario — hay que construirlo.
- [ ] **Revisar si el video de presentación puede considerarse dato biométrico**; en principio no, es contenido subido voluntariamente y público en el perfil.
- [ ] Confirmar que las respuestas coinciden con la Política antes de enviar.
