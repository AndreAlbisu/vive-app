# El inicio del coach — análisis e ideas

> 26/08/2026. Escrito a pedido de Andre: qué podría servirle a un profesional en
> su pantalla de inicio, incluyendo ideas nuevas. No es un plan cerrado — es
> material para decidir. Nada de acá está implementado.
>
> ⚠️ **08/09/2026 — esa última frase ya no es cierta y el criterio cambió.** B, D,
> E, F y G se implementaron; A y C no. Y la pregunta pasó a ser de
> pre-lanzamiento. **Leer primero la sección 0**; lo que sigue desde la 1 se deja
> tal cual como el análisis original, que sigue siendo el razonamiento de fondo.
---

## 0. Segunda pasada — 08/09/2026, con el criterio de pre-lanzamiento

> Escrita a pedido de Andre. La primera pasada (todo lo que sigue desde la
> sección 1) preguntaba *"¿qué le serviría al coach?"*. Esta pregunta cambió:
> **no hay clientes, ni coaches reales, ni recursos activos porque la app no se
> lanzó todavía — lo que hay que hacer es la estructura base para lanzar.**
>
> El criterio ya no es *"¿hay data que justifique esta card?"* sino **"¿el camino
> funciona de punta a punta para el coach #1 y el cliente #1 el día del
> lanzamiento?"**. Lo que está en el camino crítico de la primera transacción es
> bloqueante; lo que solo se vuelve interesante con volumen **se gatea por
> cantidad de datos, no se borra**. Corolario que ordena todo: **el estado vacío
> no es un caso borde, es el estado de lanzamiento** — lo van a ver todos los
> coaches del día 1.

### 0.1 Qué se implementó de la primera pasada

| | Idea | Estado al 08/09/2026 |
|---|---|---|
| A | Un solo siguiente paso | **No.** La Home quedó multi-card. Lo único parecido es `prepNextAction` dentro del checklist del coach nuevo. |
| B | Quién se está cayendo | **Sí** — `seCaen` / `lib/coachContinuity.ts`, card "Hace rato que no los ves". ⚠️ El botón dice **"Escribirle"** y abre el chat; el doc pedía *proponerle un horario*, que es la anti-fuga #1. |
| C | "Tus personas" (roster) | **No.** Hay spec (`docs/coach-tus-personas.html`) y cero código. |
| D | El arco del cliente (ánimo) | **Sí, acotada**: solo de la persona de la próxima sesión, dentro de "Preparar sesión", en palabras y no en números, detrás de `MOSTRAR_ANIMO_AL_COACH` + RPC `mood_trend_for_client`. Ver `docs/animo-compartido.md`. |
| E | Cerrar la sesión que pasó | **Sí** — card `sinCerrar` → `/sala` con `abrir_notas`. |
| F | Reputación visible | **Sí** — bloque "LO QUE CONSTRUISTE ACÁ". |
| G | Comisión decreciente dicha | **Sí**, y fusionada con F como recomendaba el doc. |
| — | "Cuánto ganaste" | Correctamente **no** está. |

Agregado después y que no venía del doc: el checklist **"Antes de tu primera
sesión"** (spec `coach-estados-vacios.html`) y la card de visibilidad con
`standing`, que reemplazó al conteo *"aparecés en N puertas"*.

### 0.2 Hechos verificados contra el código (dos creencias eran falsas)

Se chequearon uno por uno antes de decidir nada. **Importa porque dos análisis
seguidos razonaron sobre premisas equivocadas.**

- ✅ **El push al coach por reserva nueva YA existe.** `booking-effects.ts:159`
  manda *"Nueva solicitud de sesión 📅"* apenas se aprueba el pago. Se había
  concluido que no había ningún aviso: era falso.
- 🔴 **Lo que falta es la fila en `notifications` con `type='reserva_nueva'`.**
  El tipo está en el CHECK del schema hace meses y **ningún código lo inserta**
  (ya estaba anotado en el CHANGELOG y quedó ahí). Consecuencia: la push es
  efímera — sin permisos, descartada, o con teléfono nuevo, **no queda rastro** y
  la campana muestra cero.
- 🔴 **La Home no menciona en ningún lado que hay reservas esperando.** El coach
  se entera por un punto rojo de 6px en la pestaña Reservas.
- ✅ **El timeout YA existe.** `expire_pending_bookings()` (pg_cron cada 5 min)
  cancela toda `pendiente` de más de 24hs, notifica y marca el reembolso. También
  se lo había dado por faltante: era falso.
