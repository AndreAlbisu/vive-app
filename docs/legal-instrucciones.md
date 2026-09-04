# Instrucciones — Documentos legales de Vita

Guía operativa (no legal) para llevar los borradores de **Términos y Condiciones**
y **Política de Privacidad** de "borrador" a "publicado". Leé esto antes de tocar
los otros dos archivos.

## Archivos
- [`encuadre-salud-y-responsabilidad.md`](./encuadre-salud-y-responsabilidad.md) — 🆕 **A.4 y A.7, que resultaron ser el mismo problema.** 🔴 El documento con peores noticias: declararse intermediaria probablemente no alcance (art. 40 LDC + el precedente Mercado Libre), y el riesgo del encuadre de salud no es el aviso sino que coaches y psicólogos/as se presenten igual.
- [`consumo.md`](./consumo.md) — 🆕 **la respuesta investigada a A.1, A.5, A.6 y A.9.** A.1 y A.9 quedan cerradas con texto listo; A.5 y A.6 no tienen respuesta en la norma y está dicho por qué.
- [`consentimiento-datos-sensibles.md`](./consentimiento-datos-sensibles.md) — 🆕 **la respuesta investigada a A.2 y B.3**: por qué el checkbox de T&C no alcanza para dato sensible, el diseño concreto del opt-in, el texto propuesto para Política §3, y cómo se hace el registro ante la AAIP (gratis, por TAD). ⚠️ Incluye un hallazgo incómodo: la letra del art. 7 es más dura que la práctica que todos aplican.
- [`transferencias-internacionales.md`](./transferencias-internacionales.md) — 🆕 **la respuesta investigada a A.3**: dónde está cada dato (verificado), qué instrumento lo ampara, qué hay que hacer y el texto propuesto para Política §6/§7. Se escribió para no depender de una consulta paga.
- [`terminos-y-condiciones.md`](./terminos-y-condiciones.md) — T&C (24 secciones).
- [`politica-de-privacidad.md`](./politica-de-privacidad.md) — Política de Privacidad (14 secciones).
- Ambos son **BORRADORES**. No se publican ni entran en vigencia sin revisión de un/a abogado/a matriculado/a en Argentina.

> **Estos `.md` son la fuente de verdad y la app los muestra.** Después de editar
> cualquiera de los dos hay que correr **`npm run sync:legal`**, que regenera
> `constants/legal.ts` (Metro no puede importar `.md` directo). Si no se corre,
> la app sigue mostrando la versión anterior. La pantalla legal muestra un aviso de
> "borrador pendiente de revisión" mientras queden placeholders `[ ]` sin completar;
> cuando se completen todos, el aviso desaparece solo (bandera `LEGAL_IS_DRAFT`).

## Los 5 pasos, en orden

> Los pasos 1 a 4 llevan los documentos hasta publicarlos. El **Paso 5** es lo
> que queda esperando del otro lado: dos features construidas o evaluadas que
> no se encienden hasta que haya respuesta legal.

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
- [x] ~~**Antelación mínima de cancelación** (T&C §9.1)~~ — **24 horas**, sin franja intermedia (Andre, 10/08/2026). Es lo que ya hacía el código (`lib/bookingHelpers.ts`, `SalaScreen.canCancelConfirmed`). ⚠️ **Reescrita otra vez el 04/09/2026, y volvió a lo de antes por un motivo mejor:** decía que dentro de las 24hs **no se puede cancelar**, y eso (a) contradecía a la base —el trigger acepta la cancelación tardía y solo niega el reembolso— y (b) chocaba con el derecho de revocación irrenunciable de §9.4. Ahora dice que **siempre se puede cancelar** y que lo que cambia es el reembolso. Ver `docs/consumo.md`. Informada además en `BookingScreen_Confirm`.
- [x] ~~**Jurisdicción** (T&C §22)~~ — **RESUELTO por investigación el 01/09/2026, ver `consumo.md`.** No es CABA: el **CCyC art. 1109** fija la jurisdicción en el lugar donde el consumidor recibió la prestación y dice que **la cláusula de prórroga se tiene por no escrita**. Poner CABA no es riesgoso, es inútil. Texto propuesto en `consumo.md`. Para los Profesionales —que no son consumidores— sí se puede pactar, y ahí conviene Córdoba.
- [x] ~~**Líneas de ayuda en crisis** (T&C §5.3)~~ — **incluidas 10/08/2026**: 911, y la línea de asistencia al suicida **135** (CABA/GBA) · **(011) 5275-1135** · **0800-345-1435** (todo el país), 24hs. Vigencia verificada al escribirlas. **Re-verificar antes de cada publicación**: un número muerto en un aviso de crisis es peor que no ponerlo.
- [x] ~~**Plazos de conservación** de datos por categoría (Política §10)~~ — **definidos 10/08/2026**: contenido de bienestar borrado inmediato; reservas/transacciones 10 años disociadas (obligación contable-fiscal); reseñas indefinidas anonimizadas; mensajes anonimizados mientras viva la conversación; analítica disociada. §10 describe además el modelo real de baja (lápida + anonimización), que antes solo vivía en el código. **Confirmar los 10 años con el contador.**

