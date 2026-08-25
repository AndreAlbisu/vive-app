# Pagos — decisiones abiertas

> Salida de un intercambio de seis rondas entre dos análisis (25/08/2026). El
> razonamiento completo y qué se verificó está en `docs/plan-pagos.md`; acá está
> solo **lo que hay que decidir**, con opciones y consecuencias.
>
> **Nada de esto es un bug que haya que apagar.** No hay un solo cliente real
> todavía: es fijar el comportamiento correcto antes del primer usuario. Por eso
> conviene que quede escrito como decisión y no como fix — quien vea después el
> contador sin filtro va a pensar que es un descuido y "arreglarlo" al revés.

## El modelo, después de tres correcciones

> Escrito al final de la ronda de decisiones (25/08/2026). **Es lo que hace
> consistente todo lo de abajo**, y llegó corrigiendo dos veces el razonamiento.

**Hay TRES datos con tres usos que no se pisan.** Mezclarlos fue el origen de casi
todo lo que se discutió:

| Dato | Decide | No decide |
|---|---|---|
| **Dirección fiscal del coach** | Cómo VIVE le factura **su comisión** (E si está afuera, C si está en Argentina) y qué rieles de cobro le sirven | Nada del precio |
| **Riel usado** | Cuánto costó cobrar → **la comisión** | Nada del encuadre fiscal |
| **Ubicación del cliente** | Si **el coach** exporta (problema de él) y qué rieles mostrarle | Nada de las obligaciones de VIVE |

🔴 **Que la comisión dependa del riel NO es el acoplamiento que había que romper.**
Es correcto: el 25% existe para cubrir lo que cuesta ese riel —el propio comentario
de `_shared/commission.ts` lo dice: "los costos que absorbe: comisión del
procesador, cambio de moneda, comisión de red"— y PayPal cuesta unos 8 puntos más
que el split de Mercado Pago, que no cuesta nada. **Cobrar según lo que costó
cobrar no es cobrar de más.**

🔴 **El acoplamiento que sí había que romper es el otro: usar el riel para decidir
la ETIQUETA FISCAL.** Eso sigue mal y lo arregla D2.

🔴 **Y bajo D1 (agente), el cliente de VIVE es el COACH** — a él se le factura la
comisión. Por lo tanto **si VIVE exporta o no lo decide la dirección fiscal del
coach, no la del cliente.** Esto corrige lo que este documento afirmaba antes.

## Mapa rápido

| # | Decisión | Espera a | Urgencia |
|---|---|---|---|
| ~~D1~~ | ~~Principal o agente~~ | — | ✅ **DECIDIDA 25/08: AGENTE** |
| ~~D2~~ | ~~Cómo se clasifica una operación como internacional~~ | — | ✅ **DECIDIDA 25/08** · razón corregida, menos urgente |
| ~~D3~~ | ~~La escalera~~ | — | ✅ **DECIDIDA 25/08** · revisada: escalera **por riel**, contador único |
| ~~D4~~ | ~~Alcance de la regla espejo~~ | — | ✅ **DECIDIDA 25/08: espejo estricto, por reserva** |
| ~~D5~~ | ~~Mínimo por riel~~ | — | ✅ **DECIDIDA 25/08: el costo de red lo absorbe VIVE; sin mínimo** |
| ~~D6~~ | ~~Coach sin Mercado Pago conectado~~ | — | ✅ **DECIDIDA 25/08: publicar exige al menos un riel completo** |
| ~~D7~~ | ~~USDT: ofrecerlo o no~~ | — | ✅ **DECIDIDA 25/08: se ofrece, con dos cosas antes** |
| ~~D8~~ | ~~Criterio y registro del tipo de cambio~~ | — | ✅ **DECIDIDA 25/08: tabla append-only de operaciones** |
| ~~D9~~ | ~~Multiparty: pedirlo o no~~ | — | ✅ **DECIDIDA 25/08: se pide, sin desarmar nada** |
| ~~D10~~ | ~~Contracargos~~ | — | ✅ **DECIDIDA 25/08: niveles 1 y 2 ahora** |
| D11 | Filtro por ubicación en el checkout | D2 | Decisión de producto: arbitraje y plata ajena |
| **D12** | **Dirección fiscal del coach** | **Nadie** | 🔴 **El dato que VIVE necesita para SU facturación** |

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
> ⚠️ **RAZÓN CORREGIDA el 25/08, unas horas después.** Este documento decía que la
> clasificación era urgente porque "la comisión depende de si la operación es
> internacional". **Eso era falso**: la comisión depende del **riel** (ver "El
> modelo"), y la facturación de VIVE depende de la **dirección fiscal del coach**
> (D12). El país del cliente **no decide ninguna obligación de VIVE**.
>
> **La decisión se mantiene** —no derivar la clasificación del riel, guardar
> observaciones— pero **baja de urgencia** y sirve para otras dos cosas: poder
> decirle la verdad al coach sobre su propia situación fiscal, y filtrar qué
> rieles mostrarle a cada cliente (D11).
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

