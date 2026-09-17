# Consejo de asesores — las herramientas prácticas de Vita

> 15/09/2026. Dos rondas. La primera partió de un contexto que yo armé mal (creía
> que las 10 herramientas estaban visibles); Andre corrigió —son 4— y la segunda
> ronda se corrió con el dato real. **Lo que vale es la ronda 2**; la 1 queda
> porque varias de sus conclusiones sobrevivieron intactas y porque la revisión
> cruzada de esa ronda produjo los mejores hallazgos del ejercicio.
>
> Cinco asesores independientes (Contrarian, First Principles, Expansionista,
> Outsider, Ejecutor) + una ronda de revisión cruzada anónima + síntesis.

---

## 0. El estado real, verificado en el código

- La grilla de Recursos muestra **4**: Diario, Gratitud, Sonidos ambientales, Respiración.
  Exactamente las 4 que `design/recursos-v2-definiciones.md` cerró el 13/07/2026.
- Las otras 6 (Sueño, Meditación, Escáner corporal, Relajación, Lecturas breves,
  Anclaje) están retiradas de la vista con el código intacto — como pedía el doc.
- **El recorte estaba hecho. Lo que faltaba era el flag**, y eso dejó tres fugas
  (picker de hábitos, motor de recomendación, rutas directas). Arregladas en la
  sesión 236; ver el CHANGELOG.

---

## 1. Ronda 2 — las tres preguntas

### Q1. ¿Son las 4 correctas?

**El consejo se parte al medio, y vale la pena ver por qué.**

| Asesor | Saca | Mete | Razón |
|---|---|---|---|
| Contrarian | Sonidos ambientales | "Para tu próxima sesión" | *"Respiración y Sonidos son commodities. Nadie va a instalar un marketplace de coaches por un loop de lluvia que YouTube da gratis y mejor."* |
| First Principles | Sonidos ambientales | La bitácora de sesión | *"Es el tile más usado que van a tener y el más inútil estratégicamente: retiene sin acercar a nadie a una reserva."* |
| Expansionista | Sonidos ambientales | Anclaje | *"No es un destino, es una capa: debería correr por debajo de las otras tres, no competir por atención con ellas."* |
| Outsider | **Gratitud** | Anclaje (5-4-3-2-1) | *"Sonidos ambientales, ahora que cada uno dice para qué sirve, pasó a ser el mejor de los cuatro. 'Para tapar el ruido' es la frase más honesta de la app: no me promete que me voy a transformar, me resuelve un problema."* |
| Ejecutor | Ninguna | Ninguna | *"Las 4 son las 4 que no son 'un timer con texto', y eso no es casualidad: son las 4 que no compiten con Headspace."* |

**Por qué discrepan, que es lo interesante:** los tres que sacan Sonidos lo juzgan
por si **genera estado que un coach pueda leer**. El Outsider lo juzga por si le
**sirve un martes a la noche**. Son dos criterios distintos, los dos legítimos, y
el producto necesita los dos.

Sobre cada una:

- **Diario** — unánime, se gana el lugar sin discusión. Es la única donde el
  usuario produce algo propio, acumulable y longitudinal. El Outsider: *"la
  pregunta disparadora según el ánimo es lo más lindo que me contaste de toda la app."*
