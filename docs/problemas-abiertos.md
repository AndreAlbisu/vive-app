# Problemas abiertos — registro con IDs estables

> **08/09/2026.** Consolida lo que salió de: los tres consejos asesores
> (`consejo-sofia.md` y los dos de esta sesión), la devolución de Mónica Grando,
> la primera prueba en dispositivo del piso de seguridad, y la auditoría de las
> 22 frases visibles.
>
> 🔴 **Los IDs son estables y sirven para hablar por número** (*"cerremos B2"*).
> Si algo se resuelve, se marca acá — no se borra.
>
> Marcado: ✅ **verificado contra el código o la base** · ⚠️ **hipótesis sin
> verificar** · 🔴 **sin solución conocida**.

---

## L. Lo que falta para lanzar — estado al 17/09/2026

> Consolida los "Pendiente" de las sesiones 238–251 del CHANGELOG, que estaban
> desparramados en doce entradas. **Actualizar esta tabla cuando algo se cierre**
> (marcar, no borrar). Lo que ya tiene ID en otra sección se referencia, no se
> duplica.

### L.1 — Bloquea el lanzamiento

| ID | Qué falta | Estado | Quién |
|---|---|---|---|
| **L1** | ~~**La videollamada nunca se ejercitó con dos personas adentro** (A5 prueba 2).~~ | ✅ **Cerrado 21/09.** Andre la hizo solo, con las dos puntas: cliente desde su iPhone (app) y coach desde la compu (`/sala?booking=…`, identificándose con el mail de `coach-prueba`). **Se vieron y se escucharon.** No hizo falta Joaquín: alcanza con un segundo dispositivo. | — |
| **L2** | ~~**La comisión real de MP** medida sobre un pago de verdad, no el de $1 (A5 prueba 3).~~ | ✅ **Cerrado 21/09.** No hizo falta el panel: se leyeron los pagos por la API de MP con el token del coach. Los tres pagos de $4.500 (`174555144528`, `174554303062`, `173787714415`) dan el mismo número, **4,30%**, no 4%. `MP_FEE_PCT_OBSERVED = 4.3`. El 4 viejo no estaba mal medido, estaba mal redondeado: sobre $1 la tarifa es 0,04 y los centavos tapan el 0,3. **La duda del IVA se cerró: ya lo incluye** (193,63 / 1,21 = 3,556% de 4.500). | — |
| **L3** | ~~**Prender `CHECKOUT_HABILITADO`** en `web/c/index.html`.~~ | ✅ **Prendido el 21/09**, una vez cerrados L1, L2, L6 y L39, que era de lo que dependía. ⚠️ **Queda vivo en el momento en que Vercel deployee**: `/c/<slug>` es una página pública, así que desde ese push cualquiera que tenga el link de un profesional puede identificarse y pagar. El `?probar=1` se dejó en la línea, sin efecto, como interruptor para volver atrás. | — |
| **L4** | ~~**DMARC de `vitaapp.com.ar`**~~ | ✅ **Cerrado 21/09.** `_dmarc` TXT = `v=DMARC1; p=none; rua=mailto:andrealbisu@gmail.com`, puesto con `vercel dns add` (record `rec_ed677faef43c7312ae8d842c`) y verificado resolviendo desde Google, Cloudflare y el autoritativo. Seguro de publicar porque DKIM ya alineaba: ver la nota de abajo. | — |
| **L5** | **Revisión del abogado** de Términos, Privacidad y Reembolsos (`LEGAL_IS_DRAFT = true`), con A.12 (§10.3) y la duda de si declarar Cloudflare/unpkg obliga a re-pedir consentimiento — que hoy no tiene mecanismo. | 🔴 Abierto. | Andre |
| **L6** | ~~**Nombre que ve el comprador en Mercado Pago.**~~ | ✅ **Cerrado 21/09, verificado contra un pago real con tarjeta.** El descriptor del pago `180226658676` dice **`MERPAGO*VITA`**. 🔴 La descripción vieja de esta fila estaba equivocada: decía que salía de la config de la cuenta de MP y no del código, y es al revés (el `collector` es la cuenta del coach, hay una por profesional, no existe config central). Se arregló mandando `statement_descriptor: 'VITA'` en la preferencia (`mp-create-payment` v51). Antes decía `MERPAGO*AUGUSTOUNSAIN`, el nombre personal del profesional. ⚠️ **El campo solo existe en pagos con TARJETA**: en los de dinero en cuenta viene vacío, así que un pago con saldo de MP no sirve para probar esto (se descubrió intentándolo). El prefijo `MERPAGO*` lo pone Mercado Pago y no se puede sacar. | — |
| **L7** | **Link de la App Store en `app_version_gate.store_url`** el día que se publique. Sin eso, la pantalla de versión vieja dice "Buscá Vita en la App Store" sin botón. | ⏸️ Espera la publicación. Lo carga Claude con un `update`. | — |

📌 **Sobre el DMARC (L4), por si hay que tocarlo de nuevo.** Los mails salen por
**Resend** desde `no-responder@vitaapp.com.ar` (`supabase/functions/_shared/email.ts`).
Antes de publicar la política se verificó que las dos firmas ya estaban y alineaban,
que es lo que hace que `p=none` no pueda romper nada: **DKIM** en
`resend._domainkey` (firma con `d=vitaapp.com.ar`, alineación directa) y **SPF** en
`send.vitaapp.com.ar` (`v=spf1 include:amazonses.com ~all`, que es el Return-Path de
Resend, alineado en modo relajado), más el MX de rebotes a `feedback-smtp.sa-east-1.amazonses.com`.

⚠️ **Los reportes pueden no llegar nunca, y no es un error de configuración.** El
`rua` apunta a una casilla de Gmail, y el RFC 7489 pide que el dominio de destino
publique una autorización (`vitaapp.com.ar._report._dmarc.gmail.com`) para aceptar
reportes de otro dominio. Verificado: **Gmail no la publica**, y no es algo que se
pueda crear desde acá. El valor de L4 está en el `p=none` publicado, no en los
informes. Se arregla solo el día que exista la casilla propia del dominio (**L33**).

📌 **Paso siguiente, cuando haya tráfico real:** con unas semanas de mails
entregados se puede endurecer a `p=quarantine`. No antes: sin volumen no hay con
qué darse cuenta si algo quedó afuera.

### L.2 — Limpiar la base antes de abrir

| ID | Qué falta | Estado |
|---|---|---|
| **L8** | **Correr `scripts/limpiar-datos-de-prueba.sql`** (coaches falsos, 24 reseñas falsas, 8 recursos `[SEED]` con dos rickrolls). | 🔴 No corrido. Antes: completar la lista `conservar` (hoy solo `andre`) y leer el control previo. |
| **L9** | **Qué hacer con las reservas que movieron plata**: USD 91 en PayPal reembolsados + 15 `aprobado`. Privacidad §10 promete conservarlas 10 años; hoy el script las excluye. | 🔴 Decisión de Andre. |
| **L10** | **Las 6 reservas confirmadas del 17 al 26/09**: mirar una por una si alguna es de una persona real. | 🔴 Abierto. Algunas ya vencen hoy. |
| **L11** | **Qué significa `verified = true`** — hoy lo tienen los 34 coaches. | 🟡 Decisión de Andre. |
| **L12** | Borrar a mano del storage `resource-audio/seed/*.mp3` y los videos de las cuentas de prueba. | 🟡 Después de L8. |
| **L13** | `coach-prueba` (A2) se queda hasta el lanzamiento y cobra $1 real: sacarlo en L8. | ⏸️ Decidido. |

### L.3 — Seguridad y cuidado

| ID | Qué falta | Estado |
|---|---|---|
| **L14** | **Acceso a crisis permanente y a un toque**, no dependiente del detector (D4). Hoy está en el perfil (y en Ajustes del coach desde el 17/09). | 🔴 Abierto el "a un toque". ✅ **Sesión 253: las líneas estaban mal** — la pantalla prometía 24 h y el Centro de Asistencia al Suicida atiende de 8 a 24; faltaba la línea nacional 24 h (0800-999-0091). Corregido en la app y en T&C §5.3, con aviso para quien está fuera de Argentina. Ver también D2, D5, D6. |
| **L15** | **La fecha de suspensión de un coach es pública por la API** (`coaches.suspendido_hasta`, legible con la anon key). Cerrarlo pide una vista o función para catálogo, ficha y `/c`. | ⚠️ Abierto (sesión 251). |
| **L16** | ~~**¿`/c/<slug>` muestra el perfil de un coach suspendido?**~~ | ✅ **Sesión 251**: sí lo mostraba, con botón de reservar. Corregido ahí, en la ficha de la app, en el mensaje de error y en `web-book` (que dejaba una sala huérfana). Probado con un coach real. |
| **L17** | **Edad y aceptación de Términos las escribe el cliente**: falsificables por su titular. Cerrarlo es moverlas a una edge function en el alta. | ⚠️ Abierto (`SCHEMA.md`). |
| **L40** | ~~**La pantalla de entrada puede quedarse cargando para siempre.**~~ | ✅ **Cerrado 21/09.** `getSession()` ahora corre contra un reloj de 8 s (`TOPE_SESION_MS` en `AuthContext`, helper `lib/conTope.ts` con 5 tests): si no contesta, se entra como visitante. **No desloguea a nadie** — la sesión sigue guardada y, si llega tarde o se refresca después, se aplica igual y la pantalla redirige sola. 📱 **Falta verlo en el teléfono**: se reproduce con el wifi conectado a una red sin internet, que es el caso que la promesa deja colgada (el modo avión no sirve: ahí la promesa rechaza, y esa rama ya andaba). |
| **L18** | **Vista pública del catálogo**: taparía `is_admin`, `birth_date` y `nationality` a `authenticated`. Mejora de A4, no agujero. | 🟡 Para Andre. |

