# Qué hacer con "¿Cómo te gustaría empezar?"

> 31/08/2026. Revisión de la pantalla hecha con Andre. Lo que se arregló en la
> misma sesión está marcado como tal.
>
> ✅ **DECIDIDO el 01/09/2026 por Andre: la opción A**, y ya está implementada
> (ver §6). El resto del documento se deja como estaba — es el razonamiento que
> llevó a la decisión, y sirve para entender por qué el flujo quedó así.
>
> Autocontenido a propósito: se puede leer sin abrir el repo.
>
> 🔗 Versión web para compartir por link:
> https://claude.ai/code/artifact/af7f5dc4-b063-4dfc-93ab-fea778217c83

---

## 0. Por qué se revisó

Andre preguntó si esta pantalla era lo siguiente a rediseñar y si le seguía
pareciendo útil. Al mirarla apareció que el problema no era visual.

---

## 1. Cómo funciona hoy, entero

**Bienvenida** (`OnboardingScreen1`) — animada, sin opciones.

**Bifurcación** (`OnboardingBifurcacion`) — dos alas:

| | Copy | Va a |
|---|---|---|
| Quiero crecer | *Quiero explorar herramientas para mi crecimiento.* | La pantalla de abajo |
| Quiero acompañar | *Soy profesional y quiero ofrecer mi acompañamiento.* | Login de coach |

**"¿Cómo te gustaría empezar?"** (`OnboardingScreen2`) — la que se discute:

| | Copy | Va a |
|---|---|---|
| Quiero explorar la app | *Ver todo lo que ofrece Vita* | Inicio |
| Sé qué necesito | *Busco el profesional indicado* | Profesionales |
| No sé por dónde empezar | *Necesito que me orienten* | Las tres de abajo |

**Paso 1 de 3 — "¿Por dónde querés empezar?"** (*Arranquemos por lo que más te
resuena hoy*): Cuerpo · Mente · Alma.

**Paso 2 de 3 — "¿Qué aspecto querés explorar?"** (*Elegí por dónde querés
arrancar*): tres categorías según el universo, nueve en total.

- Cuerpo → Energía y hábitos · Alimentación · Sexualidad e intimidad
- Mente → Sentirme mejor · Entender qué me pasa · Mis vínculos
- Alma → Mi rumbo y propósito · Crecer y motivarme · Trabajo y carrera

**Paso 3 de 3 — "¿Qué te está pasando puntualmente?"** (*Podés elegir más de
uno*): chips multi-selección. Botón final: **"Ver profesionales"**.

---

## 2. Lo que se encontró

### 🔴 Se pregunta lo mismo tres veces, y nunca por la persona

Los tres títulos seguidos son *"¿Cómo te gustaría empezar?"*, *"¿Por dónde querés
empezar?"* y *"¿Qué aspecto querés explorar? / Elegí por dónde querés arrancar"*.
Es la misma pregunta con distinto grano.

Y ninguna es sobre la persona: todas son sobre **cómo quiere usar el producto**,
en el momento en que menos puede saberlo — abrió la app hace treinta segundos.
Incluso la pantalla que recolecta el dato bueno (cuerpo/mente/alma) lo pide
disfrazado de pregunta de navegación.

📝 La memoria de producto ya decía que el paso 2 del onboarding ideal era
**"¿Qué te trajo hoy?" (emocional — genera compromiso)**. La app terminó
preguntando lo contrario.

### 🔴 La buena pregunta existe: es la última, y es la que peor termina

*"¿Qué te está pasando puntualmente?"* es la única del flujo que pregunta por la
persona. Está en el paso 3 de 3, detrás de dos preguntas de navegación — y es la
única cuya respuesta **no tiene a dónde ir** (ver taxonomías, abajo).

### 🔴 El botón miente

`OnboardingScreen5.handleContinue()` dice **"Ver profesionales"** y hace
`router.replace('/register')`. Contestás tres pantallas, te prometen
profesionales, y aparece un campo de email.

### 🔴 "Sé qué necesito" no era un camino

Las tres opciones terminaban así: explorar → Inicio, sé qué necesito →
Profesionales, no sé → tres preguntas → registro.

