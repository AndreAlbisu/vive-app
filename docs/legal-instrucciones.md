# Instrucciones — Documentos legales de Vita

Guía operativa (no legal) para llevar los borradores de **Términos y Condiciones**
y **Política de Privacidad** de "borrador" a "publicado". Leé esto antes de tocar
los otros dos archivos.

## Archivos
- [`terminos-y-condiciones.md`](./terminos-y-condiciones.md) — T&C (24 secciones).
- [`politica-de-privacidad.md`](./politica-de-privacidad.md) — Política de Privacidad (14 secciones).
- Ambos son **BORRADORES**. No se publican ni entran en vigencia sin revisión de un/a abogado/a matriculado/a en Argentina.

> **Estos `.md` son la fuente de verdad y la app los muestra.** Después de editar
> cualquiera de los dos hay que correr **`npm run sync:legal`**, que regenera
> `constants/legal.ts` (Metro no puede importar `.md` directo). Si no se corre,
> la app sigue mostrando la versión anterior. La pantalla legal muestra un aviso de
> "borrador pendiente de revisión" mientras queden placeholders `[ ]` sin completar;
> cuando se completen todos, el aviso desaparece solo (bandera `LEGAL_IS_DRAFT`).

## Los 4 pasos, en orden

### Paso 1 — Completar los placeholders `[ ]`
Datos de la empresa y de contacto que solo tenés vos. Checklist consolidado (ambos documentos):

> **Decidido el 06/08/2026 (Andre): Vita la opera una PERSONA HUMANA inscripta en Monotributo**, no una sociedad. Por eso los documentos ya no dicen "razón social" sino `[NOMBRE Y APELLIDO]`. Revisar la decisión cuando entre inversión, se formalice un socio, la facturación se acerque al tope del monotributo, o el volumen haga que el riesgo patrimonial personal deje de ser teórico.

- [x] ~~**Nombre y apellido**~~ — Andre Albisu Lambertini
- [x] ~~**CUIT**~~ — 20-46034087-0 (confirmado por Andre)
- [x] ~~**Domicilio**~~ — De los Extremeños 5069, Córdoba, Provincia de Córdoba
- [x] ~~**Correo de contacto legal**~~ — vitaappar@gmail.com
- [x] ~~**Correo de privacidad**~~ — vitaappar@gmail.com (el mismo)
- [ ] **Fecha de última actualización** y **fecha de vigencia** (en ambos) — poner la fecha real de publicación, no la de hoy. **Son los últimos 4 corchetes que se completan**, después de la revisión legal.
- [x] ~~Referente/responsable de datos (Política §1)~~ — **10/08/2026: no se designa uno distinto del Responsable.** Todo va a `vitaappar@gmail.com`.

> **El detector de placeholders estaba roto y ocultaba 10 de los 15.** `sync-legal.mjs`
> limitaba el match a 60 caracteres, así que solo veía `[fecha]`: las notas largas
> dirigidas al abogado (`[Validar con abogado…]`, `[Si se mantiene esta política…]`)
> **se publicaban literales** en la app y en las páginas web mientras `LEGAL_IS_DRAFT`
> daba a entender que faltaba un solo campo. Arreglado el 10/08/2026 — ahora reporta
> archivo y línea de cada uno. Correr `npm run sync:legal` y leer la salida es la
> forma de saber qué falta; no confiar en la memoria.

### Paso 2 — Resolver las decisiones de producto/fiscales pendientes
No son legales puras, son tuyas (con tu contador/abogado):