### L.4 — Probar en el teléfono / navegador (hecho, no visto)

| ID | Qué | Origen |
|---|---|---|
| **L19** | ~~Una nota compartida por el coach aparece sola del lado del cliente.~~ | ✅ **Cerrado 21/09**, y probó más de lo que pedía: **al coach le aparecen las dos notas y al cliente solo la pública**, así que la privada no se filtra. Aparecen al instante (llegan empujadas a una pantalla ya abierta, a diferencia de abrir un chat, que es una carga fría). | 242 |
| **L20** | La app entera con el color nuevo de texto secundario (`#566245`, 38 archivos). | 242 |
| **L21** | Recorrido crítico con VoiceOver/TalkBack, sobre todo el calendario. | 242 |
| **L22** | Checkout web con `?probar=1`: sin el tilde de edad no pide código; después queda `age_confirmed = true`. | 241 |
| **L23** | Sanciones desde el celular: advertencia con captura adjunta, abrirla, levantarla; y un CBU en el chat que rebote y aparezca en Administración → Sanciones. | 242, 247 |
| **L24** | Versión mínima: `min_version = 9.9.9` en iOS, ver la pantalla de bloqueo, volver a `1.0.0`. | 245 |
| **L37** | **El recorrido de entrada con cuenta obligatoria** (sesión 255): bienvenida → bifurcación → "Quiero crecer" → registro con Google → tiene que aparecer "¿Cómo te gustaría empezar?". Repetir con mail (pasa por el código) y con una cuenta existente vía "Ya tengo cuenta" (tiene que ir directo a la app). Y **sin cuenta**, tocar "¿Necesitás ayuda ahora?" al pie del registro y del login: tiene que abrir las líneas de crisis. 📌 **De la bifurcación se sacó el 21/09 a pedido de Andre**, así que ahí ya no va. | 255 |
| **L39** | ~~**La videollamada en un iPhone, entrando desde la Sala.**~~ | ✅ **Cerrado 21/09: el arreglo de la sesión 260 anda.** Desde el iPhone abrió **Safari de verdad**, pidió permiso de cámara y micrófono, y la llamada entró. O sea que `Linking.openURL` en iOS hace lo que se esperaba y el bug que le pasa a Selia no nos pasa. | 260 |
| **L25** | ~~Primera corrida del cron de "tu profesional volvió"~~ | ✅ Verificado el 17/09: corre cada hora con 200 y `{"revisados":0}`; el borrado diario de avisos corrió con `DELETE 0`. |

### L.5 — No bloquea

| ID | Qué | Estado |
|---|---|---|
| **L41** | ~~🔊 **Los cuatro sonidos ambiente suenan mal.**~~ | ✅ **Resuelto el 21/09.** Pasaron de **mono 22 kHz 63 kbps** (sobre un corte ya comprimido a 31) a **estéreo 44,1 kHz 128 kbps**, encodeados una sola vez desde el original. Tres son grabaciones de Wikimedia Commons verificadas una por una (lluvia: valvalion, **CC BY 3.0, con crédito en pantalla**; bosque: nille y olas: earthcalling, los dos dominio público) y el ruido marrón se **genera**. El tramo de cada uno se eligió midiendo (`scripts/elegir-tramo.py`), no a oído. El bundle pasó de 2,6 MB a 4,5 MB. 📱 **Falta escucharlos**: se eligieron por licencia, specs y medición de estabilidad, no de oído. ⚠️ **Olas dura 34s** porque el original libre dura 40: se nota más el loop, y si aparece mejor fuente se reemplaza con el mismo script. |
| **L26** | Etiquetas de accesibilidad: **91 botones de solo ícono en 50 archivos**, la mayoría del lado del coach. | ⏸️ Por tandas. |
| **L27** | Placeholder del diario (`ViveColors.calm`, 3.39:1). Subirlo lo hace parecer texto ya escrito. | 🟡 Decisión de Andre. |
| **L28** | Migrar los 30 `FOREST_SOFT` copiados a mano a `ViveColors.softInk`. | ⏸️ Mecánico. |
| **L29** | El panel del coach dice "N sesiones completadas" y cuenta **personas distintas**. Corregir el texto o el número. | 🟡 Decisión. |
| **L30** | Dónde se pide la fecha de nacimiento (sin ella el coach nunca ve la edad). No en la reserva. | 🟡 Decisión. |
| **L31** | Detección de contacto del lado del servidor: es finalidad nueva bajo Ley 25.326, primero va a la Política. | ⏸️ A propósito. |
| **L32** | `scripts/diagnostico-fuga.sql` y `scripts/sync-legal.mjs` tienen encabezados desactualizados. | 🟡 Menor. |
| **L33** | Casilla propia en `vitaapp.com.ar`: si se crea, cambiarla en `lib/contacto.ts`, `admin-actions` y `constants/legal.ts` a la vez. | ⏸️ |
| **L34** | Voz y producto: B1, B4, C4, E1–E6, y **F** (cero usuarios reales: la prueba de la tarjeta con 5–10 personas). | Ver secciones. |
| **L35** | 🔴 **Re-verificar las líneas de crisis antes de cada publicación** (`screens/AyudaScreen.tsx` y T&C §5.3). Los horarios cambian; un número muerto ahí es peor que no ponerlo. Fuentes en el CHANGELOG, sesión 253. | ⏸️ En cada publicación. |
| **L38** | **Cuenta de prueba para la revisión de Apple y Google.** Con registro obligatorio al entrar, los revisores no pueden ver nada sin una cuenta: hay que darles usuario y contraseña en el formulario de envío. | ⏸️ Al publicar. |
| **L36** | Selia (competidor colombiano, `docs/competencia-selia.md`, **versión 4**: FODA + §24 con las 138 reseñas de sus tiendas): que lo lea Joaquín. Cambia la urgencia de lanzar, no el rumbo. | 🟡 |

📌 **Cerrado desde la lista del 16/09** (no repetir): la escalera de sanciones está corrida en producción y `admin-actions` v30 deployada; la gente ya recibe aviso cuando su profesional cae y cuando vuelve; a un coach suspendido ya no se le puede reservar por ningún camino; Cloudflare y unpkg están declarados; contraste, afirmaciones sin respaldo y foco de teclado en la web, hechos.

---

## M. Lo que Vita toma de Selia — plan del 17/09/2026

> Sale de `docs/competencia-selia.md` §19–23. Andre (17/09): *"anotá todo, y
> completemos todo"*. Antes de escribir se verificó qué ya existía en la app, para
> no rehacer nada: "Reservar próxima sesión" al terminar la sesión **ya existe**
> (`SalaScreen`), igual que reservar de nuevo desde Mensajes (`SessionsScreen`).
>
> **No reemplaza a la sección L**: lo que bloquea el lanzamiento sigue siendo L1–L5.
>
> 📌 **Ampliado en la sesión 260** con lo que salió de leer las 138 reseñas públicas de las tiendas de Selia
> (`competencia-selia.md` §24): M15, M16, M17, M18. A diferencia de todo lo anterior de esta sección, que salía
> de mirar su producto, esto sale de sus **usuarios reales diciendo qué les falló**.

### M.1 — Antes de lanzar (chico, de alto impacto)

