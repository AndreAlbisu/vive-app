# Etiquetas de privacidad de las tiendas — Vita

Respuestas para las **App Privacy labels** de App Store Connect y el **Formulario
de seguridad de los datos** de Google Play Console. Armadas auditando `SCHEMA.md`,
el código y `app.json` el 06/08/2026. **Revisado el 04/10/2026** contra lo que la app recolecta hoy: se sumaron el documento de identidad, los datos de cobro, las credenciales y los errores de la app.

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
| **User Content › Photos or Videos** | `profiles.avatar_url` (bucket `avatars`); video de presentación del profesional; fotos del documento y selfie de la verificación de identidad (ver *Other Data*) | Sí | No | Funcionalidad de la app |
| **User Content › Audio Data** | audios que sube un profesional como recurso (`resource_proposals`) | Sí | No | Funcionalidad de la app |
| **User Content › Customer Support** | `reports` (reportes de usuarios/profesionales) | Sí | No | Soporte, moderación |
| **User Content › Other User Content** | mensajes (`messages`), diario (`journal_entries`), gratitud (`gratitude_entries`), reseñas (`reviews`), notas de sesión (`session_notes`), respuestas del quiz (`user_quiz_answers`) | Sí | No | Funcionalidad de la app |
| **Health & Fitness › Health** | **check-ins de estado de ánimo (`mood_entries`, `mood_suggestions`)** y hábitos (`user_habits`) | Sí | No | Funcionalidad de la app |
| **Sensitive Info** | contenido de diario y mensajes que puede revelar salud o vida emocional | Sí | No | Funcionalidad de la app |
| **Identifiers › User ID** | `profiles.id` / `auth.users.id` | Sí | No | Funcionalidad de la app |
| **Purchases › Purchase History** | `bookings` (reservas, montos, estados, `payment_id`) | Sí | No | Funcionalidad de la app |
| **Usage Data › Product Interaction** | `analytics_events`, `resource_events`, `resource_completions` | Sí | No | Analítica **propia** |
| **Other Data** | `profiles.push_token` (Expo), `birth_date`, `gender`, `nationality`; zona horaria del teléfono al reservar (`bookings.user_tz_observed`); de profesionales: **imágenes del documento de identidad y selfie** (bucket privado `identity-docs`, se borran al verificar), título y número de matrícula (`coach_credentials`), país y provincia de atención | Sí | No | Funcionalidad de la app |
| **Financial Info › Other Financial Info** | datos de cobro del profesional: CBU, alias, mail de PayPal, billetera (`coach_payout_accounts`) y la conexión con Mercado Pago | Sí | No | Funcionalidad de la app |
| **Diagnostics › Crash Data / Other Diagnostic Data** | errores de la app (`error_app` en `analytics_events`, desde el 23/09/2026): pantalla y mensaje técnico, sin contenido del usuario | Sí | No | Funcionalidad de la app, analítica **propia** |

### Datos NO recolectados — responder "No" explícitamente
- **Location** (ni precisa ni aproximada) — la app no usa `expo-location`, verificado. La **dirección IP** se usa solo para limitar intentos repetidos (`rate_limits`, se borra a los 2 días) y no se convierte en ubicación; la zona horaria tampoco es ubicación (va en *Other Data*).
- **Contacts** — no se accede a la agenda.
- **Browsing History**, **Search History** fuera de la app.
- **Financial Info › Payment Info** — ⚠️ **importante: los datos de tarjeta los recolecta Mercado Pago, no Vita.** El checkout ocurre en el flujo de Mercado Pago; la app **no almacena datos completos de tarjetas**, solo identificadores y estado de la transacción (eso va en *Purchase History*, no en *Payment Info*).
- **Diagnostics de terceros** — no hay Sentry ni Crashlytics. ⚠️ Pero **sí** se recolectan errores propios (`error_app`): están declarados arriba, en *Diagnostics*. Hasta el 04/10/2026 este documento decía "No" a secas, y eso era declarar de menos.
- **Advertising Data** — no hay publicidad.