- [x] ~~**IVA / figura fiscal** (T&C §8.4)~~ — **RESUELTO 06/08/2026: Monotributo**, factura C sin IVA discriminado. §8.4 ya redactada, y el código no necesita cambio (la comisión retenida es la comisión final). Se agregaron §8.5 (situación fiscal del Profesional) y §8.6 (cambio de condición fiscal).
- [x] ~~**Comisión** (T&C §8.3)~~ — **20%** la primera sesión con cada persona / **15%** desde la 2da, ya escrito sin corchetes. Falta solo decidir si mencionás la promo fundador.
- [x] ~~**Lista de proveedores** (Política §6)~~ — verificada contra el código: Supabase, Mercado Pago, **Daily.co** (el video real; lo de Jitsi en `salas.room_url` es vestigial, nada lo abre) y Expo push. **Analítica: ninguna de terceros**, es tabla propia. Falta el acuerdo de tratamiento de datos con cada uno.
- [x] ~~**Garantía de primera sesión** (T&C §9.3)~~ — **RESUELTA 10/08/2026 (Andre): se mantiene y la paga el Profesional.** Reintegro total, se pide a `vitaappar@gmail.com` dentro de las 48hs del horario agendado, sin expresar motivo, **una sola vez por Cliente en toda la Plataforma**, solo sobre la primera Sesión de cada vínculo. Se debita de los fondos del Profesional; Vita no cobra comisión sobre lo reintegrado. Escrita en §9.3 y, del lado del Profesional, en **§8.8 (nueva)**. ⚠️ **Falta implementarla** — ver Paso 4.
- [x] ~~**Antelación mínima de cancelación** (T&C §9.1)~~ — **24 horas**, sin franja intermedia (Andre, 10/08/2026). Es lo que ya hacía el código (`lib/bookingHelpers.ts`, `SalaScreen.canCancelConfirmed`). §9.1 reescrita: describe también que dentro de las 24hs **no se puede cancelar** (antes decía que "podía no haber reembolso", que era otra cosa) y que el Cliente puede pedirle al Profesional que cancele. Informada además en `BookingScreen_Confirm`.
- [ ] **Jurisdicción** (T&C §22) — normalmente CABA, confirmar con abogado. **Único corchete de contenido que queda.**
- [x] ~~**Líneas de ayuda en crisis** (T&C §5.3)~~ — **incluidas 10/08/2026**: 911, y la línea de asistencia al suicida **135** (CABA/GBA) · **(011) 5275-1135** · **0800-345-1435** (todo el país), 24hs. Vigencia verificada al escribirlas. **Re-verificar antes de cada publicación**: un número muerto en un aviso de crisis es peor que no ponerlo.
- [x] ~~**Plazos de conservación** de datos por categoría (Política §10)~~ — **definidos 10/08/2026**: contenido de bienestar borrado inmediato; reservas/transacciones 10 años disociadas (obligación contable-fiscal); reseñas indefinidas anonimizadas; mensajes anonimizados mientras viva la conversación; analítica disociada. §10 describe además el modelo real de baja (lápida + anonimización), que antes solo vivía en el código. **Confirmar los 10 años con el contador.**

### Paso 3 — Revisión legal (obligatoria)
Llevá los dos borradores ya completados (pasos 1 y 2) a un/a abogado/a. Puntos donde su revisión vale más (están marcados `[Validar con abogado]` en los textos):

- [ ] **Cláusula de jurisdicción frente a consumidores** (T&C §22) — tiene límites estrictos en Argentina; no se puede perjudicar al consumidor.
- [ ] **Mecanismo de consentimiento de datos sensibles** (Política §3) — cómo se obtiene y registra el consentimiento explícito para mood/diario/mensajes.
- [ ] **Transferencia internacional de datos** (Política §7) — encuadre bajo Ley 25.326 / AAIP (servidores fuera de AR).
- [ ] **Limitación de responsabilidad e indemnidad** (T&C §18–19) — qué se sostiene ante un juez argentino.
- [ ] **Aviso de salud y emergencias** (T&C §5) — redacción fina, sobre todo por tener psicólogos/as en la plataforma.
- [ ] **Cláusula anti-solicitación / no elusión** (T&C §10) — que sea ejecutable.

> Tip: aprovechá la misma consulta legal/contable que vas a necesitar por lo fiscal (IVA/figura) para que te revisen estos textos. Es la misma persona/estudio.

### Paso 4 — Publicar y conectar en la app
Una vez revisados y aprobados:

- [x] ~~**Enlaces dentro de la app.**~~ Hecho el 06/08/2026: pantalla `/legal?doc=terminos|privacidad` desde el menú de perfil, y `LegalSheet` en el registro de usuario y en el de profesional. Muestran el texto real de estos `.md` (vía `npm run sync:legal`), no un resumen aparte.
- [x] ~~**Aceptación en el registro (email).**~~ El checkbox ya persiste en `profiles.accepted_terms` (antes se descartaba). El registro del profesional usa aceptación implícita, porque su pantalla es login y alta a la vez.
- [x] ~~**Aceptación en el registro con Google y Apple.**~~ Resuelto el 06/08/2026: el checkbox se movió **fuera** del formulario de email (antes vivía adentro, así que quien tocaba Google ni siquiera tenía dónde aceptar), los dos botones sociales quedan deshabilitados hasta tildarlo, y `signInWithGoogle`/`signInWithApple` reciben el flag y persisten `profiles.accepted_terms`.
- [x] ~~**Páginas web generadas.**~~ `npm run sync:legal` ahora emite además **`web/legal/terminos.html`** y **`web/legal/privacidad.html`**, del mismo texto que muestra la app (no pueden divergir). Responsive, con modo oscuro, y con el aviso de borrador mientras queden placeholders.
- [ ] **Hostearlas y obtener la URL pública.** App Store Connect y Google Play Console **exigen una URL pública** de la Política para poder publicar. **Dominio ya comprado: `vitaapp.com.ar` (13/08/2026)**, hosting decidido en Vercel. Falta conectar y cargar `https://vitaapp.com.ar/legal/privacidad` en las dos consolas — paso a paso en `docs/hosting.md`.
- [x] ~~**URL de solicitud de eliminación de cuenta (Google Play).**~~ Página escrita y generada: `docs/eliminar-cuenta.md` → `https://vitaapp.com.ar/legal/eliminar-cuenta`. Falta publicarla y cargar la URL en Play Console.
- [x] ~~🚨 **BORRADO DE CUENTA DENTRO DE LA APP**~~ — **YA EXISTE** (se construyó el 06/08/2026, este ítem había quedado desactualizado). `supabase/functions/delete-account/index.ts` (edge function con service role), `lib/accountDeletion.ts`, UI en `ProfileOwnScreen.tsx`. Modelo de borrado + anonimización documentado en `SCHEMA.md`. Cumple la guideline 5.1.1(v) de Apple.

### Faltantes detectados en la revisión del 10/08/2026

- [x] ~~🔴 **Botón de arrepentimiento + derecho de revocación.**~~ Escrito el 13/08/2026: **T&C §9.4** (la vieja 9.4 pasó a 9.5) + **página propia** `docs/boton-de-arrepentimiento.md` → `web/legal/arrepentimiento.html`, enlazada como botón destacado desde las otras dos páginas y accesible en la app desde el menú de perfil **también sin sesión iniciada**. ⚠️ **Corrección sobre lo que decía este ítem: el plazo es de 10 días CORRIDOS, no hábiles** — art. 34 Ley 24.240 lo dice con esas palabras; el texto se escribió con "corridos".
  - [x] ~~Falta la portada~~ — **creada el 13/08/2026**: `web/index.html`, generada por `sync-legal.mjs`, con el botón de arrepentimiento como botón destacado y el bloque de contacto. Falta **publicarla** (ver `docs/hosting.md`).
  - ⚠️ **Queda un punto para el abogado/a**, anotado como placeholder en §9.4: qué pasa si la Sesión ya se prestó dentro de los 10 días con conformidad expresa del Cliente — si el reintegro es total o proporcional. Los arts. 1110–1116 CCyC no contemplan expresamente esa hipótesis para servicios.
  - ⚠️ **No está implementado el circuito**: el código de identificación de la revocación dentro de las 24hs se manda a mano por mail, igual que la garantía de §9.3. A volumen bajo alcanza, pero es manual y hay que saberlo.
