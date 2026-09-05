# Contexto para rediseñar el Diario — vita (VIVE)

Documento para pasarle a un modelo (ChatGPT) que va a hacer bocetos visuales de la
pantalla **Diario**. Todo lo que sigue está tomado del código real
(`app/diario.tsx`, `constants/theme.ts`, `theme/tokens.ts`, `SCHEMA.md`),
no de un mockup viejo.

---

## 1. Qué es la app y qué es el Diario

**vita** (marca escrita en minúscula) es una app argentina de bienestar emocional.
Dos mitades: **herramientas de autocuidado** (10 tools) y **conexión con
profesionales** (reserva de sesiones, chat, videollamada).

El **Diario** es una de las 2 "herramientas de registro diario" (la otra es
**Gratitud**); las otras 8 son "herramientas de sesión" (Respiración, Meditación,
Sonidos ambientales, etc., con duración y timer). Diario tiene duración **"Libre"**:
no hay timer, no hay progreso, la persona escribe y guarda.

- Ruta: `/diario`, pantalla **pusheada** (no es tab). Se entra desde el deck de
  Recursos, desde la card de sugerencia de Inicio, o desde el atajo del asistente
  ("estoy teniendo un mal día" → `/diario`).
- No tiene tab bar abajo (es pantalla pusheada, full height).
- **No es pinneable** al Inicio a propósito (las de registro diario quedan afuera).

**Lo que el Diario significa en el producto (importante para el tono del diseño):**
es lo más privado de la app. Regla de producto explícita: *la app nunca ofrece
el contenido del diario para compartir con el profesional* — está disponible si
la persona lo busca, pero nada lo empuja hacia afuera. El diario se escribe para
uno mismo. El diseño tiene que **sentirse como un cuaderno propio, no como un
formulario que alguien va a leer**.

Además es dato sensible (Ley 25.326 art. 7 argentina): antes de guardar por
primera vez aparece un **sheet de consentimiento** (componente existente, no hay
que rediseñarlo, pero el flujo lo interrumpe).

---

## 2. Design system (valores exactos, en uso hoy)

### Paleta — `constants/theme.ts` (`ViveColors`)
| Token | HEX | Uso |
|---|---|---|
| `primary` | `#C1694F` | Terracota. Acento, íconos, links, bordes activos |
| `primaryInk` | `#A25842` | Terracota oscurecida — **la única válida como fondo con texto encima** (4.59:1 con crema). `primary` con texto encima NO llega a AA |
| `onPrimaryInk` | `#F7EFE4` | Texto/íconos sobre `primaryInk` |
| `background` | `#F7EFE4` | Crema cálido. Fondo. **Nunca blanco puro** |
| `text` | `#565E32` | Oliva. Texto principal. **Nunca negro puro** |
| `accent` | `#2D4A3E` | Verde bosque. Botón primario, confirmaciones |
| `calm` | `#87835C` | Oliva apagado, texto secundario |

Fondo de la mayoría de las pantallas (`components/ui/AppBg.tsx`): gradiente
diagonal `#F7EFE4 → #F0E6D8 → #EDE0CF` (start 0.1,0 → end 0.9,1).
⚠️ **El Diario hoy NO usa ese gradiente**, usa `#F7EFE4` plano — es una de las
inconsistencias a resolver en el rediseño.

Superficies "glass" del sistema:
- card bg: `rgba(255,248,240,0.80)` (en Diario) / `rgba(255,248,240,0.55)` (token)
- borde glass: `rgba(255,255,255,0.65)`
- pill bg: `rgba(255,255,255,0.60)`
- tinte terracota: `rgba(193,105,79,0.14)` · tinte forest: `rgba(45,74,62,0.14)`

### Escala de ánimo — `ViveMoodColors` (5 niveles, no inventar otros)
1 Bajón `#C06B4A` · 2 Cansado `#DDAE93` · 3 Normal `#D9D0B8` ·
4 Bien `#BFCBA6` · 5 Brillando `#8FA07C`

