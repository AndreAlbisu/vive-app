# Pagos — decisiones abiertas

> Salida de un intercambio de seis rondas entre dos análisis (25/08/2026). El
> razonamiento completo y qué se verificó está en `docs/plan-pagos.md`; acá está
> solo **lo que hay que decidir**, con opciones y consecuencias.
>
> **Nada de esto es un bug que haya que apagar.** No hay un solo cliente real
> todavía: es fijar el comportamiento correcto antes del primer usuario. Por eso
> conviene que quede escrito como decisión y no como fix — quien vea después el
> contador sin filtro va a pensar que es un descuido y "arreglarlo" al revés.

## Mapa rápido

| # | Decisión | Espera a | Urgencia |
|---|---|---|---|
| ~~D1~~ | ~~Principal o agente~~ | — | ✅ **DECIDIDA 25/08: AGENTE** |
| ~~D2~~ | ~~Cómo se clasifica una operación como internacional~~ | — | ✅ **DECIDIDA 25/08: país observado en la reserva** |
| D3 | Si las sesiones internacionales avanzan el contador de tramos | Nadie | Cobra mal hoy |
| D4 | Alcance de la regla espejo | Nadie | Elimina cuatro problemas de una |
| D5 | Mínimo por riel (solo si D4 = por reserva) | D4 | Antes de escribir el agrupamiento |
| D6 | Coach sin Mercado Pago conectado | Nadie | Agujero al lanzar |
| D7 | USDT: ofrecerlo o no | Runbook de reembolso | Antes de que haya volumen |
| D8 | Criterio y registro del tipo de cambio | Nadie | El registro es incondicional |
| D9 | Multiparty: pedirlo o no | Nadie | Es lento, conviene empezar |
| D10 | Contracargos | Nadie | Invisible hoy |
| D11 | Filtro por ubicación en el checkout | D2 y D3 | Baja a decisión de producto una vez desacoplado |

---

## D1 · ¿VIVE es principal o agente? — ✅ DECIDIDA: **AGENTE** (25/08/2026)

> **Decisión de Andre, 25/08/2026.** Y no fue elegir entre dos opciones abiertas:
> **los T&C ya dicen agente en cuatro cláusulas**, así que principal habría
> significado reescribir el encuadre central de un documento que los usuarios ya
> aceptan.
>
> - **§4.1** — "Vita es una plataforma tecnológica de intermediación… **no presta
>   por sí misma** servicios de coaching, psicología, nutrición ni ningún servicio
>   de salud".
> - **§4.2** — "La relación contractual por la Sesión se establece entre el
>   Cliente y el Profesional. **Vita no es parte de esa relación**, más allá de
>   facilitar la conexión, la agenda y —cuando corresponda— el procesamiento del
>   pago".
> - **§8.5** — "Vita **no emite comprobantes por la Sesión** … sino únicamente por
>   su comisión".
> - **§18.1** — no responde por "la conducta, idoneidad, cumplimiento o
>   prestaciones de los Profesionales".
>
> **Lo que se evita:** ser el prestador de sesiones de salud mental, y que el
> ingreso declarable pase a ser el **ticket completo** — VIVE es Monotributo
> (§8.4), así que bajo principal el tope de categoría se consumiría cuatro o
> cinco veces más rápido que facturando solo la comisión.
>
> **Lo que se asume:** en el riel internacional VIVE recibe el 100% del ticket en
> su cuenta, y bajo agente eso **no es ingreso: es plata de terceros**.
> Contablemente un pasivo, con su propia superficie regulatoria. 🔴 **Eso convierte
> la regla espejo (D4) y multiparty (D9) en estructurales y no en optimizaciones:
> son las dos formas de reducir cuánta plata ajena se tiene y por cuánto tiempo.**

### Trabajo que se desprende de la decisión