## D3 · La escalera — ✅ DECIDIDA (25/08/2026)

> **Decisión de Andre, 25/08/2026.** La pregunta original era si las sesiones
> internacionales debían **dejar de avanzar** el contador. La respuesta terminó
> siendo otra y mejor: **el internacional también tiene escalera, y el contador
> del par es uno solo.**

> 🔴 **REVISADA el 25/08, unas horas después.** La escalera **no es por régimen
> fiscal sino POR RIEL**. Ver "El modelo" arriba: el 25% cubre el costo del riel,
> no la internacionalidad. Atarlo al encuadre fiscal volvía a mezclar precio con
> clasificación, que es justo lo que se estaba desarmando.

| Riel | Primera del par | Recurrentes |
|---|---|---|
| **Mercado Pago** | 20% | 15% |
| **PayPal / USDT** | 25% | **20%** |

📝 **La versión revisada es además más simple de implementar**: cada función de
cobro **ya sabe por qué riel corre**, así que no necesita la clasificación de D2
para nada. Solo consulta el contador del par. La comisión y el encuadre fiscal
quedan completamente desacoplados.

<details>
<summary>La tabla original, antes de la revisión</summary>

| | Primera del par | Recurrentes |
|---|---|---|
| Local | 20% | 15% |
| Internacional | 25% | 20% |

</details>

**El contador cuenta TODAS las sesiones cumplidas del par, sin mirar el régimen.**
Cada régimen lee su propia tarifa en la posición que le toca.

### Por qué este modelo y no el filtro

🔴 **Cambia el RAZONAMIENTO de la escalera, no solo los números.** El comentario de
`_shared/commission.ts` la justificaba diciendo que VIVE "deja de aportar" después
de la presentación —y de ahí salía que el internacional fuera plano, porque ahí
VIVE aporta siempre—. **La justificación real es otra**: el 20% recupera el
**costo de adquisición** del cliente y la baja al 15% es **retención**. Eso aplica
igual en los dos regímenes: en el exterior también hubo un costo de adquirir a esa
persona, y también hay que retenerla.

⚠️ **Esto hay que dejarlo escrito o alguien lo revierte.** El comentario viejo
argumenta explícitamente a favor de la tarifa plana; quien lo lea sin este
contexto va a pensar que la escalera internacional es un error.

**Tres cosas que resuelve de una:**

1. **El cruce de rieles deja de ser un problema.** El caso "paga primero con PayPal
   y después con Mercado Pago" —que es el público del producto: alguien que toma
   una sesión desde Madrid y después otra desde Buenos Aires— se resuelve solo. La
   segunda es recurrente, se cobra 15% porque ocurrió en Argentina, y no hay regla
   especial.
2. **Desaparece el borde de la prima doble.** Nadie paga la adquisición dos veces,
   porque la prima es la **posición del par**, no el régimen.
3. **`countsAsCompletedSession` no necesita filtrar por `payment_provider`.** Queda
   como está. La decisión simplifica el código en vez de complicarlo.

**Y un argumento que no es de costos:** la escalera es también **anti-fuga**, una
de las cinco medidas de esa estrategia. Un par internacional recurrente pagando 25%
para siempre, contra uno local pagando 15%, es exactamente donde el incentivo a
irse de la plataforma es más fuerte.

### 🔴 Dependencia: el 20% recurrente solo cierra bajo la regla espejo (D4)

El 25% se fijó para que **la peor combinación cerrara**: sobre USD 60 el neto iba
de ~8,56 (cobrado por PayPal, pagado en USDT) a ~13,20, y con 20% esa peor caía a
~5,60 — 9,3% del ticket.

**La regla espejo elimina las combinaciones cruzadas**, y con eso el 20% recurrente
deja más margen que el que tenía la peor combinación de hoy:

- **PayPal → PayPal**, USD 60 al 20%: se cobra 12, PayPal se lleva 3,54 al procesar
  y 0,96 al pagar → quedan **~7,50** (12,5% del ticket).