| ID | Qué | Por qué (Selia) | Estado |
|---|---|---|---|
| **M1** | **Decir por qué se recomienda a cada profesional** en los resultados del quiz | Selia explica cada match; baja el miedo a elegir | ✅ 17/09. Ya había una frase, pero mentía cuando el quiz aflojaba filtros en silencio, y decidía "psicólogo" por texto libre (mismo defecto que el buscador el 03/09). Ahora cada tarjeta dice lo que cumple y lo que no (`lib/quizMatch.ts`, 9 tests), y la regla de tipo vive en `lib/tipoProfesional.ts`, compartida con el buscador. ⚠️ Los rangos de presupuesto ($5.000 / $10.000) quedan hasta tener precios reales |
| **M2** | **Salida si ninguno convence** al final del quiz: ver otras opciones y volver a responder | Su red de seguridad (rehacer matching, orientación) | ✅ 17/09. De a 3, "Ver otras opciones", "Cambiar mis respuestas" (vuelve con lo elegido marcado) y "Ver todos los profesionales". Solo muestra perfiles que trabajan el tema |
| **M3** | **"Avisame cuando tenga horarios"** cuando un profesional no tiene turnos | Su "Solicitar disponibilidad" | ✅ 17/09. Tabla `availability_waitlist`, edge function `availability-notices` con cron horario, probado de punta a punta en producción. Ver SCHEMA.md. 📱 Falta verlo en el teléfono |
| **M4** | **Calificar la videollamada aparte** del profesional en la reseña | Separa falla técnica de insatisfacción; sirve para L1 | ✅ 17/09. Tabla privada `session_call_feedback`, pregunta opcional en `ReviewScreen`. ⚠️ "No pude entrar" casi nunca llega por acá (la reseña exige sesión completada): ver SCHEMA.md. 📱 Falta verlo en el teléfono |
| **M14** | **Cómo trabaja el profesional**: estilo (en palabras de la persona) y enfoque (la escuela) | Observación de Andre sobre el quiz de Selia: además de preguntar si querés un psicólogo, pregunta **qué tipo de acompañamiento** querés (su "enfoque", opcional, `competencia-selia.md` §4.a) | ✅ 17/09. `coaches.estilo` + `coaches.enfoques` (ver SCHEMA.md, corridas y probadas con rollback), pantalla "Cómo trabajo" del profesional, cuarta pregunta del quiz y sección nueva en el perfil público. `lib/enfoque.ts`, 20 tests. ⚠️ El estilo ordena y explica, **nunca filtra**. ⚠️ La respuesta del quiz no se persiste: vale para esa corrida. 📱 Falta verlo en el teléfono. 🔒 La escuela pide matrícula verificada (trigger en la base, probado con revocación incluida). ➕ **Ampliado el 21/09** (decisión de Andre sobre lo que hace Selia): el quiz pasa a 7 preguntas (suma cuánto te guíen, hacia dónde mirar y género del profesional), resumen editable antes de los resultados, las respuestas se guardan (`user_quiz_answers`), la escuela cuenta como tendencia cuando el profesional no contestó, y "Cómo trabajo" suma las dos preguntas nuevas. Sigue sin filtrar ni poner rótulos. ⚠️ Revisar la tabla de tendencias por escuela con un profesional. ➕ **Segunda vuelta el 21/09**: tema en dos niveles (hasta 2 áreas y hasta 3 temas concretos, que son los mismos de `coach_topics`), y con nutricionista se saltean las preguntas de cómo trabaja. 🔴 Al compararlo apareció que **al quiz le faltaban 8 temas que los profesionales sí usan** (Duelo, Burnout, Sexualidad…): quien trabajaba solo eso no aparecía nunca. Arreglado, y ahora un test lo controla. 🔴 **Regla: "crisis" nunca es un tema del quiz** (Selia lo tiene): esa respuesta lleva a Ayuda, no a una lista con precios. ➕ **Tercera vuelta el 21/09**: presupuesto con barra; "Cómo trabajás" obligatorio en la postulación (y pendiente en la visibilidad de quien ya estaba); la opción del medio cuenta menos que la exacta y "sobre qué trabajás" va hasta 2, para que marcar todo no convenga; y **el mazo de Profesionales usa el quiz como una barra más** (cada tarjeta sortea primero entre los que encajan, sin ordenar por puntaje, y muestra el motivo), además de destacar en el menú el tema del quiz sin abrir el mazo. 📱 Falta verlo en el teléfono |

| **M15** | **Reagendar.** Hoy solo se puede cancelar, y quien no puede ir pierde la plata. | §24.3 de `competencia-selia.md`: la queja más razonada de su App Store. Y **Selia está mejor que nosotros acá**: deja mover con más de 24hs. | ✅ **DECIDIDO por Andre el 21/09: libre fuera de las 24hs, una sola vez adentro.** Con más de 24hs el cliente mueve la sesión a cualquier horario libre del profesional sin perder el pago. Dentro de las 24hs puede pedirlo **una vez** y el profesional acepta o no. 🏗️ **Construido el 21/09**, falta verlo en el teléfono: regla pura (`lib/reagendar.ts`, 18 tests), base y funciones (`scripts/add-reagendar.sql`, probadas con rollback), botón "Mover la sesión" en la Sala del cliente, el calendario y el horario reusados con el parámetro `reagendar`, y la tarjeta de aceptar o rechazar en las reservas del profesional. |
| **M16** | **Si el profesional mueve la sesión.** | La queja más furiosa contra Selia: el especialista reagenda a un horario que el paciente no puede y el paciente pierde igual. | ✅ **DECIDIDO por Andre el 21/09: el profesional PROPONE y el cliente ELIGE.** El profesional ofrece horarios; el cliente toma uno o pide que le devuelvan la plata. Nunca se le impone un horario. 🏗️ **Construido el 21/09**, falta verlo en el teléfono. `scripts/add-proponer-horarios.sql` (corrido, probado con rollback): `proponer_horarios` (hasta 3, reemplaza la tanda anterior), `elegir_horario` (el cliente toma una) y `rechazar_horarios` (no puede con ninguna: se cancela y **le vuelve la plata aunque sea tardía**, porque se escribe `cancelled_by = 'coach'`). En la app: el menú "⋯" del profesional pasa a decir **"Proponer otro horario"** en vez del "llega pronto" que estuvo ahí hasta hoy, y el cliente ve las opciones en la Sala. |

### M.2 — Primer mes después de lanzar

| ID | Qué | Por qué | Estado |
|---|---|---|---|
| **M5** | **Cambio de profesional sin culpa** después de la primera sesión | Su "¿Querés continuar con este especialista?" + sesión sin costo con otro | ✅ **DECIDIDO por Andre el 21/09: o reintegro o cambio, no los dos.** Si la primera sesión no convenció, la persona elige: le vuelve la plata (garantía de T&C §9.3) **o** la usa con otro profesional. Una sesión pagada no puede rendir dos. 🔴 **Al construirlo apareció que la versión de Selia no se puede pagar con nuestros rieles**: con MP el pago va directo a la cuenta del profesional, así que Vita no tiene de dónde sacar una sesión gratis con otro. Andre eligió la versión que sí se puede: **preguntar y dar dos salidas**, el reintegro de §9.3 (que ya devuelve todo) o ver otros profesionales. 🏗️ **Construido el 21/09**: la tarjeta de fin de sesión ahora ofrece las dos, y **la garantía se pide desde la app** (`guarantee-claim` con `solicitar`), no por mail. Falta verlo en el teléfono. |
| **M6** | **Próxima sesión sugerida por el profesional** ("en una semana") | Su "Próxima sesión sugerida"; refuerza la anti-fuga n.º 1 | ✅ 17/09. Tabla `next_session_suggestions` (ver SCHEMA.md) + app: tarjeta con las cinco opciones para el profesional al terminar la sesión, la sugerencia se lee en la tarjeta de cierre del cliente, y `/booking-calendar` abre en ese día y lo marca (queda elegido solo si hay horario libre). `lib/proximaSesion.ts`, 13 tests. 📱 Falta verlo en el teléfono |
| **M7** | **Referidos** con descuento pagado de la comisión de Vita | Su 50% al amigo + créditos | ✅ **DECIDIDO por Andre el 21/09: descuento para el que llega, nada para el que invita.** Baja la barrera justo donde está el miedo a probar, y cuesta la mitad por alta que premiar a los dos. Sale de la comisión de Vita, nunca del bolsillo del profesional. 🏗️ **Construido el 21/09**: **10%**, elegido entre 10/15/20 mirando la cuenta sobre una sesión de $7.000. Base y funciones corridas y probadas, y `mp-create-payment` v52 ya lo aplica bajando el precio y la comisión a la vez. ✅ **Parte visible hecha el 21/09**: sección "Invitar a alguien" en el Perfil (el código propio se comparte con un toque, y quien recién llega puede escribir el de otro), y el checkout **muestra el precio ya con el descuento** más la línea que explica por qué. ⚠️ **Sigue sin estar en PayPal ni USDT**: ahí el precio se cobra entero. |

### M.3 — Cuando haya gente usando la app

| ID | Qué | Nota |
|---|---|---|
| **M8** | **Paquetes de sesiones** | Empezar por PayPal y USDT, donde Vita retiene la plata (con MP va al profesional) |
| **M9** | **Tests gratis en la web** (ansiedad, ánimo) que terminen en el quiz | Para Google. "Vita guía, no diagnostica"; derivar a Ayuda si el resultado es alto |
| **M10** | ~~**Preparar la sesión**~~ **YA EXISTE**: es el "paquete para la sesión" (`docs/paquete-para-la-sesion.md`, `lib/paquete.ts`, `app/paquete.tsx`, `components/OfrecerPaqueteBanner.tsx`), construido y probado en dispositivo | No hay que construirlo. Lo que sigue abierto es la **decisión de Andre del 14/09**: si se invierte el origen del material ("anotar para la sesión" en el momento, en vez de check-ins), y si el diario entra o la nota alcanza. Ver §9 de ese doc |
| **M11** | **Empresas** | Cuando haya usuarios y reseñas para mostrar |
| **M17** | **Recordatorio para llenar el diario** | Pedido textual de un usuario de Selia de 5 estrellas (§24.2): *"me gustaría que tuviera una opción de recordatorio para llenar el diario"*. Es un pedido ya validado y gratis. Existe `lib/resourceReminders.ts` para recursos, no para el diario |
| **M19** | **Terapia de pareja, familiar e infanto-juvenil** | Selia pregunta el tipo de terapia antes que nada (21/09). Pide: que el profesional lo declare, sesiones con dos personas en la sala, y para menores el consentimiento de los adultos responsables (legal). No es solo una pregunta más del quiz |
| **M20** | **Acompañamiento afirmativo LGBTQ+** | Opción de Selia en "qué te gustaría lograr" (21/09). Marca que declara el profesional sobre sí mismo + pregunta opcional en el quiz. Barato; a quien lo necesita le cambia todo |
| **M21** | **Búsqueda describiendo lo que te pasa** (la "búsqueda inteligente" de Selia) | Podría ser Sofía. 🔒 Antes: el texto es dato de salud y viajaría a un modelo fuera del país (ver `transferencias-internacionales.md`) |
| **M18** | **Bajarse los archivos que manda el profesional por el chat** | Queja de Selia (§24.3): hay que abrir la web para descargarlos. ⚠️ **Falta confirmar si nos aplica**: no se verificó si la Sala de Vita permite adjuntos |