### Paso 3 — Revisión legal (obligatoria)

> 📦 **El paquete listo para enviar está en `docs/paquete-abogado.md`.** Junta
> el contexto del negocio, los once puntos que bloquean, los seis que no, y
> las tres consultas de IA — redactado para que se entienda sin conocer la app.
> Este archivo es el interno (estado, qué se destraba con cada respuesta); ese
> otro es el que se manda. ⚠️ Antes de enviarlo hay que **decidir si va la
> sección C**, que depende de una decisión de producto abierta sobre Sofía.
Llevá los dos borradores ya completados (pasos 1 y 2) a un/a abogado/a. Puntos donde su revisión vale más (están marcados `[Validar con abogado]` en los textos):

- [ ] **Cláusula de jurisdicción frente a consumidores** (T&C §22) — tiene límites estrictos en Argentina; no se puede perjudicar al consumidor.
- [ ] **Mecanismo de consentimiento de datos sensibles** (Política §3) — cómo se obtiene y registra el consentimiento explícito para mood/diario/mensajes. 📌 **Investigado**: ver `consentimiento-datos-sensibles.md`. Queda una sola pregunta de fondo, y es para la AAIP, no para un estudio.
- [ ] 🔴 **Transferencia internacional de datos** (Política §7) — **el punto más flojo del borrador.** Ni Brasil ni EEUU están en la lista de países adecuados de la AAIP, y ahí van hoy el ánimo, el diario, la gratitud y los mensajes (Supabase, región `sa-east-1` / São Paulo). §7 solo dice que Vita "procurará" garantías adecuadas. El instrumento probable son las **CCM de la Res. AAIP 198/2023**. Ver la sección "Chequeo de jurisdicciones" más abajo.
- [ ] **Limitación de responsabilidad e indemnidad** (T&C §18–19) — qué se sostiene ante un juez argentino.
- [ ] **Aviso de salud y emergencias** (T&C §5) — redacción fina, sobre todo por tener psicólogos/as en la plataforma.
- [ ] **Cláusula anti-solicitación / no elusión** (T&C §10) — que sea ejecutable.

> Tip: aprovechá la misma consulta legal/contable que vas a necesitar por lo fiscal (IVA/figura) para que te revisen estos textos. Es la misma persona/estudio.

#### Consulta a futuro — recomendación de profesional asistida por IA

**No está construido ni decidido.** Se anota acá, y no en un pendiente de producto, porque
**lo que lo bloquea es legal, no técnico**: el desarrollo es de una sesión, pero depende de
respuestas que solo puede dar un/a abogado/a. Preguntarlo en la **misma** consulta que los
puntos de arriba no cuesta nada; preguntarlo después son semanas de espera.

*Contexto para pasarle al abogado/a, redactado para que se entienda sin conocer la app:*

> Vita quiere ofrecer que la persona escriba **en texto libre** qué le está pasando
> (ej.: *"hace tres meses que no duermo y estoy peleando con mi mamá"*) y que el sistema,
> usando un modelo de lenguaje de un proveedor externo, clasifique ese texto dentro de una
> lista cerrada de 28 temas predefinidos y le muestre profesionales que trabajan esos temas.
> El sistema **no** genera texto libre de vuelta, no diagnostica y no da consejo clínico:
> solo elige temas de una lista y ordena profesionales, igual que hoy hace un cuestionario
> de opción múltiple. Vita se declara intermediario (T&C §4) y expresamente no prestador de
> salud (T&C §5).

Preguntas concretas:

- [ ] **Naturaleza del acto.** ¿Clasificar un relato de malestar y sugerir a qué profesional
      acudir puede interpretarse como **triage** o acto sanitario, aun sin diagnóstico ni
      indicación terapéutica? ¿Cambia la respuesta si lo hace un algoritmo en vez de un
      cuestionario de opción múltiple, siendo que el resultado es el mismo?
- [ ] **Consentimiento.** El texto libre sobre malestar psíquico es dato sensible (Ley 25.326
      art. 7 y 8). ¿Alcanza el consentimiento general de Política §3 o hace falta uno
      **específico y separado** para este uso, con su propia pantalla?
- [ ] **Transferencia internacional.** El texto se envía a un proveedor de IA con servidores
      fuera de Argentina. Se cruza con el punto ya abierto de Política §7 — conviene
      resolverlos **juntos**, porque este suma la categoría más sensible de todas.
- [ ] **Conservación.** ¿Se puede guardar el texto que la persona escribió? ¿Por cuánto
      tiempo, y para qué usos (mejorar el sistema, auditoría, soporte)? ¿O hay que
      descartarlo apenas se resuelve la clasificación?
- [ ] **Responsabilidad.** Si la sugerencia resulta inadecuada para el cuadro de la persona,
      ¿qué exposición genera, y qué redacción la acota sin volverla una cláusula abusiva?

#### Segunda consulta, más chica — devolución escrita por IA en la pantalla de inicio

**Construida y apagada** (`constants/features.ts`, `AI_REFLECTION_ENABLED = false`).
Se anota aparte de la anterior porque **el dato que sale es mucho menor**, y eso
puede cambiar la respuesta:

> La app le muestra a la persona una frase sobre su semana ("Tu semana viene
> pareja. No todo tiene que ser un antes y un después"). **Qué decir lo decide un
> algoritmo en el propio teléfono**, con reglas fijas. Lo único que se le pide a
> un modelo de lenguaje externo es **redactar esa frase**.
>
> Lo que viaja al proveedor es: el nombre de la señal que eligió el algoritmo
> (`trend-up`, `streak`…), un tono (`gentle`/`neutral`/`warm`) y dos o tres
> números que ya aparecen en el texto (días de racha, sesiones de la semana,
> prácticas). **NO viajan los valores de ánimo, ni el historial, ni una sola
> palabra escrita por la persona.** En los hechos se transmite *"la app decidió
> decir algo alentador"*, no un estado emocional.

- [ ] ¿Ese payload —una etiqueta de categoría y tres enteros, sin identificador
      de la persona— constituye tratamiento de dato **sensible**, o queda fuera
      por no ser información sobre la salud de un titular identificable?
- [ ] Si queda fuera, ¿alcanza con declarar al proveedor en Política §6 como
      destinatario, sin el consentimiento específico que sí pediría el punto
      anterior?

> 🔴 **Reencuadre del 01/09/2026 — esta consulta dejó de ser autónoma.**
> Se escribió como si la transferencia al proveedor de IA fuera un problema
> nuevo. No lo es: es la transferencia **más chica** que hace la app, por varios
> órdenes de magnitud. Supabase ya guarda en EEUU el ánimo, el diario, la
> gratitud y el contenido de los mensajes — identificados y completos — y EEUU no
> está en la lista de países adecuados de la AAIP. **Si se resuelve el encuadre
> de esas transferencias, esta se resuelve con el mismo instrumento.** Mantener
> el flag apagado no protege de nada de lo anterior.
>
> **Ancla nueva a favor**, por si acorta la respuesta: TJUE, *EDPS c/ JUR*
> (C-413/23 P), 04/09/2025 — el carácter personal de un dato **no es absoluto**;
> los mismos datos seudonimizados pueden ser personales para quien los envía y
> no serlo para el receptor que no puede reidentificar. Acá el receptor no recibe
> identificador ni clave. Queda por confirmar si ese criterio se traslada al
> encuadre argentino.
>
> 📌 **Acción que no depende de ninguna respuesta:** pedirle a Anthropic el modo
> de **retención cero** (el dato se descarta al procesarlo). Achica la pregunta
> en cualquier escenario y no cuesta nada.

⚠️ **Independiente de la respuesta legal, hay un requisito de producto que no se negocia:**
la detección de crisis tiene que ser **determinística y correr ANTES del modelo**, no
después ni a cargo de él. Si el texto contiene expresiones de riesgo, el flujo corta y
muestra las líneas de T&C §5.3 (911 y 135), sin devolver ninguna recomendación ni precio.
Un sistema que ante *"no le encuentro sentido a nada"* responde con una tarjeta de coach y
un botón de reservar es el peor modo de falla que este producto puede tener.

### Paso 4 — Publicar y conectar en la app
Una vez revisados y aprobados:

- [x] ~~**Enlaces dentro de la app.**~~ Hecho el 06/08/2026: pantalla `/legal?doc=terminos|privacidad` desde el menú de perfil, y `LegalSheet` en el registro de usuario y en el de profesional. Muestran el texto real de estos `.md` (vía `npm run sync:legal`), no un resumen aparte.
- [x] ~~**Aceptación en el registro (email).**~~ El checkbox ya persiste en `profiles.accepted_terms` (antes se descartaba). El registro del profesional usa aceptación implícita, porque su pantalla es login y alta a la vez.
- [x] ~~**Aceptación en el registro con Google y Apple.**~~ Resuelto el 06/08/2026: el checkbox se movió **fuera** del formulario de email (antes vivía adentro, así que quien tocaba Google ni siquiera tenía dónde aceptar), los dos botones sociales quedan deshabilitados hasta tildarlo, y `signInWithGoogle`/`signInWithApple` reciben el flag y persisten `profiles.accepted_terms`.
- [x] ~~**Páginas web generadas.**~~ `npm run sync:legal` ahora emite además **`web/legal/terminos.html`** y **`web/legal/privacidad.html`**, del mismo texto que muestra la app (no pueden divergir). Responsive, con modo oscuro, y con el aviso de borrador mientras queden placeholders.
- [ ] **Hostearlas y obtener la URL pública.** App Store Connect y Google Play Console **exigen una URL pública** de la Política para poder publicar. **Dominio ya comprado: `vitaapp.com.ar` (13/08/2026)**, hosting decidido en Vercel. Falta conectar y cargar `https://vitaapp.com.ar/legal/privacidad` en las dos consolas — paso a paso en `docs/hosting.md`.
- [x] ~~**URL de solicitud de eliminación de cuenta (Google Play).**~~ Página escrita y generada: `docs/eliminar-cuenta.md` → `https://vitaapp.com.ar/legal/eliminar-cuenta`. Falta publicarla y cargar la URL en Play Console.
- [x] ~~🚨 **BORRADO DE CUENTA DENTRO DE LA APP**~~ — **YA EXISTE** (se construyó el 06/08/2026, este ítem había quedado desactualizado). `supabase/functions/delete-account/index.ts` (edge function con service role), `lib/accountDeletion.ts`, UI en `ProfileOwnScreen.tsx`. Modelo de borrado + anonimización documentado en `SCHEMA.md`. Cumple la guideline 5.1.1(v) de Apple.

### 🔴 Desajustes detectados el 25/08/2026 — los T&C describen un sistema que ya no existe

Después de la sesión de decisiones de pagos, los T&C quedaron **desactualizados en
siete puntos**. Todos son de la sección 8 y 9, y **cinco son afirmaciones falsas**,
no omisiones.

⚠️ **Uno de ellos ya era una contradicción interna antes de esta sesión.**

**1. §8.1 — "Los precios se expresan en pesos argentinos (ARS)."** 🔴 **Falso.**
Existe un precio en dólares (`coaches.price_usd`), independiente del de pesos y
fijado por separado, y hay medios que cobran en USD. Además **nada impide que
alguien en Argentina elija pagar el precio en dólares** — es la pregunta A.9 del
paquete.

**2. §8.2 — "Los pagos se procesan a través de Mercado Pago mediante un modelo de
marketplace (pago dividido). Cada Profesional conecta su propia cuenta."** 🔴
**Falso para dos de los tres rieles.** Hoy hay Mercado Pago, PayPal y USDT. Y en
los dos últimos **no hay pago dividido**: cobra Vita y le transfiere al Profesional
después. El Profesional no conecta ninguna cuenta propia ahí; declara adónde
quiere recibir.

**3. §8.3 — comisión 20% / 15%.** 🔴 **Incompleto.** En los rieles internacionales
es **25% la primera Sesión del vínculo y 20% las siguientes**. Y la frase "retenida
automáticamente en el momento del pago" **solo es cierta en Mercado Pago**: en los
otros dos entra todo a Vita y la comisión se descuenta al transferir.

**4. §8.5 — "Las retenciones que aplique el procesador sobre los fondos del
Profesional".** Asume que el procesador tiene los fondos del Profesional. Cierto
con el split de Mercado Pago; en los otros dos **los fondos pasan por Vita**.

**5. §8.7 — "La liberación de los fondos puede estar sujeta a plazos operativos del
procesador."** 🔴 **Incompleto, y es material para el Profesional.** En los rieles
internacionales la demora **no es del procesador**: es la política de Vita —pago
semanal y **solo por Sesiones ya realizadas**—. Eso hoy solo está escrito en el
documento explicativo del coach, que **no es un contrato**.

**6. §9.1 y §9.2 — "el reembolso se procesa de forma automática a través del
procesador de pagos."** 🔴 **Falso en el riel de USDT**: no hay procesador que lo
haga; lo ejecuta una persona. Es la pregunta **A.8**.

**7. 🔴 §9.1 contradice a §9.4, y esto ya estaba antes de esta sesión.** §9.1 dice
que dentro de las 24hs previas la Sesión **no puede cancelarse**. §9.4 reconoce un
**derecho de revocación irrenunciable de 10 días corridos** desde la confirmación
de la reserva. Alguien que reservó hace tres días y hoy está dentro de las 24hs
**sigue dentro de sus 10 días**. Los dos no pueden ser verdad a la vez, y **el
código implementa solo §9.1**. Es la pregunta **A.6**, ahora con el conflicto
identificado adentro del propio contrato.

**Además, no está previsto en ningún lado:**
- **Qué pasa ante un contracargo o una disputa** del medio de pago.
- **Que ciertos medios cobran en dólares**, y cuál es el precio aplicable en ese caso.

### 📌 PENDIENTE — reescribir los T&C desde cero, ANTES de la consulta legal

**Decisión de Andre, 25/08/2026.** El texto actual describe un sistema que ya no
existe, y parcharlo punto por punto deja un documento que se lee como capas.

🔴 **El alcance importa, porque hay dos cosas mezcladas en los siete desajustes:**

| Se reescribe AHORA | Se deja marcado como pregunta |
|---|---|
| **Cómo funciona el sistema**: los tres rieles, quién cobra en cada uno, en qué monedas, cuándo y cómo se le paga al Profesional, qué pasa ante un contracargo | **Qué consecuencias legales tiene**: si la cláusula de 24hs es oponible, si la garantía debilita el encuadre de intermediación, si se puede cobrar en dólares a un consumidor local |

**Lo primero solo lo podés hacer vos** —nadie más sabe cómo funciona— y hoy está
mal escrito. **Lo segundo necesita al abogado**, y adelantarse tiene dos costos:
se escribe texto que va a cambiar cuando llegue la respuesta, y **se lo ancla a
una redacción propia** en vez de preguntarle qué tendría que decir. Es exactamente
lo que `fiscal-instrucciones.md` ya se dijo a sí mismo: *"la pregunta correcta es
'¿qué tendría que decir acá?', no '¿esto está bien?'"*.

⚠️ **Esto NO frena las otras dos consultas.** La del contador y la de PayPal no
dependen de los T&C y se mandan igual. La del abogado espera la reescritura:
hacerlo leer una descripción falsa del sistema es pagarle por revisar algo que no
existe.

📌 **Y al reescribir, arrancar por §9.1 vs §9.4**, que es el único desajuste que no
vino de esta sesión: el contrato se contradice a sí mismo sobre un derecho que él
mismo llama irrenunciable.

📌 **Nada de esto se arregla escribiendo el texto ahora.** Cinco de los siete
dependen de respuestas que todavía no están (A.6 a A.9 del paquete, y la consulta
fiscal). Lo que sí conviene es **llevarle esta lista al abogado junto con las
preguntas**: es más barato que revise siete puntos de una vez que descubrirlos de a
uno.

⚠️ **Y hasta que se resuelvan, los T&C no se publican.** Ya estaban marcados como
borrador sin revisión legal; esto lo confirma.

### Faltantes detectados en la revisión del 10/08/2026

- [x] ~~🔴 **Botón de arrepentimiento + derecho de revocación.**~~ Escrito el 13/08/2026: **T&C §9.4** (la vieja 9.4 pasó a 9.5) + **página propia** `docs/boton-de-arrepentimiento.md` → `web/legal/arrepentimiento.html`, enlazada como botón destacado desde las otras dos páginas y accesible en la app desde el menú de perfil **también sin sesión iniciada**. ⚠️ **Corrección sobre lo que decía este ítem: el plazo es de 10 días CORRIDOS, no hábiles** — art. 34 Ley 24.240 lo dice con esas palabras; el texto se escribió con "corridos".
  - [x] ~~Falta la portada~~ — **creada el 13/08/2026**: `web/index.html`, generada por `sync-legal.mjs`, con el botón de arrepentimiento como botón destacado y el bloque de contacto. Falta **publicarla** (ver `docs/hosting.md`).
  - ⚠️ **Queda un punto para el abogado/a**, anotado como placeholder en §9.4: qué pasa si la Sesión ya se prestó dentro de los 10 días con conformidad expresa del Cliente — si el reintegro es total o proporcional. Los arts. 1110–1116 CCyC no contemplan expresamente esa hipótesis para servicios.
  - ⚠️ **No está implementado el circuito**: el código de identificación de la revocación dentro de las 24hs se manda a mano por mail, igual que la garantía de §9.3. A volumen bajo alcanza, pero es manual y hay que saberlo.
- [x] ~~🔴 **Implementar la garantía de §9.3.**~~ Construido el 13/08/2026: tabla `guarantee_claims` + edge function `guarantee-claim` (`scripts/add-guarantee-claims.sql`), con las 5 condiciones de la cláusula validadas automáticamente. **Falta correr el script y deployar la función.** ⚠️ **La premisa de este pendiente era falsa:** no hacía falta reescribir el `status` — `mp-process-refunds` filtra solo por `payment_status` y nunca mira `status`, así que una `completada` marcada `reembolso_pendiente` se reembolsa sola con su historia intacta. El intake sigue siendo el mail, como dice §9.3; operar la garantía está en `docs/garantia-runbook.md`. Sí quedan controlados el "una sola vez por Cliente" y la ventana de 48hs, que este ítem daba por imposibles de controlar. Texto original: Escrita pero sin mecanismo: hoy los únicos caminos a `reembolso_pendiente` son la cancelación y el vencimiento sin confirmar. Una Sesión ya `completada` no tiene forma de marcarse para reintegro sin reescribir su `status` a `'cancelada'`, que contradice el criterio de no reescribir historia. Hace falta una vía propia (columna/estado nuevo, o invocar el refund a mano). Tampoco hay control del "una sola vez por Cliente" ni de la ventana de 48hs — a volumen bajo se puede operar a mano desde el mail, pero hay que saber que es manual.
- [x] ~~🔴 **Declaración de mayoría de edad en el registro.**~~ Construido el 13/08/2026: checkbox propio "Declaro que tengo 18 años o más" en `RegisterScreen` (separado del de T&C, y habilita los tres métodos de alta por igual), constancia en `profiles.age_confirmed` (`scripts/add-age-confirmation.sql`), declaración agregada a la línea de aceptación implícita de `CoachLoginScreen`, y **chequeo duro** `< 18` contra `birth_date` en `CoachApplicationScreen`. Texto original del pendiente: T&C §3.1 dice que el Usuario "declara" ser mayor de 18 y Política §11 que no se recolectan datos de menores. En el registro no se pregunta la edad ni se declara nada: `birth_date` es opcional en `EditProfileScreen` y obligatoria solo para el coach (`CoachApplicationScreen`), y en ningún caso se valida que sean 18. Mínimo: un checkbox junto al de T&C.
- [x] ~~🔴 **Bloqueo de usuarios.**~~ Construido el 13/08/2026: tabla `blocked_users` + `are_blocked()` + triggers en `messages` y `bookings` (`scripts/add-user-blocking.sql`), entrada desde el perfil del coach y el menú "⋯" del chat, y pantalla "Cuentas bloqueadas" para deshacerlo. Escrito en **§14.3**. De las cuatro cosas que pide la guideline 1.2 quedan cubiertas filtrado (advertencia de datos de contacto), reporte y bloqueo; el **contacto** ya está escrito en la portada (`web/index.html`) y solo falta **publicarla** — ver `docs/hosting.md`.
- [x] ~~**Destinatarios de datos que faltan en Política §6.**~~ Escritos el 13/08/2026, **contrastados contra el código, y con dos correcciones a lo que decía este mismo ítem**: (1) el embed de YouTube **no está en `ResourceDetailScreen`** sino en `app/coach-recurso.tsx` (`react-native-youtube-iframe`) — `ResourceDetailScreen` solo abre links externos con `Linking.openURL`; (2) no es solo YouTube: `ResourceDetailScreen:51` reconoce también **Spotify y Google Drive**. Esa diferencia cambió la redacción: el **embed** sí es un destinatario (YouTube recibe IP y datos del dispositivo sin que el Usuario lo elija) y quedó en §6; los **links externos** no lo son —el Usuario sale de la app— y quedaron en un párrafo aparte. Google y Apple como proveedores de identidad también en §6. Los **permisos de dispositivo** (fotos/cámara, micrófono, calendario) NO son destinatarios: fueron a **§2.4**, aclarando que el calendario es de solo escritura y que la app funciona sin ellos. Texto original: Google y Apple como proveedores de identidad (`expo-auth-session`, `expo-apple-authentication`), YouTube por los videos embebidos (`react-native-youtube-iframe` en `ResourceDetailScreen`), y los permisos de dispositivo que la app pide — fotos/cámara (`expo-image-picker`) y calendario (`expo-calendar`). Tiene que quedar consistente con las etiquetas de las tiendas.
- [ ] **Inscripción en el Registro Nacional de Bases de Datos de la AAIP.** Obligación del Responsable, independiente del texto. Se hace por TAD. Con datos sensibles de por medio, la falta de inscripción funciona como agravante ante una denuncia o inspección.
- [ ] **`session_notes` tras la baja.** Se conservan (ver `SCHEMA.md`) — notas de un profesional sobre alguien que pidió irse. Es la pregunta más delicada del modelo de borrado y sigue sin respuesta del abogado.
- [x] ~~**Guardar `accepted_terms_at` y `accepted_terms_version`.**~~ Construido el 13/08/2026 (`scripts/add-terms-version.sql`, **corrido y verificado el mismo día**). La versión **se deriva del contenido**: `LEGAL_VERSION` en `constants/legal.ts` es el sha256 corto de T&C + Política, generado por `sync-legal.mjs` — un número mantenido a mano se olvida justo al editar el documento, que es cuando importa. Verificado que es determinístico, que cambia al tocar el texto y que vuelve al original al revertirlo. Texto original: La columna `accepted_terms_at` ya existe en la base y nadie la escribe; de versión no hay nada. Sin eso no se puede probar qué texto aceptó cada persona, que es justo lo que se discute al invocar §20 (modificaciones) y §10 (no elusión).
- [ ] ⚠️ **Las columnas de aceptación son falsificables por su propio titular.** `accepted_terms`, `accepted_terms_at`, `accepted_terms_version` y `age_confirmed` las escribe el cliente desde `AuthContext`, y aunque `scripts/lock-privileged-columns.sql` limita el UPDATE a esas columnas, su dueño sigue pudiendo escribirlas — por ejemplo una versión vieja para sostener que aceptó otro texto. El daño es acotado (solo su propia fila) pero debilita justo el valor probatorio para el que existen. Cerrarlo exige mover esa escritura a una edge function en el alta. Detectado 13/08/2026.
- [ ] **Etiquetas de las tiendas.** Completar las *App Privacy labels* (Apple) y el *formulario de seguridad de los datos* (Google) de forma **consistente** con lo que declara la Política (datos sensibles incluidos).

---

## Chequeo de jurisdicciones — 01/09/2026

> **Qué es esto.** Un relevamiento de qué normativa aplica más allá de Argentina,
> hecho al evaluar si la devolución con IA de Inicio es viable "a nivel global".
> **No es asesoramiento legal** — es material para que la consulta sea una
> pregunta afilada y no un pedido de razonar desde cero. Lo que se decide, lo
> decide el abogado/a; lo que está acá es para no volver a averiguarlo.
>
> Las preguntas que salieron de esto ya están escritas en
> `docs/paquete-abogado.md`: **A.3** (el instrumento de las transferencias),
> **B.5** (si aplica el RGPD) y **B.6** (Reglamento de IA).

### Lo que disparó el chequeo

La pregunta era si se podía encender la devolución escrita por IA. La respuesta
corta es **sí**, y el encuadre elegido —la señal se decide en el teléfono, al
modelo le llegan una etiqueta y tres enteros sin identificador— es lo que la hace
fácil. Pero el chequeo devolvió que **el riesgo real no estaba ahí**.

### Argentina

- **La lista de países adecuados de la AAIP** (Disposición 60-E/2016) son los
  Estados miembro de la UE y del EEE, Reino Unido, Suiza, Guernsey, Jersey, Isla
  de Man, Islas Feroe, Canadá (solo sector privado), Andorra, Nueva Zelanda,
  Uruguay e Israel (solo datos con tratamiento automatizado). **Ni Brasil ni
  Estados Unidos están.**
- 📌 **Dónde está el dato — verificado el 01/09/2026 con `supabase projects list`
  y contra el código, no estimado:**
  - **Supabase** → región **`sa-east-1`, São Paulo (Brasil)**. Ahí vive TODO lo
    sensible: ánimo, diario, gratitud, contenido de los mensajes. Empresa
    estadounidense, dato en Brasil — son dos preguntas distintas.
  - **Daily.co** → **no almacena nada**. Solo guarda si se activa su API de
    grabación, y `create-meeting-room` crea las salas sin `enable_recording`.
    Transporta audio y video, no los conserva.
  - **Expo** → guarda el **token** del dispositivo; el contenido de la
    notificación va por memoria y colas hasta entregarlo a Apple/Google, no a una
    base.
- ⚠️ **Corrección del 01/09:** la primera versión de esta sección puso a Supabase
  en EEUU sin verificarlo, y así viajó al paquete del abogado. El dato está en
  Brasil. La conclusión no cambia (tampoco es país adecuado), pero el país
  determina el instrumento. Comparado con esa primera fila, el payload de la IA
  sigue siendo ruido.
- El instrumento probable son las **Cláusulas Contractuales Modelo de la
  Resolución AAIP 198/2023** (las de la RIPD, de uso libre, variante
  responsable→encargado), o las de la **Disposición DNPDP 60/2016**.
- Del lado del proveedor de IA eso ya viene resuelto: el DPA con las SCCs
  europeas (Módulos 2 y 3) está incorporado a los términos comerciales de la API
  desde el 01/01/2026, sin firmar nada aparte.

### Unión Europea — aplica solo si hay usuarios allá

Lo dispara **"Sesiones desde el exterior"** (`docs/cobro-internacional-coaches.md`),
que está pensada explícitamente para que *"alguien en Madrid"* reserve. Ofrecer
servicios a personas en la UE activa el **art. 3(2) del RGPD**.

- ✅ **A favor: Argentina tiene decisión de adecuación de la UE** (2003/490/CE),
  revisada y mantenida en enero de 2024 junto con las otras diez, valorando la
  adhesión al Convenio 108+. El flujo UE→Argentina no necesita instrumento
  adicional. El problema sería el salto siguiente, Argentina→EEUU, que es el
  mismo de arriba.
- ✅ **A favor, y conviene que quede escrito: Vita NO es un "sistema de
  reconocimiento de emociones" del Reglamento de IA.** El art. 3(39) lo define
  como inferir emociones **a partir de datos biométricos**; acá la persona elige
  su ánimo tocando un botón. Es autorreporte, no inferencia. Las guías de la
  Comisión aclaran que ni siquiera el análisis de sentimiento sobre texto entra,
  por el mismo motivo. **Esto se anota para no volver a discutirlo**: es la clase
  de objeción que alguien va a levantar como bloqueante dentro de un año.
- ⚠️ **En contra: el art. 50(1)** — un sistema de IA que interactúa directamente
  con personas tiene que informarle a la persona que está interactuando con IA.
  Rige **desde el 02/08/2026**. Hay excepción cuando es "obvio", pero las guías
  de la Comisión advierten contra apoyarse en ella. Ver la consecuencia de
  producto en `docs/la-voz-de-sofia.md`.

### Estados Unidos — solo antes de expandir

La **My Health My Data Act de Washington** (vigente desde 03/2024) define
*consumer health data* incluyendo el **estado de salud mental**, exige
consentimiento opt-in para recolectar y compartir, autorización firmada aparte
para vender, política específica publicada, y tiene **acción privada** más multas
de hasta USD 7.500 por infracción. Es la norma más exigente del mundo para lo que
hace Vita. **No aplica sin residentes de Washington** — es un ítem a revisar antes
de cualquier expansión a EEUU, no ahora.

### Dispositivo médico — afuera, pero con un borde

Mientras Vita no reclame diagnosticar, tratar ni manejar una enfermedad, queda
fuera del MDR europeo: la norma dice que las apps de bienestar no son software de
dispositivo médico, y lo que define la línea es el **propósito declarado**. T&C §4
y §5 ya declaran intermediario y no prestador, así que el encuadre está bien.

⚠️ **El borde es el piso de seguridad** pendiente en `docs/la-voz-de-sofia.md`
§5 ter. Un mecanismo con umbral fijo que muestra las líneas de T&C §5.3 es
**derivación**, y es seguro. Uno que *evalúa el nivel de riesgo* empieza a
parecerse a triage — que es exactamente lo que ya se preguntó para la
recomendación asistida por IA. La distinción hay que tenerla a la vista desde el
diseño, no después.

### Por qué NO se tocó la Política de Privacidad todavía

Tentación evidente y equivocada, anotada para que no la repita el próximo que lea
esto:

- **§6 no puede declarar todavía al proveedor de IA como destinatario.** El flag
  está apagado: no recibe nada. Declarar un destinatario que no recibe datos es
  una afirmación falsa, igual que omitir uno que sí.
- **§7 no puede decir que hay cláusulas contractuales en vigor** hasta que las
  haya. El texto actual (*"procurará que existan garantías adecuadas"*) es débil,
  pero es honesto y lleva su `[Validar con abogado]`. Reemplazarlo por una
  garantía inexistente sería peor que dejarlo flojo.

Las dos se escriben **después** de la respuesta, no antes. El trabajo real de este
hallazgo es el de la lista de acciones del Paso 5, no un cambio de redacción.

---

## Paso 5 — Decisiones que esperan la respuesta legal

Esta sección existe porque el resto del archivo está escrito **hacia** el
abogado/a: son las preguntas. Acá va lo de **después** — qué hacer con cada
respuesta. Sin esto, la respuesta llega y no queda registrado en ningún lado
qué se destraba con ella.

**Nada de lo de abajo está pendiente de programar.** Está construido, apagado y
sin deployar. Lo que falta es una decisión, no trabajo.

### 5.1 — Devolución escrita por IA en Inicio 🔒 apagada

Lo construido está en el duodécimo y decimotercer bloque del changelog del
15-16/08/2026. La consulta correspondiente es la **segunda** del Paso 3
("Segunda consulta, más chica").

| Estado | Dónde |
|---|---|
| Flag del cliente | `constants/features.ts` → `AI_REFLECTION_ENABLED` (`false`) |
| Flag del servidor | ausencia de `ANTHROPIC_API_KEY` → la función devuelve 503 |
| Edge function | `supabase/functions/weekly-reflection/` — **escrita, no deployada** |
| Guardarraíl | `rejectCopy()` en `lib/weeklyReflection.ts`, con tests |
| Piso si algo falla | las reglas de `buildReflection()` — la app funciona igual |

**Si la respuesta es que el payload NO es dato sensible** (una etiqueta de
categoría y tres enteros, sin identificador):
1. Declarar al proveedor de IA en **Política §6** como destinatario, y la
   transferencia internacional en **§7** — con el instrumento que el abogado/a
   haya indicado en A.3, no con una fórmula genérica. Correr `npm run sync:legal`.
2. ~~Cargar `ANTHROPIC_API_KEY` en Supabase.~~ **Hecho** (sesión del 30/08, la
   key está cargada y verificada con `supabase secrets list`).
3. ~~`npx supabase functions deploy weekly-reflection`.~~ **Hecha** — v2, activa.
4. Pedir **retención cero** al proveedor. No depende de la respuesta legal: se
   pide igual, y achica la pregunta en cualquier escenario.
5. `EXPO_PUBLIC_AI_REFLECTION=true` y rebuild. ⚠️ `.env` está gitignoreado — hay
   que agregarlo también en la máquina de quien lo pruebe.
6. Si para entonces hay usuarios en la UE, la tarjeta necesita además decir que
   el texto lo escribe una IA (art. 50(1) — ver "Chequeo de jurisdicciones").

Los cuatro son independientes y **cualquiera que falte deja la app en el texto
determinístico sin romperse** — se puede avanzar de a uno.

**Si la respuesta es que SÍ es dato sensible:** hace falta consentimiento
específico y separado, con su propia pantalla, antes de encenderlo. En ese caso
conviene evaluar si vale la pena: la ganancia es de redacción, no de
funcionalidad, y el costo pasa a ser una fricción nueva en el onboarding.

**Si la respuesta no llega o queda en duda:** no hay que hacer nada *con la IA*.
Es el estado actual y la tarjeta funciona con el texto determinístico.

⚠️ **Pero eso NO deja la app en un estado seguro**, y hasta el 01/09/2026 este
archivo daba a entender que sí. El flag apagado solo evita una transferencia
mínima y anónima; las transferencias grandes —ánimo, diario, mensajes a
Supabase— ocurren igual, todos los días, con o sin IA. **Lo que hay que destrabar
es A.3, y eso no espera a ninguna decisión de producto.** Ver "Chequeo de
jurisdicciones".

### 5.2 — Recomendación de profesional asistida por IA 🔒 sin construir

Corresponde a la **primera** consulta del Paso 3. A diferencia de 5.1, acá no
hay nada escrito todavía — evaluado en 8/10 de viabilidad, con el grueso del
trabajo ya hecho (el contrato de salida es el mismo que produce hoy el quiz).

🔴 **Requisito de producto que no depende de la respuesta legal:** la detección
de crisis tiene que ser **determinística y correr ANTES del modelo**. Si el
texto trae expresiones de riesgo, el flujo corta y muestra las líneas de
T&C §5.3 (911 / 135) sin devolver recomendación ni precio. Eso se construye
primero, o no se construye nada.

## Mantenimiento
- Actualizar la **fecha** de cada documento cada vez que cambie.
- **Revisar el Paso 5 apenas vuelva el abogado/a**, aunque la consulta haya sido
  por otra cosa: son las dos features que quedaron esperando una respuesta.
- Re-revisar con el abogado ante cambios relevantes del producto (nuevos datos que se recolecten, nuevos proveedores, cambio de modelo de pago, etc.).
- Mantener la sección de mensajería (T&C §15 / Política §8.2) **siempre consistente con la realidad técnica**: mientras no haya cifrado de extremo a extremo real, no afirmarlo.

---
Este archivo es una guía operativa, no asesoramiento legal.