- **Gratitud** — defendida por cuatro, cuestionada por el Outsider (*"es Diario con
  tres renglones"*). Dos asesores por separado marcan **la racha de días seguidos
  como contradicción del principio propio** de "racha suave, no agresiva":
  *"me va a hacer sentir un fracasado el día que la corte"*.
- **Respiración** — el First Principles la salva con una distinción útil: *"no
  produce nada, pero es la única primitiva de regulación aguda y es el piso de la
  rutina sembrada. Se lo gana como infraestructura, no como herramienta."*
- **Sonidos ambientales** — la discutida. Dato verificado que cambia el análisis:
  **`constants/moodResources.ts` no la sugiere nunca.** Está visible pero fuera
  del motor de ánimo. Parte de la crítica de "no aporta" puede ser consecuencia
  de eso, no causa.

**Anclaje de vuelta:** 2 a favor (Expansionista, Outsider), 2 en contra explícito
(Contrarian, First Principles: *"sigue siendo un callejón sin salida; el cuarto
tile no debería ser otra práctica de calma"*).

### Q2. ¿Está bien dejar las 6 donde están?

**Unánime: opción (b) — cerrar el acceso, conservar el código.** Es lo único
unánime de las dos rondas. Los argumentos se suman en vez de repetirse:

- **Contrarian:** *"hoy alguien puede ponerse Escáner corporal como hábito y recibir
  un push diario que lo manda a una pantalla fuera de la grilla, con diseño viejo,
  con un guion clínico sin revisar, que el equipo ya decidió no sostener. Eso es
  una promesa que nadie está manteniendo."* Y la corrección que evitó el próximo
  bug: *"el arreglo no es filtrar en progreso.tsx — es un flag en el catálogo. Si
  lo parchean en la pantalla, el próximo leak aparece en la siguiente pantalla que
  lea TOOLS."*
- **First Principles:** *"medio abierto es el peor estado posible: la app
  contradiciéndose sola frente al usuario."*
- **Outsider**, el ángulo que nadie más tuvo: *"si algún día las encuentro de
  casualidad, no voy a pensar 'qué bien, hay más'. Voy a pensar **¿qué más me
  están escondiendo?** y **¿esto está terminado?**"*. Más: *"el único lugar donde
  aparecen las diez es 'armá tu rutina' — o sea que para descubrir que existe la
  meditación tengo que primero comprometerme a meditar todos los días. Está al
  revés: me pedís el hábito antes de dejarme probar la cosa."*
- **Ejecutor:** 2-3 horas. Y sobre las filas huérfanas: *"son 0 usuarios, corré el
  DELETE, no escribas lógica de compatibilidad para datos que no existen."*
- **Expansionista**, que en la ronda 1 las quería vivas, converge en (b) pero con
  un reencuadre que es el mejor que produjo: **las 6 no son producto muerto, son
  un spec de formato.** *"El día que firma el coach número uno, Vita no le dice
  'grabá algo'. Le dice: acá está el guion de escáner corporal de 8 minutos, leelo
  con tu voz, la pantalla ya está construida, se publica mañana. Guion de Vita,
  grabación del coach: si se va, se lleva su audio y el slot queda."*

### Q3. ¿Qué herramienta falta?

| Asesor | Propuesta |
|---|---|
| Contrarian | **"Para tu próxima sesión"** — durante la semana anotás lo que querés llevar; el día de la sesión la app te lo entrega hecho lista, y con tu consentimiento se lo pasa al coach antes de empezar. Sin coach todavía: termina en *"esto conviene hablarlo con alguien"* → perfiles. |
| First Principles | **La bitácora de sesión** — antes: "qué llevo hoy", armado con tus últimos check-ins y entradas. Después: "qué me llevo" + la tarea del coach, que pasa a ser hábito tildado por uso real. *"Es lo único de esta lista que exige un coach del otro lado — o sea, lo único que es de Vita y no de cualquiera."* |
| Expansionista | **"Tu patrón"** — lectura semanal que cruza el historial de ánimo con las completions reales: *"las semanas que escribiste tres veces o más, tu ánimo promedio fue un punto más alto"*. Funciona el día 1 con cero coaches, mejora con cada uso, y es el mejor pase a un profesional que existe: *"mostrale esto a alguien"*. Los dos datasets ya existen; falta cruzarlos. |
| Outsider | **Algo para el minuto malo.** *"De las diez, ninguna dura un minuto. Todas asumen que tengo entre 3 y 30 minutos y un lugar tranquilo. No hay nada para el mensaje que acabo de leer, el colectivo, las tres de la mañana."* |
| Ejecutor | **La salida al coach al final de cada práctica** — *"¿Querés trabajar esto con alguien?"* → perfiles filtrados por el eje cuerpo/mente/alma que ya existe. 1 día. Antes de lanzar, porque es lo único que instrumenta `recurso → perfil → reserva`. |

Tres de cinco proponen **la misma pieza** con tres nombres: algo que produzca
**estado del usuario que el coach pueda leer**. La del Ejecutor es la versión
barata y previa de todas ellas.

---

## 2. Lo que sobrevivió de la ronda 1

Lo que la corrección no invalidó:

- **Ninguna de las herramientas lleva a un coach.** Vale igual con 4 que con 10.
  La métrica declarada como "la que valida todo" no está instrumentada.
- **La pieza faltante** (asignación / bitácora), que las dos rondas propusieron.
- **La racha de Gratitud** contra el principio de racha suave.
- **Instrumentar antes de lanzar**, o la discusión se repite sin datos en 3 meses.

Lo que se cayó con la corrección: "7 timers redundantes" (de las 4 visibles solo
Respiración es un timer), "4 formatos × N coaches" (esos slots no están en la app),
"apagá Lecturas y Sueño" (ya estaba hecho), y la acusación de que el equipo no
ejecuta sus decisiones — **sí las ejecuta**.

### Los hallazgos de la revisión cruzada de la ronda 1

Salieron solo cuando los asesores se leyeron entre ellos. Siguen abiertos:

1. **Riesgo clínico** (tres revisores). Escáner corporal, Relajación muscular
   progresiva y el 5-4-3-2-1 son protocolos clínicos. El 5-4-3-2-1 es intervención
   para crisis de pánico y disociación; el escáner corporal puede disparar
   reexperimentación en trauma. Los escribió el equipo, sin supervisión, en una app
   que aloja matriculados. **Mitigado en parte**: las tres están retiradas de la
   vista y ahora también del acceso. No resuelto: si alguna vuelve, vuelve el tema.
2. **Marco legal argentino.** Diario, check-ins y ánimo son datos sensibles de salud
   (Ley 25.326). Las tres propuestas de "compartir con tu coach" son cesión de datos
   de salud; el cifrado de mensajes es XOR, obfuscación, no E2E. Sumado: Ley 26.657,
   protocolo de derivación ante riesgo suicida, disclaimers de App Store para salud
   mental. **Esto bloquea cualquier versión de la bitácora compartida.**
3. **El usuario que no puede pagar.** Si toda herramienta termina en embudo a
   reserva, el gratuito deja de ser persona y pasa a ser lead — y la misión
   declarada es democratizar el acceso.
4. **Propiedad del contenido del coach.** Si se va con su audio, el catálogo es
   alquilado, no propio.
5. **El arranque en dos lados.** Todo lo que depende de coaches depende de una
   oferta que hoy es cero.

---

## 3. Veredicto

**No muevas los tiles.** Que tres asesores quieran sacar Sonidos ambientales y el
único que razona como usuario diga que es el mejor no es señal de que una esté mal
elegida: es señal de que las 4 son defendibles y de que la discusión de cuál sobra
es la menos productiva disponible. Además se decidiría a ciegas: 0 usuarios, 0 datos.

**Lo indefendible era el estado medio abierto de las 6.** Unánime, y ya está cerrado
(sesión 236).

**La herramienta que falta**, en orden de costo:
1. La salida al coach al final de cada práctica (1 día, instrumenta la métrica).
2. "Tu patrón" — cruce ánimo × completions. Funciona con 0 coaches.
3. La bitácora de sesión. Es la más valiosa y la que más depende de tener coaches
   reales **y de resolver el punto legal 2**.

**Pendientes chicos y baratos que salieron del ejercicio:**
- Meter Sonidos ambientales en `moodResources.ts` (20 min — hoy no se sugiere nunca).
- El `paraQue` de Diario, Gratitud y Respiración (Sonidos ya lo tiene).
- Revisar la racha de Gratitud contra el principio de "racha suave".

**Para el día que se defina un quinto tile:** el hueco real no es otra práctica de
10 minutos. Es el minuto malo — algo de menos de 60 segundos, sin auriculares, que
se pueda hacer en un colectivo o en un baño del trabajo. Anclaje casi lo llena, pero
dura 2-3 minutos y está retirado.