### M.4 — Fuera de la app

| ID | Qué | Nota |
|---|---|---|
| **M12** | **Página de una hoja para profesionales** comparando condiciones | `competencia-selia.md` §23.2 c. Lo único útil sin usuarios |
| **M13** | **Escribir en T&C que no hay costo de alta** para profesionales | Antes de prometerlo en M12 |

### M.5 — Descartado a propósito (no re-proponer sin algo nuevo)

Notas automáticas grabando la sesión (datos de salud, equipo de dos) · cuentas familiares (Vita es 18+) · terapia grupal (con grupales Apple exige su sistema de pago, 3.1.3(d)) · psiquiatría y orientación humana de 15 minutos (no escalan para dos).

---

## A. Exposición — no es producto, es riesgo vivo

**Nada de las secciones B–F vale más que esto.** La revisión de ejecutabilidad
lo dijo así: *"las cinco respuestas debaten calidad de frases mientras hay riesgo
de seguridad y plata real corriendo sin auditar"*. Un equipo grande paraleliza;
dos hermanos no.

| ID | Problema | Solución | Costo |
|---|---|---|---|
| **A1** | ⏭️ **ASIGNADO A JOAQUÍN el 08/09** (device review). 🔴 **Dos de las tres ramas del piso de seguridad nunca se probaron.** Es la única feature que le habla a alguien en crisis. ✅ El 07/09 una hora de teléfono encontró un bug que **540 tests no vieron** (le prometía una sesión inexistente), porque el bug no estaba en una función sino en la relación entre dos partes de una pantalla. | Forzar los dos casos que faltan: sin ninguna sesión, y con una agendada. | 15 min |
| **A2** | ⏸️ **DECIDIDO el 08/09: se queda hasta el lanzamiento.** Es **"Coach Prueba"** (`e58d2ec3`, especialidad *"Especialidad de prueba"*), `verified` y `activo`, con MP conectado y `price_per_session = 1` — `mp-create-payment` deriva el precio de esa columna, así que cobraría $1 real. **Andre lo deja porque hace falta un coach para ejercitar los flujos, y con cero usuarios el riesgo es cero.** 🔴 **El riesgo no es tenerlo: es olvidárselo el día que abran** — y ya llevaba varias sesiones apareciendo en "pendiente" sin que eso lo moviera. | ✅ **Mitigado, no resuelto: `scripts/verificar-pre-lanzamiento.sql`** (solo lectura, 5 chequeos, devuelve filas solo si hay problema). Correrlo con la service key **antes de dejar entrar a la primera persona** deja de depender de que alguien se acuerde. | — |
| **A4** | ⏭️ **ASIGNADO A JOAQUÍN el 08/09.** 🔴 **`authenticated` puede leer las 17 columnas de `profiles` de TODOS los coaches** — mail y `push_token` incluidos. El agujero que se cerró para `anon` ese mismo día **está a un registro de distancia**. | No es de dos líneas: hay que mover al servidor el envío de push (client-side en 6 lugares) y la lectura de mails del panel, y después una vista pública para el catálogo. **Receta abajo.** | Media sesión larga |
| **A5** | 📌 **17/09: prueba 1 cerrada (11/09); pruebas 2 y 3 y el DMARC siguen abiertos → L1, L2, L4.** ⏭️ **ASIGNADO A JOAQUÍN el 09/09.** 🔴 **El camino del cliente #1 está construido entero y hay tres cosas que solo se prueban con un teléfono y plata.** Sin eso no se puede prender `CHECKOUT_HABILITADO`. | Tres pruebas cortas. **Receta abajo.** | Una hora, más la del 18 |
| **A3** | ✅ **RESUELTA el 13/09/2026: la columna ES nullable, así que el guard es NECESARIO.** `information_schema.columns` sobre `public.coaches` devuelve `price_per_session` → `numeric`, **`is_nullable = YES`, sin default** (y `price_usd` igual). Es exactamente la condición que el propio comentario de `app/search3.tsx` nombraba como *"un crash esperando al primer coach sin precio"*: sin el guard, `.toLocaleString()` sobre null revienta la tarjeta. 📌 Hoy **no dispara** —0 de 34 filas en null, medido el 07/09— pero nada lo impide: no hay `NOT NULL` ni default, y el alta de coach no exige precio. 📌 **Cómo se resolvió sin service key**: `npx supabase db query --linked`, que ejecuta SQL contra producción con el login del CLI — la nota de que "el endpoint OpenAPI de PostgREST exige `service_role`" era cierta pero había otro camino. | ✅ Hecha. | — |

### A1 — receta para Joaquín (device review del piso de seguridad)

> **HECHO (09/09, Joaquín) — CERRADO.** Se probaron en dispositivo los TRES
> estados, y los tres consistentes con la sección "Tu próxima sesión" de abajo
> (que es donde vivía el bug del 07/09):
> · Estado 1 (completada esta semana, ninguna agendada) → *"Eso es de lo que
>   conviene hablar en sesión"*, abre `/ayuda`. ✅
> · Estado 2 (confirmada futura) → *"Llevalo a tu próxima sesión"* y abajo aparece
>   esa sesión — el estado que **no había visto nadie**. ✅
> · Estado 3 (ni confirmada futura ni completada en 7 días) → *"Hay gente
>   preparada para acompañar esto"*, vacío abajo. ✅
> El bug del 07/09 (la tarjeta contradiciendo la sección de abajo) está corregido
> en los tres. **Persistencia "al día siguiente": garantizada por construcción** —
> la tarjeta sale pura de `detectarPisoSeguridad(...)`, sin ningún flag de
> "ya vista/descartada" en `index.tsx`, así que reaparece cada día que la
> condición se cumpla; el modo de falla de "noticia que se muestra una vez" no
> existe. Data de prueba (5 check-ins bajos + fechas de reserva) revertida. Y los
> teléfonos de `/ayuda` marcan de verdad (verificado). Nada queda abierto de A1.

> Andre lo dejó para vos el 08/09. **Contexto en una línea:** el piso de
> seguridad —la única pantalla que le habla a alguien en crisis— se encendió en
> producción el 07/09 y **solo se vio correr una de sus tres ramas**. Esa prueba
> encontró un bug que 540 tests no habían visto.

**Setup, una sola vez:** los 5 registros bajos ya están cargados (dentro de los
14 días). Abrí la app y **tocá Bajón** para que haya check-in de hoy — sin eso la
tarjeta muestra su estado neutro y no se ve nada.

⚠️ El `user_id` de las consultas es el de Andre
(`8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c`); si probás con tu cuenta, cambialo y
cargá primero los 5 registros bajos (5 días distintos dentro de 14, todos en 1
o 2, y que sean **los 5 más recientes**).

**Son TRES estados, no dos** — el fix del 07/09 cambió lo que sale con la
configuración actual, así que ese tampoco está confirmado:

| # | qué tiene que decir | setup |
|---|---|---|
| 1 | *"Eso es de lo que conviene hablar **en sesión**."* | **Ninguno.** Es lo que sale con sesión completada esta semana y ninguna agendada. 🔴 Ayer en ese mismo estado salía *"Llevalo a tu próxima sesión"* mientras abajo decía "Sin sesiones agendadas" — **ese era el bug**. |
| 2 | *"**Llevalo a tu próxima sesión**."* | Una reserva `confirmada` con fecha ≥ hoy (ver SQL abajo). **Nadie la vio nunca.** |
| 3 | *"**Hay gente preparada para acompañar esto**."* | Ninguna `confirmada` futura **ni** ninguna `completada` en los últimos 7 días. |

```sql
-- Ver dónde estás parado
select id, scheduled_date, status from bookings
where user_id = '8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c'
order by scheduled_date desc limit 5;

-- Estado 2: una confirmada a futuro
update bookings set scheduled_date = current_date + 2, status = 'confirmada'
where id = 'PEGÁ_UNO_DE_ARRIBA';

-- Estado 3: sin nadie. Mueve fechas al pasado en vez de borrar, así se revierte.
update bookings set scheduled_date = current_date - 30
where user_id = '8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c'
  and scheduled_date >= current_date - 7;
```

**Qué mirar en los tres:**