- **USDT → USDT** al 20%: quedan **12** (el costo de red lo paga el coach).

⚠️ **La cuenta usa las cifras del propio comentario y la tarifa verificada de
PayPal, no una medición.** La medición de USD 50 es lo que la confirma.

⚠️ **Por lo tanto: no shippear la escalera internacional antes que D4.** Con las
combinaciones cruzadas todavía posibles, un par recurrente cobrado por PayPal y
pagado en USDT dejaría ~9,3%.

### Trabajo que se desprende

1. **Partir `COMMISSION_INTERNATIONAL`** en primera y recurrente (25 / 20).
2. **`paypal-create-payment` y `usdt-create-payment` tienen que consultar el
   contador del par**, como ya hace `mp-create-payment`, en vez de escribir una
   constante plana.
3. **Actualizar el comentario de `_shared/commission.ts`** con el razonamiento
   nuevo (adquisición + retención + anti-fuga), reemplazando el de "deja de
   aportar".
4. **Corregir el documento del coach**: hoy dice *"25%, siempre, sin tramos. Sobre
   un precio de USD 60 cobrás USD 45"*. 📝 No se le mandó a nadie todavía —está
   bloqueado esperando al contador—, así que no hay ninguna promesa que romper.
5. **Verificar cómo interactúa con la promo fundador** (`COMMISSION_PROMO = 0`
   hasta `FOUNDER_PROMO_UNTIL`): tiene que seguir ganándole a las dos escaleras.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

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

</details>

---

## D4 · Regla espejo — ✅ DECIDIDA: **espejo estricto, por reserva** (25/08/2026)

> **Decisión de Andre, 25/08/2026.** El coach **declara qué rieles acepta**
> (PayPal, USDT, o los dos); sus clientes ven exactamente esos; y **cada reserva
> se paga por el riel por el que entró**. **El CBU desaparece como opción de cobro
> para el exterior.**

**Qué elimina —no resuelve, elimina—:** el pozo de plata ajena, la regla de ruteo,
el criterio de tipo de cambio del payout y el problema de que el saldo de PayPal
no se pueda drenar. **No es integración nueva: es borrar opciones y filtrar.**

Después de D1 (agente) esto dejó de ser una optimización de costos: la plata del
riel internacional es **de terceros**, y la regla espejo es una de las dos formas
de reducir cuánta se tiene y por cuánto tiempo.

### Por qué esta y no las otras dos

**Contra "espejo por coach"** (el coach elige UN riel y eso define qué ven sus
clientes): **fragmenta el catálogo mucho más.** Un coach que eligiera USDT
perdería a todos los clientes que hubieran pagado con PayPal — que son la mayoría.
Y lo obliga a entender la mecánica para elegir bien, cuando la elección no le
cambia nada a él. A cambio solo ahorra tener que decidir D5.

**Contra "espejo con conversión pasante"** (mantener el CBU, convirtiendo cada
pago puntual y pasando el tipo de cambio real con comprobante): es una buena idea
y **es aditiva** — se puede agregar después sin rehacer nada. Hoy no se justifica:
hay **un** coach con internacional habilitado, así que sería resolverle el problema
a alguien que no existe, pagándolo con una operación manual por cada pago. ⚠️ Y
tiene un costo que apareció al analizarla: los retiros de PayPal a un banco
argentino **tienen comisión de transferencia**, así que convertir de a un pago
multiplica un costo fijo — el mismo problema de amortización de D5, pero del lado
de VIVE.

📝 **Vale la pena guardar el hallazgo de esa opción**: convirtiendo **por pago**, la
atribución del tipo de cambio es exacta y el criterio (A) de D8 —descartado por
arbitrario cuando se convierte en lote— vuelve a ser defendible. Si algún día se
agrega, ese es el criterio que le corresponde.

### El costo residual, aceptado con los ojos abiertos

Un coach que solo quiere pesos **no puede atender al exterior** sin convertir él.

📝 **Y eso es menos grave de lo que suena en el riel de PayPal**: como no se puede
sacar dólares de PayPal salvo retirando a una cuenta en pesos, la ruta del coach y
la de VIVE son **idénticas** — los dos pasan por la misma conversión, al mismo
~3-4,5%. La regla espejo no empeora el resultado: mueve quién aprieta el botón y
quién come el markup. "Saber hacerlo" ahí es vincular una cuenta bancaria y tocar
retirar.

