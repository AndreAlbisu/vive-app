# La card "Sobre vos" del Home — giro a presente + acción real

> 2026-09-03. Escrito por Joaquín (con Claude Code), a partir de un planteo de
> Andre ("no me cierra hablarle en pasado, sino en presente"). **Nada de esto
> está implementado.** Es una propuesta para decidir entre los dos.
>
> 🔴 **Pedido para Andre:** leelo y pasáselo a **tu Claude Code para una revisión
> crítica** — que busque dónde el presente se vuelve hueco, qué señales no dan
> para preguntar sin afirmar, el caso del usuario nuevo sin datos, dónde roza la
> línea "presencia vs. interpretación", y que **agregue valor**. Es decisión de
> ambos. Si te cierra, seguimos.

Es la continuación natural de lo mismo que estábamos hablando para Recursos
(`recomendacion-recursos.md`): que la app se sienta como alguien que te presta
atención y te acerca algo útil, no como un adorno. Acá aplicado a la card del
Inicio.

---

## El problema, en una línea

El doc de la voz (`la-voz-de-sofia.md` §1) ya decidió el 28/08 que la card deje
de ser **"una devolución sobre tu semana"** (pasado) y pase a ser **"una
presencia que te habla hoy"** (presente). **Pero el código nunca se mudó.**
`lib/weeklyReflection.ts` sigue siendo el modelo viejo — el encabezado lo dice
solo: *"la **devolución** de la tarjeta 'Tu semana'… toma lo que la persona
**viene haciendo** y devuelve UNA frase"*. Eso es una reflexión semanal en
pasado = el modo *analista que te reporta*, justo lo que §2/§3.1 dice que hay que
abandonar. **Ese es el desajuste que Andre siente.**

La propuesta tiene **tres capas** que se apilan.

---

## Capa 1 — Giro pasado → presente

Andre tiene razón y el doc ya se lo da (§1, fila "tiempo verbal": *pasado
"venís mejor que la semana pasada"* → *presente "acá estoy, ¿cómo va hoy?"*).

**El matiz que evita implementarlo mal** (importante, porque "presente" a secas
es una trampa):

- **Presente sin ancla = la card vacía que Andre justo teme.** *"¿Cómo estás
  hoy?"* todos los días no tiene contenido (§2: la app no sabe nada que vos no
  sepas) y se vuelve empapelado en una semana (§3.3). Ese es el fracaso que él
  mismo nombró: *"una tarjeta vacía que terminás ignorando por lo básica"*.
- **El movimiento real (§3.1 + §3.2):** tomás **la misma señal** que antes
  reportabas y, en vez de reportarla, **la usás para preguntar por el ahora**.
  Misma data, gramática opuesta. Un amigo pregunta *"¿pudiste dormir mejor?"* —
  usa lo que sabe para preguntar, no para informarte.

| Señal | Antes (pasado / reporte) | Ahora (presente / ancla + pregunta) |
|---|---|---|
| Ánimo remontando | "Venís mejor que la semana pasada." | "Algo se está acomodando estos días. ¿Lo sentís?" |
| Bajón fuerte hoy | "Veniste más cansado — se nota." | "Hoy pesa. Acá estás, y con eso alcanza." |
| Constancia | "Llevás 5 días de práctica." | "Estás haciéndote un lugar casi todos los días." |
| Sesión cerca | "Tuviste una sesión hace 5 días." | "Falta poco para el sábado. ¿Cómo venís llegando?" |
| Usuario nuevo / sin datos | (genérico o nada) | "Acá estás. ¿Por dónde querés empezar hoy?" |

Dos cuidados:
- **No es prohibir todo verbo en pasado.** Podés *referir* algo que pasó para
  preguntar por hoy ("¿pudiste dormir mejor?"). La línea es **reportar vs.
  referir-para-preguntar**, no la conjugación.
- **El presente tiene su propio modo de fallar:** *"acá estoy para vos ❤️"* cada
  mañana es presente **y** falso (§3.5) **y** repetido (§3.3). Necesita las tres
  patas: **ancla + pregunta + poder callarse** (el silencio ya está resuelto en
  `sobreVosSilencio.ts`, eso sobrevive).

Los **guardrails** de `weeklyReflection.ts` son oro y **no se tocan** (no
generizar, no diagnosticar, no gurú, no vender, no felicitar cuando la persona
está mal). Quizás se suma uno nuevo: *"no afirmar en pasado sobre la semana"*,
para que un futuro modelo no recaiga.

---

## Capa 2 — La función real: puente al paquete de la sesión

El giro a presente mejora el adorno, pero un texto lindo **se lee y se sigue de
largo**. El valor de verdad —que cambia un resultado— ya está scopeado en
`paquete-para-la-sesion.md` (idea de Andre tras consultar a la psicóloga Mónica
Grando):

> La persona **arma un paquete** con lo que registró desde la última sesión
> (check-ins, una nota, entradas del diario que elige una por una), lo revisa, y
> **se lo manda al profesional por el chat.** Mónica ya lo pide a mano con sus
> pacientes → demanda comprobada, no hipótesis nuestra.

**El trabajo de la card entre sesiones (§3.4 de la voz):** *"sostener hasta la
próxima sesión y ayudar a que llegue lo que pasó."* O sea: la card es **el hilo
hasta la sesión**, no un mensaje diario suelto.