Las dos últimas **desembocan en el mismo lugar** (un profesional); lo único que
cambia es si la lista viene filtrada. Y las dos primeras se diferencian en **qué
tab abre primero**. Observación de Andre, y es correcta: eso no es una
bifurcación de producto, es una preferencia de pantalla inicial.

**Los perfiles que llegan son tres, pero los caminos son dos:**

1. **El curioso** — bajó sin un problema urgente, quiere ver qué hay. En una app
   nueva, probablemente la mayoría.
2. **El que viene a reservar** — se la recomendaron o vio publicidad. Existe como
   persona, pero **no necesita puerta propia**: con un tap desde Inicio ya está
   en Profesionales.
3. **El que tiene un problema y no sabe qué necesita** — literalmente el problema
   #1 del overview de producto. Es el único que necesita un camino distinto.

### ⚠️ Hay una tercera (y cuarta) taxonomía

Los temas del paso 3 (`TEMAS` en `OnboardingScreen5`) **no hablan el vocabulario
de los coaches** (`AXES` en `constants/searchData.ts`, que es lo que llena
`coach_topics`):

| Categoría | Temas que existen del lado del coach |
|---|---|
| Mis vínculos | 5 de 6 |
| Mi rumbo · Crecer | 3 de 4 |
| Energía y hábitos | 3 de 5 |
| Sentirme mejor | 1 de 5 |
| Entender qué me pasa | 1 de 4 |
| **Alimentación** | **0 de 2** |
| **Sexualidad** | **0 de 3** |

Los que no coinciden son de dos tipos: el mismo concepto con otro nombre
(*"Energía y cansancio"* vs `Energía`, *"Tristeza/bajón"* vs `Tristeza`), o
conceptos que **no existen** del otro lado (`Pánico`, `Insomnio`, `Comer mejor`,
`Deseo`, `Intimidad`).

Y encima Profesionales no filtra por `AXES` sino por **puertas**
(`constants/conexionesDoors.ts`), que es otra agrupación más.

**Consecuencia:** "llevarte a profesionales filtrados por lo que dijiste" **no se
puede hacer con los temas**. Sí con universo + categoría, que ya mapean.

---

## 3. Lo que YA se arregló (no hace falta discutirlo)

- ✅ **La elección se guarda.** Antes era estado local que se perdía al salir de
  la pantalla.
- ✅ **"Sé qué necesito" ya no choca contra un registro.** Iba a `/register`
  siendo la rama de más intención, cuando Profesionales anda sin cuenta.
- ✅ **Las respuestas del guiado ya no se tiran.** Se encolan sin cuenta y se
  vuelcan a `user_quiz_answers` al registrarse, una sola vez.
- ✅ **`user_quiz_answers.axis`** guarda el universo declarado
  (`scripts/add-quiz-declared-axis.sql`, **corrido y verificado el 31/08/2026**),
  así el eje decide **qué** recomendar y el topic **cómo** nombrarlo.
- ✅ **Las microguías ya existían** (`FirstTimeTooltip`, en Inicio, Profesionales,
  Recursos y Sala) y ahora llevan contador "N de 3" y "Saltear la guía".

---

## 4. Las cuatro opciones

### A · Una pregunta sobre la persona

Se deja de preguntar por la navegación. **"¿Qué te trae por acá?"** con tres
estados y una salida:

```
        ¿Qué te trae por acá?

  Algo del cuerpo    · No dormís, sin energía
  Algo de la cabeza  · Ansiedad, ánimo, vínculos
  Algo del rumbo     · Trabajo, propósito
  Solo estoy mirando · Quiero ver qué hay
```

Las tres primeras van a una segunda pregunta (la categoría, que es la que mapea
limpio) y de ahí a profesionales filtrados con una línea que explique por qué. La
cuarta va a Recursos.

- **Colapsa** la pantalla 2 y el paso 1 en una sola; **elimina** el paso 3.
- **Queda**: 1 pantalla para el curioso, 2 para el que trae algo. Hoy son 4 para
  todos.
- **Recolecta** exactamente el dato que ya tiene columna (`axis`) y el que ya
  mapea (categoría → `topic`).
- **Cuesta**: perdés los temas, que es el dato más específico que se recolecta
  hoy — aunque hoy no lo usa nadie ni podría.