### Tipografía — 2 familias, ya cargadas, no se pueden agregar otras
- **Poppins** (400/500/600/700) → cuerpo, labels, botones, casi todo.
- **Plus Jakarta Sans** (600/700/800) → títulos de pantalla (`title` 700),
  el wordmark "vita" (800), y **textos de devolución/reflexión generada** (600).
- Se sacó Fraunces (serif) del proyecto en agosto 2026. **No proponer serif**
  salvo que sea una decisión explícita de rediseño (implicaría sumar una fuente).
- Cuerpo mínimo 16px en mobile; en Diario el textarea hoy está en 15px/24.

### Formas y sombras — `theme/tokens.ts`
- radios: card 20 · recurso 18 · pill 20 · ícono 21. En Diario hoy: 18 (cards),
  16 (mood row, botón), 14 (entradas del historial), 12 (pills).
- Sombra actual del Diario: iOS `#565E32` a 8% opacity, offset y=2, radius 8;
  Android elevation 2. **Suave, casi plana.**
- Existe un sistema de sombra más rico (`SurfaceCard`, variantes `elevated` /
  `subtle`): 3 capas — halo terracota `#C06B4A` 22% y=26 r=23, media
  `#2E261A` 18% y=12 r=14, contacto `#2E261A` 6% y=1 r=1 — más **grano** (ruido
  SVG al 3-5%), borde con gradiente y línea de brillo superior. El Diario **no
  lo usa todavía**: candidato natural del rediseño.

### Principios de UI del proyecto
- Aire / espacio en blanco es feature, no desperdicio.
- **Una acción principal clara por pantalla** (acá: guardar).
- Íconos cálidos redondeados (`MaterialCommunityIcons` en Diario;
  `Ionicons` en otras partes).
- Toques mínimo 44px de alto.
- Animaciones suaves tipo Headspace (reducen ansiedad).
- **Light only.** No hay dark mode real en la app.

### Tono de voz (aplica a todo el copy del boceto)
Español argentino, de "vos". Amigo sabio, no coach gurú ni clínico.
- SÍ: "Empezá por donde quieras...", "No hay respuesta correcta", "Guardado".
- NO: lenguaje corporativo, jerga clínica, signos de exclamación de más,
  párrafos largos.

---

## 3. La pantalla hoy — estructura exacta

Orden vertical, sobre `SafeAreaView` crema, padding horizontal 20, padding top 24.

**1. Header** (`components/ui/ToolHeader.tsx`, compartido con las otras 3 tools
rediseñadas — si se cambia, se cambia en las 4):
`chevron-left` (26px, forest `#3A4F2A`) + título **"Diario"** (Poppins Bold 20,
letter-spacing -0.3) a la izquierda; a la derecha un **pill de fecha corta**
("4 sep", Poppins Medium 13, bg blanco 70%, borde oliva 14%, radio 12).
Debajo, una línea divisoria de 1px al 5% de oliva.

**2. Bloque de ánimo del día** (solo lectura — el Diario NO pregunta el mood,
lo lee del check-in de Inicio). ⚠️ **Esto cambia en el rediseño: ver 4.1** — el
ánimo pasa a elegirse acá, por entrada. Dos estados hoy:
- **Con check-in**: fila glass (radio 16, padding 14) = punto de color de 14px
  con el color del mood + `"Hoy registraste"` (11px, 50%) sobre
  `"Brillando"` (semibold 15) + link `"Cambiar"` en terracota a la derecha.
- **Sin check-in**: fila terracota tenue (bg `rgba(193,105,79,0.10)`, borde 20%)
  = ícono campana + `"Todavía no contaste cómo venís hoy."` + botón sólido
  terracota `"Registrar"`.