🔴 **En USDT es otra cosa**: vender cripto exige cuenta en un exchange y entender
la red. **De ahí una regla de producto: PayPal es el riel para el coach que quiere
pesos, y USDT para el que realmente quiere dólares.** Empujar a un coach que quiere
pesos hacia USDT es pedirle que aprenda cripto para cobrar su sueldo.

### 🔴 D5 es obligatoria y va pegada

Espejar por reserva **fragmenta la acumulación**: el pozo del coach se parte en
tantos como rieles use. Con pagos semanales y **sin mínimo** —decisión ya tomada—
un coach con una sesión USDT por semana come USD 1,50 sobre ~USD 45: **3,3%**.

### Trabajo que se desprende

1. **`coach_payout_accounts` pasa de un `method` único a un conjunto de rieles
   aceptados.** Las columnas ya existen todas (`wallet` + `network`,
   `paypal_email`); `cbu`/`alias` quedan solo para el uso local, si aplica.
2. **El selector del checkout filtra por los rieles que el coach acepta.**
3. **El panel agrupa los pagos por `(coach, riel)`** en vez de por `(coach)`.
4. **Actualizar el documento del coach**: hoy ofrece CBU como una de las tres
   opciones de cobro del exterior.

<details>
<summary>El análisis previo a la decisión</summary>

## Comparación original

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

</details>

---

## D5 · El costo de entrega — ✅ DECIDIDA (25/08/2026)

> **Decisión de Andre, 25/08/2026: el costo de red de USDT lo absorbe VIVE**, como
> ya absorbe el 2% de PayPal Payouts. **Y no hay mínimo**: se paga todo, todas las
> semanas, como estaba decidido.

**Esto disuelve el problema en vez de administrarlo.** La pregunta original era
cómo evitar que un coach con una sesión USDT semanal comiera 3,3% de su pago
(USD 1,50 sobre ~45). Si el costo no sale de su pago, no hay mínimo que decidir ni
espera que administrar.

### 🔴 Revierte la regla fijada esta misma mañana, y por un motivo

La regla anterior era **"costo fijo se descuenta, costo proporcional se absorbe"**,
y el argumento para descontar el de USDT estaba escrito en `lib/payout.ts`: *"se lo
descuenta a quien lo elige: pidió que le manden dólares por blockchain, controla la
causa y paga el costo"*.

**D4 le sacó el piso a ese argumento.** Con el espejo estricto, elegir un riel dejó
de ser una preferencia libre: **define qué clientes pueden pagarle**. Cobrarle el
costo sería penalizarlo por una decisión que ya no es puramente suya.

La regla nueva es más simple: **el costo de entrega lo paga VIVE, sea fijo o
proporcional.** El coach cobra su neto, siempre.

### El riesgo que se acepta, que ya estaba anticipado

`_shared/commission.ts` lo dice desde antes de esta conversación: el costo de red
**es el único que no escala con la facturación sino con la cantidad de coaches** —
es por pago, no por sesión, así que un coach de una sesión por semana cuesta lo
mismo que uno de diez. Absorberlo traslada ese riesgo a VIVE.

Sobre la comisión, no sobre el ticket, así se ve la magnitud real:

| Sesión | Comisión de VIVE (25%) | USD 1,50 pesa |
|---|---|---|
| USD 60 | 15,00 | 10% |
| USD 20 (el mínimo) | 5,00 | **30%** |

**Muerde justo donde el margen es más chico.** Hoy es irrelevante —cero coaches
internacionales activos— pero es el número a mirar cuando haya volumen.

**⏱️ Disparador para revisar:** si la mayoría de los coaches internacionales
termina cobrando en USDT, sobre todo con poco volumen cada uno. Es el mismo
disparador que el comentario del código ya anotaba.

**Mitigación estructural, que ya está decidida y no cuesta nada:** la regla de
producto de D4 — **PayPal para el coach que quiere pesos, USDT para el que quiere
dólares**. El costo de PayPal es proporcional, así que no es regresivo; empujar
hacia USDT solo a quien realmente quiere dólares mantiene ese riel en los perfiles
de más volumen.

### Trabajo que se desprende

1. **`deliveryCostFor` devuelve 0 para todos los métodos** — el costo se mueve al
   lado de VIVE (`costoPlataforma` en el panel, donde ya está el 2% de PayPal).
2. **Sacar el descuento del documento del coach**: hoy dice *"USDT — … con un costo
   de red de USD 1,50 por transferencia que se descuenta de tu pago"*.
3. **Sacar la nota de la pantalla de datos de cobro**, que explica ese descuento.
4. **Actualizar el comentario de `lib/payout.ts`** con el razonamiento nuevo — el
   viejo argumenta explícitamente a favor de descontarlo.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

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

