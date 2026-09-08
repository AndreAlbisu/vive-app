# Problemas abiertos — registro con IDs estables

> **08/09/2026.** Consolida lo que salió de: los tres consejos asesores
> (`consejo-sofia.md` y los dos de esta sesión), la devolución de Mónica Grando,
> la primera prueba en dispositivo del piso de seguridad, y la auditoría de las
> 22 frases visibles.
>
> 🔴 **Los IDs son estables y sirven para hablar por número** (*"cerremos B2"*).
> Si algo se resuelve, se marca acá — no se borra.
>
> Marcado: ✅ **verificado contra el código o la base** · ⚠️ **hipótesis sin
> verificar** · 🔴 **sin solución conocida**.

---

## A. Exposición — no es producto, es riesgo vivo

**Nada de las secciones B–F vale más que esto.** La revisión de ejecutabilidad
lo dijo así: *"las cinco respuestas debaten calidad de frases mientras hay riesgo
de seguridad y plata real corriendo sin auditar"*. Un equipo grande paraleliza;
dos hermanos no.

| ID | Problema | Solución | Costo |
|---|---|---|---|
| **A1** | 🔴 **Dos de las tres ramas del piso de seguridad nunca se probaron.** Es la única feature que le habla a alguien en crisis. ✅ El 07/09 una hora de teléfono encontró un bug que **540 tests no vieron** (le prometía una sesión inexistente), porque el bug no estaba en una función sino en la relación entre dos partes de una pantalla. | Forzar los dos casos que faltan: sin ninguna sesión, y con una agendada. | 15 min |
| **A2** | 🔴 **Coach de prueba con `price_per_session = 1` vivo en el catálogo de producción.** ✅ Verificado: `e58d2ec3`, `verified` y `activo`, con MP conectado. `mp-create-payment` deriva el precio de esa columna, así que cobraría $1 real. | Un número, o `availability_status = 'en_pausa'`. | 1 línea |
| **A3** | **Nullability de `price_per_session` sin confirmar.** El guard que se agregó al buscador es necesario o decorativo, y no sabemos cuál. ⚠️ El endpoint OpenAPI de PostgREST exige `service_role`. | Una consulta con la service key. | 2 min |

---

## B. La arquitectura de la voz — el hallazgo de raíz

| ID | Problema | Solución propuesta |
|---|---|---|
| **B1** | 🔴 **La tarjeta es AUTORA: cada día tiene que inventar algo con casi ninguna entrada.** De ahí salen el horóscopo, la absolución sistemática y que el modelo copie los ejemplos del prompt. El outsider: *"a la segunda semana la esquivo con la vista, como los banners de «completá tu perfil»"*. | **Volverla MENSAJERA.** Hay cosas reales para entregar que no necesitan ni memoria ni texto libre. **Resuelve B2, B3 y B5 de una**, y da vuelta el techo del apego: si el vínculo se ata al paquete y a lo que manda el coach, **el apego empuja hacia el profesional en vez de competir con él.** |
| **B2** | 🔴 **Movimiento 5 (acercarte un recurso): 0 de 22 frases.** ✅ **VERIFICADO: `resource_recommendations` existe con 7 filas reales** — un profesional elige un recurso para una persona, con nota, y queda registrado si se abrió. Tiene pantalla propia (`app/mis-recomendaciones.tsx`). **La tarjeta no la mira nunca.** | Conectarla. **No es un límite de arquitectura: nadie unió dos partes que ya existen.** ⚠️ Depende en parte de E1. |
| **B3** | **El paquete para la sesión vive aislado.** Usa el mismo material crudo que la tarjeta (check-in, diario, gratitud) y nunca se tocan. Es **lo único que un usuario de prueba validó sin que se lo pidieran** (*"buenísimo, lo usaría"*). | Que la tarjeta lo empuje cuando hay sesión cerca. Le da un propósito verificable en vez de una frase linda que se ignora. |
| **B4** | 🔴 **Movimiento 1 (recordar) imposible: la tarjeta no sabe qué dijo ayer.** §3.1 lo pide desde el 28/08 y nada lo implementa. Sin él, los movimientos 2 a 5 no tienen de qué agarrarse. | ⚠️ **Cuidado con la solución fácil.** La adjudicación separó dos ejes que veníamos mezclando: **la falla es "cero memoria", no "cero texto"**. Pero **memoria de señales NO es gratis**: una trayectoria de meses de ánimo día a día es un perfil longitudinal y **singulariza igual que un diario**, aunque no haya una palabra escrita. Que viva solo en el teléfono cambia el análisis **legal**, no el ético. 📌 **La versión mínima segura: aflojar la VENTANA, no guardar historia** — mandar un agregado de 7 días (*"bajón sostenido"*) en vez de números sueltos de hoy. |
| **B5** | **El modelo escribe a ciegas.** Nunca ve la frase de las reglas; recibe `señal / tono / dos números` y escribe una alternativa que reemplaza entera o se descarta entera. ✅ Por eso, en tres corridas de ensayo, **copió los ejemplos del prompt textualmente**. | Con B1 el modelo pasa a **anunciar en vez de inventar**, que es lo que sí sabe hacer con poca entrada. |
| **B6** | ⚠️ **HIPÓTESIS SIN VERIFICAR, y si es cierta explica casi todo: los 14 guardarrales premian lo genérico por diseño.** Es más fácil que una frase vacía pase el filtro que una específica. Si es así, **el sistema no necesita más frases: necesita guardarrales que no castiguen la especificidad**, y reescribir el banco es inútil. | **La prueba de resta:** aplicar las doce prohibiciones y listar qué queda permitido decir. Si la lista es flaca, no faltan movimientos — **no hay lugar donde entren**. Es lectura, no construcción. 🔴 **Correr esto ANTES que C1 y C2.** |
| **B7** | 📌 **El error de raíz, dicho con precisión** (adjudicación de privacidad): *"calcaron el modelo de voz de alguien que **sí recuerda** sobre un sistema que decidió no hacerlo"*. | Existe una versión honesta que no pide saber más: **acompañamiento por presencia, no por historia** — reconocer el patrón de hoy sin comparar contra ayer. No finge una memoria que no tiene. |

