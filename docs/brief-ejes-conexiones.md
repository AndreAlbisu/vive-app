# Brief de diseño — Los ejes de bienestar (pantalla Conexiones)

> Documento para pasarle a un modelo de lenguaje que va a proponer bocetos.
> Está escrito para entenderse **solo**, sin acceso al código. Todo lo que dice
> sobre el producto y el sistema de diseño está tomado de la app real, no
> inventado para el brief.

---

## 1. Qué es Vita

Una app de bienestar que conecta personas con **profesionales** — coaches de
vida, de hábitos, nutricionistas, psicólogos. La persona busca a alguien, reserva
una sesión, paga por la app y trabaja con esa persona a lo largo del tiempo.

Del lado del profesional, Vita resuelve lo que un independiente no tiene: agenda,
sistema de reservas y, sobre todo, **gente nueva**.

Es una app de teléfono (iOS y Android), en español rioplatense, hecha en React
Native. Está en etapa pre-lanzamiento.

---

## 2. La marca

El principio que gobierna todas las decisiones de producto:

> **"Si abruma, sobra."** Menos, pero más intencional.

Vita **no** es una app de productividad. No hay rachas, no hay contadores que
presionen, no hay paredes de métricas. El tono es cálido, sereno y adulto — le
habla a alguien que la está pasando mal o que quiere cambiar algo, no a alguien
que quiere optimizarse.

Consecuencias visuales de eso:

- **Calidez sobre frialdad.** La paleta es crema, oliva y terracota. Nada de
  azules corporativos, nada de blanco clínico.
- **Aire sobre densidad.** Si una pantalla se siente llena, algo sobra.
- **Nada que grite.** Sin urgencia artificial, sin badges rojos innecesarios, sin
  animaciones que reclamen atención.
- **Naturaleza sin literalidad.** El mundo de la marca es orgánico, pero no hay
  ilustraciones de hojitas ni acuarelas.

El isotipo son **tres círculos que se cruzan** en trébol (solo contorno, sin
relleno). Es geométrico y simple. Todavía no está cerrado — hay un encargo a un
estudio de diseño — así que **no conviene que una propuesta dependa de su forma
exacta**.

---

## 3. Sistema de diseño (valores reales de la app)

### Color

| Rol | Hex | Uso |
|---|---|---|
| Fondo de app | `#F7EFE4` | Crema cálido. Es el fondo de todo. |
| Fondo de tarjeta | `#F7F2E7` | Crema un punto más claro que el fondo. |
| Verde principal | `#3F512F` | Textos fuertes, íconos, botones sólidos. |
| Verde suave | `#6B7A56` | Texto secundario, bajadas. |
| Tinta | `#2E3624` | Títulos dentro de tarjetas. |
| Terracota | `#C06B4A` | Acento. Llamados a la acción, destacados. |
| Terracota suave | `#EAD3C6` | Fondos de acento, bordes. |
| Línea | `rgba(63,81,47,0.14)` | Bordes de tarjeta, separadores. |

Los tres colores de marca, que son los que importan para este encargo:

- **Terracota `#C1694F`** — se usa hoy para el eje **espiritual**
- **Forest `#2D4A3E`** — se usa hoy para el eje **físico**
- **Oliva muted `#87835C`** — se usa hoy para el eje **emocional**

### Tipografía

- **Plus Jakarta Sans** para títulos: `700` (títulos de pantalla) y `600`
  (subtítulos, nombres).
- **Poppins** para todo el resto: `400` (cuerpo), `500` (etiquetas), `600`
  (énfasis), `700` (raro).

No hay serif en el proyecto. Se sacó una (Fraunces) y no volvió.

### Formas y profundidad

- Radios en uso: **20** (tarjetas), **22** (tarjeta destacada), **18** (chips),
  **12** (píldoras chicas). Círculos completos para avatares e íconos.
- Sombra: **cálida, no gris.** Sombras en capas con tinte terracota
  (`rgba(192,107,74,0.16)` para el halo) más una sombra de contacto oscura y
  sutil. Nunca una sombra negra dura.