**3. Card del prompt del día** (glass, radio 18, padding 14): círculo de 30px
con tinte terracota 18% + ícono `creation` (chispa), después la **pregunta**
(Poppins Medium 16 / lh 24) y el hint `"No hay respuesta correcta. Escribí lo
que te salga."` (13px, 50%).
La pregunta **cambia según el ánimo de hoy** (5 variantes):
- 1 Bajón: *"Hoy venís con un bajón. ¿Qué es lo que más te está pesando? Soltalo acá, sin filtro."*
- 2 Cansado: *"Se nota que estás cansado. ¿Qué te está drenando la energía estos días?"*
- 3 Normal: *"Un día tranquilo. ¿Qué anduvo dando vueltas por tu cabeza hoy?"*
- 4 Bien: *"Venís bien hoy. ¿Qué fue lo que sumó para sentirte así?"*
- 5 Brillando: *"¡Hoy estás brillando! ¿Qué hizo especial este día? Dejalo guardado acá."*
- sin check-in: *"Este es tu espacio seguro. Escribí lo que necesites descargar, sin juzgarte."*

**4. Área de escritura** (card glass, radio 18, padding 16, **borde terracota
25%** que pasa a terracota sólida al enfocar): `TextInput` multiline,
`minHeight 180`, Poppins Regular 15 / lh 24, placeholder
`"Empezá por donde quieras..."`, **máx. 2000 caracteres**. Abajo a la derecha,
contador `"37 palabras"` (11px, 33%).

**5. Botón guardar**: full width, verde bosque `#2D4A3E`, radio 16, padding
vertical 16, texto crema semibold 15 `"Guardar entrada"`. Deshabilitado (texto
vacío): bg `#EAE2D0`, texto oliva 40%, sin sombra. Al guardar: micro-animación
de escala (0.95 → 1, spring) y el botón pasa a `check-circle-outline` +
`"Guardado"` durante 2,5s; el textarea se vacía.

**6. Historial "Entradas anteriores"**: título semibold 15, y una lista de
cards glass (radio 14, padding 14) = punto de color del mood (12px) + fecha
("4 de septiembre", capitalizada, 11px al 53%) + preview del texto **cortado a
64 caracteres + "..."** (13px / lh 19) + chevron derecho al 27%.
Debajo del todo, un link centrado `"Tus últimas entradas →"` en terracota que
**hace scroll** a esa misma sección (no hay pantalla de historial propia).

**7. Modal de entrada completa** (`pageSheet`, slide): header crema `#F7EFE4`
con `close` + punto de mood + fecha (semibold 16); cuerpo con padding 24: un
badge con tinte terracota 15% que muestra la **pregunta fija vieja**
(*"¿Qué fue lo más importante que sentiste hoy?"*) y abajo el texto de la
entrada en Poppins Regular 16 / lh 26.

**8. `ConsentSheet`** — bottom sheet de consentimiento, aparece la primera vez
que se toca Guardar. Existente, no hace falta rediseñarlo.

---

## 4. Decisiones ya tomadas (ronda 1, sobre el primer boceto)

Estas tres se discutieron sobre un boceto previo y **ya están resueltas**: el
boceto nuevo tiene que respetarlas, no volver a proponerlas.

### 4.1 El ánimo se elige en el Diario, pero es el ánimo DE LA ENTRADA

Motivo: el ánimo de una persona cambia durante el día. Alguien puede venir bien
a la mañana, que le pase algo a la tarde, y querer anotarlo. La versión actual
—solo lectura del check-in de la mañana— no deja registrar eso.

**Cómo se resuelve, y es importante porque son dos cosas distintas:**

| | `mood_entries` | `journal_entries.mood` |
|---|---|---|
| Pregunta | "¿Cómo venís **hoy**?" | "¿Cómo estás **ahora**?" |
| Cardinalidad | 1 por día (`UNIQUE user_id + entry_date`) | 1 **por entrada**, con timestamp |
| Quién escribe | el check-in de Inicio | el Diario |
| Quién lee | Inicio, recomendación de recursos, **la tendencia que ve el profesional** | solo el Diario |

El selector del Diario escribe **únicamente en `journal_entries.mood`**. Nunca
en `mood_entries`: eso pisaría el check-in del día (marcar "Bajón" a las 18
convertiría todo el día en Bajón) y movería la tendencia que ve el profesional
por un momento puntual, no por el día.

Consecuencias para el diseño:
- **Copy**: en el Diario la pregunta es **"¿Cómo estás ahora?"** (o similar).
  Nunca "¿cómo estás hoy?", que es la del check-in y suena a repetir.