- ⚠️ **"¿Qué te trae?" pesa más** que "¿cómo querés empezar?". "Solo estoy
  mirando" tiene que ser una opción entera y del mismo tamaño visual, no un link
  chiquito: si se siente premio consuelo, la pantalla empuja a mentir.

### B · Dos puertas

Se cae "Sé qué necesito". Queda **"Quiero explorar"** / **"Necesito que me
guíen"**, y las tres pantallas del guiado siguen igual detrás de la segunda.

- **A favor**: el cambio más chico, no toca nada que funcione.
- **En contra**: deja intacto el problema de fondo. Sigue preguntando por la
  navegación, sigue preguntando tres veces lo mismo, y el guiado sigue terminando
  en un registro con un botón que promete profesionales.

### C · Ninguna pantalla

Se saca la pregunta y entrás directo a la app. La ayuda no se ofrece antes de que
la persona haya visto nada: vive donde sirve, **y las dos piezas ya existen** —
la guía contextual "1 de 3" y la card *"¿No sabés por dónde empezar?"* que ya
está en Profesionales con el quiz atrás.

- **A favor**: el que más respeta "si abruma, sobra". Cero fricción.
- **En contra**: perdés el dato del eje justo después de haber agregado la
  columna, y el perfil 3 —para el que existe el producto— queda dependiendo de
  que encuentre solo la card del quiz.

### D · Una oferta con salida

Misma forma que la guía contextual: no dos puertas gemelas, sino una propuesta y
una salida.

```
   ¿Querés que te ayudemos a encontrar por dónde empezar?

   [ Dale, empecemos ]   ·   Son dos preguntas

              Prefiero mirar solo
```

Detrás de "Dale" van las preguntas de la opción A.

- **A favor**: es honesto sobre que las dos cosas no pesan igual. "Explorar" no
  es una elección, es un "no, gracias".
- **En contra**: una sola oferta con un link abajo **empuja más** que dos
  tarjetas iguales. Hay que decidir si eso está bien.

---

## 5. Lo que hay que decidir

1. **Cuál de las cuatro.**
2. Si sobrevive alguna pantalla: **instrumentarla**. Hoy el onboarding **no tiene
   una sola línea de analítica** (cero `registrarEvento` en `OnboardingScreen1-5`
   ni en la bifurcación), así que ninguno de los tres perfiles está medido y esta
   discusión se dio entera sobre hipótesis.
3. **Dónde aterriza "explorar"**. Hoy va a Inicio, y sin cuenta esa pantalla es
   casi toda estados vacíos (pinneados vacíos, check-in que pide registrarse, sin
   próxima sesión). Debería ir a Recursos, que es lo único que da valor solo,
   gratis y sin cuenta.
4. **Qué pasa con los temas** si se eligen A, C o D: se sueltan, o se renombran
   al vocabulario de los coaches aceptando perder los que no tienen contraparte.

---

## 6. Lo decidido y construido — 01/09/2026

**Andre eligió A.** Las cuatro decisiones de §5 quedaron cerradas así:

1. **Opción A.** El onboarding pasa de cuatro pantallas para todos a **una para
   quien vino a mirar y dos para quien trae algo**.
2. **Instrumentado el embudo entero** (ver §7), no solo las dos pantallas
   nuevas. La próxima vez que se discuta esto va a haber números.
3. **"Solo estoy mirando" va a Recursos**, no a Inicio.
4. **Los temas se sueltan.** No se renombran: el paso 3 salió del flujo. El
   campo `temas` sigue existiendo, opcional, para poder leer lo que ya está
   guardado en dispositivos reales.

**El flujo ahora:**

| Pantalla | Pregunta | Va a |
|---|---|---|
| `OnboardingScreen2` | **¿Qué te trae por acá?** — cuerpo · cabeza · rumbo · solo mirando | *mirando* → Recursos · el resto → abajo |
| | *(rediseñada sobre el boceto de Andre, 01/09: filas en vez de tarjetas, título a la izquierda, navegación directa al tocar)* | |
| `OnboardingScreen4` | **¿Qué aspecto querés explorar?** (*Última pregunta*) | Profesionales, **en el menú de su eje con su tema destacado** |

