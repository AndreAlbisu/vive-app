# Paquete para la consulta legal — Vita

> **Cómo usar este archivo.** Es lo que se le manda al abogado/a: contexto +
> preguntas, redactado para que se entienda sin conocer la app. El estado de
> cada punto (qué está construido, qué se destraba con cada respuesta) vive en
> `docs/legal-instrucciones.md` y **no** se manda — es interno.
>
> Antes de enviarlo: decidir si va la sección **C**, que depende de una decisión
> de producto todavía abierta.
>
> Los borradores completos están en `docs/terminos-y-condiciones.md` y
> `docs/politica-de-privacidad.md`, y publicados en
> `https://vive-app.vercel.app/legal/` (con aviso de borrador visible).

---

## Mail de encuadre

> Hola,
>
> Te escribo por **Vita**, una aplicación de bienestar y desarrollo personal
> para Argentina que estoy por publicar en App Store y Google Play. Tengo los
> Términos y Condiciones y la Política de Privacidad **redactados en borrador**
> y necesito una revisión antes de enviarla a las tiendas.
>
> No busco que los escribas de cero: están completos y contrastados contra lo
> que el sistema hace de verdad. Lo que necesito es (a) que valides los puntos
> donde no me alcanza el criterio, y (b) que me digas qué está mal.
>
> Abajo te dejo el contexto del negocio y las preguntas concretas, agrupadas
> por si bloquean o no la publicación. Los textos completos van adjuntos.
>
> Gracias,
> Andre

---

## 1. Qué es Vita y cómo funciona

**Quién opera.** Persona humana inscripta en Monotributo — no hay sociedad.
Actividad **631200 (Portales web)** a nivel nacional, y **631201** como
actividad provincial en el alta de IIBB de Córdoba (Monotributo Unificado).
Categoría A. Facturación tipo C, sin IVA discriminado.

**Qué hace la app.** Dos cosas conectadas:

1. **Un marketplace.** Los usuarios reservan y pagan sesiones por videollamada
   con profesionales — hay **coaches y también psicólogos/as**. La sesión ocurre
   dentro de la app.
2. **Contenido propio de bienestar.** Herramientas de 5-10 minutos: respiración,
   meditación, diario personal, registro diario de estado de ánimo.

**Cómo circula el dinero.** El cobro es con **Mercado Pago en modalidad
marketplace**: el usuario paga al reservar, Mercado Pago **retiene
automáticamente la comisión de Vita** y le acredita el resto al profesional. La
comisión es del **20% en la primera sesión de cada vínculo usuario–profesional y
15% en las siguientes**. Vita nunca tiene los fondos del profesional en su
cuenta. Los reembolsos se ejecutan contra el pago original, así que **salen de
los fondos del profesional** y Vita resigna su comisión.

**Posicionamiento declarado.** Vita se declara **intermediaria** entre usuarios y
profesionales (T&C §4) y **expresamente no prestadora de servicios de salud**
(T&C §5). No emplea a los profesionales.

**Qué datos se tratan.** Además de los de registro, hay **datos sensibles**:
registro diario de estado de ánimo, entradas de diario personal, y los mensajes
entre usuario y profesional.

⚠️ **Un punto sobre el que quiero ser explícito, porque suele darse por
supuesto: los mensajes NO tienen cifrado de extremo a extremo.** Hay una
ofuscación básica, no criptografía real. Los textos actuales (T&C §15 y Política
§8.2) lo dicen así, sin adornos, a propósito. Si te parece que esa redacción
expone de más o de menos, decímelo.

**Estado.** Pre-lanzamiento. La app funciona y procesó pagos reales de prueba,
pero no está publicada.

---

## 2. Preguntas, por orden de urgencia

### A. Bloquean la publicación

Estos cinco están marcados dentro de los borradores como
`[Validar con abogado…]` y son los que impiden sacar el aviso de "documento en
borrador" que hoy se muestra en la app y en el sitio.

**A.1 — Jurisdicción frente a consumidores (T&C §22.2).**
La cláusula hoy dice `[ordinarios de la Ciudad Autónoma de Buenos Aires / los que
correspondan]`. Entiendo que las cláusulas de jurisdicción frente a consumidores
tienen límites estrictos. ¿Qué corresponde poner, considerando que opero desde
**Córdoba** y los usuarios pueden estar en cualquier provincia?