- El selector **arranca pre-seleccionado** con el check-in del día, o en
  "Normal" si no hay. No se pide de cero.
- **Se cae la card de invitación** "Todavía no contaste cómo venís hoy /
  Registrar". Con ánimo por entrada, el Diario ya no necesita mandar a nadie a
  Inicio: una fricción menos antes de escribir.
- El **prompt puede reaccionar** al selector (cambiar de ánimo cambia la
  pregunta), pero **se congela apenas hay texto escrito** — una pregunta que se
  reescribe sola mientras escribís es insoportable.
- Se pueden escribir **varias entradas el mismo día** con ánimos distintos (la
  tabla ya lo permite, no tiene unique por día). Entonces el historial necesita
  **hora además de fecha**: "4 sept · 18:30", si no quedan dos filas idénticas.
- ⚠️ **La escala sigue siendo de 5 niveles de valencia** (Bajón, Cansado,
  Normal, Bien, Brillando). **No tiene eje de ansiedad**: "me puso ansioso" cae
  en Bajón o Cansado. No agregar un sexto nivel — la escala está compartida con
  `ViveMoodColors`, con la tendencia del profesional y con el mapeo de recursos.

### 4.2 Va una franja semanal, y no tiene que castigar

Se acepta a propósito, para empujar el hábito.
- Representa **días en que escribiste**, no el ánimo: **un solo color**
  (círculo lleno terracota / círculo vacío). Pintarla por ánimo la haría hablar
  del check-in en vez del diario, y se pisaría con el gráfico de ánimo que ya
  vive en Progreso.
- **Sin racha rota, sin rojo, sin números de castigo.**
- **No se muestra hasta que exista la primera entrada.** A alguien que abre el
  Diario por primera vez, 7 círculos vacíos le dicen "vas mal" antes de
  escribir una palabra — en la herramienta que se usa justo cuando uno está peor.
- El día de hoy se marca con **anillo**, no vacío.
- Dato: sale de `created_at` de los últimos 7 días. Query trivial, sin migración.

### 4.3 La píldora de fecha no lleva chevron

No hay navegación por día ni consulta de entradas por fecha. Un chevron promete
una pantalla que no existe. Es una etiqueta.

---

## 5. Restricciones duras (lo que el boceto NO puede romper)

**Técnicas (React Native / Expo SDK 54, iOS + Android, se testea en Expo Go):**
- No hay CSS: nada de `backdrop-filter` libre, `filter`, pseudo-elementos,
  `position: sticky`, grid CSS. Blur real solo vía `expo-blur` (`BlurView`);
  gradientes solo vía `expo-linear-gradient`; formas complejas vía
  `react-native-svg`.
- Sombras: iOS ≠ Android. Android solo tiene `elevation` (sin color, sin
  offset). Un efecto que dependa de sombras de colores hay que simularlo con
  Views extra.
- Tipografías: solo Poppins y Plus Jakarta Sans (pesos listados arriba).
- Íconos: sets `MaterialCommunityIcons` / `Ionicons`. **No hay ilustraciones
  custom ni sets de íconos propios en `assets/`.** Si el boceto los pide, es un
  costo nuevo (encargar arte). Sí existe el isotipo de la marca —tres círculos
  en trébol, `components/VitaMark.tsx`— pero ⚠️ **el logo no está cerrado**
  (hay un encargo abierto a un estudio), así que no conviene apoyar el diseño
  sobre él.
- No hay textura/imagen de grano en `assets/`: el grano actual es ruido SVG
  generado en código.
- Teclado: la pantalla es de escritura. Cuando el teclado sube (~⅓ de la
  pantalla), lo único que importa es el textarea + el botón guardar. Todo lo
  demás queda tapado. **Un diseño con mucha decoración arriba del textarea se
  pierde justo en el momento de uso.**

