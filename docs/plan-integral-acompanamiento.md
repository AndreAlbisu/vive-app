# Plan integral — que Vita te conozca y te acompañe

> 2026-09-03. Escrito por Joaquín (con Claude Code). **Documento paraguas.** No
> reemplaza a los de detalle, los ata. Nada de esto está construido; espera el OK
> de Andre — es decisión de los dos.
>
> Detalle en: `recomendacion-recursos.md` · `card-sobre-vos.md` ·
> `la-voz-de-sofia.md` · `paquete-para-la-sesion.md`.
>
> 🔴 **Pedido para Andre:** revisá este plan y los dos docs de detalle con tu
> Claude Code en modo crítico. Buscá puntos débiles, casos borde, y agregá valor.

---

## 0. La tesis (una sola)

Todo esto sirve a **un** norte, el que ya está escrito en `la-voz-de-sofia.md`
§0: *"que la gente se sienta acompañada entre las sesiones."* Que la app te
conozca y te ayude — que te encuentre donde estás y te baje, en palabras y en un
recurso, cómo encarar lo que te pasa. Sin diagnosticar, sin vender, sin fingir.

## 0 bis. ✅ Reconciliado con la devolución de Andre (04/09) — MANDA sobre el resto

Andre hizo la revisión crítica (`docs/revision-propuestas.md`). El rumbo quedó
bien; cambian **el orden, el alcance y algunas decisiones**. Esto supersede el
roadmap del §4 y el orden del §8:

- 🔴 **El ranker con pesos → filtro por intención** hasta que el catálogo llegue
  a 25-30 recursos (hoy hay 11, uno por objetivo → los pesos no mueven nada).
- 🔴 **`user_consents` pasa de Fase 2 a PRERREQUISITO** (TJUE C-184/20: el
  comportamiento que deduce lo sensible ES sensible). Ya lo construyó Andre; el
  opt-in ahora cubre también "qué recursos usás".
- ✅ **Cerradas:** NO toda card lleva acción (día sin señal se calla) · el
  paquete va primero (dependencia de una vía) · el usuario nuevo no era decisión
  sino un bug ya arreglado (`early`, sesión 159) · el `why` es enum cerrado · el
  motor es puro/compartido y la card vive en Recursos, Inicio solo ofrece una
  línea.

**El orden acordado (reemplaza el §8):**
1. `user_consents` (hecho) · 2. **el paquete de la sesión** · 3. **capa 1 de la
card** (giro a presente en `weeklyReflection.ts`) · 4. **la conversación del
catálogo** (§7, lo que más mueve la aguja) · 5. **recién ahí el ranker/filtro**.

**Abiertas (de 10 quedan 6):** seco vs. para-qué suave · pesos del ranker
(después del catálogo) · formato de la card · check-in como acción principal ·
relación con Sofía · **cómo crece el catálogo** (la más importante).

Detalle por doc: `recomendacion-recursos.md §0` y `card-sobre-vos.md §0`.

---

## 1. Las dos mitades de la misma cosa

No son dos features sueltas: son la misma tesis en **dos superficies**.

| | La card "Sobre vos" (Home) | El apartado Recursos |
|---|---|---|
| Qué hace | Te **encuentra** y produce una **acción** hacia la sesión | Te **ofrece** lo que encaja y lo **baja en palabras** |
| Pieza clave | prompt + acción + destino | ranker + "momento" |
| Detalle en | `card-sobre-vos.md` | `recomendacion-recursos.md` |

**Se alimentan:** la card puede ofrecer un recurso ("¿un audio para eso?"), el
recurso registra qué probaste, y eso vuelve a la card como material para el
sábado. El loop se cierra en el **paquete para la sesión**
(`paquete-para-la-sesion.md`).

## 2. La columna vertebral compartida (vale para las dos)

- **Presencia, no interpretación · material, no conclusión.** La app acompaña y
  acerca; no diagnostica ni concluye. La asociación es el acto terapéutico y
  ocurre en sesión.
- **Guardrails de voz** (el `rejectCopy` de `weeklyReflection.ts`): nunca vende,
  nunca finge sentir, nunca prescribe. Se reusan en las dos.
- **Gate de consentimiento:** lo sensible (ánimo/emocional) solo con opt-in
  (`user_consents`, sesión 157 de Andre). Sin opt-in, degrada a no-sensible.
- **Ingeniería:** el corazón son **módulos puros y testeados** (estilo
  `lib/payout.ts`), determinista, explicable. Frontend-first, sin ML.