- [x] ~~🔴 **Implementar la garantía de §9.3.**~~ Construido el 13/08/2026: tabla `guarantee_claims` + edge function `guarantee-claim` (`scripts/add-guarantee-claims.sql`), con las 5 condiciones de la cláusula validadas automáticamente. **Falta correr el script y deployar la función.** ⚠️ **La premisa de este pendiente era falsa:** no hacía falta reescribir el `status` — `mp-process-refunds` filtra solo por `payment_status` y nunca mira `status`, así que una `completada` marcada `reembolso_pendiente` se reembolsa sola con su historia intacta. El intake sigue siendo el mail, como dice §9.3; operar la garantía está en `docs/garantia-runbook.md`. Sí quedan controlados el "una sola vez por Cliente" y la ventana de 48hs, que este ítem daba por imposibles de controlar. Texto original: Escrita pero sin mecanismo: hoy los únicos caminos a `reembolso_pendiente` son la cancelación y el vencimiento sin confirmar. Una Sesión ya `completada` no tiene forma de marcarse para reintegro sin reescribir su `status` a `'cancelada'`, que contradice el criterio de no reescribir historia. Hace falta una vía propia (columna/estado nuevo, o invocar el refund a mano). Tampoco hay control del "una sola vez por Cliente" ni de la ventana de 48hs — a volumen bajo se puede operar a mano desde el mail, pero hay que saber que es manual.
- [x] ~~🔴 **Declaración de mayoría de edad en el registro.**~~ Construido el 13/08/2026: checkbox propio "Declaro que tengo 18 años o más" en `RegisterScreen` (separado del de T&C, y habilita los tres métodos de alta por igual), constancia en `profiles.age_confirmed` (`scripts/add-age-confirmation.sql`), declaración agregada a la línea de aceptación implícita de `CoachLoginScreen`, y **chequeo duro** `< 18` contra `birth_date` en `CoachApplicationScreen`. Texto original del pendiente: T&C §3.1 dice que el Usuario "declara" ser mayor de 18 y Política §11 que no se recolectan datos de menores. En el registro no se pregunta la edad ni se declara nada: `birth_date` es opcional en `EditProfileScreen` y obligatoria solo para el coach (`CoachApplicationScreen`), y en ningún caso se valida que sean 18. Mínimo: un checkbox junto al de T&C.
- [x] ~~🔴 **Bloqueo de usuarios.**~~ Construido el 13/08/2026: tabla `blocked_users` + `are_blocked()` + triggers en `messages` y `bookings` (`scripts/add-user-blocking.sql`), entrada desde el perfil del coach y el menú "⋯" del chat, y pantalla "Cuentas bloqueadas" para deshacerlo. Escrito en **§14.3**. De las cuatro cosas que pide la guideline 1.2 quedan cubiertas filtrado (advertencia de datos de contacto), reporte y bloqueo; el **contacto** ya está escrito en la portada (`web/index.html`) y solo falta **publicarla** — ver `docs/hosting.md`.
- [ ] **Destinatarios de datos que faltan en Política §6:** Google y Apple como proveedores de identidad (`expo-auth-session`, `expo-apple-authentication`), YouTube por los videos embebidos (`react-native-youtube-iframe` en `ResourceDetailScreen`), y los permisos de dispositivo que la app pide — fotos/cámara (`expo-image-picker`) y calendario (`expo-calendar`). Tiene que quedar consistente con las etiquetas de las tiendas.
- [ ] **Inscripción en el Registro Nacional de Bases de Datos de la AAIP.** Obligación del Responsable, independiente del texto. Se hace por TAD. Con datos sensibles de por medio, la falta de inscripción funciona como agravante ante una denuncia o inspección.
- [ ] **`session_notes` tras la baja.** Se conservan (ver `SCHEMA.md`) — notas de un profesional sobre alguien que pidió irse. Es la pregunta más delicada del modelo de borrado y sigue sin respuesta del abogado.
- [x] ~~**Guardar `accepted_terms_at` y `accepted_terms_version`.**~~ Construido el 13/08/2026 (`scripts/add-terms-version.sql`, **falta correrlo**). La versión **se deriva del contenido**: `LEGAL_VERSION` en `constants/legal.ts` es el sha256 corto de T&C + Política, generado por `sync-legal.mjs` — un número mantenido a mano se olvida justo al editar el documento, que es cuando importa. Verificado que es determinístico, que cambia al tocar el texto y que vuelve al original al revertirlo. Texto original: La columna `accepted_terms_at` ya existe en la base y nadie la escribe; de versión no hay nada. Sin eso no se puede probar qué texto aceptó cada persona, que es justo lo que se discute al invocar §20 (modificaciones) y §10 (no elusión).
- [ ] **Etiquetas de las tiendas.** Completar las *App Privacy labels* (Apple) y el *formulario de seguridad de los datos* (Google) de forma **consistente** con lo que declara la Política (datos sensibles incluidos).

## Mantenimiento
- Actualizar la **fecha** de cada documento cada vez que cambie.
- Re-revisar con el abogado ante cambios relevantes del producto (nuevos datos que se recolecten, nuevos proveedores, cambio de modelo de pago, etc.).
- Mantener la sección de mensajería (T&C §15 / Política §8.2) **siempre consistente con la realidad técnica**: mientras no haya cifrado de extremo a extremo real, no afirmarlo.

---
Este archivo es una guía operativa, no asesoramiento legal.