- Bordes de 1px en `rgba(63,81,47,0.14)`, muy tenues.

### Íconos

**Feather Icons** (línea fina, sin relleno) en toda la app. Si una propuesta
necesita otra familia de íconos, hay que decirlo explícitamente.

---

## 4. Dónde vive esto: la pantalla "Conexiones"

Es la pantalla donde la persona **busca profesional**. Funciona en tres fases,
que son la misma pantalla cambiando de contenido (no son pantallas distintas):

1. **Fase 1 — Ejes.** Elegís un área de bienestar. **Esto es lo que hay que
   rediseñar.**
2. **Fase 2 — Puertas.** Dentro del eje elegido aparecen sus temas concretos
   ("Ansiedad y estrés", "Descanso y energía"…).
3. **Fase 3 — Deck.** Un carrusel de tarjetas de profesionales de ese tema, una
   por vez, con foto, nombre, especialidad y un motivo de por qué aparece.

### Qué hay en pantalla, de arriba a abajo, en la fase 1

1. Título grande **"Conexiones"** con dos íconos a la derecha (campana de avisos
   y estrella de favoritos).
2. Una línea de texto: *"Elegí un área de bienestar para empezar"*.
3. Una **barra de búsqueda** por nombre de profesional (lupa + campo + limpiar).
4. **Los tres ejes.** ← el objeto del rediseño
5. Una **tarjeta destacada** con degradado terracota: *"¿No sabés por dónde
   empezar? Respondé unas preguntas y te orientamos"*, que lleva a un quiz.
6. Barra de navegación inferior flotante (isla con 4 íconos).

Todo eso está dentro de una vista que scrollea. El ancho útil de la pantalla es
de unos **390 puntos**, con 20 de margen a cada lado.

---

## 5. Qué son los ejes, exactamente

Tres áreas de bienestar. Es la **primera decisión** que toma la persona, y su
función real es reducir 12 temas a 4 o 5 — que alguien que está mal no tenga que
mirar doce opciones de golpe.

| Eje | Bajada actual | Ícono actual | Color actual |
|---|---|---|---|
| **Bienestar físico** | Cuerpo, descanso y energía | `activity` | Forest `#2D4A3E` |
| **Bienestar emocional** | Emociones, vínculos y foco | `heart` | Oliva `#87835C` |
| **Bienestar espiritual** | Propósito, identidad y sentido | `sun` | Terracota `#C1694F` |

Qué hay detrás de cada uno (esto **no** se muestra en la fase 1, pero explica el
peso de cada eje):

- **Físico** → 3 temas: Descanso y energía · Nutrición y movimiento ·
  Sexualidad e intimidad
- **Emocional** → 6 temas: Ansiedad y estrés · Estado de ánimo · Autoestima y
  confianza · Relaciones · Comunicación · Foco, hábitos y trabajo
- **Espiritual** → 3 temas: Propósito y dirección · Identidad y motivación ·
  Espiritualidad y soledad

📝 Nótese que **no están equilibrados**: el emocional tiene el doble de temas que
los otros dos. Hoy los tres se ven exactamente iguales, lo cual es una decisión
por omisión, no una decisión tomada. Una propuesta puede reflejar ese desbalance
o puede ignorarlo a propósito, pero conviene que sepa que existe.

---

## 6. Cómo se ven hoy, y qué le falta

Tres tarjetas horizontales idénticas, apiladas con 10 puntos entre ellas. Cada
una:

```
┌──────────────────────────────────────────────┐
│  ⬤   Bienestar físico                     ›  │
│  ⌄   Cuerpo, descanso y energía              │
└──────────────────────────────────────────────┘
```

- Círculo de 48px a la izquierda, relleno con el color del eje al 16% de
  opacidad, y adentro el ícono de línea en el color pleno.
- Título en Poppins 600, 15.5px.
- Bajada en Poppins 400, 12.5px, en verde suave.
- Flecha `›` a la derecha.
- Fondo crema, borde de 1px, radio 20, sombra suave.