- ✅ **`coaches.instant_booking` YA existe y funciona** (switch en el perfil; con
  él prendido la reserva nace `confirmada`). **Hoy el default es `false`.**
- ✅ **Un cliente no puede elegir un horario que el coach no declaró**:
  `BookingScreen_Time.tsx:70` solo ofrece slots de `coach_availability` con
  `blocked = false`.
- 🔴 **El link público del coach no es "un día de trabajo".** Están
  `react-native-web` y `react-dom`, y `app.json` tiene `web.output: "static"` —
  pero **no hay hosting ni dominio deployado, no existe `coaches.slug`, no hay
  lectura pública del perfil por anon, y `app.json` no tiene `associatedDomains`
  (iOS) ni `intentFilters` (Android)**. Hoy un link no abre la app ni cae en
  ningún lado. Es la única infraestructura **nueva** del lanzamiento.

### 0.3 El veredicto del consejo (dos rondas, `/llm-council`)

La primera ronda razonó con *"no hay volumen, no construyas"* y quedó
invalidada por el reencuadre. La segunda, con el criterio de pre-lanzamiento,
se movió a un lugar distinto y **casi unánime**:

- 🔴 **El link público del coach dejó de ser idea #12 y pasó a ser el centro.**
  Los cinco asesores lo nombraron sin coordinarse. La tesis: el día 1 VIVE no
  tiene demanda propia, pero cada coach llega con 4-10 clientes que ya le pagan
  por transferencia. Dicho crudo: *"el día 1 VIVE no es un marketplace, es un
  riel de cobro + video + notas para transacciones que ya existían afuera"*.
- **`instant_booking = true` por default** (4 de 5). Si el cliente lo trae el
  coach, `pendiente` no protege nada: mete 24hs de espera y un reembolso en el
  momento más frágil del producto. **Ese default colapsa la mitad del backlog**:
  saca del camino crítico la card de pendientes, el punto rojo y el timeout.
- **El checklist necesita un cuarto paso: "Traé a tus primeros clientes"**, con
  el link ya generado y texto listo para pegar en WhatsApp. Los tres pasos
  actuales son tarea administrativa y **ninguno contesta la única pregunta que el
  coach tiene abierta: de dónde salen los clientes.** *"Nadie completa tres pasos
  por fe."*
- **"Puertas" → "temas"**, ahora como bloqueante de onboarding y no como detalle
  de copy: es jerga que funciona adentro del equipo y afuera es un acertijo.

**Dónde el consejo se peleó:**

- **¿Gatear las cards vacías?** El ejecutor dijo *no toques nada, vacío no rompe*.
  Tres de cinco revisores lo marcaron como el peor punto ciego: vacío no rompe el
  código, **rompe la confianza**. Siete ceros, *"Sin sesiones"*, *"Lo que
  construiste: 0"* y un ranking contra rivales inexistentes no se leen como
  *"recién arrancás"* sino como **"esto está muerto"**. Es la única primera
  impresión que no se repite. → **Se gatean.**
- 🔴 **La objeción que no tuvo respuesta:** si la jugada es que el coach traiga su
  propia gente, entonces **la comisión decreciente cobra el máximo justo en la
  primera sesión con clientes que él ya tenía y que hoy le pagan el 100%**. Ese
  coach hace la cuenta en la sesión 2. **Es un problema de pricing, no de UI**, y
  hay que resolverlo antes de vender el paso 4 del checklist. Ver
  `docs/camino-del-cliente-1.md`.
- **¿El aviso es software o una persona?** Se propuso escalación humana (WhatsApp
  al coach a los 30 min). Descartado: *"no es un entregable, es un turno de
  guardia sin dueño ni horario"* — y con `instant_booking` en true no hace falta.