---

## C. El contenido de las 35 frases

⚠️ **Todo este bloque espera a B6.** Si el filtro selecciona por absolución,
reescribir el banco no cambia nada.

| ID | Problema | Solución |
|---|---|---|
| **C1** | ✅ **10 de 22 frases "absuelven"** (*"no le debés nada a nadie"*, *"no todas tienen que rendir"*, *"está bien que algunas sean así"*). Es la categoría **más grande**, y no es ninguno de los cinco movimientos. **El sistema inventó un sexto movimiento que nadie pidió**, porque es el único ejecutable sin saber nada de la persona. | Rebalancear la distribución a mano. Después de B6. |
| **C2** | ✅ **Movimiento 4 (hacerte creer en vos): 1 de 22.** Es el movimiento central del modelo de voz y aparece en una sola frase, escrita el 07/09. | Idem. |
| **C3** | 🔴 **Hace preguntas y no hay dónde contestarlas.** 7 de 22 preguntan al vacío. El outsider: *"es como si alguien te pregunta algo en la calle y se va caminando. **Si no hay buzón, no preguntes.**"* | O hay buzón, o no se pregunta. Se cruza con E2 (el chat que no existe). |
| **C4** | **Repetición detectable en ~2 semanas**: 2-3 variantes por categoría y sin memoria puede repetir literal la misma frase. *"Ahí se cae la ilusión de que Sofía es algo. Ese es el momento exacto en que dejo de creer."* | Más variantes no alcanza si el problema es B1. |
| **C5** | **Cero humor.** §2 ter dice que era *"graciosa, cálida, amable para los problemas del resto"*. Ninguna de las 22 tiene liviandad. | §3.5 apuntaba contra *"me alegro por vos"* y **terminó barriendo también la calidez**. Separar las dos cosas. |
| **C6** | 📌 **Se pierde la negrita cuando gana la IA** (`withCopy` deja `bold` vacío): la tarjeta se ve distinta según qué camino ganó. | Inconsistencia visual que nadie decidió. |

---

## D. Abierto y sin solución conocida

