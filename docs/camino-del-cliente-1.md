# El camino del cliente #1 — de dónde sale la primera transacción

> 08/09/2026. Abierto a pedido de Andre, como consecuencia de la segunda pasada
> sobre el Inicio del coach (`docs/inicio-del-coach.md` §0). **No es un plan: es
> el problema, escrito, con lo que se verificó y lo que queda por decidir.**
>
> Nada de acá está implementado.

## 1. Por qué existe este documento

La pregunta que se traía era *"¿qué cards van en el Inicio del coach?"*. La
respuesta resultó chica —medio día de trabajo, ver §0.4 del otro doc— y el peso
se movió a otro lado:

**El lanzamiento no depende de la Home del coach. Depende de un camino que hoy no
existe: el que va desde el WhatsApp del coach hasta la primera sesión pagada.**

El hallazgo que lo destapó, y que cazaron cuatro de cinco revisores por separado:
**nadie caminó el lado del cliente.** Dos rondas enteras de análisis sobre lo que
ve el coach, y ninguna sobre lo que le pasa a la persona que llega.

## 2. La tesis, y su objeción

**La tesis.** El día 1 VIVE no tiene demanda propia. El único que tiene clientes
reales es el coach: sus 4-10 personas que ya le pagan por transferencia. Eso no
es tráfico futuro, es GMV que existe hoy y está a un link de distancia. Con 10
coaches iniciales son decenas de transacciones reales en el mes 1, sin pauta y
sin SEO. Dicho crudo: **el día 1 VIVE no es un marketplace, es un riel de cobro +
video + notas para transacciones que ya existían afuera.**

El upside que lo hace algo más que un Calendly: **los clientes que el coach trae
son usuarios de VIVE desde el minuto uno.** Reservan con su coach y después ven
la app; esa persona vuelve a buscar para otro tema, otro momento. El coach paga
su propia adquisición y encima regala demanda cruzada. Es el playbook de
Calendly/Cal.com: la herramienta individual bootstrapea el marketplace, no al
revés.

**La objeción, que no tuvo respuesta en el consejo.** Si la jugada es que el
coach traiga su propia gente, entonces VIVE es un Calendly con comisión — y
🔴 **la comisión decreciente cobra el máximo justo en la primera sesión con
clientes que él ya tenía y que hoy le pagan el 100%.** Ese coach hace la cuenta
en la sesión 2 y se va. Es la medida anti-fuga #3 aplicada al usuario
equivocado.

**Es un problema de pricing, no de UI, y hay que resolverlo antes de pedirle al
coach que comparta el link.**

> ✅ **Decisión de Andre, 08/09/2026: no se toca la comisión — el link ofrece un
> DESCUENTO a quien entra por él.** Cambia el sujeto del beneficio: en vez de
> cobrarle menos al coach, la persona invitada paga menos. El coach pasa a tener
> un motivo para compartirlo (*"si venís por acá te sale más barato"*) en lugar
> de un motivo para evitarlo.
>
> ✅ **Lo absorbe VIVE** (decisión de Andre, 08/09/2026): sale de la comisión, no
> del precio del coach. El coach cobra su neto de siempre y **la persona invitada
> paga menos**. Que lo absorbiera el coach era la otra opción y habría empeorado
> el problema: cobrar menos *y* pagar comisión alta por gente que ya era suya es
> justamente la cuenta que lo hace irse.
>
> ✅ **Vale solo la PRIMERA sesión de esa persona en VIVE** (decisión de Andre,
> misma fecha). Acota la fuga clásica —que VIVE subsidie transacciones que iban a
> ocurrir igual— y encaja con la escalera: el descuento vive exactamente donde la
> comisión es más alta.

### 2.1 Cuánto descuento se puede dar — la pregunta de los costos de procesamiento

Andre preguntó si el margen aguanta, dado que parte de la comisión cubre el costo
de cobrar. **Verificado contra el código, y la respuesta es distinta según el
riel.**

**Riel LOCAL (Mercado Pago) — no hay piso de procesamiento.** El split se arma
con `marketplace_fee`, y el comentario de `mp-create-payment/index.ts:173` es
explícito: *"marketplace_fee = comisión pura (20/15%), SIN IVA"*, porque la
figura fiscal es Monotributo y la factura C no discrimina IVA. **La tarifa de
Mercado Pago se descuenta del lado del cobrador, no de la porción de VIVE.** O
sea que en Argentina el 20% de la primera sesión es margen limpio y el descuento
sale entero de ahí.

La aritmética, con el neto del coach intacto (precio 100):