**El punto ciego que cazó la revisión, y es el hallazgo de la ronda:** 🔴 **nadie
caminó el lado del cliente.** Las dos rondas discutieron la Home del coach; pero
el cliente #1 llega por WhatsApp a una app que no conoce y tiene que instalar,
registrarse, pasar un onboarding pensado para *descubrimiento* (no para "vengo a
ver a Sofía") y pagar. **Ahí se cae el embudo, no en la card 6.** Se abrió
`docs/camino-del-cliente-1.md` para eso.

También quedó anotado, sin dueño: **no hay screening de coaches ni protocolo de
crisis**, en una app que toca ánimo bajo Ley 25.326.

### 0.4 Qué hacer con la Home, entonces

**La pregunta "qué cards van en el Inicio del coach" está respondida, y resultó
ser la parte chica: medio día de trabajo.**

- **Se muestran:** header, próxima sesión (con "Preparar sesión"), sesión sin
  cerrar, y el checklist — que es **la** card del día 1.
- **Se gatean por datos** (el código queda, se le pone una compuerta):
  - `week` — que no renderice si la semana está en cero.
  - **Card 6, visibilidad/standing** — por tamaño del pool. Con 4 coaches el
    ranking es mentira; con 40 es el mejor dato de la pantalla.
  - **Card 7** — ya se auto-esconde bien (`rebooking_rate` es NULL con menos de 5
    completadas). Lo único a hacer es **mover la nota de comisión a cobros**: en
    la pantalla de saludo se lee *"me van a cobrar"*, no como generosidad.
- **Se cambia copy:** "puertas" → "temas"; "Escribirle" → "Proponerle un horario".
- **Se agrega:** el cuarto paso del checklist.
- **No se construye ahora:** A (motor de prioridades sin tráfico para calibrarlo;
  ordenar y colapsar da el 80% gratis) ni C (no está en el camino crítico de la
  primera transacción). D queda como está.

**Orden sugerido:** `instant_booking` default → insert de `reserva_nueva` →
copy + compuertas → cuarto paso del checklist → y el proyecto de verdad, que ya
no es esta pantalla.

> ✅ **08/09/2026 — aplicado todo lo que no dependía de una decisión abierta:**
> el insert de `reserva_nueva`, la compuerta de la tira semanal, la compuerta
> del `standing` por competencia real, "puertas" → "temas" en las dos pantallas
> del coach, y la nota de comisión mudada a "Cómo te pagamos". ⚠️ **Queda sin
> hacer**, y a propósito: `instant_booking` (decisión), "Escribirle" →
> "Proponerle un horario" (es una re-reserva, no un cambio de label) y el cuarto
> paso del checklist (necesita el link, que necesita la decisión 1). Detalle en
> la entrada de la sesión 201 del CHANGELOG.
>
> ✅ **09/09/2026 — el veredicto quedó APLICADO ENTERO.** Se destrabó lo que
> faltaba: la decisión del link se tomó (opción A), el link se construyó, y con
> él llegó **el cuarto paso del checklist**. También se hizo "Escribirle" →
> "Proponer horario", que era una re-reserva y no un cambio de label.
>
> 📝 Y dos cosas **NO se hicieron, en contra del veredicto y con razón**: la tira
> semanal se muestra siempre —decisión de Andre: es la orientación de la
> pantalla y una Home que cambia de forma según el día hace que el coach no sepa
> dónde mirar— y las reservas pendientes van **debajo** de "Tu próxima sesión",
> no arriba: urgente no es lo mismo que principal.

### 0.5 Lo que queda decidido por Andre

1. 🔴 **La forma del link público: ¿reserva y cobra en web, o muestra el perfil y
   manda a la store?** Es lo único que no se puede decidir después: define si el
   lanzamiento tiene un embudo o solo un botón de instalar. **Abierta.**
2. ~~El default de `instant_booking`~~ → ✅ **RESUELTA el 08/09/2026: sigue en
   `false`**, contra la recomendación del consejo. *No se puede obligar a un
   coach a aceptar sesiones de gente random* — la reserva instantánea no es
   fricción a eliminar, es el único control que el profesional tiene sobre con
   quién trabaja. 🔴 **Consecuencia: se cae el argumento de que ese default
   "colapsaba la mitad del backlog", y la card "Reservas esperando tu respuesta"
   vuelve al camino crítico del lanzamiento.** Ver `docs/camino-del-cliente-1.md`
   §6. También se descartó la excepción por origen (instantánea para quien entra
   por el link): **el coach igual tiene que aprobar si el horario le queda
   cómodo** — conocer a la persona no vuelve conveniente el martes a las 8.
   ✅ **Y la card "Reservas esperando tu respuesta" ya está hecha** (sesión 203).
3. ~~La comisión sobre clientes que trae el coach~~ → ✅ **RESUELTA el
   08/09/2026: no se toca la comisión, el link ofrece un DESCUENTO a quien entra
   por él, lo absorbe VIVE, y vale solo la primera sesión de esa persona.** El
   beneficio cambia de sujeto: paga menos la persona invitada, y el coach gana un
   motivo para compartir el link en vez de un motivo para evitarlo. Falta solo
   **el porcentaje**: el techo local es 20% (la comisión de MP no toca la porción
   de VIVE), pero el que manda es el riel internacional, donde PayPal cobra
   5,40% + USD 0,30. Ver `docs/camino-del-cliente-1.md` §2.1.


## 1. El diagnóstico, en una frase

**La Home de hoy contesta "¿qué tengo hoy?", y ese es el marcador, no la palanca.**

Sus cuatro bloques —saludo, tira de la semana, próxima sesión, tarjeta de
visibilidad— dependen todos de que ya haya sesiones. Pero los problemas reales
del coach, según la definición del producto (*"tengo conocimiento pero no sé
llegar a la gente, no tengo agenda ni sistema de reservas"*), son tres y ninguno
es la agenda:

1. **Llegar a gente nueva** (adquisición)
2. **Que esa gente vuelva** (retención)
3. **No dejar caer el hilo entre sesión y sesión** (continuidad)

La agenda es el *resultado* de los tres. La Home muestra el resultado y ninguna
de las tres palancas. Por eso se siente vacía incluso cuando hay una sesión
agendada: no es que falte contenido, es que lo que hay no le da nada que hacer.

## 2. La reinterpretación que ordena todo lo demás

De la estrategia anti-fuga viene el insight que debería gobernar esta pantalla:

> Para el coach, lo que Vita le da **no es el cliente que ya tiene, es el cliente
> nuevo**. La comisión es su costo de adquisición.

Si eso es cierto, entonces:

**La Home no es un dashboard. Es el recibo permanente de lo que Vita le está
dando.**

Hoy el coach siente la comisión todos los meses y no ve nunca lo que compró con
ella. Esa asimetría es exactamente el combustible de la fuga: lo que se cobra es
visible y recurrente, lo que se entrega es invisible. Cualquier bloque que
agreguemos debería poder contestar *"¿esto me lo trajo Vita?"*.

⚠️ **Y hay una tensión que no se puede ignorar.** El producto se define como *"si
abruma, sobra"*, *"menos pero más intencional"*, explícitamente **no**
productividad tóxica. Llenar el vacío con una pared de métricas sería resolver un
problema visual traicionando el principio. **El vacío no se llena: se reemplaza
por lo poco que se gane el lugar.**

## 3. Ideas, ordenadas por lo que aportan

### A. Un solo "siguiente paso" (la más alineada con la marca)

En vez de N bloques, la Home calcula **la única cosa que importa ahora** y la
muestra grande:

- ¿Hay una reserva sin confirmar? → *"Ana espera tu confirmación para el jueves"*
- ¿La próxima sesión es en menos de 24hs? → *"Preparás la de mañana"*
- ¿Hay alguien que no vuelve hace 3 semanas? → *"Hace 21 días que no ves a Marcos"*
- ¿Falta algo para aparecer en Conexiones? → el bloqueante
- ¿Nada de lo anterior? → *"Estás al día"* y punto

Es lo contrario de un dashboard y es exactamente *"menos pero más intencional"*.
Y resuelve un agujero concreto que hoy existe: **en la captura del 26/08 la
pestaña de Reservas tiene el punto rojo y la Home no lo menciona.** Hay algo
esperando acción y te enterás por un punto de seis píxeles en otra pestaña.

### B. Continuidad: quién se está por caer 🔴

**Es la idea con más retorno de todas, y no existe en ninguna forma.**

Datos que ya están: sesiones `completada`, sin reserva futura, N días desde la
última. Con eso se arma *"Hace 3 semanas que no ves a Ana"* con un botón de
**proponerle un horario**.

Por qué importa tanto:

- Es el problema de negocio más caro del coach (la fuga de clientes propios).
- Es plata para el coach y para Vita al mismo tiempo.
- **Es la medida anti-fuga #1 vista desde el otro lado.** "Re-reserva de un
  toque" hoy existe solo del lado del usuario (`rebookData` en
  `app/(tabs)/conexiones.tsx`). El coach no tiene ninguna forma de iniciar una
  re-reserva — y es el que se acuerda de la persona.
- Si Vita le recupera un cliente que se estaba cayendo, la comisión deja de
  discutirse sola.

### C. "Tus personas" — el modelo mental que la app no tiene 🔴

**Verificado: no existe ninguna lista de clientes en la app.** Hay reservas
(`CoachReservasScreen`) y hay chats (`CoachChatsScreen`), que son dos vistas de
eventos. Pero **el coach no piensa en reservas, piensa en personas**: "cómo viene
Ana", "a Marcos le mandé el ejercicio y no sé si lo hizo".

Un roster —cada persona con su última sesión, si abrió lo que le mandaste, si
tiene próxima— es el bloque que más se parece a cómo trabaja de verdad. Y es
**sesión pegajosa** en estado puro (anti-fuga #4): ese historial no se lo puede
llevar a ningún lado.

### D. El arco del cliente entre sesiones ⚠️ (la más diferenciadora, y la más delicada)

`mood_entries` existe: el usuario hace check-in diario de ánimo. **El coach nunca
lo ve.** Verificado — cero referencias en todo `screens/Coach*.tsx`.

Un coach que antes de la sesión ve *"viene de cuatro días seguidos en bajón"*
llega con una información que **ninguna plataforma de la competencia le da**, y
que hace la sesión medible mejor. Es el diferencial más grande que encontré.

🔴 **Pero es dato sensible en los términos de la Ley 25.326**, y SCHEMA.md ya lo
dice así: el ánimo y el diario *"pueden constituir datos sensibles"* y se tratan
*"con el consentimiento libre, expreso e informado del Usuario"* y **con el único
fin de prestar el servicio**. Compartirlo con el coach **no está cubierto por ese
consentimiento**: es una finalidad nueva.

Así que esto **no se puede hacer en silencio**. Requiere:
- Opt-in explícito del usuario, por coach, revocable.
- Probablemente solo la tendencia agregada (una flecha, no las entradas).
- **Nunca el diario ni la gratitud.** Eso es contenido, no metadato.
- Revisión del abogado antes de escribir una línea.

Bien hecho, es una razón para elegir Vita. Mal hecho, es un problema legal y una
traición a la confianza del usuario, que es el activo entero del producto.

### E. Cerrar la sesión que ya pasó

`session_notes` existe (privada + compartida) y vive detrás de una pill en el
header del chat. **Nadie le pide nunca al coach que la escriba.**

Un bloque *"Ayer tuviste sesión con Ana — ¿le dejás algo para la semana?"* es a
la vez buena práctica profesional y la función más pegajosa que tiene el
producto. Costo bajo: la infraestructura está entera.

### F. La reputación como ancla, visible

`coach_rebooking_stats` calcula `rebooking_rate` (qué fracción de tus clientes
vuelve) y hoy **solo se usa para rankear el deck del usuario**. El coach nunca lo
ve.

*"El 60% de las personas que atendés vuelve"* es el número más halagador y más
difícil de conseguir que tiene un profesional independiente — y **no se lo puede
llevar a ningún lado**. Es anti-fuga #4 en una línea.

### G. La comisión decreciente, dicha

Anti-fuga #3 está pendiente desde el 06/08 y la memoria la describe como *"casi
gratis (copy)"*. El encuadre que funciona ya está escrito:

> **"Te cobramos por presentarte al cliente, no por tu relación con él."**

La Home es donde eso se dice. Hoy el coach ve la comisión en el perfil, en frío,
sin ese marco.

## 4. Lo que NO haría

**Un bloque de "cuánto ganaste".** Es lo primero que pide un dashboard y acá está
mal por dos motivos:

1. **En pesos, Vita no tiene el dato.** El split de Mercado Pago deposita en la
   cuenta propia del coach. Mostrar "ganaste X" duplica —y puede contradecir— lo
   que él ya ve en su app de MP.
2. **Es el encuadre equivocado.** Un contador de plata en la pantalla de inicio
   empuja al coach a pensar en volumen, que es exactamente la productividad
   tóxica que el producto dice no ser.

Lo que sí tiene sentido mostrar es **lo que Vita le debe** (riel internacional,
donde no tiene otra fuente): *"USD 120 a transferirte el lunes"*. Preciso,
accionable, y solo donde somos la única fuente.

## 5. Si hubiera que elegir un orden

1. **Un solo siguiente paso** (A) — chico, muy alineado, y destapa lo accionable
   que hoy está escondido en un puntito.
2. **Quién se está por caer** (B) — el mayor retorno para coach y para Vita.
3. **Tus personas** (C) — el modelo mental que falta.
4. **Cerrar la sesión** (E) y **reputación** (F) — baratos, pegajosos.
5. **El arco del cliente** (D) — el diferencial, detrás de consentimiento y del
   abogado.

## 6. La pregunta que queda abierta

Todo lo de arriba asume que la Home debe **darle trabajo** al coach. Hay una
lectura opuesta, igual de coherente con la marca: que la Home sea **un lugar
tranquilo** —tu día, tu gente, nada más— y que las palancas vivan en otras
pestañas.

Bajo esa lectura, el vacío de la captura **no es un problema a resolver sino una
decisión a defender**, y lo único que falta es que lo accionable no esté
escondido en un punto rojo.

No creo que sea la lectura correcta —el coach que arranca necesita que le digan
qué hacer— pero conviene descartarla a propósito y no por omisión.
