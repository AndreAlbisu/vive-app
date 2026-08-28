# "Sobre vos" pasa a ser la voz de Sofía

> 28/08/2026. Decisión de dirección tomada con Andre. **Nada de esto está
> implementado**: es el marco para decidir qué se construye y qué se descarta.
> Reemplaza el encuadre con el que se venía trabajando la tarjeta del Inicio.

---

## 0. Para qué existe la IA en Vita

> **Para que la gente se sienta acompañada ENTRE las sesiones.**

Alguien tiene una sesión por semana. Entre una y otra pasan cosas, y el
profesional tiene que poder desconectarse — no está disponible un martes a las
once de la noche, ni debería estarlo.

🔴 **La IA no puede ni debe reemplazar al coach.** Es un amigo a distancia que te
hace sentir acompañado; no interpreta, no trata, no aconseja lo que le toca a un
profesional.

De ahí sale el único criterio que importa para juzgar cualquier versión de esto:

> **Un martes a la noche, con la sesión el sábado, ¿esto sirve de algo?**

Y el fracaso concreto a evitar, dicho por Andre: *"que no se sienta como una
tarjeta vacía, que terminás ignorando por lo básicas e inútiles de sus
respuestas"*.

---

## 1. Qué cambia

La tarjeta del Inicio deja de ser **una devolución sobre tu semana** y pasa a ser
**una presencia que te habla hoy**.

No es un cambio de copy. Es un cambio de para qué existe:

| | Antes | Ahora |
|---|---|---|
| Qué es | Una lectura de lo que registraste | Alguien que está |
| Tiempo verbal | Pasado — "venís mejor que la semana pasada" | Presente — "acá estoy, ¿cómo va hoy?" |
| Se juzga por | Si dice algo cierto y útil | Si se siente acompañamiento |
| Modo de fallar | Inútil | Falso |

## 2. Por qué, y por qué el argumento anterior estaba mal

La objeción que tenía la versión anterior era: **la app no puede decirte nada que
no sepas sobre tu propia semana**. No tiene ninguna ventaja de información sobre
vos. Es un espejo que solo refleja.

Esa objeción es correcta **y es irrelevante**, porque estaba usando la vara de un
analista. Un amigo no vale por tener información que vos no tenés. Vale porque
está. *"¿Cómo venís?"* no tiene contenido informativo y tiene enorme valor.

Y hay un argumento más fuerte que el de producto:

> 🔴 **La presencia se equivoca más barato que la interpretación.** Un análisis
> que afirma cosas sobre el estado emocional de alguien puede errarle de maneras
> que lastiman — y esta app le habla a gente que la está pasando mal. Una
> presencia que dice "acá estoy" no puede fallar igual.

Eso no es una excusa para decir cualquier cosa: es la razón por la que este
encuadre es **más defendible**, no menos exigente.

## 3. El riesgo real, que es peor que el anterior

**La presencia es lo más difícil de falsificar.** El modo de fallar del analista
era *inútil*; el del amigo es *falso*. Una app actuando intimidad da vergüenza
ajena en una semana, y de ahí no se vuelve.

Las cinco reglas que la hacen creíble, y sin las cuales no hay que construirla:

### 3.1 Recuerda la conversación, no los datos

Un amigo pregunta *"¿pudiste dormir mejor?"* porque se lo contaste, no porque lo
calculó. La diferencia entre analista y amigo **no está en la información que
tienen**: está en qué hacen con ella. Uno te la reporta, el otro la usa para
preguntarte.

### 3.2 Pregunta más de lo que afirma

Es lo mismo que dijo la psicóloga consultada el 27/08 sobre compartir el ánimo:
su movimiento era **preguntar, no afirmar**. Viene de alguien que hace esto en
serio, y vale igual acá.

### 3.3 No es igual todos los días

Una presencia idéntica cada mañana se vuelve empapelado en una semana. **A veces
un amigo no dice nada**, y eso también es estar. La tarjeta tiene que poder
callarse.

### 3.4 Nunca pide una reserva — pero sí puede nombrar al profesional

El día que la voz cálida sugiere reservar una sesión, deja de ser un amigo y es
un vendedor. ⚠️ Esto ya se aprendió acá: `CoachSuggestionCard` se sacó en la
sesión 97 por aparecer en el peor momento a pedir algo. **No reintroducirlo por
la ventana.**

📝 **Corrección del 28/08:** la regla estaba mal formulada como "nunca pide
nada". Mencionar al profesional NO es vender. Un amigo que dice *"eso decíselo el
sábado"* hace exactamente lo contrario de un vendedor: reconoce su límite. Un
amigo que sabe hasta dónde llega es **más** creíble, no menos.

Y le da a la voz un trabajo concreto entre sesiones: **sostener hasta la próxima
sesión y ayudar a que llegue lo que pasó** — que enlaza directo con
[`paquete-para-la-sesion.md`](paquete-para-la-sesion.md).

### 3.5 No finge sentir

*"Me alegro por vos"* de una app es mentira. Cálida y presente, sí. Persona, no.

## 4. Una voz, no dos

