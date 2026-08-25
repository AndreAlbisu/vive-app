# Pagos — dónde estamos y qué sigue

> Escrito el 25/08/2026, al cerrar la sesión 126. Consolida decisiones que
> estaban dispersas en `CHANGELOG_SESIONES.md`. **No es una lista de tareas: es
> un mapa de qué depende de qué**, porque la mitad de lo que falta no se puede
> construir todavía y conviene saber por qué antes de empezar.

## Lo que YA funciona

| Sesión | Cómo paga el cliente | Adónde va la plata | Estado |
|---|---|---|---|
| **Argentina** | Mercado Pago, pesos | **Directo al MP del coach** (split). VIVE no la toca. | Producción, probado |
| **Exterior** | PayPal, dólares | La cobra VIVE, le transfiere después | **Producción, probado 25/08** |
| **Exterior** | USDT (TRC20), dólares | La cobra VIVE, le transfiere después | Producción, probado 18/08 |

El coach elige **cómo recibe** lo del exterior, en Perfil → Datos de cobro:
**CBU** (pesos, sin costo) · **PayPal** (dólares, sin costo) · **USDT** (dólares,
USD 1,50 por envío a su cargo). Uno a la vez. Los pagos son **semanales y
agregados**, solo por sesiones ya realizadas, y se registran a mano en el panel.

---

## Bloque 0 — Antes de lanzar. No depende de nadie.

Lo único de esta lista que no espera a ningún tercero. Son dos, y las dos son
defaults viejos, no decisiones.

### 0.1 · Un coach sin Mercado Pago recibe reservas SIN COBRO 🔴

`mp-create-payment` devuelve 409, el cliente lo trata como caso benigno y sigue:
reserva confirmada, cero cobrado, sin comisión y sin protección para quien
reservó. El comentario del código ya lo anticipaba —*"cuando el pago sea
OBLIGATORIO, esto debería frenar la reserva"*— pero quedó así de cuando el pago
era opcional.

**Decidir entre dos:**
- **(a) Exigir MP conectado para publicar.** Más simple y más seguro: con el
  split, VIVE nunca toca la plata del coach — sin float, sin plata ajena en la
  cuenta, sin obligación de transferir.
- **(b) Que VIVE cobre también en pesos** y transfiera por CBU. La
  infraestructura ya existe casi entera; habría que ajustar `listCoachPayouts`,
  que excluye las reservas de MP porque ahí el split ya pagó. ⚠️ Pone plata
  ajena en la cuenta y **extiende al mercado local la pregunta fiscal** que hoy
  es solo del exterior.

**Recomendación: (a)**, y (b) solo si aparecen coaches reales que no puedan.

### 0.2 · La tarjeta de la sala puede cancelar otra sesión 🔴

`SalaScreen` lee las reservas una sola vez al montarse y no las relee al volver;
además la tarjeta muestra siempre la próxima, sin dejar elegir. Cancelar es
irreversible y puede disparar un reembolso. Apareció el 24/08 cancelando una
sesión por otra.

**Arreglo:** releer al enfocar la pantalla. Chico, pero toca una pantalla
central — probarlo en dispositivo.

---

## Bloque 1 — Bloqueado por el contador 🔴

**Una sola respuesta destraba las tres.** Es el pendiente más viejo del proyecto
y desde el 25/08 es también el más caro: el riel internacional está en
producción y puede entrar plata real en cualquier momento.

La pregunta, ordenada en `docs/fiscal-instrucciones.md`, es si **VIVE actúa como
principal o por cuenta y orden**.

### 1.1 · El sistema no emite ninguna factura
Cero referencias a ARCA/AFIP en todo el código. La cuota del Monotributo no
reemplaza la obligación de facturar.

### 1.2 · La sección "Qué facturás" del documento del coach
Bloqueada. Hasta que se cierre, **ese documento no se le manda a ningún coach**.