**El problema no es que esté mal hecho — es que no dice nada.** Es el patrón de
fila de lista que usa cualquier app para cualquier cosa: la misma tarjeta serviría
para "Configuración", "Ayuda" y "Términos". El color de cada eje aparece
solamente en un círculo de 48px, o sea que la diferencia entre las tres áreas de
bienestar se comunica con un 3% de la superficie.

Es también **la primera pantalla de decisión real** del producto y el primer
lugar donde alguien se hace una idea de qué es Vita. Merece tener carácter.

---

## 7. Restricciones técnicas (importantes)

Esto se implementa en **React Native**, que no es la web. Lo que se puede y lo que
no:

**Se puede:**
- Degradados **lineales** (hay librería instalada y ya se usa).
- **SVG** completo: formas, trazos, máscaras, `clipPath`, degradados dentro del
  SVG.
- Sombras, bordes, radios por esquina, opacidades, rotaciones, escalas.
- Animaciones de `transform` y `opacity` a 60fps sin costo.
- Recortar contenido con `overflow: hidden`.

**No se puede (o sale caro):**
- **Degradados radiales** nativos — hay que aproximarlos con un círculo
  semitransparente o hacerlos en SVG.
- Filtros CSS: `blur` de fondo es limitado, `backdrop-filter` no existe como en
  web.
- Modos de fusión (`mix-blend-mode`, `multiply`).
- Animar `width`, `height`, `borderRadius` o colores **fuera** del hilo nativo —
  se puede, pero corre en JavaScript y puede trabarse.
- Tipografía variable, `text-stroke`, sombras de texto complejas.

**Imágenes:** hoy la app **no usa fotos ni ilustraciones** en ninguna superficie
de navegación. Todo es color, forma, tipografía e íconos de línea. Una propuesta
puede romper eso, pero es un cambio de rumbo y conviene que lo diga.

---

## 8. Lo que no se puede cambiar

- **Son tres ejes**, con esos tres nombres. Ni dos ni cuatro.
- **Cada eje lleva a sus temas.** Sea cual sea la forma, tiene que ser tocable y
  tiene que quedar clarísimo que lleva a otro lado.
- **Tiene que convivir** con la barra de búsqueda arriba y con la tarjeta del
  quiz abajo, sin que las tres cosas compitan.
- **Accesible:** contraste suficiente sobre crema, área tocable de 44pt mínimo, y
  que funcione con "reducir movimiento" activado.
- ⚠️ **Detalle técnico sobre el color:** hoy el código agrupa los temas de cada
  eje **comparando su color**. O sea que el color no es decorativo, está
  cargando lógica. Si una propuesta cambia la paleta de los ejes, es
  perfectamente posible, pero hay que tocar código además del diseño. Vale la
  pena decirlo si se propone.

---

## 9. Qué se espera de las propuestas

Tres o cuatro direcciones **distintas entre sí** — no tres variaciones del mismo
rectángulo. Para cada una:

1. **Un nombre y una idea en una frase.** Qué la hace distinta.
2. **Un boceto** — ASCII, descripción precisa o SVG, lo que se pueda.
3. **Cómo se ve la jerarquía** entre los tres ejes: ¿son iguales? ¿el emocional
   pesa más porque tiene el doble de temas?
4. **Qué pasa al tocar.** Cómo se siente la transición hacia los temas.
5. **Qué la vuelve Vita y no otra app.** Si la propuesta serviría igual para una
   app de banco, no sirve.
6. **Costo real** en React Native, según las restricciones de arriba.

Direcciones que valen la pena explorar, sin que sea una lista cerrada: formas
orgánicas en vez de tarjetas rectangulares; que los tres ejes formen **una sola
composición** en lugar de tres objetos sueltos; que el color ocupe superficie de
verdad y no un círculo; jugar con la idea de tres cosas que se cruzan (que es
literalmente el isotipo); profundidad o capas en vez de una lista plana.

Lo que hay que evitar: cualquier cosa que se sienta como un panel de control,
como una app de fitness, o como una lista de configuración.