**A.2 — Consentimiento de datos sensibles (Política §3).**
¿Cómo hay que **obtener y registrar** el consentimiento explícito para el
registro de ánimo, el diario y los mensajes? Hoy hay un checkbox de aceptación
de los Términos al registrarse, y se guarda fecha y una versión del texto
aceptado. ¿Alcanza, o los datos sensibles necesitan un consentimiento
**separado y específico**, con su propia pantalla?

**A.3 — Transferencia internacional de datos (Política §7).**
Los servidores están fuera de Argentina (Supabase). ¿Cómo hay que encuadrarlo
bajo la Ley 25.326 — cláusulas contractuales, países con nivel adecuado, otra
figura? ¿Y qué hay que decir en el texto?

**A.4 — Aviso de salud y emergencias (T&C §5).**
La redacción actual aclara que Vita no presta servicios de salud, no diagnostica
y no reemplaza atención profesional, e incluye líneas de crisis (911, y la línea
de asistencia al suicida 135 / 0800-345-1435). **Con psicólogos/as operando en
la plataforma, ¿esa redacción alcanza?** Es el punto donde más me preocupa
quedarme corto.

**A.5 — Efecto de la revocación sobre una sesión ya prestada (T&C §9.4).**
El botón de arrepentimiento da 10 días corridos (art. 34 Ley 24.240). Pero si la
sesión **ya se prestó** dentro de esos 10 días, con conformidad expresa del
cliente, ¿el reintegro es total o proporcional al servicio efectivamente
prestado? Los arts. 1110 a 1116 del CCyC no parecen contemplar expresamente esa
hipótesis para servicios. Necesito la cláusula redactada en consecuencia.

**A.6 — Cancelación dentro de las 24hs sin reembolso (T&C §9.1).**
Hoy quien cancela con menos de 24 horas de anticipación **pierde el reembolso**, y
la sesión **todavía no se prestó**. ¿Esa cláusula es oponible frente al régimen de
contratación a distancia de la Ley 24.240 y la Res. 424/2020? Es distinto de A.5,
que pregunta por una sesión ya prestada. Si no es oponible, el código está
implementando una penalidad que no se sostiene.

**A.7 — La garantía de §9.3 frente al encuadre de §4.1.**
Léelas juntas, por favor. §4.1 dice que Vita **no presta** servicios de coaching ni
de salud, y §9.3 ofrece **reintegrar la primera sesión** si la persona no quedó
conforme. ¿Ofrecer esa garantía debilita el encuadre de intermediación, o convive
sin problema como garantía comercial? Es el hecho más fuerte que un reclamo podría
usar para argumentar solidaridad en la cadena de comercialización.

**A.8 — §9 promete un reembolso que en un medio de pago no existe.**
§9.1 y §9.2 dicen que el reembolso "se procesa de forma **automática** a través del
procesador de pagos". Es cierto para Mercado Pago y PayPal. **Para los pagos en
criptomoneda (USDT) no hay procesador**: lo ejecuta una persona haciendo una
transferencia a mano. ¿Alcanza con aclararlo en la cláusula, o hay que comprometer
un plazo máximo? ¿Y qué plazo sería defendible?

**A.9 — Precio en dólares a un consumidor en Argentina.**
Un profesional puede fijar **dos precios**: uno en pesos y uno en dólares. Y puede
aceptar cobrar por medios en dólares (PayPal, USDT). **Nada impide que alguien que
está en Argentina elija pagar el precio en dólares** — puede ser lo que prefiera.
¿Hay algún problema con ofrecerle a un consumidor local un precio expresado en
dólares, si el precio en pesos también está disponible? ¿Cambia si el profesional
solo aceptó medios en dólares y entonces el precio en pesos no se le ofrece?

### B. No bloquean, pero quiero tu lectura

**B.1 — Limitación de responsabilidad e indemnidad (T&C §18–19).**
¿Qué de lo redactado se sostiene efectivamente ante un juez argentino en una
relación de consumo, y qué es letra muerta que conviene sacar?

**B.2 — Cláusula anti-elusión (T&C §10).**
Prohíbe que usuario y profesional se lleven la relación fuera de la plataforma
para evitar la comisión. ¿Es ejecutable? ¿Cómo se redacta para que lo sea sin
volverse abusiva?

**B.3 — Inscripción en el Registro Nacional de Bases de Datos (AAIP).**
Entiendo que es una obligación del Responsable, se hace por TAD, y que con datos
sensibles de por medio la falta de inscripción agrava ante una denuncia.
¿Confirmás? ¿Me guiás con el trámite o lo hago yo?
Además, la Política §11 tiene un espacio reservado para **la mención
informativa sobre la AAIP que la normativa exija** — decime qué texto va ahí.