Hoy la app tiene **dos presencias cálidas compitiendo**: esta tarjeta, y Sofía —
que tiene nombre, cara, animación y un lugar destacado, y que **no conversa**
(su campo de texto está deshabilitado con un "Muy pronto vas a poder
escribirme").

Tener dos es tener una de más. La decisión:

> **La tarjeta es Sofía estando. El panel es Sofía hablando.**

Le da a la tarjeta una identidad que hoy no tiene, y le da a Sofía algo que hacer
todos los días en vez de esperar un chat que todavía no existe.

⚠️ **Consecuencia incómoda que hay que mirar de frente:** unificar hace que el
chat faltante sea MÁS visible, no menos. Si la tarjeta es Sofía hablándote y al
tocarla no se le puede contestar, la promesa rota queda al frente del Inicio.
Eso condiciona el orden: o el panel deja de prometer conversación, o la
conversación existe antes de unificar.

## 5. Qué sobrevive de lo que ya está

No se tira nada de la maquinaria. Cambia qué produce, no cómo se decide:

- **La lista de señales con prioridad** (`lib/weeklyReflection.ts`) sigue
  sirviendo, pero para otra cosa: ya no elige *qué contarte de tu semana*, elige
  **cuándo hablar y en qué registro**. Que un bajón fuerte gane sobre todo y baje
  el tono vale igual —más todavía— para una presencia.
- **Nunca mezclar nivel con dirección** sigue en pie para cualquier frase que
  mencione la semana.
- **Los guardarraíles sobre lo que escribe el modelo** (`rejectCopy`) siguen, y
  necesitan reglas nuevas: nada de fingir sentir (§3.5), nada de pedir una
  reserva (§3.4).
- **La línea de la privacidad no se mueve: cero texto escrito por la persona.**
  Ni el diario, ni la gratitud, ni las notas. ⚠️ Lo que SÍ está en discusión es
  cuánta señal estructurada viaja — hoy son tres números y por eso suena
  genérica; ver §5 bis. Las dos cosas no se contradicen: se puede saber la forma
  de los días de alguien sin leer una sola palabra suya.
- **El piso sin red**: las reglas escriben al instante y la IA reescribe después.
  La tarjeta nunca queda vacía ni con un spinner.

## 5 bis. Por qué hoy suena básica (la causa raíz)

**No es el prompt ni el modelo.** Al modelo le llegan hoy tres cosas: el nombre
de la señal, el tono, y tres números (racha, sesiones, prácticas). Con eso no se
puede escribir nada que se sienta personal — cualquier modelo, por bueno que
sea, produce genéricos. La causa de "básica e inútil" es **el presupuesto de
datos**, no la redacción.

Y ahí hay una tensión que conviene decidir a propósito en vez de heredarla: la
postura de privacidad actual **produce genericidad**.

Pero no es todo o nada. El camino intermedio:

> Mandar **señales estructuradas más ricas**, sin una sola palabra escrita por la
> persona. Por ejemplo: *"hoy bajón, ayer bajón, anteayer bien; última sesión
> hace 5 días; próxima en 2; escribió 2 veces esta semana"*.

Con eso un amigo tiene muchísimo para decir, y el diario sigue sin salir del
teléfono. Es el único lugar donde "que no sea básica" y "que no lea lo tuyo"
pueden convivir.

📝 De paso resuelve a medias §3.1: la voz puede **recordar la forma de tus días
sin leer tus palabras**.

## 5 ter. El piso de seguridad

🔴 **Falta, y en esta app no es opcional.** Si alguien registra el fondo varios
días seguidos, una voz cálida no alcanza y no puede simular que sí. Tiene que
haber un punto donde **deja de hacer de amigo** y dice algo real sobre buscar
ayuda.

Hoy la señal de bajón fuerte baja el tono y se corre, que está bien para un mal
día — pero **no hay nada para el caso grave**. Eso hay que diseñarlo antes de
darle más voz, no después.

## 5 quater. Acompañar no es perseguir

"Constantemente" no significa notificaciones. Un amigo a distancia aparece cuando
pasa algo, pero **una IA que te escribe sola al teléfono es el camino más rápido
a lo invasivo**.

Criterio: que **reaccione a lo que la persona acaba de hacer dentro de la app**,
y que no la persiga afuera. Al menos hasta que la voz tenga crédito ganado.

## 6. Lo que queda abierto

- **El nombre.** "Sobre vos" anuncia un análisis. Si es una voz, se llama de otra
  manera — y probablemente lleve la marca de Sofía.
- **Qué pasa al tocarla.** Hoy abre el "momento" a pantalla completa. Si la
  tarjeta es Sofía, lo natural es que abra su panel. Son dos superficies que hoy
  se pisan.
- **Cuánto contexto se le manda al modelo** (§5 bis). Es la decisión que
  determina si esto se siente personal o genérico, y hoy está tomada por
  omisión.
- **Cuándo callarse** (3.3): hace falta una regla, no una ausencia por azar.

## 7. Por dónde empezaría

1. **Decidir el nombre y la identidad visual** — es barato y ordena todo lo demás.
2. **Subir el presupuesto de datos** (§5 bis) a señales estructuradas ricas, sin
   texto libre. Es lo que más mueve la aguja contra "básica e inútil".
3. **Cambiar el registro de las frases a presente**, con las reglas actuales
   eligiendo cuándo y en qué tono. Sin tocar la arquitectura.
4. **Diseñar el piso de seguridad** (§5 ter) antes de darle más voz.
5. **Agregar el silencio** (3.3) y los guardarraíles nuevos a `rejectCopy`.
6. **Recién después** unificar con Sofía, y solo si para entonces el panel no
   sigue prometiendo un chat que no existe.
