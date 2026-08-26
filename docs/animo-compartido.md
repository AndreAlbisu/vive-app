# Compartir el ánimo con el profesional — propuesta

> 26/08/2026. Escrito porque Andre pidió pensarlo al 100% antes de construir:
> "podría ser delicado". **Nada de esto está implementado como propuesta.** Lo
> que sí existe hoy está en la sección 8, y está **apagado**.

## 1. La idea, en una frase

La persona registra su ánimo todos los días. Si ella quiere, su profesional
puede ver **cómo viene** — para llegar mejor a la sesión y para saber si lo que
están haciendo está sirviendo.

## 2. El encuadre, que decide todo lo demás

Hay dos preguntas que este dato puede contestar, y **no son la misma función**:

| | pregunta | qué es |
|---|---|---|
| ❌ | ¿Cómo está mi paciente **ahora**? | monitoreo |
| ✅ | ¿Lo que estamos haciendo **está sirviendo**? | trabajo profesional |

La primera lleva a un panel que se mira todos los días. La segunda lleva a un
historial que se lee antes de una sesión. **Solo la segunda le sirve a la persona
compartir**: nadie comparte su ánimo para que lo vigilen; sí para que su
profesional sepa si el trabajo funciona.

🔴 **Y por eso el dato solo vale cruzado con las sesiones.** Un historial de
ánimo suelto es un gráfico. Un historial con las sesiones marcadas encima
contesta la pregunta de arriba de un vistazo. Sin ese cruce, es un dato bonito
que no justifica la intimidad que cuesta.

## 3. Los tres niveles, que NO son el mismo permiso

Esto es lo que más se subestima al diseñarlo:

1. **Tendencia agregada** — "viene con el ánimo bajo, y mejorando". Un resumen.
   Casi no revela nada puntual.
2. **Historial por semana** — una línea de las últimas N semanas. Revela
   períodos, no días.
3. **Entradas día por día** — revela el martes que estuvo mal.

**El salto de intimidad está entre 2 y 3, no entre 1 y 2.** Un gráfico diario
deja inferir episodios concretos que la persona quizás no quiso contar; solo
quiso decir "vengo mejor".

**Propuesta: compartir 1 y 2. Nunca 3.** Y si algún día se quisiera el 3, es un
permiso aparte, pedido aparte.

⚠️ **El diario y la gratitud no entran en ninguna versión de esto.** Son texto
libre donde la persona escribe lo que no le dice a nadie. El ánimo es una escala
de 1 a 5. La distinción es la que hace defendible todo lo demás.

## 4. Quién abre la puerta

🔴 **La persona, y solo la persona. El profesional no puede pedirlo.**

No es un detalle de flujo: entre un coach y su cliente hay un desnivel de
autoridad. Si el profesional puede mandar "¿me compartís tu ánimo?", eso no es
una pregunta, es una presión — y negarse tiene costo social justo con alguien a
quien le estás pagando para que te ayude. **Que la solicitud no exista es la
única forma de que el sí sea libre.**

De ahí se siguen:

- **Opt-in explícito**, apagado por default.
- **Por profesional**, no global. Se puede tener dos y querer compartirle a uno.
- **Revocable en cualquier momento**, desde el mismo lugar donde se activó.
- **Constancia de qué y cuándo se aceptó**, igual que con los T&C
  (`accepted_terms_at` / `accepted_terms_version`) — si el texto cambia, la
  aceptación vieja no cubre el texto nuevo.

## 5. Qué pasa al revocar (la parte incómoda)

Revocar tiene que **significar algo**, y hay dos decisiones que no son obvias:

**¿El profesional pierde también lo ya visto?** Sí. No se puede deshacer que lo
haya leído, pero que la app **siga mostrándolo** es una elección nuestra, y la
respuesta correcta es que deje de hacerlo. Si no, revocar es decorativo.

**¿Se le avisa al profesional?** 🔴 **No.** Un aviso de "Ana dejó de compartir su
ánimo" convierte una decisión privada en un mensaje, y deja a la persona
teniendo que explicarse en la próxima sesión. La vista simplemente deja de estar.
Es asimétrico a propósito: protege al lado más débil de la relación.

📝 Consecuencia asumida: el profesional puede quedar confundido. Se resuelve con
copy honesto de su lado ("esto se ve solo si la persona lo comparte"), no
avisando.

## 6. El caso malo, y por qué no puede haber alertas