### Permisos que pide la app (justificación, ya en `app.json`)
Declarados también en **Política §2.4** desde el 13/08/2026; tienen que decir lo mismo.
- **Cámara y Fotos** — foto de perfil y video de presentación del profesional (`expo-image-picker`, en `CoachProfileScreen` y `EditProfileScreen`).
- **Micrófono** — video de presentación y videollamadas.
- **Calendario** — **solo escritura**: agregar la sesión que el usuario decide agendar (`expo-calendar`, en `SessionsScreen` y `SalaScreen`). La app **no lee** los eventos existentes; conviene decirlo así en el formulario, porque "acceso al calendario" a secas suena a lectura.
- **Notificaciones** — recordatorios de sesión y avisos del servicio.

### Terceros que reciben datos, más allá de los encargados
Contrastado contra el código el 13/08/2026 y declarado en **Política §6**:
- **Google / Apple como proveedores de identidad** — solo si el usuario elige ese camino de alta (`expo-auth-session`, `expo-apple-authentication`).
- **YouTube** — hay un **reproductor embebido** en `app/coach-recurso.tsx` (`react-native-youtube-iframe`). Al cargarse, YouTube recibe IP y datos técnicos del dispositivo. ⚠️ Esto **sí** cuenta como compartir con un tercero en los dos formularios.
- ⚠️ **No confundir con los enlaces externos.** `ResourceDetailScreen` abre YouTube, Spotify y Google Drive con `Linking.openURL`: el usuario sale de la app y ahí no se comparte nada. Declararlos como destinatarios sería declarar de más.

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
| **Información personal › Otra info** (documento de identidad y selfie del profesional; título y matrícula) | Sí | No | Sí para profesionales | Funciones de la app, prevención de fraude |
| **Info financiera › Otra info financiera** (CBU, alias, PayPal o billetera del profesional) | Sí | No | Sí para profesionales | Funciones de la app |
| **Info y rendimiento de la app › Registros de fallos / Diagnóstico** (`error_app`) | Sí | No | Sí | Analítica, funciones de la app |

"Compartido = No" en todos: los proveedores (Supabase, Mercado Pago, PayPal, Daily.co,
Expo, Resend, Cloudflare y Anthropic, este último sin datos que identifiquen a la persona)
son **encargados de tratamiento que procesan por cuenta de Vita**, lo que
Google clasifica como procesamiento, no como compartir con terceros. La lista tiene que
ser la misma que la de Política §6.

### Prácticas de seguridad
- **¿Se cifran los datos en tránsito?** **Sí** — todo va por HTTPS (Supabase, Mercado Pago, Daily.co, Expo).
- **¿El usuario puede pedir la eliminación de sus datos?** **Sí** — desde la app (Perfil → Eliminar mi cuenta), escribiendo a `vitaappar@gmail.com` (Política §9), o desde la URL que exige Google: **`https://vitaapp.com.ar/legal/eliminar-cuenta`** (escrita el 13/08/2026, pendiente de publicar).
- **¿Se siguió el programa Play Families?** No aplica: la app es para mayores de 18 (T&C §3.1).

---

## Pendientes antes de completar los formularios

- [x] ~~**URL de eliminación de cuenta (Google).**~~ Página escrita y generada el 13/08/2026 (`docs/eliminar-cuenta.md` → `web/legal/eliminar-cuenta.html`): declara qué se borra y qué se conserva con su plazo, siguiendo Política §10. Queda cargar `https://vitaapp.com.ar/legal/eliminar-cuenta` en Play Console **cuando el sitio esté publicado** — ver `docs/hosting.md`.
- [x] ~~**Borrado de cuenta dentro de la app.**~~ Existe desde el 06/08/2026 (Perfil → Eliminar mi cuenta, función `delete-account`); revisado de punta a punta el 03 y 04/10/2026.
- [ ] **Revisar si el video de presentación puede considerarse dato biométrico**; en principio no, es contenido subido voluntariamente y público en el perfil.
- [ ] Confirmar que las respuestas coinciden con la Política antes de enviar.