### 1.3 · Si conviene cobrar DIRECTO a la cuenta del coach
- **PayPal: técnicamente posible** — producto "Multi-party", con un OAuth por
  coach calcado del de Mercado Pago.
- **USDT: imposible.** En una transferencia on-chain directa no hay forma de
  retener comisión ni de reembolsar, y se cae el mecanismo que identifica los
  pagos por monto (funciona porque los centavos son un identificador **en
  nuestra wallet**).

🔴 **Lo que lo frena no es el código: cobrar directo convierte a cada coach en
exportador de servicios**, que es justo lo que el diseño actual evita y lo que su
documento le promete evitar. **Y la respuesta puede darlo vuelta entero:** si
VIVE es por cuenta y orden, el coach termina siendo exportador igual y cobrar
directo sería *más* coherente. Construir cualquiera de las dos arquitecturas
antes de esa respuesta es 50% de chance de tirarla.

⚠️ La contradicción de quién exporta vive hoy en **tres** lugares: T&C §8.5, el
changelog de la sesión 101, y un comentario en `CoachProfileScreen.tsx:313`.

---

## Bloque 2 — Tesorería. Depende de volumen real, no de terceros.

### 2.1 · Las dos mediciones de USD 50 🔴
Dólares de PayPal → pesos, y USDT → pesos. Las tarifas publicadas no incluyen el
spread, así que la única forma de saberlo es hacerlo. **Primero la de PayPal.**
Destraban: si el 2% de PayPal Payouts conviene o no (ver 2.3), y el margen real
del riel internacional.

### 2.2 · El techo de PayPal 🔴
**En Argentina no se puede cargar saldo en PayPal**: se retira a un banco local
(en pesos, obligatoriamente) pero no se ingresa por transferencia local.

> **Lo que se le paga a los coaches por PayPal está topeado por lo que entra por
> PayPal.** No es un costo que se pueda decidir pagar: es un techo.

Las otras direcciones sí funcionan: PayPal → pesos (con su spread), PayPal →
USDT (retirar a pesos y comprar, caro pero posible), USDT → pesos o → USDT
(directo). El techo casi nunca debería morder —PayPal es el riel principal—
pero **nunca prometerle PayPal a un coach sin entrada por PayPal que lo
respalde**.

⚠️ Confirmarlo en la cuenta: si no aparece "Agregar fondos", queda cerrado.

### 2.3 · Que el coach acepte VARIOS métodos de cobro
**Es la solución al problema de los pozos, y no cuesta un solo cliente.**

El coach marca **qué métodos acepta**, no cuál usa, y **VIVE elige al pagar**
según qué pozo tenga saldo. Nadie es indiferente entre pesos y dólares — pero
entre **PayPal y USDT sí puede serlo**, y ese es justo el par que causa el
problema.

- 🔴 **Resolver antes de construir:** hoy USDT le descuenta USD 1,50 al coach y
  PayPal no. Si el que elige pasa a ser VIVE, **el costo lo absorbe VIVE** — si
  no, el coach que aceptó los dos para ayudarnos cobra menos según qué pozo
  teníamos flojo.
- **El código no es grande: las columnas ya existen todas.** Cambia `method` de
  valor único a conjunto de habilitados; el panel tiene que dejar elegir con
  cuál se paga y registrar cuál se usó; la lógica que borra los datos del método
  inactivo pasa a borrar los de los no habilitados (sigue cubriendo el riesgo
  del destino viejo, que es real).

**Mientras tanto**, la palanca barata: ofrecer solo **CBU + PayPal**. El CBU se
alimenta desde los dos rieles y es una conversión que se hace igual; PayPal se
autoalimenta con el riel principal. **USDT como método de COBRO es el único que
puede obligar a comprar cripto** — sacarlo no le quita ninguna opción de PAGO al
cliente y es reversible.