</details>

---

## D6 · Requisito para publicar — ✅ DECIDIDA (25/08/2026)

> **Decisión de Andre, 25/08/2026: para publicar el perfil hay que tener al menos
> UN riel de cobro completo.** No es "exigir Mercado Pago": es exigir **un** medio,
> cualquiera.

**Y el catálogo muestra al coach solo a los clientes que pueden pagarle:**

| Riel configurado | Quién lo ve |
|---|---|
| Mercado Pago conectado | Clientes en Argentina |
| PayPal o USDT | Clientes del exterior |
| Los dos | Los dos |
| Ninguno | **No publica** |

Es la regla espejo (D4) aplicada a la publicación, y **es mejor que una guarda**:
el estado "reserva confirmada sin cobro" no se bloquea — **deja de ser
alcanzable**. Hoy ese estado existe porque `mp-create-payment` devuelve 409, el
cliente lo trata como caso benigno y sigue: reserva confirmada, cero cobrado, sin
comisión y sin protección para quien reservó. Es un default heredado de cuando el
pago era opcional, y el comentario del código ya lo anticipaba.

### 🔴 Arregla de paso otro estado roto que ya existe

Hoy un coach puede tener `accepts_international = true` **sin `price_usd`
cargado**: queda anunciado en el catálogo y la pantalla de pago no puede cobrarle.
Con esta regla eso es imposible — **lo que habilita un riel es que el riel esté
COMPLETO**, no un flag aparte.

📝 **`accepts_international` pasa de casilla a dato derivado**: se deduce de tener
un riel en dólares configurado y un precio en dólares. Una casilla que puede
contradecir a los datos es una fuente de estados imposibles; derivarla los elimina.

### Por qué no la alternativa

La otra opción era **que VIVE cobrara también en pesos** y transfiriera por CBU,
para que un coach sin MP pudiera trabajar. Se descarta porque **contradice D1 y
D4 a la vez**: pondría plata de terceros en la cuenta también en el mercado local
—hoy el split de Mercado Pago es la única parte del sistema donde eso **no
pasa**— y extendería ahí la misma pregunta fiscal que hoy es solo del exterior.
Sería renunciar justo a la pieza que ya resuelve bien lo que en el resto del
sistema es un problema.

### Trabajo que se desprende

1. **Bloquear la publicación del perfil** sin ningún riel completo.
2. **Filtrar el catálogo y el buscador** por los rieles del coach cruzados con el
   contexto del usuario. ⚠️ Si un coach solo tiene USDT, alguien en Argentina no
   debería verlo: llegaría a la pantalla de reserva sin ningún medio que ofrecerle.
   **De dónde sale el contexto del usuario es D11.**
3. **Derivar `accepts_international`** en vez de leerlo como flag, y sacar la
   casilla del perfil del coach.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

**Hoy la reserva se confirma igual, sin cobro**: sin comisión para VIVE y sin
ninguna protección para quien reservó. Es un default heredado de cuando el pago
era opcional — el comentario del código ya lo anticipaba.

| Opción | Pros | Contras |
|---|---|---|
| **(a) Exigir MP conectado para publicar** (recomendado) | Con el split, VIVE **nunca toca la plata del coach**: sin float, sin plata ajena, sin obligación de transferir | Fricción de onboarding |
| **(b) VIVE cobra en pesos y transfiere por CBU** | Un coach sin MP puede trabajar | 🔴 Pone plata ajena en la cuenta y **extiende al mercado local la pregunta fiscal** que hoy es solo del exterior |
| **(c) Dejarlo como está** | — | 🔴 No es una decisión: es un agujero |

</details>

---

## D7 · USDT — ✅ DECIDIDA: **se ofrece** (25/08/2026)

> **Decisión de Andre, 25/08/2026.** El mecanismo de reembolso **ya está
> construido casi entero**; lo que falta no es mecanismo sino dos cosas chicas.

### Lo que ya existe (más de lo que se creía)

- **`RefundAddressScreen`**: el usuario carga **su propia dirección** de devolución
  y la red, con policy propia en la base para que solo toque la suya. `SessionsScreen`
  detecta el reembolso pendiente sin dirección y se la pide solo.
- **`listUsdtRefunds`**: el panel lista los pendientes **con esa dirección**.
- **`mark_usdt_refunded`** exige el **hash de la transacción**, validado como 64
  hexadecimales, con el comentario explícito de que sin eso el registro dejaría de
  ser una prueba.