⚠️ **La primera versión abría el deck de la puerta** —el mazo de personas para
reservar— y Andre lo frenó: *"se siente como que lo querés forzar un poco"*.
Tenía razón, y el error fue de razonamiento: el defecto original era "el botón
miente", y lo arreglé cumpliendo la promesa a rajatabla en vez de preguntarme si
la promesa estaba bien. El perfil para el que existe este camino es **"el que
tiene un problema y no sabe qué necesita"**, y no saber qué necesitás no es lo
mismo que estar listo para pagarle a alguien. Ahora ve que hay gente de lo suyo
—su tema destacado entre los del eje— pero elige ella si entra.

**Lo que se borró**: `OnboardingScreen3` (el universo, que se comió la pantalla
2) y `OnboardingScreen5` (los temas), con sus rutas. Están en git.

**La cuarta taxonomía**: para poder abrir la puerta correcta hizo falta un mapa
nuevo, `CATEGORIA_A_PUERTA` en `lib/onboardingRespuestas.ts` — las puertas son
capa de presentación y no se derivan ni del universo ni del `topic`. Es a mano,
y un test verifica que las nueve categorías caigan en puertas que existan, que
no se repitan y que un id desconocido no rompa nada.

📝 **Lo que NO se tocó en su diseño**: `OnboardingScreen1` (la bienvenida) y la
bifurcación usuario/profesional. Las dos sí quedaron instrumentadas.

---

## 7. La instrumentación — 01/09/2026

> *"Todo es prueba y testeo: necesitamos saber qué cosas tocan y deciden los
> usuarios, para ver qué llama la atención, qué no, qué sirve y qué no."* — Andre

🔴 **El problema que había que resolver primero**: `registrarEvento` escribe
`user_id` sacándolo de la sesión, y **en todo el onboarding no hay sesión**. Sin
más, los eventos caían todos con `user_id` en null y eran indistinguibles entre
sí: se podría contar cuánta gente tocó cada opción, pero **no si dos eventos son
de la misma persona** — o sea, habría conteos pero no embudo, que es lo único
que sirve para decidir. Por eso existe `lib/onboardingAnalytics.ts`: un id
anónimo por dispositivo que viaja en `properties.sesion` de cada evento.

**Los eventos:**

| Evento | Dónde | Qué contesta |
|---|---|---|
| `onboarding_pantalla_vista` | bienvenida · bifurcación · las dos preguntas | Dónde se cae la gente |
| `onboarding_opcion_tocada` | la pregunta de categoría | **Qué llama la atención**, con `orden`: el primer toque es lo que atrajo, los siguientes son los que se lo pensaron |
| `onboarding_respuesta` | las cuatro pantallas | Qué elige, con `segundos` (y `toques` donde hay paso de confirmación) — dos personas que eligen lo mismo, una en 2s y otra en 20s, no dicen lo mismo sobre la pregunta |
| `onboarding_fin` | las dos preguntas | Dónde aterriza y con qué puerta sugerida |
| `onboarding_registro` | `AuthContext` | **El puente**: única fila con `user_id` y `sesion` juntos |
| `conexiones_puerta_abierta` | Profesionales | Con `sugerida`: **si abre la que le sugerimos u otra** |

📝 **`conexiones_puerta_abierta` es la que evalúa la decisión de hoy.** Si la
mayoría de los que llegan del onboarding abre una puerta distinta a la
destacada, el mapa `CATEGORIA_A_PUERTA` está mal — y lo va a decir el dato, no
una discusión.

⚠️ **`onboarding_opcion_tocada` ya no sale de "¿Qué te trae por acá?"**: desde el rediseño del 01/09/2026 esa pantalla navega al tocar la fila, así que tocar **es** responder y el evento sería un duplicado de `onboarding_respuesta`. Se perdió `toques` como señal de duda ahí; queda `segundos`, que mide lo mismo por otro lado. La pregunta de categoría sí lo conserva, porque todavía tiene paso de confirmación.

📝 **La bienvenida se mide aparte por una razón concreta**: avanza con un *long
press*, así que tiene una forma de perder gente que ninguna otra pantalla tiene
—no entender que hay que sostener—, y sin medirla una caída ahí se leería como
que la app no le interesó a nadie.