### 2.4 · Decisiones de producto sueltas
- **Medios offline de Mercado Pago** (efectivo/Rapipago/cajero): acreditan días
  después, así que con la regla actual quien elija uno se queda sin reserva y su
  pago cae sobre una cancelada → reembolso. Se corta excluyéndolos en la
  preferencia (`excluded_payment_types: ['ticket','atm']`). Verificado: **no
  está puesto**.
- **El 15% plano en Mercado Pago**, que quedó afuera de la decisión del riel
  internacional.
- **La vía de retiro concreta** de los dólares (Prex, Belo, Payoneer, banco). No
  bloquea construir, sí lanzar.

---

## Bloque 3 — Deuda conocida, sin bloqueo

- **`bookings.cancelled_at`.** Hoy no hay ninguna columna que diga *cuándo* se
  canceló algo: el 24/08 la única forma de investigar una cancelación fue
  **descifrar mensajes de chat**. Se repite entero la próxima vez.
- **`UsdtPaymentScreen`** sigue con `router.replace('/(tabs)')`, el patrón que se
  arregló en `BookingScreen_Success` en la sesión 118. Hoy no se nota porque
  `(tabs)` tiene `gestureEnabled: false`.
- **`registrarEvento('reserva_confirmada')`** se dispara al insertar la reserva,
  antes del pago: cuenta como confirmadas reservas que se cancelan segundos
  después.
- **El checkout de PayPal abre Safari**, no la app: PayPal no reclama la ruta
  como universal link. No afecta la acreditación (es server-side) pero obliga a
  loguearse a mano — el paso donde históricamente se caen los pagos. La salida
  sería el SDK nativo, que es otra integración.
- **Sin probar en Android**, nada del riel de pagos.
- **Probar en dispositivo** la pantalla de datos de cobro con las tres opciones,
  y el cartel de espera nuevo.

---

## Análisis — dónde está la plata de verdad

> Escrito el 25/08/2026 mirando la matriz de conversiones. **La conclusión es
> que la matriz mide lo que menos importa.**

### 1. Hay dos costos mezclados, y uno es un orden de magnitud más grande

- **Costos de riel**: 2% de PayPal Payouts, USD 1,50 de red en USDT, transferencia
  bancaria gratis. Sobre un pago de USD 45 son entre 0 y 0,90 dólares.
- **Spread de conversión**: lo que se pierde al pasar de una moneda a otra.

🔴 **CORRECCIÓN (25/08, después de un análisis externo): la premisa original de
esta sección estaba mal.** Decía que la brecha entre convertir por PayPal y
convertir por cripto era el costo más grande del sistema, asumiendo una brecha
cambiaria grande entre el dólar oficial y el MEP. **Hoy esa brecha es de ~0,3%**
(verificado el 25/08/2026: MEP ≈ $1.524, oficial minorista ≈ $1.515). Elegir MEP
u oficial como referencia mueve centavos.

**Lo que sí es caro es el RIEL, no el dólar.** PayPal incorpora un recargo de
~3-4,5% dentro de su propio tipo de cambio al convertir, que no aparece como
comisión. Encadenado con el 5,40% + USD 0,30 de recepción y el costo del retiro,
**el riel de PayPal puede llevarse entre 9% y 14% del monto** — sobre una
comisión bruta del 25%, es la mitad del margen.

**Qué sobrevive de la conclusión original y qué no:**
- ✅ Sobrevive la regla de ruteo: fondear pesos desde PayPal sigue siendo peor que
  desde USDT, porque el markup de PayPal es real aunque la brecha de mercado no
  lo sea.
- ❌ No sobrevive la magnitud. No es "el costo más grande y desconocido del
  sistema": es ~3-4,5% de markup, medible y acotado.
- ✅ Sobrevive la necesidad de medirlo — pero lo que hay que medir cambió: es el
  **markup de PayPal**, no una brecha de mercado.

### 2. Eso reordena la matriz