📝 **Eso cubre la preocupación de estafa mejor que un banco.** No se devuelve a la
dirección remitente —que si pagó desde un exchange **no es suya**, y devolver ahí
pierde los fondos— sino a la que el usuario declara. Y "nunca me lo mandaron" es
refutable con el hash: una transacción TRC20 es pública y verificable para siempre.

### 🔴 Lo que falta, y son dos cosas

**1. Nada avisa que hay un reembolso esperando.** `listUsdtRefunds` es una consulta
que hay que ir a buscar: si nadie abre el panel, el reembolso se queda ahí. Hace
falta un aviso cuando uno lleva más de X horas pendiente. Es lo que convierte "hay
que acordarse" en "te enterás".

**2. Los T&C describen un mecanismo que en este riel no existe.** §9.1 y §9.2
prometen que el reembolso *"se procesa de forma automática a través del procesador
de pagos"*. En Mercado Pago y PayPal es cierto —hay un cron—; **en USDT no hay
ningún procesador: es una persona haciendo una transferencia a mano**. Es la misma
clase de brecha entre legales y código que el proyecto viene cazando, y §9 es la
cláusula que un usuario señalaría. **A la lista del abogado, junto con la pregunta
de las 24 horas.**

⚠️ **Verificar antes de ofrecerlo:** que la pantalla valide la dirección **contra la
red elegida**, como ya hace `walletError` con la wallet del coach. Sin eso, alguien
puede pegar una dirección de Ethereum y elegir Tron — y ahí los fondos se pierden y
no rebotan.

### Sobre "que VIVE pague y el coach quede en negativo"

Propuesta de Andre durante la discusión. **Para las cancelaciones no hace falta: la
plata todavía es de VIVE.** Al coach se le paga *después* de la sesión y las
cancelaciones ocurren antes, así que cuando hay que devolver esos dólares siguen en
la wallet. No hay nada que descontarle.

📝 **Ese mecanismo sí va a hacer falta en D10**, para un contracargo posterior al
pago al coach — que en USDT no existe, pero en PayPal y Mercado Pago tienen ventana
de meses.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

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

</details>

---

## D8 · Registro de operaciones — ✅ DECIDIDA (25/08/2026)

> **Decisión de Andre, 25/08/2026: una tabla append-only de operaciones**, acotada
> a lo que ejecuta una persona.

### 🔴 El criterio de tipo de cambio se disolvió con D4

La pregunta original tenía dos mitades: **qué criterio se promete** y **qué se
registra**. La primera **ya no tiene caso de uso**: con el espejo estricto, el
internacional se paga en dólares por el mismo riel que cobró, y lo local lo paga el
split de Mercado Pago directamente. **VIVE nunca convierte moneda para pagarle a
nadie.** Las tres opciones que se habían planteado (cambio realizado / referencia
pública / pagar en dólares) quedaron sin objeto.

📝 Si algún día se agrega la "conversión pasante" de D4, el criterio que le
corresponde es **el cambio realizado con comprobante** — convirtiendo por pago, la
atribución es exacta y deja de ser arbitraria, que era la única objeción.

### Lo que sí queda, y cambió de naturaleza

Ya no es sobre tipo de cambio: **es que no hay ningún registro de operaciones.**

Hoy existen `paid_at`, `refunded_at`, `paid_out_at` y un `payout_reference` de
texto libre. Todo eso es **estado sobre la reserva**, no un registro de lo que se
hizo. No se puede contestar "qué se ejecutó el martes", "quién lo hizo", ni
"cuántos reembolsos manuales van este mes".

### El alcance, que es lo que hace la decisión barata

**Los movimientos automáticos ya tienen registro en otro lado:** Mercado Pago y
PayPal tienen sus propios paneles, y una transferencia TRC20 está en la blockchain
para siempre. **Lo que no tiene registro en ningún lado es lo que hizo una persona
de VIVE**: pagarle a un coach, ejecutar un reembolso de USDT a mano, compensar un
error.

**La tabla cubre solo eso.** No cada escritura de webhook.

Campos: **tipo** de movimiento · **qué reservas** abarca (un pago semanal cubre
varias, y una compensación puede no corresponder a ninguna) · **monto y moneda** ·
**tipo de cambio y su fuente**, si hubo conversión · **referencia externa** (hash o
número de operación) · **quién lo ejecutó** · **cuándo**.

### Por qué ahora, con cero volumen