- El CTA dice **"→ Si lo necesitás, hay líneas de ayuda"**, no *"Ver más"*.
- **Tocarla abre `/ayuda`**, no el momento a pantalla completa con *"Ver mi
  progreso completo"* — ofrecerle eso a alguien que lleva dos semanas en el fondo
  era el agujero que se tapó el 07/09.
- 🔴 **Que no se contradiga con la sección de abajo** ("Tu próxima sesión"). Ese
  fue exactamente el bug del 07/09 y es el que más fácil vuelve: **el bug no
  estaba en una función, estaba en la relación entre dos partes de la pantalla**,
  que es lo que ningún test puede ver.
- Que los teléfonos de `/ayuda` **marquen** de verdad.
- **Al día siguiente: que siga apareciendo.** No es una noticia que se muestra
  una vez — tiene que estar todos los días que dure la condición.

📌 No interfiere el aviso nuevo de `recurso-del-coach` aunque tengas
recomendaciones sin abrir: el piso le gana.

### A5 — receta para Joaquín (las pruebas que faltan del checkout web)

> Andre te las dejó el 09/09. **Contexto en una línea:** ese día se construyó y
> se probó el camino entero del cliente que entra por el link del coach —
> `/c/<slug>` → horario → código por mail → pago → `/reserva` → sala web — y
> quedaron tres cosas que **no se pueden verificar sin un teléfono y plata
> real**.
>
> 🔴 **Mientras no estén, `CHECKOUT_HABILITADO` no se prende** (está en
> `web/c/index.html`). Con el interruptor apagado la página muestra perfil y
> horarios pero no pide nada; con `?probar=1` se enciende **solo para vos**, y
> avisa en rojo que la reserva y el cobro son reales.

**Lo que ya está probado y no hace falta repetir** (09/09, con plata real): la
reserva se crea, el pago se acredita, el horario desaparece de los disponibles,
`/reserva` muestra el estado, y **los dos mails llegan** — "Recibimos tu reserva"
al instante y "Sesión confirmada" por el cron, a bandeja principal.

#### Prueba 1 — el checkout, otra vez, mirando el nombre

El 09/09 la prueba salió bien salvo una cosa: **el coach veía "Alguien"** en vez
del nombre de quien reservó. La cuenta nace del código, que solo pedía el mail,
así que `profiles.name` quedaba vacío. Se arregló pidiendo el nombre, **y ese
arreglo no se volvió a probar.**

1. `vitaapp.com.ar/c/coach-prueba?probar=1` — es el único con horarios cargados,
   y su precio es **$1**.
2. Elegí un horario, poné **nombre y mail** (usá un alias `+algo` de tu Gmail),
   aceptá los Términos, confirmá el código, pagá.
3. 🔴 **Entrá a la app como coach y mirá la tarjeta "espera tu respuesta":
   tiene que aparecer TU NOMBRE**, no "Alguien". Eso es lo único nuevo a probar.
   - ✅ **CERRADA el 11/09/2026 (Andre)**: reserva desde el link a las 16:33
     con el CAPTCHA prendido. El nombre quedó guardado en la base (no
     "Usuario") **y la tarjeta del coach de prueba en la app muestra el nombre**
     — el arreglo de `d1f19296` funciona de punta a punta.
4. De paso: que la card esté **debajo** de "Tu próxima sesión" (decisión de Andre
   del 09/09), y que al tocar Aceptar desaparezca.

#### Prueba 2 — la videollamada — ⏸️ SIGUE ABIERTA

Es la única parte del camino que **nunca se ejercitó**, y solo se puede el día de
la sesión: la sala se abre 15 minutos antes.

> 🔴 **Se perdió la oportunidad del 12/09.** Había una sesión real a las 11:00
> (coach de prueba ↔ la cuenta nacida en el checkout web, pagada) y **nadie
> entró**. La reserva quedó `completada`, pero eso no prueba nada: lo marca el
> cron `complete-sessions` por horario.
>
> 📌 **Lo único que dejó, y sirve**: el 13/09 después de las 11:00, la función
> `session-attendance` tiene que escribir una fila con `participants_count = 0`
> — el cron corre al minuto 17 de cada hora y espera 24 h antes de concluir que
> la sala quedó vacía. Si la escribe, queda probado el registro de "nadie
> entró", que es la prueba que hace falta cuando alguien reclama una sesión que
> no dio. Si NO la escribe, hay un bug en ese camino.
>
> ⚠️ Para volver a intentarlo hace falta una sesión nueva: la sala de la del
> 12/09 ya venció (`exp` = fin + 1 hora).

1. **Vos como cliente**, desde el navegador: `vitaapp.com.ar/sala?booking=<id>`.
   El link también llega en el mail de "Sesión confirmada".
   ⚠️ **Te va a pedir el código de nuevo, y es normal**: el token de acceso dura
   una hora, así que quien entra el día de la sesión siempre se re-identifica. Si
   eso se siente mal, decilo — es lo primero que revisaríamos.
2. **El coach desde la compu**: en el Inicio, tarjeta de la próxima sesión,
   **"Hacerla desde la computadora"** → comparte el link, lo abrís en el
   escritorio. Es como va a trabajar de verdad: la app es solo móvil y nadie da
   una sesión de una hora con el teléfono en la mano.
3. Que **se vean y se escuchen las dos puntas**. Ahí el camino está cerrado.

#### Prueba 3 — cuánto cobra Mercado Pago de verdad

📊 **Todo el desglose que el coach ve en "Cómo te pagamos" depende de un número
medido sobre un pago de $1**: `mercadopago_fee` 0,04 sobre 1,00, o sea ≈4%. A ese
monto, cualquier componente fijo de la tarifa distorsiona el porcentaje.

✅ **HECHA el 21/09/2026, sin panel.** Se leyeron los pagos por la API de MP
(`GET /v1/payments/<id>`) con el `access_token` del coach que ya está en
`coach_mp_accounts`, que es la misma vía por la que se había medido el de $1.

Los tres pagos de $4.500 con tarjeta (`174555144528` y `174554303062` del 19/08,
`173787714415` del 20/08) dan **exactamente el mismo desglose**:

| | |
|---|---|
| Mercado Pago (`mercadopago_fee`) | **193,63** = **4,30%** |
| VIVE (`application_fee`) | 675 (el 15% del tramo recurrente, correcto) |
| Neto del coach (`net_received_amount`) | 3.631,37 |

**`MP_FEE_PCT_OBSERVED` pasó de 4 a 4,3.** El 4 no estaba mal medido: sobre $1 la
tarifa es 0,04 y el redondeo a centavos tapaba el 0,3.

📌 **La duda del IVA se cerró**: 193,63 / 1,21 = 160,02, que es el 3,556% de
4.500. El número que descuenta MP ya viene con IVA adentro.

⚠️ **Lo que sigue sin saberse**: los tres pagos son con **tarjeta de crédito** y
**acreditación inmediata** (`money_release_date` a los 3 minutos). El de $1 era
dinero en cuenta. La tarifa cambia con las dos cosas, así que el 4,3% se sigue
mostrando con "≈" y la pantalla del coach ahora aclara que depende también del
medio de pago, no solo del plazo de acreditación.

🔴 **Hallazgo al pasar, para Andre**: los **7** pagos de MP a precio real que hay
en la base figuran `reembolsado`, incluido el del 19/08 que
`docs/fiscal-instrucciones.md` lista como *"confirmada, sin reembolso"*. O ese
doc quedó viejo, o el reembolso pasó después de escribirlo. Toca revisarlo antes
de usarlo para algo fiscal, y se cruza con **L9**.

#### Y una cosa de DNS, si te queda a mano

**Falta el DMARC** de `vitaapp.com.ar`. Sin él, Gmail y Yahoo son más duros con
un remitente nuevo y los mails pueden caer en spam — que es peor que no llegar,
porque parece que funcionó. La zona vive en **Vercel** (no en DonWeb, ver
`docs/hosting.md`): un TXT en `_dmarc` con

```
v=DMARC1; p=none; rua=mailto:andrealbisu@gmail.com
```

`p=none` no rechaza nada, solo reporta.

### A4 — receta para Joaquín (`authenticated` lee el mail de todos los coaches)