| | Cliente paga | Coach cobra | VIVE se lleva |
|---|---|---|---|
| Normal, 1.ª sesión | 100 | 80 | **20** |
| Con 10% de descuento | 90 | 80 | **10** |
| Con 20% de descuento | 80 | 80 | **0** |

**El techo duro es 20%**, y ahí VIVE no gana nada en esa operación. Un descuento
del 10% deja 10% — y hay algo que parece una anomalía y no lo es: **la primera
sesión pasaría a rendir menos que las recurrentes (15%)**. Es coherente con la
lógica de la escalera y no en contra: el 20% de la primera existe porque
*"recupera el costo de ADQUISICIÓN del cliente"*
(`_shared/commission.ts`) — y en una reserva por link del coach **VIVE no pagó
ninguna adquisición**. Cobrar ahí como si la hubiera pagado es lo que no cierra.

**Riel INTERNACIONAL — acá sí hay piso, y es real.** En PayPal/USDT cobra VIVE,
así que paga la tarifa: **5,40% + USD 0,30** (tarifa oficial confirmada el
19/08/2026, en `lib/pricing.ts`), sin contar el spread de conversión, que se
evita manteniendo saldo en dólares. Y `commission.ts` dice que el costo operativo
de cobrar y transferir *"lo cubre la diferencia entre 25 y 20"*, o sea ~5 puntos.
Sobre una sesión de USD 50: comisión 25% = 12,50, costo PayPal ≈ 3,00, quedan
≈ 9,50. **Un descuento del 10% (USD 5) deja ≈ 4,50 — positivo pero fino.**

📌 **Conclusión práctica: fijar el número mirando el riel internacional, no el
local.** Un 10% funciona en los dos; más que eso empieza a comerse el margen
internacional antes que el local.

⚠️ **Un supuesto a confirmar antes de fijarlo:** que la tarifa de MP efectivamente
no toque la porción de VIVE. Se puede verificar contra el pago real de $1 que ya
se hizo (09/08/2026), mirando cuánto entró de verdad. Si esa suposición estuviera
mal, el techo local baja de 20% a ~14% y el número cambia.

📌 Requisito técnico que aparece con esto: **`bookings` tiene que saber por dónde
entró la persona.** Hoy no lo sabe. ✅ **Decisión de Andre: se diseña junto con
el link, no antes** — el link define cómo llega el dato (slug, query param,
código) y esa es la mitad que falta.

📌 El corolario que desactiva la objeción por el otro lado: **si el cliente se
queda por VIVE y no solo por su coach, la comisión se defiende sola.** Eso
depende de qué ve esa persona al terminar la sesión 1 — y hoy no está diseñado.

## 3. Lo que se verificó contra el código

- ✅ Están `react-native-web` y `react-dom`; `app.json` tiene
  `web.output: "static"`. O sea: un build web es posible.
- 🔴 **No hay hosting ni dominio deployado.** No existe la ruta pública.
- 🔴 **No existe `coaches.slug`.**
- 🔴 **No hay lectura pública del perfil por anon** para esa ruta.
- 🔴 **`app.json` no tiene `associatedDomains` (iOS) ni `intentFilters`
  (Android)**: hoy un link no abre la app.
- ✅ El backend de la transacción está entero y probado con plata real: Mercado
  Pago marketplace, PayPal, USDT, reembolsos, disputas, videollamada (Daily),
  notas de sesión.

**Conclusión: es la única infraestructura NUEVA del lanzamiento.** Todo lo demás
del backlog es ejecución sobre cosas que ya existen. Por eso no se puede estimar
antes de decidir su forma.

## 4. La decisión que bloquea a las demás — ✅ DECIDIDA: **A** (09/09/2026)

> ✅ **Decisión de Andre: el link RESERVA Y COBRA EN EL NAVEGADOR.** La app queda
> para después de tener la sesión agendada, que es cuando la persona tiene un
> motivo real para instalarla.
>
> **El consejo la votó 5 de 5**, y el argumento que cerró la discusión es que el
> pago **ya** ocurre en el navegador: Checkout Pro exige `back_urls` https, por
> eso existe `booking-return`. A no agrega un riel de cobro — le cambia el
> destino al 302.
>
> La objeción que sus revisores dejaron abierta —*nadie preguntó qué gana el
> coach mandando el link*— quedó resuelta antes, con el descuento yendo a él:
> cobra ~86% contra el 76% de siempre (§2.1).
>
> 📌 **Y buena parte de lo que el consejo creía faltante ya estaba**: el dominio
> `vitaapp.com.ar` apunta a Vercel desde el 14/08, las páginas legales están
> publicadas, `coaches.slug` quedó corrido el 08/09 y la lectura pública del
> perfil tiene las columnas justas.

🔴 **La pregunta original, que queda como registro de por qué:**