¿Qué pasa si alguien viene cinco días seguidos en el nivel más bajo?

La tentación es avisarle al profesional. **Y ahí es donde esto se vuelve
peligroso**, por dos motivos:

1. **Una alerta implica una respuesta.** Si le mandamos una notificación al
   profesional diciendo que alguien está mal, creamos la expectativa de que haga
   algo. Vita no es un servicio de crisis y no puede sostener esa promesa.
2. **Los profesionales no son todos clínicos.** Hay coaches, guías,
   nutricionistas. Ponerle a un coach de hábitos una alerta de salud mental
   delante es pedirle algo para lo que no está — ni formado ni contratado.

**Propuesta:**

- Al **profesional**: el dato se ve **cuando entra**, como contexto de la
  persona. **Nunca una notificación push.** Contexto es contexto; una alerta es
  otra cosa.
- A la **persona**: si el propio producto detecta un período sostenido bajo, lo
  que corresponde es mostrarle **a ella** recursos y, si el abogado lo indica,
  las líneas de ayuda. Es sobre ella y ella ya consintió que la app le hable.

Esto es coherente con el principio del producto: **"Vita guía, no diagnostica"**.

## 7. La asimetría que hay que arreglar primero

Hoy la persona **no ve la lectura de su propio ánimo**. Ve sus check-ins en
Progreso: no hay promedio, ni tendencia, ni relación con sus sesiones.

🔴 **Construir la vista del profesional antes que la de la persona sería
exactamente al revés**, y además es peor producto: es mucho más fácil pedirle a
alguien que comparta algo que ya ve y entiende, que algo que solo existe del otro
lado y de lo que tiene que fiarse.

**Primero la lectura para la persona. Después el permiso. Después la vista del
profesional.**

## 8. Qué existe hoy, y en qué estado

- ✅ `mood_entries` — el check-in diario. Andando hace meses.
- ✅ `mood_trend_for_client(user_id, days)` — función `security definer` que
  devuelve **solo el agregado** (nivel 1), verificada de punta a punta el
  26/08/2026 (`scripts/add-mood-para-coach.sql`).
- ⏸️ **La vista del profesional está APAGADA** (`MOSTRAR_ANIMO_AL_COACH = false`
  en `CoachHomeScreen`).
- 🔴 **Por qué se apagó:** está construida con la puerta en el lado equivocado.
  La valida el **vínculo** —que exista una reserva entre los dos— y no la
  **persona**. O sea que mientras estuvo prendida, un profesional veía el ánimo
  de alguien que nunca aceptó compartirlo. Es reversible en una línea, pero no
  debería volver a prenderse hasta que exista el opt-in de la sección 4.
- ✅ Mandar un recurso y saber si lo abrió: ya existe (`SalaScreen` →
  `resource_recommendations`, con `opened_at`).

**O sea que de la idea completa, lo que falta es: la lectura para la persona, el
permiso, el historial cruzado con sesiones, y colgar todo eso de la persona en la
pestaña Personas — nunca de un panel.**

## 9. Para el abogado

**A.10** ya está en `paquete-abogado.md`. Con esta propuesta hay que ampliarla y
agregar dos preguntas nuevas:

- **A.10 (ampliada).** ¿Alcanza un opt-in in-app, por profesional y revocable?
  ¿Hay que registrar versión y fecha del texto aceptado, como con los T&C?
  ¿Cambia que se comparta el agregado y no las entradas?
- **A.11 — Deber de actuar.** Si le mostramos a un profesional que una persona
  viene sostenidamente mal, y no hace nada, ¿en qué posición queda él y en cuál
  Vita? ¿Cambia que no sea personal de salud? ¿Conviene que los T&C digan
  explícitamente qué se espera y qué no del profesional con este dato?
- **A.12 — Revocar.** ¿Es suficiente que se corte el acceso hacia adelante, o hay
  que hacer algo con lo que el profesional ya vio o anotó (`session_notes`)?

⚠️ **Nada de la sección 4 en adelante se construye antes de estas respuestas.** La
persona mayor de edad está garantizada (`age_confirmed`), así que al menos no hay
menores involucrados.

## 10. Lo que NO haría, resumido

- Un panel con todas las personas y su ánimo. Nunca.
- Notificaciones push al profesional por el ánimo de alguien.
- Que el profesional pueda **pedir** el permiso.
- Compartir el día por día.
- Compartir diario o gratitud, en ninguna forma.