Si la brecha existe —hay que medirla—, el orden real de conveniencia es:

1. **PayPal → PayPal** y **USDT → USDT**: gratis, sin conversión.
2. **USDT → CBU**: una conversión, por la vía que mejor cotice.
3. **PayPal → CBU**: una conversión **al tipo de cambio de PayPal**, que es el
   que no elegimos nosotros.
4. **PayPal → USDT**: dos conversiones, la primera al cambio de PayPal.
5. **USDT → PayPal**: imposible.

⚠️ **Corrige algo que se dijo antes en esta misma sesión** ("el CBU es el más
cómodo de fondear porque se llega desde los dos rieles"). Se llega desde los dos,
pero **no al mismo precio**, y la diferencia no es marginal.

> **Regla operativa: nunca fondear un pago en pesos desde PayPal si hay USDT
> disponible.** Es la decisión de ruteo que más plata mueve, y no cuesta nada
> implementarla — es elegir bien de qué pozo sale cada transferencia.

### 3. La política de ruteo, en tres pasos

Con varios métodos aceptados por coach (ver 2.3), cada semana:

1. **Llenar las diagonales gratis**: pagarle por PayPal a quien acepte PayPal,
   por USDT a quien acepte USDT, hasta agotar cada pozo.
2. **Lo que quede en USDT** financia los pagos en pesos.
3. **Lo que quede en PayPal** solo se convierte si no hubo con qué cubrirlo
   antes. **Nunca** PayPal → USDT.

No hace falta ningún motor: son dos pozos y tres destinos, se resuelve mirando el
panel.

### 4. 🔴 El agujero: el tipo de cambio no se decide ni se registra

`markCoachPaid(bookingIds, reference)` guarda **un texto libre** y nada más. El
panel muestra la deuda **en dólares** y quien transfiere elige a cuántos pesos
equivale, a mano. No hay columna que guarde el tipo de cambio ni el monto en
pesos.

Tres consecuencias, y las tres son de plata:

- **No se puede auditar.** Si un coach pregunta por qué recibió esos pesos, no
  hay con qué contestarle.
- **No se puede reconciliar.** Es imposible saber si VIVE ganó o perdió en la
  conversión, ni cuánto.
- **El documento del coach dice "cobrás en pesos, sin costo" sin decir a qué
  cambio.** Es la clase de ambigüedad que se descubre en la primera discusión, y
  la descubre el coach.

**Y es una decisión de negocio, no un detalle operativo.** Sobre 10 sesiones
semanales de USD 60, al coach le corresponden USD 450. Cada punto porcentual de
diferencia en el tipo de cambio son USD 4,50 por semana — más que todas las
comisiones de riel de esa semana juntas. Elegir mal el criterio, o no elegirlo,
pesa más que la diferencia entre cobrar 20% o 25% de comisión.

**Son dos problemas y conviene no mezclarlos** (precisión que aportó un análisis
externo del brief, 25/08): **qué criterio se promete** —ex ante, va en el
documento del coach— y **qué se registra** —ex post, va en la tabla—. El registro
**no es opcional en ningún escenario**: tipo de cambio, monto en pesos, fuente y
timestamp, se elija el criterio que se elija. Y es lo primero, porque es una
migración de tres columnas y es lo único que permite reconstruir qué se pagó si un
coach reclama tres meses después.

**Sobre el criterio, la recomendación es (B), una referencia pública** (MEP del día
del pago, con fuente y horario fijados por escrito). (A) suena más justo y es
indefendible en la práctica: depende de cuándo VIVE decidió vender, el coach no
puede verificarlo ni anticiparlo, y si se convierte en lote para varios coaches la
atribución por coach es arbitraria — convierte una decisión operativa nuestra en el
ingreso de otro. Con (B) el coach sabe el lunes cuánto va a cobrar el viernes.

🔴 **Y esto convierte la regla de ruteo en una restricción, no en una
optimización.** Si se promete MEP, los pesos **solo** se pueden fondear con USDT:
vender desde PayPal a un cambio sensiblemente peor que MEP es regalar la diferencia
en cada pago. `PayPal → CBU` deja de ser una celda cara y pasa a ser una celda
prohibida mientras la promesa sea MEP.

📝 **Y el riesgo de (B) es más chico de lo que parece, si el ruteo se respeta.**
VIVE tiene dólares, cuyo valor en pesos se mueve *con* el MEP: no hay exposición al
nivel del tipo de cambio, solo a la **brecha** entre el cambio realizado y el MEP.
Fondeando con USDT esa brecha es chica; fondeando con PayPal es justamente la que
no se controla. El criterio y el ruteo son el mismo problema.

**Corolario incómodo:** si el pozo de PayPal crece más rápido que los pagos por
PayPal, se acumula saldo que no se puede bajar a pesos sin perder. Eso da vuelta el
argumento de §2.3: **varios métodos aceptados no sirven solo para elegir el más
barato, sirven para poder DRENAR el pozo de PayPal** ofreciéndolo cuando sobra.

Los tres criterios, para dejarlos escritos:

- **(a) El cambio al que VIVE efectivamente convirtió**, mostrando el
  comprobante. Honesto y auditable; el coach asume la variación.
- **(b) Una referencia pública** (por ejemplo el dólar MEP del día del pago).
  Predecible para él; VIVE se queda con la diferencia o la pone.
- **(c) Pagar en dólares y que convierta él** — que es exactamente lo que
  resuelven PayPal y USDT como métodos de cobro.

**Y en los tres casos, guardar el número usado.** Hoy `payout_reference` es texto
libre; alcanzaría con dos columnas (`payout_fx_rate`, `payout_amount_ars`) para
que la conversión deje rastro.

### 3bis. Lo que un análisis externo afirmó y NO es cierto

Verificado contra el código el 25/08, porque se recomendaba tratarlo como
prioridad uno:

- ❌ **"El coach fija precio en dólares, el usuario argentino paga en pesos por
  MP, y alguien convierte sin registrar el tipo de cambio."** **No existe esa
  conversión.** El precio local (pesos) y el `price_usd` son **dos números
  independientes** que el coach fija por separado; `price_usd` no se deriva de
  ninguna cotización, y está documentado así a propósito. **No hay ningún tipo de
  cambio del lado del cobro, en ningún riel.**
- ⚠️ **"Conciliar por identificador en los centavos funciona hasta que dos
  reservas coinciden en monto."** El choque **no puede acreditar mal un pago**:
  hay un índice único parcial sobre `usdt_amount` y `usdt-create-payment`
  reintenta ante el `23505`. El modo de falla es "probá de nuevo", no un cobro mal
  asignado. **Lo que sí es cierto es el techo**: 2 decimales son 100
  combinaciones, o sea 100 reservas esperando pago al mismo tiempo — y está
  documentado en `_shared/usdt.ts`, junto con la salida (una dirección por
  reserva, no más decimales). Los 2 decimales tampoco son elección: las
  billeteras no dejan tipear más.
- ⚠️ **"El botón de arrepentimiento hay que sumarlo a la lista del abogado."** Ya
  existe como borrador (`docs/boton-de-arrepentimiento.md`), citando la misma
  Res. 424/2020, y ya está marcado como pendiente de revisión legal. **Lo que sí
  es aporte nuevo** es la pregunta de si la cláusula de "menos de 24hs, sin
  reembolso" es oponible frente al régimen de contratación a distancia — eso no
  estaba y va a la lista.

### 4bis. Contracargos — el agujero que no se cierra con una columna

Verificado en el código el 25/08, después de que un análisis externo lo señalara
como el riesgo ausente. Los tres hallazgos son peores que "no está en la lista":

- 🔴 **Un contracargo de Mercado Pago se registra como si fuera un reembolso
  normal.** `mp-webhook` mapea `charged_back → 'reembolsado'`, el mismo valor que
  usa para `refunded`. **En los datos son indistinguibles**: no se puede contar
  cuántos hubo, ni detectar un patrón, ni saber si un coach los acumula.
- 🔴 **Las disputas de PayPal son invisibles.** El webhook solo procesa
  `CHECKOUT.ORDER.APPROVED` y `PAYMENT.CAPTURE.COMPLETED`; cualquier otro evento
  se descarta con 200. Y el webhook registrado en producción **tiene suscritos
  exactamente esos dos eventos**, así que PayPal ni siquiera nos avisa. Una
  disputa debita el saldo de VIVE y **nada en el sistema se entera**.
- 🔴 **Nada mira `paid_out_at` cuando la plata se va para atrás.** La columna solo
  se usa para escribirla y para filtrar los pagos pendientes. Si un contracargo
  cae sobre una sesión ya transferida al coach, **la pierde VIVE, en silencio y
  sin ningún registro de que eso fue lo que pasó.**

**La exposición es estructural, no un caso de borde.** PayPal le da al comprador
hasta 180 días para disputar; el coach cobra a la semana de la sesión, sin mínimo
de acumulación y sin reserva retenida. Cada sesión pagada es exposición neta de
VIVE por medio año. Y sobre una videollamada, "el servicio no se prestó" es
dificilísimo de defender: no hay nada que enviar como prueba de entrega.

⚠️ **Sin verificar, y hay que hacerlo contra la documentación de Mercado Pago:**
en el split, un contracargo ¿debita al coach, a VIVE, o a los dos en proporción?
Si la plata fue directo a la cuenta del coach, la pregunta de contra quién va no
la contesta nuestro código.

**Lo mínimo que habría que hacer, en orden de costo:**
1. **Distinguir el contracargo del reembolso** en `payment_status`. Es un valor
   nuevo, y sin eso no se puede medir nada del resto.
2. **Suscribir los eventos de disputa de PayPal** y al menos dejar registro y
   aviso. Hoy no llegan.
3. **Cruzar contra `paid_out_at`**: si la reversión cae sobre una sesión ya
   pagada, marcarla — es plata que hay que recuperar o dar por perdida, y hoy
   nadie se entera.
4. Recién después discutir reserva retenida o retraso del pago, que es la
   mitigación cara y la que peor le cae al coach.

### 4ter. El pivot a cobro directo está GATED, no bloqueado por una decisión

Un análisis externo (25/08) propuso reemplazar todo el riel internacional por
**PayPal Multi-party con cobro directo a la cuenta del coach y comisión retenida
como platform fee** — espejo del split de Mercado Pago—, matando de paso USDT y
los payouts manuales. El argumento a favor es bueno: elimina el pozo, el ruteo,
el tipo de cambio de payout, el riesgo de congelamiento y el trabajo manual. Y el
costo (fragmentar el catálogo: quien esté en España solo ve coaches con PayPal)
**hoy es cero, porque el catálogo no tiene tráfico**.

🔴 **Verificado el 25/08 contra la documentación de PayPal, y el obstáculo no es
el que se suponía:**

- **Multi-party NO es self-serve.** Se solicita por formulario, un representante
  evalúa el negocio, aprueba la plataforma, se prueba en sandbox y hace falta otra
  aprobación para producción.
- **No hay lista pública de países** para el lado de la PLATAFORMA. Argentina no
  figura ni en la documentación de multiparty ni en la de plataformas. (Para
  **Payouts** sí figura, como "Send, receive, and withdraw" — son productos
  distintos, no confundirlos.)
- 🔴 **El filtro más probable es de VOLUMEN, no geográfico.** Hay plataformas
  rechazadas porque su volumen era demasiado bajo para calificar como cliente, y
  los mínimos no se publican. **VIVE tiene cero volumen real.**
- ⚠️ Quien recibe el platform fee **debe tener una cuenta bancaria vinculada** a
  su PayPal, y en Argentina esa cuenta tiene que ser en pesos. Cómo se liquida el
  fee en ese caso es una pregunta concreta para PayPal.

**Consecuencia para la secuencia, que es lo que importa:** no se puede desarmar el
riel actual antes de tener la aprobación, y la aprobación probablemente exija un
volumen que solo el riel actual puede generar. **El pivot no es una decisión que
se pueda tomar hoy: es una solicitud que conviene iniciar hoy** —es gratis y
lenta— mientras lo que existe sigue funcionando. Pedirlo no rompe nada: la
integración actual (VIVE como comerciante) es un producto distinto y sigue igual.

**Si Multi-party no se otorga**, la alternativa propuesta fue **dLocal for
Platforms** (payins, payouts y split en una integración, liquidando en USD a
cuenta internacional, 4-6%). Sin evaluar. Es proveedor nuevo e integración nueva,
así que solo entra en la conversación si PayPal dice que no.

### 5. Qué medir, y en qué orden

Las mediciones que ya estaban pendientes son **exactamente los insumos de este
análisis**. Con una precisión que antes no estaba: hay que anotar, el mismo día y
para el mismo monto, **contra qué referencia** quedó cada una.

1. **USD 50 de PayPal → pesos.** Anotar los pesos que llegaron y la cotización de
   referencia de ese día. Da el tipo de cambio efectivo de PayPal.
2. **USD 50 de USDT → pesos.** Lo mismo.
3. **La brecha entre los dos es el número que decide todo lo de arriba.** Si es
   chica, la regla de ruteo es una optimización menor. Si es grande, es la
   decisión económica más importante del riel internacional.

### 6. Lo que NO haría

- **Especular con el momento de convertir.** Eso es tomar posición en el dólar,
  no optimizar costos.
- **Automatizar la conversión.** Con este volumen, la decisión semanal se toma
  mirando el panel.
- **PayPal → USDT, nunca.** Siempre hay una forma mejor: pagarle en USDT a otro
  coach y en PayPal a este.

---

## Orden sugerido

0. **Decidir el criterio del tipo de cambio** y guardarlo (§4 del análisis). Es
   barato, no depende de nadie, y es requisito para poder medir cualquier otra
   cosa — hoy cada transferencia en pesos se hace a un cambio que nadie anota.
1. **Bloque 0** — es lo único que no espera a nadie y lo único que es un agujero
   real al lanzar.
2. **La hora con el contador** — no porque haya que construir algo después, sino
   porque destraba tres cosas a la vez y cada día que pasa con el riel en
   producción es más caro.
3. **La medición de PayPal → pesos** — un movimiento de USD 50, y da el número
   que falta para cerrar el margen.
4. **Bloque 3**, en los huecos: son chicos, independientes entre sí y ninguno
   necesita una decisión.
5. **2.3 (varios métodos de cobro)** cuando haya volumen real que lo justifique.
   Antes es optimizar un problema que todavía no existe.

## Al pasar a producción algo nuevo, releer esto

Tres cosas que ya costaron caro y son fáciles de repetir:

- **El webhook id es por app y por modo.** El de sandbox no sirve en live y
  viceversa; el síntoma es 401 en cada notificación, sin capturar nunca, **sin
  error visible en la app**. Está `supabase/functions/paypal-diagnostico/` sin
  deployar para exactamente esto.
- **Los secrets se leen al arrancar.** Cambiar uno sin redeployar deja un estado
  indistinguible del correcto hasta que alguien pierde un pago.
- **Cerrar las reservas de prueba ANTES de cambiar de modo.** Un reembolso de
  una captura de sandbox pedido contra la API de producción es un 404, seis
  intentos y dead-letter — el pozo del que `2c72b126` no salió desde julio.