| ID | Problema | Estado |
|---|---|---|
| **D1** | 🔴 **Inferencia causal.** *"No es que hayas dejado de intentar"* — niega una causa que nadie planteó y **al negarla la introduce**. Reproche de contrabando dentro de un consuelo, sin ninguna palabra prohibida. | Cuatro corridas de ensayo confirman que **no se arregla con el prompt**. `rejectCopy` mira vocabulario. |
| **D2** | 🔴 **A.11 — qué hace Vita frente al riesgo real.** No puede preguntar sin crear un deber que no puede sostener. | Veredicto del consejo: **no agregar la pregunta hasta que la respuesta valga algo.** *"Preguntar «¿querés dejar de vivir?» y contestar con una pantalla de teléfonos es funcionalmente idéntico a no preguntar — pero le costó a la persona decir que sí."* 📌 **Tercera vía propuesta:** no *"¿querés morir?"* sino **"¿querés que alguien te llame ahora?"** con la llamada en un tap. |
| **D3** | 🔴 **El umbral no distingue "mal tramo" de "riesgo"**, y no sabemos cómo hacerlo sin preguntar. Mónica: *"las sesiones pueden destapar ansiedades como parte del proceso de sanación"* — el detector puede dispararse sobre alguien cuyo tratamiento funciona. | Lo hecho: **dejar de afirmar la distinción que no podemos medir**. La pregunta de fondo sigue abierta y atada a D2. |
| **D4** | **El acceso a crisis depende del detector.** Deja afuera el caso que Mónica nombró: **violencia intrafamiliar**, que la escala de ánimo no ve nunca. | Sacarlo del control del algoritmo: permanente y a un tap, no contingente. Hoy está en el perfil, que es mejor que nada pero hay que ir a buscarlo. |
| **D5** | **Nadie externo firma nada.** Las dos revisiones llegaron solas: *"la salida obvia frente a «no podemos preguntar ni sostener un sí» es un socio externo — una línea de crisis con convenio, una ONG, un asesor clínico que co-diseñe el protocolo"*. Para dos personas es **la acción de más apalancamiento y de las más baratas**. | Nadie lo empezó. |
| **D6** | **¿Se enteran ustedes cuando el piso dispara?** Hoy no hay logging ni alerta propia. Sin eso no pueden aprender ni hacer seguimiento al día siguiente — *"la única forma de cuidado sostenible sin guardia 24/7"*. | Sin decidir. |

---

## E. Decisiones frenadas que bloquean otras cosas

| ID | Qué | Quién | Bloquea |
|---|---|---|---|
| **E1** | **Cómo crece el catálogo de recursos.** Marcada por ustedes como la más importante, frenada hace semanas. 📌 §2 bis le dio una pista fuerte: *"un recurso si lo tenía a mano"* — **nunca fabricado**. Y si el problema es peso y no escasez, **más recursos lo empeoran**. | 30 min con Joaquín | B2 |
| **E2** | **Los dos Sofía / el orbe** (D-1 y D-2 de `consejo-sofia.md`). ✅ Verificado que apagarlo no deja nada inaccesible. | Pausado con Joaquín | C3 |
| **E3** | **Consentimiento en el onboarding** (PC-4). La página `sobre-nosotros` existe, pero **hay que ir a buscarla** — que es la letra chica que PC-4 critica. | Andre | — |
| **E4** | **Hablar con Sofía (la persona) y dejar algo escrito.** Hoy **no tiene voz formal en un producto que lleva su nombre**, y nadie calculó el costo reputacional para ella si el producto falla en una crisis. | Andre | — |
| **E5** | **Visto bueno de voz** sobre la frase nueva de `sustained-low` y sobre *"estar ahí con vos"* (§1 la avala, §3.5 la roza). | Andre | — |

---

## F. El problema de método

🔴 **Cero usuarios reales. Nada de esto está validado.**

Tres consejos, 18 sesiones de trabajo de voz, ~540 tests — y la única persona que
simuló ser usuario dijo que a las dos semanas la ignoraría y que **no la
extrañaría si desapareciera**.

**La prueba más barata que salió, y contesta la pregunta de fondo mejor que
cualquier análisis:** mandar la tarjeta **en versión reglas-only, sin IA** a 5-10
personas reales durante dos semanas, sin avisarles que es un experimento, y
preguntarles el sábado antes de la sesión: **"¿leíste algo esta semana que te
sirvió?"**.

> *"Esa respuesta vale más que los 540 tests."*