1. **Reescribir el razonamiento de la sesión 101** ("cobra Vita para tener un solo
   circuito"). Bajo agente, VIVE cobra **por cuenta y orden**. El motivo real es
   más simple y alcanza: Mercado Pago no procesa tarjetas emitidas fuera del país.
2. **Corregir el comentario de `screens/CoachProfileScreen.tsx:313`** — *"él nos
   factura a nosotros en vez de al usuario"* es la formulación de **principal**, y
   contradice directamente §8.5.
3. **Revisar la promesa del documento del coach**: "cobrando VIVE, ese circuito es
   uno solo" (o sea, vos no exportás). Si el criterio de exportación es dónde se
   aprovecha el servicio, bajo agente esa promesa es probablemente falsa. La
   sección ya está bloqueada esperando al contador, así que **no se mandó a nadie**.
4. 🔴 **Para el abogado: §9.3 (garantía de primera sesión) al lado de §4.1.** VIVE
   ofrece un reintegro por una prestación que §4.1 dice que no presta. Es
   defendible como garantía comercial, pero es el hecho más fuerte que un reclamo
   podría usar para argumentar solidaridad en la cadena. Que las vea juntas.

### Lo que esta decisión NO decide

No obliga a cobrar directo: un agente puede cobrar por cuenta y orden, que es lo
que se hace hoy. Lo que sí hace es **quitar la justificación que se venía dando**
para cobrar.

<details>
<summary>El análisis previo a la decisión</summary>

## Comparación original

**Qué se decide:** si VIVE le vende la sesión al usuario (y el coach le vende a
VIVE), o si el coach es el vendedor y VIVE cobra una comisión por intermediar.

🔴 **No lo determina el contador: lo determinan ustedes.** El contador confirma
la implementación de la decisión que tomen.

| | **Principal** | **Agente** (recomendado) |
|---|---|---|
| El coach | Factura local en pesos a VIVE. No exporta nada, no toca factura E. | Es el vendedor. Puede ser **exportador** cuando el cliente está afuera. |
| VIVE | Es el prestador: responde por la prestación bajo Ley 24.240. | Intermedia. Responsabilidad acotada. |
| Ingreso declarable de VIVE | El **ticket completo** | Solo la comisión |
| Riesgo | 🔴 Responder por la prestación en una app de **salud mental** no es un tecnicismo | El coach carga con la fricción de exportar |

**A favor de agente:** es lo que ya son en el 100% del volumen local (el split de
MP), evita la responsabilidad de principal sobre sesiones de salud mental, y
mantiene el ingreso declarable en la comisión.

🔴 **El punto que hay que llevarle al contador:** si son agentes, **el coach
podría ser exportador tenga o no VIVE en el medio** — el criterio de exportación
no sería la nacionalidad del cliente sino **dónde se aprovecha el servicio**. Si
eso es así, el diseño actual (cobrar VIVE para que el coach no exporte) **no
evita nada: lo esconde**, y a cambio le mete a VIVE un riesgo de tesorería.

📝 Y exportar sería menos grave de lo que suena: la factura E no lleva IVA, se
puede emitir en moneda extranjera, no suma al tope del monotributo, y desde la
Com. A 8330 del BCRA se puede cobrar del exterior sin límite y sin pesificar. El
costo real para el coach sería habilitar un punto de venta E. **Sin verificar —
es exactamente lo que hay que preguntar.**

</details>

---

## D2 · ¿Cómo se clasifica una operación como internacional? — ✅ DECIDIDA (25/08/2026)

> **Decisión de Andre, 25/08/2026: por el PAÍS OBSERVADO al momento de reservar**,
> guardando la procedencia del dato, y con **nulo** —nunca `AR`— cuando no hay
> observación.
>
> **Por qué ahora y no después:** con D1 (agente) lo que VIVE declara es su
> comisión, y **la comisión depende de si la operación es internacional**. Una
> clasificación mal hecha no es solo una etiqueta: es facturación mal hecha.
>
> **Se aceptó que es un proxy.** El servicio se aprovecha en la sesión, no en la
> reserva, y quien reserva puede viajar en el medio. Se elige igual porque la
> alternativa —observar en la sesión— exige capturar ubicación durante una sesión
> de salud mental: dato sensible bajo la 25.326 que habría que declarar en una
> política de privacidad **que todavía tiene placeholders esperando al abogado**.
> Sumar una recolección nueva a un documento que no existe es garantizar que no
> coincidan. Si el contador dice que hace falta, se agrega después, con el
> criterio conocido y el texto legal escrito.

### Las dos reglas que van pegadas a la decisión

🔴 **1. Guardá observaciones, derivá la clasificación. Nunca persistas
`es_internacional` como si fuera un hecho.**

Se guarda **qué país se observó**, **de dónde salió el dato** (locale del
dispositivo, IP, declarado) y **cuándo**. La clasificación se calcula al
consultarla.

El motivo es directamente D1: la respuesta del contador **puede definir el
criterio distinto** de como se asume hoy. Con un booleano guardado, aplicar el
criterio nuevo obliga a reescribir historia; con observaciones, se vuelve a
derivar y no se toca ninguna fila. Guardar la procedencia importa tanto como el
valor: locale, IP y declarado tienen confiabilidades distintas, y en dos años esa
diferencia va a pesar más que el país.

🔴 **2. El default es NULO, nunca `AR`.** La derivación trata el nulo como **"sin
clasificar"**, no como "local". Un default silencioso es indistinguible de un dato
real a los seis meses, que es exactamente lo que guardar la procedencia intenta
evitar. **Como todas las reservas internacionales que existen son de prueba, la
salida limpia es borrarlas** en vez de backfillear nada.

📝 Precedente de la familia de errores que esto evita: el `?? 20` de
`platform_fee_pct` en `lib/admin.ts`, documentado como "no debería activarse
nunca". Así empiezan.

### Cómo se relaciona con la comisión

Son cosas con vidas distintas y la tentación va a ser unificarlas:

- **La observación** se guarda (hecho, inmutable).
- **La clasificación** se deriva de la observación (puede cambiar si cambia el
  criterio).
- **La comisión se SELLA en la reserva** — se decide una vez, con la clasificación
  vigente en ese momento, y no se recalcula nunca. Derivarla al consultarla haría
  que un cambio de criterio moviera retroactivamente lo ya cobrado.

<details>
<summary>El análisis previo a la decisión</summary>

## Comparación original

**Hoy la clasifica el RIEL, y el riel lo elige el usuario.** Un argentino que
elige PayPal genera una operación que parece exportación —dólares, riel
internacional, comisión del 25%— y no lo es.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Por riel** (hoy) | Cero trabajo | 🔴 Incorrecta, y **la controla el usuario**. Sin esto arreglado, la consulta a D1 no se puede ni formular: el sistema no sabe cuáles operaciones son internacionales |
| **(b) Por país observado en la reserva** (recomendado) | Es un dato, no una inferencia. Reconstruible | Es un **proxy**: el servicio se aprovecha en la sesión, y quien reserva puede viajar |
| **(c) Por país en el momento de la sesión** | Más cerca del hecho fiscal | 🔴 Capturar ubicación en una sesión de salud mental es dato sensible bajo la 25.326 y hay que declararlo en la política de privacidad, **que todavía tiene placeholders esperando al abogado** |

**Regla que sale de esto, y es la más importante de todo el documento:**

> **Guardá observaciones, derivá la clasificación. Nunca persistas
> `es_internacional` como si fuera un hecho.**

Se guarda qué país se observó, **de dónde salió el dato** (locale, IP, declarado)
y cuándo. La clasificación se deriva al consultarla. Motivo: la respuesta de D1
puede definir el criterio distinto de como se asume hoy — con un booleano
guardado habría que reescribir historia; con observaciones, se vuelve a derivar y
no se toca nada.

**Sub-decisión: qué pasa con las reservas sin país observado.** Recomendación:
dejarlo **nulo** y que la derivación trate el nulo como "sin clasificar", nunca
como "local". Un default silencioso es indistinguible de un dato real a los seis
meses. Como todas las reservas internacionales existentes son de prueba, la
alternativa limpia es **borrarlas**.

</details>

---

## D3 · ¿Una sesión internacional avanza el contador de tramos?

**Hoy sí.** `countsAsCompletedSession` no filtra por `payment_provider`, así que
una sesión pagada por PayPal o USDT hace que **la próxima sesión local de ese par
se cobre 15% en vez de 20%**.

🔴 **El propio código argumenta en contra.** El comentario de
`_shared/commission.ts` dice que la escalera existe porque en Argentina VIVE
"deja de aportar" después de la presentación, mientras que en el exterior "cobra,
retiene y transfiere en cada sesión, **para siempre**". La escalera no es un
descuento por fidelidad: es una **renuncia progresiva a cobrar por algo que ya no
se está haciendo**. Esa premisa nunca se cumple en el riel internacional.

**Recomendación: que no cuenten.** La escalera y el 25% plano son dos regímenes
con lógicas distintas, y una sesión no debería contar en un régimen que no la
generó.

**Sub-decisión que NO cae sola** — el borde de esa regla: si las internacionales
no cuentan, un par que hizo una internacional y después hace una local **paga la
prima de adquisición del 20%** en la local, cuando VIVE ya los presentó y ya
cobró 25%.

- **A favor de cobrar el 20%:** el 25% no era una prima de adquisición sino el
  precio del servicio continuo de esa sesión; la prima local no se cobró nunca.
- **En contra:** la presentación ocurrió una sola vez.

⚠️ El escenario es el público del producto: alguien toma una sesión desde Madrid,
vuelve a Buenos Aires y reserva con el mismo coach.

---

## D4 · Alcance de la regla espejo

**La regla:** pagarle al coach solo por el riel por el que se cobró.

| Opción | Pros | Contras |
|---|---|---|
| **(a) No aplicarla** (hoy) | — | Obliga a mantener pozos, ruteo, conversiones y criterio de tipo de cambio |
| **(b) Espejo por coach** | Concentra la acumulación en un solo pozo por coach | El coach elige y esa elección le cierra rieles de pago a sus clientes |
| **(c) Espejo por reserva** (recomendado) | El coach no elige nada: cobra por el riel que usó cada cliente | 🔴 **Fragmenta la acumulación** — ver D5 |

**Lo que la regla elimina (no resuelve: elimina):** el pozo, la regla de ruteo,
el criterio de tipo de cambio del payout —no habría ningún pago en pesos desde
VIVE— y el problema de drenar PayPal.

**No es integración nueva:** es borrar opciones y filtrar en el checkout, un
subconjunto estricto de lo que ya está construido.

**Costo residual:** un coach que solo quiere pesos no puede atender al exterior.
Hoy eso es **un** coach, y la conversión que hoy paga VIVE pasa a hacerla él,
explícitamente y sabiéndolo.

---

## D5 · Mínimo por riel (solo si D4 = por reserva)

Con pagos semanales agrupados por `(coach, riel)` y **sin mínimo de acumulación**
—que es una decisión ya tomada—, un coach con una sesión USDT por semana come
**USD 1,50 sobre ~USD 45: 3,3%**, contra un costo que además está declarado como
no medido.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Sin mínimo** (hoy) | El coach cobra todo, siempre | Costo de entrega desproporcionado en montos chicos |
| **(b) Mínimo por riel** | Amortiza el costo fijo | El coach espera para cobrar lo de un riel flaco |
| **(c) Barrido al riel primario bajo X** | Cobra todo y sin costo desproporcionado | Rompe el espejo justo en los montos chicos |

⚠️ **Se decide antes de escribir el agrupamiento, no después.**

---

## D6 · Coach sin Mercado Pago conectado

**Hoy la reserva se confirma igual, sin cobro**: sin comisión para VIVE y sin
ninguna protección para quien reservó. Es un default heredado de cuando el pago
era opcional — el comentario del código ya lo anticipaba.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Exigir MP conectado para publicar** (recomendado) | Con el split, VIVE **nunca toca la plata del coach**: sin float, sin plata ajena, sin obligación de transferir | Fricción de onboarding |
| **(b) VIVE cobra en pesos y transfiere por CBU** | Un coach sin MP puede trabajar | 🔴 Pone plata ajena en la cuenta y **extiende al mercado local la pregunta fiscal** que hoy es solo del exterior |
| **(c) Dejarlo como está** | — | 🔴 No es una decisión: es un agujero |

---

## D7 · USDT: ¿se ofrece?

**No es un problema de fragilidad ni de costo.** La conciliación por centavos
tiene índice único y reintenta (el modo de falla es "probá de nuevo", no un cobro
mal asignado), y el techo —100 reservas esperando pago a la vez— está documentado
con su salida.

🔴 **El problema es que es un riel sin reversa:** no hay disputa, no hay
contracargo, y devolver exige una transferencia a mano. Eso choca con la política
de cancelación, con el reembolso por expiración y con el derecho de revocación.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Como está** | Es el único riel que no le pide permiso a nadie, y bajo la regla espejo `USDT → USDT` es la diagonal perfecta | Los legales prometen un reembolso que el riel no ejecuta solo |
| **(b) Se queda, no se ofrece hasta que exista el runbook** (recomendado) | Cierra la brecha entre legales y código, que es el criterio del proyecto | Un documento más que escribir |
| **(c) Matarlo** | Menos superficie | Saca el único riel independiente y la diagonal más limpia |

**La pregunta que decide entre (a) y (b):** ¿puede una persona con nombre y
apellido devolver a mano dentro del plazo que prometen los legales, cuando haya
diez por semana en vez de una?

---

## D8 · Tipo de cambio: criterio y registro

**Son dos problemas y no hay que mezclarlos.**

**El registro NO es opcional en ningún escenario**, se elija el criterio que se
elija: tipo de cambio, monto en pesos, fuente y timestamp. Hoy la función que
marca el pago recibe **solo un texto libre**. Sin eso no se puede reconstruir qué
se pagó si un coach reclama en noviembre.

**El criterio** (solo aplica si hay pagos en pesos — bajo D4 no habría):

| Opción | Pros | Contras |
|---|---|---|
| **(A) El cambio efectivamente realizado** | Suena justo, es lo que pasó | 🔴 Indefendible: el coach no puede verificarlo ni anticiparlo, y si se convierte en lote la atribución por coach es arbitraria |
| **(B) Referencia pública** (MEP del día, fuente y horario por escrito) | El coach sabe el lunes cuánto cobra el viernes. Sin disputa posible | VIVE asume la brecha entre su cambio realizado y la referencia |
| **(C) Pagar en dólares y que convierta él** | Es lo que ya resuelven PayPal y USDT como métodos de cobro | El coach que quiere pesos se queda afuera |

📝 **El riesgo de (B) es más chico de lo que suena**: VIVE tiene dólares, cuyo
valor en pesos se mueve *con* la referencia. No hay exposición al nivel del tipo
de cambio, solo a la **brecha**.

---

## D9 · Multiparty: ¿se pide?

| Opción | Pros | Contras |
|---|---|---|
| **(a) Pedirlo ya + probar en sandbox** (recomendado) | Es gratis y lento; el sandbox **no requiere aprobación**, así que el binario se despeja en paralelo sin comprometer nada | Ninguno real: la integración actual es otro producto y sigue igual |
| **(b) Esperar** | — | La aprobación probablemente exija un volumen que solo el riel actual puede generar |

🔴 **No desarmar nada hasta tenerlo aprobado y probado.** No es self-serve: hay
formulario, evaluación humana y una segunda aprobación para producción. No hay
lista pública de países y **el filtro más probable es de volumen** — hay
plataformas rechazadas por volumen bajo, y VIVE tiene cero.

⚠️ **Caveat que baja el techo de esta opción:** la partner fee se liquidaría a una
cuenta bancaria vinculada, una vez por día — con entidad argentina, eso es
**pesificación diaria al cambio de PayPal**. Multiparty no sacaría del problema
PayPal→pesos: lo achicaría del 100% del ticket al 25%. **Preguntarlo así, porque
la respuesta genérica no sirve:** ¿la partner fee se liquida sí o sí a la cuenta
bancaria, o puede retenerse en saldo USD?

---

## D10 · Contracargos

**Los tres hallazgos, verificados en el código:**
- Un contracargo de Mercado Pago se registra como `'reembolsado'`, **el mismo
  valor que un reembolso voluntario**. En los datos son indistinguibles.
- Las disputas de PayPal **ni llegan**: el webhook procesa dos eventos y el
  registrado en producción tiene suscritos exactamente esos dos.
- **Nada mira `paid_out_at`** cuando la plata se va para atrás. Si el contracargo
  cae sobre una sesión ya transferida, la pierde VIVE en silencio.

**La exposición es estructural:** PayPal da hasta 180 días para disputar; el coach
cobra a la semana, sin mínimo y sin reserva retenida.

**Lo mínimo, en orden de costo:** (1) distinguir contracargo de reembolso, (2)
suscribir los eventos de disputa, (3) cruzar contra `paid_out_at`. **Recién
después** discutir reserva retenida o retraso del pago, que es la mitigación cara
y la que peor le cae al coach.

📝 Cobrar directo (D1/D9) lo mitiga mucho —el contracargo va contra el coach—
pero hay que confirmar el tratamiento del platform fee.

---

## D11 · Filtro por ubicación en el checkout

⚠️ **Esto va DESPUÉS de D2 y D3, y el orden importa.** El filtro **enmascara** el
acoplamiento en vez de arreglarlo: si un argentino nunca ve PayPal, la comisión
mala nunca se escribe, pero el riel sigue siendo la fuente de verdad. La primera
excepción que alguien agregue —un coach que pide dólares para un cliente puntual,
un riel nuevo, un flujo de reagendamiento que saltea el filtro— lo revive, y va a
ser más difícil de encontrar la segunda vez porque va a estar tapado por un filtro
que "ya lo resolvió".

**Con D2 y D3 resueltos, esto baja de "cobra de más hoy" a decisión de producto:**
un argentino que elige PayPal genera una operación de mercado interno cobrada al
20% que se pagó por un riel raro. Sigue siendo algo que se quiere arreglar —ese
riel mete plata ajena en la cuenta de PayPal por algo que MP resolvía solo— pero
ya no es urgente.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Rieles internacionales solo a usuarios fuera de Argentina** | Cierra el arbitraje entre dos precios independientes del mismo coach | Hay que decidir de dónde sale la ubicación, y un viajero puede quedar del lado equivocado |
| **(b) Como está** | — | Un argentino elige entre el precio en pesos y el precio en dólares, y se queda con el que le conviene |

---

## Lo que NO es una decisión

Sale de las dos partes del intercambio y conviene dejarlo escrito para no
rediscutirlo:

- **Desacoplar la comisión del riel.** No hay alternativa defendible.
- **Registrar el tipo de cambio.** No es opcional en ningún escenario.
- **No tocar el `platform_fee_pct` de reservas viejas.** Esa columna registra lo
  que efectivamente se cobró: es un hecho histórico. Toda corrección va hacia
  adelante.
- 🔴 **La comisión se SELLA en la reserva.** Si se derivara en tiempo de consulta,
  el filtro nuevo del contador cambiaría **retroactivamente** el tramo de sesiones
  ya cobradas: una reserva vieja pasaría de 15% a 20% porque cambió la regla de
  conteo. Es reescribir historia por la puerta de atrás, sin tocar ninguna fila y
  sin que ningún diff lo muestre.
- **Cuatro cosas con vidas distintas**: la observación se guarda, la clasificación
  se deriva, la comisión se sella, y el contador de tramos se deriva pero **solo
  alimenta reservas futuras**.

## Pendiente que no es de código

**El razonamiento de la escalera 20/15 no está en ningún documento para el
coach.** Existe solo en un comentario de `_shared/commission.ts`; el 20/15 pelado
aparece en `docs/fiscal-instrucciones.md`, que es para el contador. No hay un
documento de comisión local para el coach — no es que firme otra cosa, es que **no
hay nada que firmar**. Y la razón es lo que hace defendible la regla: sin ella,
"te cobro menos en la segunda" se lee como un descuento arbitrario que se puede
quitar.