**Es lo único de toda esta lista que no se puede reconstruir después.** Una columna
se agrega el día que se necesita; la historia de lo que se hizo, no. Empezarla hoy
sale gratis y hace que el registro cubra la vida entera del negocio.

Y es **append-only**, coherente con lo que el proyecto ya sostiene en todos lados:
no se reescribe historia.

### Por qué no las alternativas

- **Dejarlo como está**: cada operación manual queda como un texto libre pegado a
  una reserva.
- **Columnas en `bookings`**: sirve mientras cada operación toque **una sola**
  reserva. Un pago semanal cubre varias y una compensación puede no corresponder a
  ninguna.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

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

</details>

---

## D9 · Multiparty — ✅ DECIDIDA: **se pide** (25/08/2026)

> **Decisión de Andre, 25/08/2026: se solicita ahora, y se prueba el flujo en
> sandbox en paralelo.** El sandbox **no requiere aprobación**, así que la
> integración técnica se valida con una cuenta de desarrollador mientras la
> solicitud avanza. Es gratis y es lento: cuanto antes arranque el reloj, mejor.

**No rompe nada:** la integración actual (VIVE como comerciante) es otro producto y
sigue funcionando igual.

🔴 **Condición escrita: no desarmar nada hasta tenerlo aprobado y probado.** Sacar
el riel actual antes dejaría a VIVE sin ningún medio internacional, esperando un
permiso que puede tardar o no llegar. Y el problema es circular: la aprobación
probablemente exija un volumen que **solo el riel actual puede generar**.

⚠️ **Expectativa calibrada:** la partner fee se liquidaría a una cuenta bancaria
vinculada, una vez por día — con entidad argentina eso sería **pesificación diaria
al cambio de PayPal**. Si es así, multiparty **no saca del problema PayPal→pesos**:
lo achica del 100% del ticket al 25%.

Sigue valiendo la pena, pero por otra razón: **se deja de mover plata ajena**, que
después de D1 es el argumento fuerte. No compite con la regla espejo — se apila
arriba.

**La pregunta hay que hacerla así, porque la respuesta genérica no sirve:**

> Para una plataforma con entidad argentina, ¿la partner fee se liquida sí o sí a
> la cuenta bancaria vinculada en pesos, o puede retenerse en saldo USD?

### El mensaje, para mandar tal cual

> We run a marketplace based in Argentina that connects independent wellness
> professionals with clients, and we currently use PayPal Checkout as the merchant
> of record. We are evaluating a multiparty setup where the payment settles
> directly into the professional's PayPal account and we retain our fee as a
> platform fee.
>
> Three questions before we commit to building it:
>
> 1. Is the multiparty / platform-fee solution available for a **platform with an
>    Argentine entity**, onboarding sellers who are mostly in Argentina but may be
>    in other countries?
> 2. **How is the platform fee settled for an Argentine platform?** We understand
>    the fee payee needs a linked bank account and that fees are disbursed daily —
>    for an Argentine account that would mean a daily conversion to local currency.
>    **Can the platform fee instead be retained as a USD balance?**
> 3. In a transaction with a retained platform fee, **who bears a chargeback** —
>    the seller, the platform, or both proportionally?
>
> We are pre-launch, so our current transaction volume is minimal. If there is a
> minimum volume requirement to qualify, we would rather know now.

📝 **La tercera pregunta no estaba en el plan original** y es la que más importa
para D10: si el contracargo va contra el vendedor, multiparty mitiga la exposición
de 180 días que hoy tiene VIVE. Si va contra la plataforma, no cambia nada de eso.

📝 **Decir el volumen de entrada es a propósito.** Si el filtro es de volumen —que
es el obstáculo más probable— conviene enterarse en el primer mail y no después de
construir la integración.

<details>
<summary>El análisis previo a la decisión</summary>

## Planteo original

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

</details>

---

## D10 · Contracargos — ✅ DECIDIDA: **niveles 1 y 2 ahora** (25/08/2026)

> **Decisión de Andre, 25/08/2026.** Ver lo que pasa y poder defenderse. Recuperar
> cuando haya volumen; prevenir, probablemente nunca.

### 🔴 El hallazgo que cambió la prioridad: no hay ninguna prueba de que la sesión ocurrió

Verificado el 25/08: existe `meeting_url` (Daily.co) y `duration_minutes`, pero
**nada registra quién entró, cuándo ni por cuánto tiempo**.

Si llega una disputa diciendo *"el servicio no se prestó"* —que sobre una
videollamada es **la** disputa que va a llegar— **no hay nada que presentar**. No
es un caso débil: es no tener evidencia. Daily.co sí produce esos datos; simplemente
no se guardan.