> **ESTADO (09/09, Joaquín): FASE 1 HECHA.** El envío de push se movió al server:
> nueva edge function `send-push` (validada por contexto — el que llama tiene que
> compartir sala o booking con el destinatario, cierra el vector de spam), y los
> 9 reads client-side de `push_token` (5 archivos) pasan por ella vía
> `notifyViaServer` en `lib/notifications.ts`. `sendPushNotification` (envío
> directo) se borró. Deployada y verificada con JWT real: sala/booking ajenos →
> 403, sin auth → 401. tsc 0, 570 tests. Push confirmado en dispositivo.
>
> **FASE 2 HECHA (09/09).** La única lectura de admin que traía el MAIL del coach
> (`listCoachApplications`, `profiles!inner(name, email)` desde `lib/admin.ts`)
> pasó a `admin-actions` (nueva acción `list_coach_applications`, tras confirmar
> `is_admin`, con service role). Verificado: un no-admin recibe 403. Los otros
> reads directos de admin son `name` (reports) o `paypal_email` de otra tabla,
> fuera del scope de A4. Confirmado además que la query directa
> `coaches`→`profiles.email` TODAVÍA devuelve filas para un `authenticated`
> no-admin: eso es lo que cierra la fase 3.
>
> **FASE 3 HECHA (09/09) — A4 CERRADO.** `authenticated` ya no puede leer `email`
> ni `push_token` de `profiles`. `scripts/restrict-authenticated-profiles-columns.sql`:
> se le sacó el SELECT a nivel TABLA (era `authenticated=ardm`, un grant de tabla
> cubre todas las columnas y no se puede revocar un subconjunto) y se re-granteó
> el SELECT de las 15 columnas restantes. Efecto lateral bueno: al pasar de tabla
> a columnas, una columna sensible NUEVA en `profiles` ya no queda legible sola
> (cierra la asimetría de la 207, para `profiles`).
>
> **Decisión (Joaquín, 09/09): revoke-only en vez de la vista.** La auditoría
> mostró que NADA client-side lee `email`/`push_token` de `profiles` (ni de otros
> ni de la fila propia — el mail propio sale de la sesión de auth; el push_token
> solo se ESCRIBE), y que los 4 lectores del catálogo piden solo columnas seguras.
> Así que el revoke de las dos columnas cierra el agujero sin tocar el catálogo ni
> el código. La trampa del FILTRO se auditó: `RegisterScreen` ya no filtra por
> `email` (usa la RPC `email_es_de_coach` desde la 206), y nada más filtra por
> esas columnas.
>
> ✅ Verificado en vivo con JWT `authenticated` real: `coaches→email` y
> `push_token` → **42501**; catálogo (coachesCache/search3) y columnas seguras de
> la fila propia → **OK**. Sin cambios de código de app.
>
> 🟡 **QUEDA COMO MEJORA APARTE, PARA ANDRE — la vista pública.** No cierra nada de
> A4 (ya cerrado), pero taparía además `is_admin`, `birth_date` y `nationality` de
> `authenticated` y sería a prueba de columnas futuras. No se hizo ahora porque el
> catálogo embebe `profiles` vía PostgREST desde `coaches` (`profiles!inner(...)`),
> y repuntarlo a una vista es un refactor con riesgo de regresión en búsqueda/
> catálogo — territorio de arquitectura de Andre. 🔴 Esas tres columnas NO se
> pueden revocar sin la vista: los grants son por rol y `EditProfileScreen` lee
> `birth_date/gender/nationality` de la fila PROPIA.

> Andre lo dejó para vos el 08/09. **Contexto en una línea:** ese día se cerró
> que **cualquiera con la anon key** pudiera leer el mail y el `push_token` de
> los 34 coaches, y quedó abierto que **cualquiera con una cuenta** todavía
> puede. Es el mismo agujero, una puerta más adentro.

**Por qué importa más de lo que parece un dato de contacto.** No es solo
privacidad: **es la estrategia anti-fuga al revés.** Con una cuenta gratis,
una plataforma competidora se baja el roster entero de VIVE con los mails y les
escribe uno por uno. Es el activo más difícil de construir que tenemos.

**Lo que ya está hecho y no hay que rehacer** (sesión 205):
- `anon` quedó con **`id`, `name`, `avatar_url`, `gender`** y nada más, por
  grants de columna (`scripts/restrict-anon-profiles-columns.sql`, corrido).
- Verificado que la RLS **sí** está bien: las cuatro policies de `profiles` no
  le dejan a un usuario logueado leer perfiles de **otros usuarios**. El
  problema es solo con las filas de coaches, por la policy *"Perfiles de coaches
  visibles para todos"* (`role = 'coach' OR auth.uid() = id`).

**El problema de fondo, que es el que define la solución.** Con grants de
columna **no se puede decir "tu propia fila entera, la de los coaches solo
cuatro campos"**: los grants son por ROL, no por fila. Por eso no alcanza con
repetir lo que se hizo con `anon`.

**El orden importa — al revés se rompen las notificaciones de reserva que se
arreglaron el mismo día (sesión 201, ya deployada).**

1. **Mover el envío de push al servidor.** Hoy es client-side en **6 lugares**:
   `lib/coachBookingActions.ts` (×2), `lib/bookingCancel.ts`,
   `screens/SalaScreen.tsx` (×2), `screens/BookingScreen_Confirm.tsx` y
   `screens/CoachReservasScreen.tsx`. En todos, **el que manda lee el
   `push_token` del que recibe desde el dispositivo**. El patrón a copiar ya
   existe y anda: `supabase/functions/_shared/booking-effects.ts` manda push con
   service role.
2. **Mover la lectura de mails del panel de admin.** `lib/admin.ts` lee
   `profiles!inner(name, email)` desde el cliente; va a `admin-actions`, que ya
   corre con service role.
3. **Recién ahí**, achicar lo que ve `authenticated`. La salida correcta es una
   **vista pública** para el catálogo (`id, name, avatar_url, gender` de los
   coaches) y dejar la tabla `profiles` para la fila propia. Hay que repuntar
   `coachesCache`, `search3`, `ProfesionalScreen` y `FavoritosScreen` a la vista.

🔴 **La trampa que ya pisamos una vez, no la pises de nuevo.** Al sacarle
`email` a `anon` se rompió `RegisterScreen`, que **filtraba** por esa columna
(`.eq('email', …)`): **filtrar por una columna exige SELECT sobre ella**, no
solo seleccionarla. Y **falló abierto** —el código descartaba el error— así que
no se vio hasta el barrido. Antes de tocar grants, buscá quién FILTRA por la
columna, no solo quién la selecciona. Se arregló con una función
`security definer` (`scripts/add-email-es-de-coach.sql`).

📌 **Cómo verificar sin adivinar:** el `.env` tiene la anon key, y con `curl`
contra `/rest/v1/` se prueba exactamente lo que ve un atacante. Es como se
verificaron los tres scripts de ese día. Para el rol `authenticated` hace falta
una sesión real, así que ahí sí conviene el teléfono o un token de prueba.

### Lo demás de device review, también de Joaquín

Viene arrastrándose de las sesiones 157-163 y ninguna se cerró:

- 🔴 **Matrícula en vivo** — cargar una credencial, aprobarla desde admin, ver que
  `has_matricula` pasa sola a `true` y aparece la insignia. **Es lo único de todo
  el backlog que no se puede verificar estáticamente**; el pre-flight ya validó
  las 4 superficies y el trigger por lectura. Hoy 0 coaches con matrícula, así
  que nada lo ejercita.