- **Si cobra en web:** el embudo se cierra en el navegador y la app queda para
  después de la reserva. Requiere hosting, checkout web y decidir qué riel de
  pago vive ahí. Es el camino que hace que el link sea un producto.
- **Si manda a la store:** el link es una landing y el embudo tiene un salto
  duro en el medio. Requiere deep links bien configurados para que la persona
  vuelva a caer en el coach correcto después de instalar — y aun así, cada paso
  corta.

⚠️ **Y hay un supuesto que nadie chequeó:** si la app todavía no está aprobada en
las tiendas, el segundo camino no lleva a ninguna parte.

## 4 bis. Por qué el código por mail es OBLIGATORIO en la web

> Anotado el 09/09/2026, al descubrir que en la app **el usuario final no
> verifica su mail**.

`profiles.email_verified_at` queda en **NULL para todos los usuarios finales**:
solo los coaches pasan por el código, como parte de su alta
(`lib/altaCoach.ts`). Es una decisión tomada y documentada, no un olvido.

🔴 **Pero lo que es razonable en la app deja de serlo en la web, y el motivo no
es de seguridad sino de canal.**

En la app, que alguien se registre con el mail mal tipeado es tolerable: tiene la
app instalada, ve el estado de su reserva adentro y le llegan las push. **El mail
es un canal más.**

Quien entra por el link del coach no tiene nada de eso. Si paga y su mail tiene
un error, no se entera de nada: ni de que la reserva quedó pendiente, ni de que
el coach la confirmó, ni de que **se venció a las 24hs y se le devolvió la
plata** (`expire_pending_bookings`). En la web el mail no es un canal más: **es
el único.**

📌 **Por eso el código de seis dígitos no es solo una forma de identificarse: es
la única manera de garantizar que el canal de contacto funciona ANTES de
cobrarle a alguien.** Cobrar sin tener cómo avisar es el problema que evita.

⚠️ **Esto se va a ver como una fricción innecesaria** cuando alguien mire el
embudo buscando pasos para sacar — "¿por qué le pedimos un código si ya puso el
mail?". La respuesta es esta, y por eso queda escrita acá y no solo en el código.

🟢 Y lo caro ya está hecho: **el código de seis dígitos existe y funciona**
(`VerificarMailScreen`, `signInWithOtp` + `verifyOtp`, plantilla con
`{{ .Token }}`). Se construyó para el alta de coach. La web usa lo mismo.

## 4 ter. 🔴 EL BLOQUEANTE REAL: la sesión ocurre en una app que no está publicada

> Encontrado el 09/09/2026, después de probar el checkout web de punta a punta
> con plata real. **Es el hallazgo más caro de todo este documento**, y apareció
> de una pregunta de Andre que parecía de marketing: *"¿el mail no debería
> hacerte descargar la app?"*.

**Hoy el camino web vende algo que el comprador no puede consumir.** Alguien
entra por el link del coach, elige horario, se identifica, paga, recibe los dos
mails… y la sesión es una videollamada que **solo existe dentro de la app**
(`lib/meetingRoom.ts` → `create-meeting-room`, abierta en `SalaScreen`).

Y las apps **no están publicadas**. No hay tienda de dónde bajarla; tampoco hay
links a las tiendas en ningún lado del repo. O sea: no es que haya fricción para
asistir, es que **no hay forma de asistir**, y en ningún momento se le dice.

🔴 **Es de la misma familia que los otros problemas de esta línea —prometer lo
que no se puede cumplir— pero es el más caro, porque acá ya hay plata cobrada.**

### Lo que cambia

El argumento del consejo para elegir la opción A fue *"la app queda para después,
que es cuando la persona tiene un motivo real para instalarla"*. Con las tiendas
sin publicar eso deja de ser una comodidad: **la web tiene que poder entregar la
sesión entera, o no hay lanzamiento.**

📌 El upside que el Expansionista mencionó al pasar —*"si la reserva vive en la
web, VIVE deja de necesitar la store para existir"*— **pasó de ventaja a
requisito.**

### 🟢 Y la buena noticia: la sala web es chica

`create-meeting-room` ya recibe un `booking_id` y el JWT de quien llama, y
devuelve **`room_url?t=<token>`: una URL de Daily que abre en cualquier
navegador**. Ya acuña el meeting token por participante y hace entrar al coach
como owner. Lo difícil —crear la sala privada, los tokens, la propiedad— está
hecho, probado y deployado desde el 28/08.

Falta una página `/sala` que lea la sesión, llame a esa función con el
`booking_id` y muestre la sala. La misma pieza sirve para las dos puntas.