**Por eso el nivel 2 va junto con el 1, aunque parezca menos urgente:** los otros
niveles dejan enterarse, recuperar o prevenir. **El 2 es el único que permite
ganar la disputa**, y es el más barato de los cuatro.

### Nivel 1 — Ver lo que pasa ✅

1. **Distinguir contracargo de reembolso.** Hoy `mp-webhook` mapea `charged_back`
   al mismo `'reembolsado'` que un reembolso voluntario: en los datos son
   indistinguibles. Sin esto no se puede ni contar cuántos hubo.
2. **Suscribir los eventos de disputa de PayPal** y dejar registro y aviso. Hoy el
   webhook procesa dos eventos y el registrado en producción tiene suscritos
   exactamente esos dos, así que **ni llegan**.
3. **Cruzar contra `paid_out_at`.** Si la reversión cae sobre una sesión ya
   transferida al coach, marcarla: es plata que hay que recuperar o dar por
   perdida, y hoy nadie se entera.

### Nivel 2 — Poder defenderse ✅

**Guardar la asistencia que Daily ya produce**: quién entró, a qué hora, cuánto
duró. Es la única prueba que existe de que la sesión pasó.

⚠️ **Es metadato, no contenido** — pero en una app de salud mental hay que
declararlo en la política de privacidad, **que sigue esperando al abogado**. Mismo
criterio que se aplicó en D2 con la ubicación: no sumar una recolección nueva a un
documento que todavía no existe.

### Nivel 3 — Recuperar ⏸️ cuando haya volumen

La idea de Andre: **que el coach quede en negativo** y se descuente de pagos
futuros. Necesita el registro de operaciones de **D8** para tener sentido.

📝 **Acá sí aplica**, a diferencia de lo que se vio en D7: un contracargo llega
*después* de haberle pagado al coach, así que hay algo que descontar. En las
cancelaciones no, porque la plata todavía es de VIVE.

### Nivel 4 — Prevenir ❌ probablemente nunca

Reserva retenida o retraso de los pagos. Es la mitigación cara y la que peor le cae
al coach. Solo si los contracargos aparecen de verdad.

### La exposición, para dimensionar

PayPal le da al comprador **hasta 180 días** para disputar; el coach cobra a la
semana de la sesión, **sin mínimo y sin reserva retenida**. Cada sesión pagada es
exposición neta de VIVE por medio año.

📝 Cobrar directo (D9) lo mitigaría mucho —el contracargo iría contra el coach—
pero hay que confirmar el tratamiento del platform fee. Y en el split de Mercado
Pago, contra quién va el contracargo **no lo contesta nuestro código**: hay que
verificarlo en la documentación de MP.

<details>
<summary>El planteo original</summary>

## Los tres hallazgos

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

</details>

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

---

## D12 · La dirección fiscal del coach — 🔴 ABIERTA

Apareció al final de la ronda, y es **el dato que VIVE necesita para sus propias
obligaciones** — a diferencia del país del cliente, que no decide ninguna.

**Hoy no existe.** Está implícito que todos los coaches son argentinos, y
estructuralmente **ya no tiene por qué ser así**: PayPal y USDT le sirven a
cualquiera, en cualquier país.

**Para qué se necesita:**

1. **Cómo VIVE le factura su comisión.** Coach en el exterior → exportación de
   servicios, factura E, sin IVA y sin sumar al tope del monotributo. Coach en
   Argentina → factura C, mercado interno. Es la misma comisión y dos comprobantes
   distintos.
2. **Qué rieles de cobro le sirven.** Argentina figura como "Send, receive and
   withdraw" en la tabla de países de PayPal Payouts, pero **no todos los países
   tienen el mismo nivel**. Hay que mirarlo país por país antes de ofrecerle a
   alguien un riel que su país no soporta.

**Lo que hay que decidir:**

- ¿Se soportan coaches fuera de Argentina, o por ahora es hipotético? Cambia si
  hace falta pedir el dato o basta asumirlo.
- Si se soportan: cómo se pide y cómo se verifica. Y si aplica la misma regla de
  D2 — **guardar la observación, derivar la clasificación** — que acá probablemente
  no, porque una dirección fiscal es **declarada**, no observada.

⚠️ **Y el documento de cobro internacional está escrito para un coach argentino de
punta a punta** — habla de CBU, de monotributo, de bajar dólares a un banco
argentino. Con coaches afuera hace falta otra versión, o una que no asuma el país.