- **Cold-start es el DEFAULT** (ver auditoría §4bis de `recomendacion-recursos.md`):
  hoy hay 2-5 usuarios de test, así que lo declarado + lo estructural cargan el
  peso; el comportamiento y lo colaborativo crecen con la base.

## 3. Estado hoy

- ✅ **Auditoría de señales** (03/09) — sabemos qué datos hay de verdad.
- ✅ **Backfill `wellness_goal`** 8/8 publicados — desbloquea la intención.
- ✅ **Tarjeta "Pedile una reco" con borrador** — ya en prod (sesión 158).
- ⏸ **Los dos motores** (recomendador + card) — esperan el OK de Andre.
- ⏸ **`user_consents`** — diseñado por Andre, sin construir.

## 4. Roadmap unificado por fases

**Fase 0 — datos / prep**
- ✅ Backfill `wellness_goal` (hecho).
- ⏳ Hacer `wellness_goal` **obligatorio/prompteado en el alta** del coach
  (`coach-recurso-nuevo.tsx`) para que no vuelva a quedar null.
- ⏳ **Revisar la taxonomía de objetivos**: los 8 no cubren "relaciones", y
  `ganar_foco`/`alimentacion` quedaron sin recurso (ver §4bis).

**Fase 1 — sale sin bloqueo (comportamiento no-sensible + declarado)**
- `lib/resourceRanking.ts` (puro + tests) — qué ofrecer. Pesos reordenados:
  para `coach_resources` manda `topic_id`, no el eje (0/8 tagged).
- `lib/momentoRecurso.ts` (puro + tests) — cómo se dice, con los guardrails.
- Reescribir `weeklyReflection.ts` como **`{prompt, acción, destino}`** en
  presente (la card de Sobre vos deja de ser "devolución semanal").
- Card de momento en Recursos + card de Sobre vos en el Home enganchadas a
  destinos que **ya existen** (`mood_entries`, `sessionNotes`, la sala).

**Fase 2 — necesita `user_consents`**
- Filtro/rank por intención (`wellness_goal`, ya poblado).
- Presencia emocional (ánimo) gateada por opt-in.

**Fase 3 — necesita BASE de usuarios**
- Señal colaborativa agregada ("gente en un momento parecido…"), molde
  `coach_trending_stats`. Solo con opt-in.

**Transversal — el paquete para la sesión** (`paquete-para-la-sesion.md`): es el
**destino** al que apuntan las acciones de la card. Conviene definir su orden
respecto de la Fase 1 (¿el paquete primero, o la card como on-ramp?).

## 5. Dependencias y bloqueos

- 🔴 **OK de Andre** — para arrancar cualquiera de los dos motores.
- **`user_consents`** (Andre) — para todo lo sensible (Fase 2+).
- **Base de usuarios** — para lo colaborativo (Fase 3).
- **Catálogo** — ver §7, es el bloqueo silencioso.

## 6. Decisiones abiertas (consolidadas)

De Recursos (`recomendacion-recursos.md` §10) y de la card
(`card-sobre-vos.md`): tono seco vs. para-qué suave · pesos del ranker · formato
de la card · ánimo sin `user_consents` · dónde vive el momento · cuánta acción
por defecto · el check-in como acción principal · card de momento vs. card de
Sofía (una voz, no dos) · orden paquete vs. card · usuario nuevo sin datos · a
qué catálogo apunta primero el ranker (`resources` vs `coach_resources`).

## 7. 🔴 El bloqueo silencioso: el catálogo es chico

Un recomendador vale lo que vale lo que hay para recomendar. Hoy: **8
`coach_resources` publicados + 3 `resources` curados = 11 recursos.** Por más
fino que sea el motor, sobre 11 items el techo de valor es bajo, y la señal de
comportamiento se satura enseguida. **Antes o en paralelo a construir el motor,
hay que decidir cómo crece el catálogo** (más coaches subiendo, biblioteca
curada, etc.). No es tarea de código, es de contenido/estrategia — pero es la que
más mueve la aguja de todo el plan.

## 8. Orden sugerido de arranque (si Andre da OK)

1. Cerrar las decisiones abiertas (§6) entre los dos.
2. `resourceRanking.ts` + `momentoRecurso.ts` puros con tests — revisar en
   aislado las palabras y los pesos **antes** de tocar UI.
3. Reescribir `weeklyReflection` a `{prompt, acción, destino}` (presente).
4. Enganchar las cards a los destinos existentes.
5. Recién ahí, Fase 2 (con `user_consents`) y el resto.

Y en paralelo, la conversación de contenido (§7), que es la que destraba el valor
real.