**De datos (`journal_entries`):** solo hay `id`, `user_id`, `content` (texto),
`mood` (1-5, ahora el ánimo **de esa entrada**, ver 4.1), `created_at`.
⚠️ **No existen**: título de la entrada, tags, adjuntos, fotos, audio,
favoritos, edición de entradas, borrado desde la UI, ni el prompt con el que se
escribió cada entrada vieja (por eso el modal muestra la pregunta genérica).
Cualquiera de esas cosas en un boceto = feature nueva + migración de base.

⚠️ **Las entradas no tienen título.** El preview del historial son los primeros
64 caracteres del texto, cortados a mitad de frase: *"Hoy me costó bastante
arrancar, me quedé pensando en lo que me dijo..."*. **No dibujar el historial
con títulos cortos y prolijos** — el ritmo visual real es otro.

**De producto:**
- Nada que empuje a compartir el contenido con un profesional.
- El ánimo por entrada **no sale del Diario**: la tendencia que ve el
  profesional lee `mood_entries`, no esta tabla.
- Los colores de ánimo son los 5 de `ViveMoodColors` y solo esos. Si un punto
  de color representa un ánimo, tiene que salir de ahí.

---

## 6. Qué está flojo en la pantalla actual

1. **Se siente formulario, no cuaderno.** Cuatro cards apiladas del mismo peso
   visual (mood, prompt, escritura, botón) — nada dice "acá se escribe".
2. **Jerarquía plana**: la card del prompt y la de escritura tienen el mismo
   tratamiento; el área de escritura, que es la pantalla entera, no domina.
3. **Fondo plano** mientras el resto de la app usa el gradiente cálido `AppBg`.
4. **Sombra pobre** (8%, radius 8) contra el sistema de superficie rico que ya
   existe (`SurfaceCard`, halo terracota + grano). Si el rediseño elige ir
   **plano y editorial** —defendible, es la pantalla íntima— que sea una
   decisión declarada, no un descuido: sería la única pantalla plana de la app.
5. **El historial es una lista genérica de filas**, sin sensación de archivo,
   de tiempo, ni de volumen de lo escrito.
6. **La escritura no tiene modo enfocado**: con el teclado abierto la pantalla
   sigue mostrando todo lo demás.
7. La tipografía del textarea es Poppins 15 — funcional, pero no invita a
   escribir largo.
8. **Contraste**: ya hubo una auditoría que encontró 25 superficies de terracota
   por debajo de AA. El texto secundario claro sobre crema (hints, contador de
   palabras, capitales espaciadas) hay que medirlo antes de darlo por bueno.

---

## 7. Prompt para la ronda 2

> Sos director de arte de producto. Te paso el contexto completo de una pantalla
> de app mobile (React Native, iOS/Android). Ya hubo una primera ronda de
> bocetos: acertó en sacar el prompt de adentro de una card y volverlo
> tipografía grande sobre el fondo, con el área de escritura como única
> superficie de la pantalla. **Esa dirección se mantiene.**
>
> Quiero la siguiente ronda, más resuelta, respetando la sección 4
> ("decisiones ya tomadas") al pie de la letra y sin proponer nada que la
> sección 5 declare imposible.
>
> Necesito **cuatro estados dibujados**, no uno:
> 1. **Reposo** — la pantalla al entrar, con el selector de ánimo
>    pre-seleccionado, el prompt, el área vacía, la franja semanal y el historial.
> 2. **Teclado abierto** — el estado de uso real, con ~⅓ inferior de la pantalla
>    ocupado. Es la decisión más importante: ¿el prompt de tres líneas se achica,
>    se colapsa a una, sube y desaparece? ¿Qué pasa con el botón guardar?
> 3. **Primera vez** — sin ninguna entrada todavía. Sin franja semanal (ver 4.2).
> 4. **Guardado** — el momento posterior a guardar (hoy el botón se convierte en
>    "Guardado" durante 2,5 s y el área se vacía). ¿Qué debería pasar en vez de eso?
>
> Y el historial dibujado con **previews reales**: texto cortado a mitad de frase
> a los 64 caracteres, dos líneas, con fecha **y hora**.
>
> Para cada estado: el boceto, y una línea sobre qué decisión estás tomando y
> por qué. El norte sigue siendo el mismo: que se sienta un cuaderno íntimo y no
> un formulario.