🔴 **Material, no conclusión** (paquete §3). La app **nunca** entrega la
interpretación ya hecha ("tu ánimo sube después de las sesiones" — eso *cierra*).
Da lo crudo, elegido por la persona, para mirarlo **con** el profesional. La
asociación es el acto terapéutico y **ocurre en sesión**. Es la misma línea que
nos salvó del "modo analista" en Recursos.

---

## Capa 3 — El modelo de acción: prompt + acción + destino

🔴 **Este es el pedido central de Joaquín, repetido varias veces: que la card
PRODUZCA UNA ACCIÓN EN RESPUESTA, que no sea un cartel que hablás.**

No choca con la presencia — de hecho la cumple: §3.2 dice *"pregunta más de lo
que afirma"*, y **una pregunta ES una invitación a hacer algo**. Lo que falta es
hacer explícito el **mecanismo de respuesta** y que esa respuesta **aterrice en
algún lado** en vez de evaporarse.

**Cada vez que la card habla, tres cosas:**
1. **Prompt** — presente, anclado (Capa 1).
2. **Una acción** — de bajo costo (un toque, una línea, una carita). Una sola.
3. **Un destino** — la respuesta **aterriza en algo que se acumula hacia la
   sesión** (Capa 2). Esto es lo que la vuelve no-adorno: no es acción por
   engagement, es acción que **construye el paquete**.

**El catálogo de acciones (finito, cada una cambia un resultado):**

| La card nota… | Ofrece (acción) | Aterriza en | Por qué no es adorno |
|---|---|---|---|
| Nada fuerte / arranca el día | "¿Cómo venís hoy?" → tocá una carita | `mood_entries` | el check-in alimenta todo lo demás |
| Un día que pesó | "¿Guardás una línea para el sábado?" | `session_notes` / paquete | llega material real a la sesión |
| Venís con un tema (sueño, laburo) | "¿Te viene bien un audio para eso?" | el "momento" de Recursos | alivio ahora + queda registrado qué probaste |
| Algo que marcaste antes | "¿Sigue dando vueltas?" → sigue / ya está | actualiza el hilo | continuidad real, no galletita diaria |
| Se acerca la sesión | "¿Armamos lo que querés llevar?" | chat con el coach | el payoff: la semana converge |

**Nunca:** *"reservá"* / vender (§3.4). Las acciones son **cuidado**, no
conversión.

**La línea que lo mantiene presencia y no una app de tareas:** ofrecimiento, NO
obligación. "No hacer nada" es siempre una respuesta válida (§3.3). La card
produce una **oportunidad** de actuar, nunca una tarea que le debés. Sin rachas
que castiguen, sin *"no anotaste hoy"*. **Una** acción, **opcional**, **de bajo
costo**, que **aterriza en algo que le sirve a la persona (su sesión)**, no a la
métrica de la app. Si cada día exige algo, se vuelve to-do y se ignora — que es
justo el fracaso que Andre nombró.

---

## Qué cambia en el código

- `lib/weeklyReflection.ts` deja de devolver *una frase* y pasa a devolver
  **`{prompt, acción, destino}`**. Hoy es `Reflection = { text }`; pasaría a
  `{ text, action: { label, kind, target } }`. Se mantiene la lista de señales
  con prioridad (dice una sola cosa) y el silencio.
- **Cambian las plantillas:** de afirmación en pasado → pregunta/presencia en
  presente + una acción. Los guardrails quedan igual (+ el nuevo de "no pasado").
- **No toca la IA** (sigue apagada); cambia qué producen las reglas, que son el
  piso. Cuando la IA se prenda, produce esta misma forma.
- **Cada destino ya existe:** `mood_entries`, `lib/sessionNotes.ts`, el momento
  de Recursos, la sala. No hay que inventar plumbing — hay que **conectar** la
  card a lo que ya está.
- Probablemente convenga **dejar de llamarlo "reflexión semanal"** (nombre del
  archivo/concepto) — es parte del cambio de para-qué.

---

## Lo que falta decidir entre los dos

1. **Cuánta acción por defecto:** ¿toda card trae una acción, o algunos días es
   solo presencia sin acción (más cerca del "a veces un amigo no dice nada")?
2. **El check-in como acción principal:** ¿la card del Home ES el punto de
   entrada al check-in de ánimo del día? (tendría sentido: alimenta todo).
3. **Relación con la card de Sofía:** §4 del doc de la voz dice "una voz, no
   dos". ¿Esta card ES la de Sofía, o conviven? Hay que evitar dos presencias
   pisándose en el Inicio.
4. **El paquete:** ¿construimos primero el paquete (`paquete-para-la-sesion.md`)
   y después la card como on-ramp, o al revés? El orden importa para no dejar
   acciones que aterrizan en un destino que todavía no existe.
5. **Usuario nuevo / sin señales:** el caso más difícil del presente (§2). ¿Qué
   dice y qué ofrece cuando no hay nada registrado todavía?

---

## El pedido, de nuevo

Andre: **revisá esto con tu Claude Code en modo crítico.** Buscá dónde el
presente se vuelve hueco, qué señales no dan para preguntar sin afirmar, el caso
del usuario nuevo, dónde una "acción por día" empieza a pesar como obligación, y
qué de esto choca con lo que ya tenés pensado para la voz. Es decisión de los
dos. Si te cierra, arrancamos — probablemente por reescribir `weeklyReflection`
como `{prompt, acción, destino}` con sus tests (puro, sin UI), que es donde vive
lo delicado: las palabras y qué acción ofrece cada señal.