- ✅ **Cancelación tardía — HECHO (09/09), verificado en dispositivo + base.**
  Usuario canceló una confirmada a ~2hs (pago aprobado): el trigger
  `mark_refund_on_cancel` marcó `cancelled_late = true` y dejó `payment_status`
  en `aprobado` (NO `reembolso_pendiente`) — o sea que **no se disparó reembolso**,
  y el mensaje al usuario fue el de política ("cancelaste con menos de 24hs… no
  corresponde reembolso"). Era el camino que toca plata y no se había ejercitado
  nunca. Data de prueba revertida (reserva a confirmada / 09-26).
- **Diario nuevo** (el colapso con el teclado, que la franja se llene sola al
  guardar), **"Sobre vos" early**, y ~~**el aviso de `recurso-del-coach`**~~.
  - ✅ **`recurso-del-coach` HECHO (09/09) — con bug encontrado y arreglado.** La
    tarjeta *"Tu coach te dejó algo"* aparece bien con una recomendación en
    `opened_at = null`, y tocarla lleva a `mis-recomendaciones`. 🔴 **Pero al
    abrir las recomendaciones y volver a Inicio, la tarjeta SEGUÍA** — `opened_at`
    se marcaba bien en la base, pero `useWeeklySignals` cargaba una sola vez y no
    re-leía al volver a foco (Inicio es tab, no re-monta). **El mismo bug que
    `useMoodHistory` en la 191.** Arreglado igual: `refetch` en el hook +
    `useFocusEffect` en `index.tsx`. `tsc` 0, 570 tests.
  - **Matrícula en vivo** y **Diario nuevo** de arriba: ya cerrados por Joaquín en
    la sesión 191 (este doc los listaba sin saberlo).

---

## B. La arquitectura de la voz — el hallazgo de raíz

| ID | Problema | Solución propuesta |
|---|---|---|
| **B1** | 🔴 **La tarjeta es AUTORA: cada día tiene que inventar algo con casi ninguna entrada.** De ahí salen el horóscopo, la absolución sistemática y que el modelo copie los ejemplos del prompt. El outsider: *"a la segunda semana la esquivo con la vista, como los banners de «completá tu perfil»"*. | **Volverla MENSAJERA.** Hay cosas reales para entregar que no necesitan ni memoria ni texto libre. **Resuelve B2, B3 y B5 de una**, y da vuelta el techo del apego: si el vínculo se ata al paquete y a lo que manda el coach, **el apego empuja hacia el profesional en vez de competir con él.** |
| **B2** | ✅ **RESUELTO el 08/09.** Nueva señal `recurso-del-coach` en el motor: si hay una fila con `opened_at IS NULL`, la tarjeta avisa y tocarla lleva a `/mis-recomendaciones`. ~~Movimiento 5 (acercarte un recurso): 0 de 22 frases.** ✅ **VERIFICADO: `resource_recommendations` existe con 7 filas reales** — un profesional elige un recurso para una persona, con nota, y queda registrado si se abrió. Tiene pantalla propia (`app/mis-recomendaciones.tsx`). **La tarjeta no la mira nunca.** | ✅ Hecho. 📌 **NO dependía de E1** (un coach recomienda desde el catálogo que ya existe; cómo crece el catálogo es otra pregunta). 📌 **La dependencia del guardarraíl se resolvió mejor de lo previsto:** en vez de un flag en los `facts`, la señal **no la escribe un modelo** —es un aviso, no una devolución— así que no viaja ningún dato nuevo, y `ACOMPANANTE` acepta `recurso-del-coach` como prueba de que el coach existe. ⚠️ **Lo cazó un test, no una revisión.** |
| **B3** | **El paquete para la sesión vive aislado.** Usa el mismo material crudo que la tarjeta (check-in, diario, gratitud) y nunca se tocan. Es **lo único que un usuario de prueba validó sin que se lo pidieran** (*"buenísimo, lo usaría"*). | Que la tarjeta lo empuje cuando hay sesión cerca. Le da un propósito verificable en vez de una frase linda que se ignora. |
| **B4** | 🔴 **Movimiento 1 (recordar) imposible: la tarjeta no sabe qué dijo ayer.** §3.1 lo pide desde el 28/08 y nada lo implementa. Sin él, los movimientos 2 a 5 no tienen de qué agarrarse. | ⚠️ **Cuidado con la solución fácil.** La adjudicación separó dos ejes que veníamos mezclando: **la falla es "cero memoria", no "cero texto"**. Pero **memoria de señales NO es gratis**: una trayectoria de meses de ánimo día a día es un perfil longitudinal y **singulariza igual que un diario**, aunque no haya una palabra escrita. Que viva solo en el teléfono cambia el análisis **legal**, no el ético. 📌 **La versión mínima segura: aflojar la VENTANA, no guardar historia** — mandar un agregado de 7 días (*"bajón sostenido"*) en vez de números sueltos de hoy. |
| **B5** | **El modelo escribe a ciegas.** Nunca ve la frase de las reglas; recibe `señal / tono / dos números` y escribe una alternativa que reemplaza entera o se descarta entera. ✅ Por eso, en tres corridas de ensayo, **copió los ejemplos del prompt textualmente**. | Con B1 el modelo pasa a **anunciar en vez de inventar**, que es lo que sí sabe hacer con poca entrada. |
| **B6** | ~~⚠️ Hipótesis: los 14 guardarrales premian lo genérico~~ ✅ **DESCARTADA el 08/09, y el resultado es bueno: los guardarrales NO bloquean los movimientos que faltan.** Prueba de resta empírica — **11 de 11 frases candidatas pasan**: la expectativa (*"Eso no te lo dio nadie"*), la confianza con evidencia (*"Ya saliste de tramos así antes"*), el recurso, el paquete, la memoria, y hasta el humor liviano. Los dos controles (elogio vacío, consejo) se rechazan como corresponde. | 🔴 **El diagnóstico correcto es más simple y más barato: nadie las escribió.** Los guardarrales eliminan los gestos cálidos **baratos** —elogiar, aconsejar, prometer, fingir sentir— y dejan **absolver** como el camino de menor resistencia: es cálido, no requiere saber nada de la persona, y **ninguna regla lo apunta**. No es que el filtro castigue la especificidad: es que la especificidad **cuesta escribirla** y la absolución no. **C1 y C2 quedan DESBLOQUEADOS.** |
| **B7** | 📌 **El error de raíz, dicho con precisión** (adjudicación de privacidad): *"calcaron el modelo de voz de alguien que **sí recuerda** sobre un sistema que decidió no hacerlo"*. | Existe una versión honesta que no pide saber más: **acompañamiento por presencia, no por historia** — reconocer el patrón de hoy sin comparar contra ayer. No finge una memoria que no tiene. |

---

## C. El contenido de las 35 frases

✅ **DESBLOQUEADO el 08/09 por B6.** Se verificó que los guardarrales no impiden
ninguno de los movimientos que faltan: **reescribir el banco sí va a funcionar.**
Lo que falta es escribirlas, no arreglar el filtro.

| ID | Problema | Solución |
|---|---|---|
| **C1** | ✅ **RESUELTO el 08/09: de 10 absoluciones sobre 22 a 5.** Se reescribieron 7 frases. Las que quedan absolviendo son las que corresponde (un día que recién se cayó, una semana pareja) — no se eliminó el gesto, se dejó de ser el default. ~~10 de 22 frases "absuelven"~~ (*"no le debés nada a nadie"*, *"no todas tienen que rendir"*, *"está bien que algunas sean así"*). Es la categoría **más grande**, y no es ninguno de los cinco movimientos. **El sistema inventó un sexto movimiento que nadie pidió**, porque es el único ejecutable sin saber nada de la persona. | Rebalancear la distribución a mano. Después de B6. |
| **C2** | ✅ **RESUELTO el 08/09: de 1 sobre 22 a 8.** Ahora aparece en `sharp-drop`, `sustained-low` (×2), `trend-down`, `sessions`, `streak` (×2) y `level`. ~~Movimiento 4: 1 de 22.~~ Es el movimiento central del modelo de voz y aparece en una sola frase, escrita el 07/09. | Idem. |
| **C3** | ✅ **RESUELTO el 08/09: el toque lleva al Diario con esa pregunta.** El buzón ya existía y nadie los había unido. Y lo que se escriba ahí **termina en el paquete que va al profesional**, así que la pregunta no muere en la app. ~~Hace preguntas y no hay dónde contestarlas.~~ 7 de 22 preguntan al vacío. El outsider: *"es como si alguien te pregunta algo en la calle y se va caminando. **Si no hay buzón, no preguntes.**"* | O hay buzón, o no se pregunta. Se cruza con E2 (el chat que no existe). |
| **C4** | **Repetición detectable en ~2 semanas**: 2-3 variantes por categoría y sin memoria puede repetir literal la misma frase. *"Ahí se cae la ilusión de que Sofía es algo. Ese es el momento exacto en que dejo de creer."* | Más variantes no alcanza si el problema es B1. |
| **C5** | ✅ **REPLANTEADO y parcialmente resuelto el 08/09 — el diagnóstico estaba mal.** ~~Cero humor.~~ §2 ter dice que era *"graciosa, cálida, amable para los problemas del resto"*. Ninguna de las 22 tiene liviandad. | 🔴 **§3.5 nunca prohibió la calidez: dice textual *"cálida y presente, sí"*.** Nadie usó el permiso — misma forma que B6. **Y el problema no era que faltaran chistes: era que todo estaba dicho en tono solemne.** El único dato real es del usuario del consejo: rescató *"un día flojo no borra la semana"* (*"tiene onda, se siente como algo que diría un amigo"*) y rechazó *"¿lo notás vos también?"* (*"me suena a chatbot de call center"*). **La diferencia es hablar llano contra actuar cercanía.** ✅ Dos frases cambiadas y la regla aclarada en §3.5. ⚠️ Queda pendiente el resto del banco. |
| **C6** | ✅ **RESUELTO el 08/09.** ~~Se pierde la negrita cuando gana la IA~~ (`withCopy` deja `bold` vacío): la tarjeta se ve distinta según qué camino ganó. | El modelo ya devolvía salida estructurada, así que se le sumó un campo `destacado` — un trozo literal de la línea. 🔴 **Toda falla degrada a texto plano**, que es como se veía antes: el modelo puede no mejorar la tarjeta, no puede romperla. ⚠️ El cache guarda línea + destacado juntos (si guardara solo la línea, la tarjeta se vería con destacado el día que se genera y sin él al reabrir), con lectura tolerante de las entradas viejas. |

---

### C7 — nueva (08/09): la voz vive en más de una pantalla y solo una está vigilada

✅ **Encontrado pasando los prompts del Diario por `rejectCopy`.** Son la **misma
voz de Sofía en otra pantalla**, se escribieron antes de que las reglas
existieran, y **nada los verifica**.

| prompt | veredicto |
|---|---|
| *"Se nota que estás **cansado**."* (ánimo 2) | 🔴 **Violación real y doble**: *"se nota que"* es la app de testigo (prohibido por nombre en el `SYSTEM`) y *"cansado"* le asigna género a quien lee — el mismo bug que Andre cazó con *"parejo"*. ✅ **Corregido**: *"Hoy venís con poca energía."* |
| *"Un día **tranquilo**."* (ánimo 3) | ⚠️ **Falso positivo del guardarraíl, no del prompt.** Ahí `tranquilo` concuerda con *"día"* y es correcto. En la tarjeta nunca puede serlo (el sujeto tácito es *la semana*). Anotado en `NIVEL_MASCULINO`. |
| *"**¡**Hoy estás brillando**!**"* (ánimo 5) | 📌 **Decisión de Andre**: el `SYSTEM` prohíbe exclamaciones en la tarjeta. ¿Vale la misma regla en el Diario, o es otro registro a propósito? |

#### ✅ Barrido completo del 08/09

Se recorrieron las otras superficies buscando los patrones que las reglas ya
frenan en la tarjeta: adjetivo con género sobre quien lee, la app de testigo,
exclamaciones, tuteo.

| superficie | resultado |
|---|---|
| **Gratitud** | 🔴 **Una violación real: *"¿Por qué estás **agradecido** hoy?"*** — mismo bug que *"cansado"* y *"parejo"*. ✅ Corregido: **"¿Qué agradecés hoy?"**, que además no necesita ningún adjetivo. |
| **Check-in** (`MoodCheckIn`) | ✅ Limpio. Su copy sale de `ViveMoods` y de texto dinámico; no hay frases fijas dirigidas a la persona. |
| **Panel del orbe** | ✅ Limpio en cuanto a reglas. Sus cuatro atajos no generan ni observan. (Su problema es otro y está en E2.) |
| **Sala / chat** | 📌 *"¡Empezá la conversación!"* tiene exclamación, **pero no es la voz de Sofía**: es el vacío del chat entre dos personas. Superficie distinta, registro distinto. No se tocó. |
| **Diario** | Ya barrido arriba: 1 corregida, 1 falso positivo del guardarraíl, 1 decisión de Andre. |

📌 **Dos violaciones en total, en dos pantallas distintas, y las dos del mismo
tipo: un adjetivo masculino sobre quien lee.** No es casualidad — es el error más
fácil de cometer en español y el único que **la tarjeta tiene cuatro reglas para
evitar** mientras el resto de la app no tiene ninguna.

🔴 **Lo que sigue abierto: nada verifica esto.** El barrido fue a mano y no queda
nada que impida que la próxima pantalla nazca con el mismo error. La tarjeta
tiene un test que barre sus 35 frases contra `rejectCopy`; **el resto de la app
no tiene equivalente**, y no es obvio cómo hacerlo (el copy vive suelto en JSX,
no en un banco enumerable).

---

## D. Abierto y sin solución conocida

| ID | Problema | Estado |
|---|---|---|
| **D1** | 🔴 **Inferencia causal.** *"No es que hayas dejado de intentar"* — niega una causa que nadie planteó y **al negarla la introduce**. Reproche de contrabando dentro de un consuelo, sin ninguna palabra prohibida. | Cuatro corridas de ensayo confirman que **no se arregla con el prompt**. `rejectCopy` mira vocabulario. |
| **D2** | 🔴 **A.11 — qué hace Vita frente al riesgo real.** No puede preguntar sin crear un deber que no puede sostener. | Veredicto del consejo: **no agregar la pregunta hasta que la respuesta valga algo.** *"Preguntar «¿querés dejar de vivir?» y contestar con una pantalla de teléfonos es funcionalmente idéntico a no preguntar — pero le costó a la persona decir que sí."* 📌 **Tercera vía propuesta:** no *"¿querés morir?"* sino **"¿querés que alguien te llame ahora?"** con la llamada en un tap. |
| **D3** | 🔴 **El umbral no distingue "mal tramo" de "riesgo"**, y no sabemos cómo hacerlo sin preguntar. Mónica: *"las sesiones pueden destapar ansiedades como parte del proceso de sanación"* — el detector puede dispararse sobre alguien cuyo tratamiento funciona. | Lo hecho: **dejar de afirmar la distinción que no podemos medir**. La pregunta de fondo sigue abierta y atada a D2. |
| **D4** | **El acceso a crisis depende del detector.** Deja afuera el caso que Mónica nombró: **violencia intrafamiliar**, que la escala de ánimo no ve nunca. | Sacarlo del control del algoritmo: permanente y a un tap, no contingente. Hoy está en el perfil, que es mejor que nada pero hay que ir a buscarlo. |
| **D5** | **Nadie externo firma nada.** Las dos revisiones llegaron solas: *"la salida obvia frente a «no podemos preguntar ni sostener un sí» es un socio externo — una línea de crisis con convenio, una ONG, un asesor clínico que co-diseñe el protocolo"*. Para dos personas es **la acción de más apalancamiento y de las más baratas**. | Nadie lo empezó. |
| **D6** | **¿Se enteran ustedes cuando el piso dispara?** Hoy no hay logging ni alerta propia. Sin eso no pueden aprender ni hacer seguimiento al día siguiente — *"la única forma de cuidado sostenible sin guardia 24/7"*. | Sin decidir. |

---

## E. Decisiones frenadas que bloquean otras cosas

| ID | Qué | Quién | Bloquea |
|---|---|---|---|
| **E1** | **Cómo crece el catálogo de recursos.** Marcada por ustedes como la más importante, frenada hace semanas. 📌 §2 bis le dio una pista fuerte: *"un recurso si lo tenía a mano"* — **nunca fabricado**. Y si el problema es peso y no escasez, **más recursos lo empeoran**. | 30 min con Joaquín | B2 |
| **E2** | **Los dos Sofía / el orbe** (D-1 y D-2 de `consejo-sofia.md`). ✅ Verificado que apagarlo no deja nada inaccesible. | Pausado con Joaquín | C3 |
| **E3** | **Consentimiento en el onboarding** (PC-4). La página `sobre-nosotros` existe, pero **hay que ir a buscarla** — que es la letra chica que PC-4 critica. | Andre | — |
| **E4** | **Hablar con Sofía (la persona) y dejar algo escrito.** Hoy **no tiene voz formal en un producto que lleva su nombre**, y nadie calculó el costo reputacional para ella si el producto falla en una crisis. | Andre | — |
| **E6** | 🔴 **¿La voz puede tratarte en género?** Idea de Andre (08/09). Hoy la app no sabe, y **cuatro de los catorce guardarrales existen solo por eso** (`GENDERED`, `GENDERED_PERIFRASIS`, `NIVEL_MASCULINO`, `CONCORDANCIA_SEMANA`). Saberlo desbloquearía calidez hoy imposible: *"no estás sola"*, *"venís cansada"*. **Ver el análisis abajo.** | Andre | C5 |
| **E5** | **Visto bueno de voz** sobre la frase nueva de `sustained-low` y sobre *"estar ahí con vos"* (§1 la avala, §3.5 la roza). | Andre | — |

---

### E6 — ¿la voz puede tratarte en género? (análisis del 08/09)

**El dato existe**: `profiles.gender`, con cuatro opciones —`Prefiero no decir`
(**el default**), `Masculino`, `Femenino`, `No binario`— editable en el perfil.
✅ Verificado: **hoy tiene un solo uso en toda la app**, `search3.tsx:331`, el
filtro para elegir profesional por sexo.

**Lo que se ganaría** es real: desaparecería toda la gimnasia de *"que el
adjetivo califique a la semana y no a la persona"*, y con ella cuatro reglas.

**Tres problemas, y el tercero es el que decide:**

1. **Solo sirve para dos de las cuatro opciones.** `Prefiero no decir` es el
   default y `No binario` no tiene forma gramatical en español que no sea la
   neutra. **La voz neutra tiene que existir igual** — no se elimina trabajo, se
   agrega un segundo banco de frases.
2. **No se sabe cuántos lo completaron** (la RLS no deja contarlo con la anon
   key) y el default es "prefiero no decir".
3. 🔴 **El campo se pidió para otra cosa.** Alguien lo completó **para que le
   ofrezcan una psicóloga mujer**, no para autorizar que la app le hable con
   adjetivos todos los días. ⚠️ **El modo de falla es concreto:** una persona
   trans que puso `Masculino` para el filtro, o que no actualizó el campo, y la
   app empieza a tratarla en masculino todas las mañanas. **El costo cae justo
   sobre quien la app tenía que cuidar mejor — que es el motivo por el que la
   regla existe.**

**Propuesta (sin decidir):**

- 🟢 **No leer el campo: preguntar aparte.** *"¿Cómo preferís que te hable?"*, un
  toque, con el propósito dicho. No repurposea nada, le da control sobre **cómo
  le hablan** —que es distinto de su género— y deja *"me da igual"* como
  respuesta válida y probablemente la más elegida.
- 🟢 **Y el dato no tiene por qué ir al modelo.** El motor de reglas corre en el
  teléfono: si las 35 frases usan el género y el payload sigue siendo el de
  siempre, **no se toca el encuadre legal ni viaja un dato más**. Se acepta que
  lo que escribe la IA sigue siendo neutro.
- **Los guardarrales quedan en pie** para todos los que no contesten, que van a
  ser la mayoría.

📌 Se cruza con **C5** (la voz no tiene humor ni calidez propia): parte de esa
frialdad viene de que no puede usar un solo adjetivo sobre la persona.

---

## F. El problema de método

🔴 **Cero usuarios reales. Nada de esto está validado.**

Tres consejos, 18 sesiones de trabajo de voz, ~540 tests — y la única persona que
simuló ser usuario dijo que a las dos semanas la ignoraría y que **no la
extrañaría si desapareciera**.

**La prueba más barata que salió, y contesta la pregunta de fondo mejor que
cualquier análisis:** mandar la tarjeta **en versión reglas-only, sin IA** a 5-10
personas reales durante dos semanas, sin avisarles que es un experimento, y
preguntarles el sábado antes de la sesión: **"¿leíste algo esta semana que te
sirvió?"**.

> *"Esa respuesta vale más que los 540 tests."*