**B.4 — Notas de sesión después de una baja de cuenta.**
Cuando alguien pide eliminar su cuenta, se borran o anonimizan sus datos. Pero
**las notas privadas que el profesional escribió sobre esa persona hoy se
conservan.** Es la pregunta más delicada del modelo de borrado: son
documentación del profesional sobre un tratamiento, y a la vez datos de alguien
que pidió irse. ¿Qué corresponde?

### C. Solo si decidimos que Sofía conversa — *decidir antes de enviar*

> **Nota interna, borrar antes de mandar:** esta sección solo va si se decide
> que el asistente sea conversacional. Si queda como router de destinos
> cerrados, se reemplaza por la pregunta de C.2, que es mucho más chica.

La app tiene un asistente llamado **Sofía**. Hoy es solo interfaz: cuatro
atajos que llevan a pantallas existentes, sin ninguna inteligencia detrás.
Estamos evaluando conectarlo a un modelo de lenguaje.

**C.1 — Chat abierto sobre malestar.**
Si Sofía conversa libremente, cada mensaje es texto libre de una persona sobre
cómo se siente, procesado por un proveedor externo fuera del país. ¿Qué exige
eso — consentimiento propio, aviso específico, algo más? ¿Y cambia el encuadre
de Vita como no prestadora de servicios de salud el hecho de tener un
interlocutor automático que responde sobre malestar emocional?

**C.2 — Clasificación de texto libre hacia un destino cerrado.**
Alternativa mucho más acotada, y la que probablemente elijamos: la persona
escribe qué necesita y el sistema **solo la deriva** a una de las secciones ya
existentes, o a profesionales que trabajan uno de 28 temas predefinidos. No hay
conversación ni respuesta generada. ¿Clasificar un relato de malestar para
derivar puede interpretarse como **triage** o acto sanitario, aun sin
diagnóstico ni indicación terapéutica?

**C.3 — Redacción asistida de un texto ya decidido.**
El caso más chico, y ya está construido y apagado esperando esta respuesta. En
la pantalla de inicio se muestra una frase sobre la semana de la persona ("Tu
semana viene pareja. No todo tiene que ser un antes y un después"). **Qué decir
lo decide un algoritmo en el propio teléfono**, con reglas fijas. Al proveedor
externo se le pide únicamente **redactar** esa frase, y lo que se le envía es:
el nombre de una categoría (`tendencia-en-alza`, `racha`…), un tono, y dos o
tres números enteros. **No se envían los valores de ánimo, ni el historial, ni
una sola palabra escrita por la persona, ni un identificador.**

¿Ese envío constituye tratamiento de dato **sensible**, o queda afuera por no
ser información sobre la salud de un titular identificable? Si queda afuera,
¿alcanza con declarar al proveedor en la Política como destinatario?

> ⚠️ Independientemente de la respuesta legal, ya está decidido del lado del
> producto que **la detección de expresiones de riesgo corre antes que
> cualquier modelo**, con reglas fijas: si el texto trae señales de crisis, el
> flujo corta y muestra las líneas de emergencia, sin devolver ninguna
> recomendación. No es negociable ni depende de esta consulta.

---

## 3. Lo que ya está resuelto y no necesita revisión

Para que no gastes tiempo ahí:

- **Baja de cuenta dentro de la app**, con borrado y anonimización, y su página
  pública de solicitud (exigida por Google Play).
- **Botón de arrepentimiento** como página propia, enlazada desde la portada sin
  requerir registro (Res. 424/2020), con el plazo de 10 días **corridos**.
- **Bloqueo y reporte de usuarios** (guideline 1.2 de Apple).
- **Declaración de mayoría de edad** en el registro, con constancia guardada.
- **Constancia de qué versión de los textos aceptó cada persona**, con fecha.
- **Garantía de primera sesión** (T&C §9.3) implementada y operable.
- **Plazos de conservación** definidos por tipo de dato (Política §10).

---

## 4. Qué necesito de vuelta

1. Los **cinco puntos de A** resueltos, con la redacción que corresponda.
2. Tu lectura de **B**.
3. La respuesta de **C** si esa sección quedó en el envío.
4. Cualquier cosa que veas mal y que yo no haya preguntado. Es lo que más me
   sirve.

Después de eso completo las fechas de vigencia, publico y saco el aviso de
borrador.