✅ **HECHO el 09/09/2026**: `web/sala/index.html`. Lee la sesión, llama a
`create-meeting-room` con el `booking_id` y abre la sala de Daily en un iframe.
El link va en el mail de confirmación y en `/reserva`.

📌 **Una consecuencia del diseño que conviene entender**: el token de acceso de
Supabase dura una hora y no se guarda el de refresco, así que **quien entre
desde el mail el día de la sesión SIEMPRE va a tener que confirmar su mail de
nuevo**. No es un caso raro, es el normal — por eso la pantalla del código está
pensada como parte del camino y no como un error. `create_user: false` ahí: la
cuenta ya existe, y crear una nueva por un mail mal tipeado dejaría a la persona
mirando una sesión que no es suya.

⚠️ **Lo que esto NO resuelve: las apps siguen sin publicar.** La web ahora
entrega la sesión entera, así que el lanzamiento deja de depender de las
tiendas — pero el coach también necesita entrar, y hoy entra por la app. Si el
coach de la primera sesión no tiene la app instalada (dev build), no hay sala
para él. `web/sala` sirve para las dos puntas —`create-meeting-room` acepta al
coach y lo hace owner— así que el mismo link le funciona; falta que en algún
lado se lo demos.

## 5. El embudo, escrito entero

Lo que hoy no está caminado, paso por paso. Cada uno corta:

1. El coach comparte el link por WhatsApp. *(¿con qué texto? ¿lo escribe él?)*
2. La persona lo toca. *(¿qué ve: perfil, precio, horarios?)*
3. Instala / abre. *(salto duro si es por store)*
4. Se registra. *(¿mail, Google? ¿cuántos pasos?)*
5. 🔴 **Pasa el onboarding — que hoy está pensado para DESCUBRIMIENTO**, no para
   alguien que viene con nombre y apellido a ver a su coach de siempre. Es el
   paso más desalineado de todos.
6. Elige horario y paga.
7. Sesión.
8. 🔴 **Y termina la sesión, ¿y entonces qué?** Acá está el marketplace: *"viste
   ansiedad con Sofi, ¿querés ver quién trabaja sueño?"*. No existe.

## 6. `instant_booking` — por qué el default sigue en `false`

> ✅ **Decisión de Andre, 08/09/2026, en contra de la recomendación del consejo
> (4 de 5 asesores decían `true`): no se puede obligar a un coach a aceptar
> sesiones de gente random.** Es la parte que el consejo no pesó: para él la
> reserva instantánea era fricción a eliminar, y en realidad **es el único
> control que el profesional tiene sobre con quién se sienta a trabajar** —en un
> rubro donde eso no es un detalle operativo.

**Consecuencia, y es grande: se cae el argumento de que ese default "colapsaba la
mitad del backlog".** Con `pendiente` ocurriendo de verdad, vuelven al camino
crítico del lanzamiento:

- 🔴 **La card "Reservas esperando tu respuesta" en el Inicio** deja de ser
  opcional. Hoy el coach se entera por un punto rojo de 6px en otra pestaña.
- La fila `reserva_nueva` (ya hecha y deployada) pasa de red de seguridad a
  pieza principal.
- El timeout de 24hs de `expire_pending_bookings()` pasa a ser un camino que se
  va a recorrer seguido, no una excepción.

**Se evaluó y se descartó** una excepción por origen —instantánea para quien
entra por el link del coach, manual para el resto— con el argumento de que el
reparo era sobre *gente random* y eso excluye a quien el coach invitó.
❌ **Decisión de Andre: no.** El horario es una segunda pregunta, independiente de
quién sea la persona: **el coach igual tiene que aprobar si ese horario le queda
cómodo.** Conocer a quien reserva no vuelve conveniente el martes a las 8.

📌 O sea que `instant_booking` queda como está: **default `false` para todos, y
el switch por coach para quien lo quiera**. No hay excepción por origen, y la
columna de origen en `bookings` queda pedida solo por el descuento (§2).

## 7. Qué queda abierto

1. 🔴 **La forma del link** (§4). Bloquea todo lo demás. **Única decisión grande
   que queda.**
2. **El número exacto del descuento** (§2.1) — el marco ya está cerrado (lo paga
   VIVE, solo la primera sesión). Falta elegir el porcentaje mirando el riel
   internacional, y confirmar el supuesto de la tarifa de MP contra el pago real.
3. **Un camino de onboarding corto para quien llega invitado**, distinto del de
   descubrimiento (§5.5).
4. **Qué ve el cliente al terminar la sesión 1** (§5.8).
5. **Sin dueño y anotado aparte:** no hay screening de coaches ni protocolo de
   crisis, en una app que toca ánimo bajo Ley 25.326.
