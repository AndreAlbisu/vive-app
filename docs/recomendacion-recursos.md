# Recomendación de Recursos — propuesta para decidir entre los dos

> 2026-09-03. Escrito por Joaquín (con Claude Code). **Nada de esto está
> implementado todavía.** Es una propuesta para que Andre la lea, la piense, y
> demos el OK juntos. Es decisión de ambos.
>
> 🔴 **Pedido concreto para Andre:** leelo, y pasáselo a tu Claude Code para una
> **revisión crítica** — que busque los puntos débiles, lo que se nos escapa, y
> agregue cosas de valor. Cuanto más lo rompan antes de construir, mejor. Si
> después de eso te cierra, arrancamos por los dos módulos puros (ver el final).

---

## 0. ✅ Reconciliado con la devolución de Andre (04/09) — LEER PRIMERO

Andre hizo la revisión crítica (`docs/revision-propuestas.md`). El rumbo quedó
bien; lo que cambió es **el orden y el alcance**. Esto manda sobre lo que sigue
más abajo (que es la propuesta original, se deja como historia):

- 🔴 **El "ranker con pesos" es sobre-ingeniería HOY. Pasa a ser un filtro por
  intención (un `where`).** Con 8 objetivos y 8 recursos (uno por objetivo), el
  ranker no elige entre varios: devuelve el único que hay. Los pesos no mueven
  nada. El ranker con pesos vuelve a tener sentido con **25-30 recursos**
  (3-4 por objetivo). Hasta entonces: "mostrame lo de dormir" = filtro por
  `wellness_goal`. **Los pesos de §5.1 quedan congelados** hasta que haya catálogo.
- 🔴 **La Fase 1 NO estaba destrabada legalmente. `user_consents` es
  PRERREQUISITO, no Fase 2.** El §6 (que decía que el comportamiento no-sensible
  sale sin opt-in) **queda corregido**: TJUE C-184/20 — "volviste a los audios de
  ansiedad" es una deducción de un dato sensible, así que ES categoría especial.
  Andre ya amplió `consentimiento-datos-sensibles.md` para que el opt-in cubra
  también "qué recursos usás". Nada se recomienda sin ese consentimiento.
- ✅ **El `why` es un ENUM CERRADO, no texto libre** (§4bis lo confirma como
  fuga al modo analista): `mismo_tema`, `mismo_coach`, `formato_preferido`,
  `guardado_antes` — con la plantilla escrita de antemano. El ranker elige de una
  lista, no redacta. "Porque venís con ansiedad" no puede existir.
- ✅ **Dónde vive (decisión 5, resuelta):** el motor (`resourceRanking.ts`) es
  puro y compartido, corre donde se lo llame; la **card de momento vive en
  Recursos**; Inicio a lo sumo hace un ofrecimiento de una línea y manda para
  allá. No rompe "una voz, no dos".

**El orden acordado (de Andre, y sale de MI propia auditoría):**
1. `user_consents` (ya construido por Andre) · 2. el **paquete de la sesión**
(demanda comprobada, no depende del catálogo) · 3. la **capa 1 de la card** (giro
a presente en `weeklyReflection.ts`, barato, mejora hoy) · 4. la **conversación
del catálogo** (lo que más mueve la aguja, no es código) · 5. **recién ahí el
ranker/filtro**, cuando haya qué rankear.

**Decisiones que siguen abiertas entre los dos:** los pesos del ranker (después
de que haya catálogo) · a qué catálogo apunta primero · y **cómo crece el
catálogo** (la más importante).

---

## 1. Qué queremos lograr (en criollo)

Que la persona sienta que **la app lo conoce y lo ayuda**: que en el momento
justo le baje, en palabras y en un recurso concreto, cómo encarar lo que le está
pasando. Que Recursos deje de ser una biblioteca estática y pase a sentirse como
alguien que te presta atención y te acerca la cosa que te sirve hoy.

## 2. Por qué esto no es un invento nuevo

Es **el norte que ya está escrito** en `docs/la-voz-de-sofia.md` §0:

> *"Para que la gente se sienta acompañada ENTRE las sesiones."*

O sea: no estamos cambiando de rumbo, estamos poniéndole recursos y datos a la
misma idea que ya decidimos. La diferencia con "Sobre vos" es el ángulo: Sobre
vos es Sofía *estando*; esto es la app *acercándote algo concreto para el
momento*.

## 3. La decisión de dirección que ya tomó Joaquín (a validar con Andre)

Había tres formas de pararse. Joaquín eligió la del medio-conservador:

- **Guía activa (DESCARTADA).** La app interpreta tu estado y te baja pasos de
  qué hacer ("venís con ansiedad, hacé 1, 2, 3"). Es el *modo analista* que el
  doc rechaza (§2): *"la presencia se equivoca más barato que la
  interpretación"*. Afirma cosas sobre el estado emocional de alguien frágil,
  puede lastimar cuando erra, y pisa al profesional. **No va.**

- **✅ Presencia + puente (ELEGIDA).** La app te devuelve *lo que vos
  registraste* (no lo que dedujo), te ofrece un recurso concreto, y lo hondo lo
  manda al coach. No diagnostica, no prescribe.

- **Presencia + para-qué suave (en reserva).** Igual que la anterior pero
  además nombra livianamente para qué sirve el recurso ("este audio baja la
  activación antes de dormir"). Es un pasito más y se puede sumar después sin
  romper nada. ⚠️ **Punto a discutir con Andre:** ¿arrancamos seco (solo puente)
  o con el para-qué suave desde el día uno?

**Cómo se ve la card elegida (ejemplo):**

```
"Volviste a los audios de foco esta semana."      ← presencia (lo que registraste)
   → [ Enfocarte sin ruido · 6 min ]  de Coach Prueba   ← puente (el recurso)
"Y si te cuesta sostenerlo, buen tema para el sábado."   ← hand-off al coach
```

## 4. La idea clave que conecta todo

El doc de la voz ya explica **por qué hoy Sofía suena básica** (§5 bis): no es el
prompt ni el modelo, es que *le llegan señales pobres* (nombre de la señal, tono,
tres números). El camino que propone el propio doc es *"mandar señales
estructuradas más ricas"*.

👉 **Ese trabajo de señales ES el motor de recomendación.** No son dos proyectos:
los recursos (qué ofrecer) y la voz (cómo nombrarlo) son las dos mitades de lo
mismo. El ranker le da a la voz de qué hablar. Por eso conviene construirlos
juntos.

## 4 bis. 🔴 Auditoría de señales (03/09/2026) — LEER, cambia los pesos y el orden de fases

Antes de escribir una línea, Joaquín + Claude Code chequearon contra la base si
**realmente** tenemos con qué alimentar esto. Resultado: **la mitad de las
señales del plan original están vacías o apuntan al catálogo equivocado.** Los
números crudos (proyecto de test / pre-launch):

- **Hay DOS catálogos, no uno:**
  - `resources` (biblioteca **curada** de Vita): **3 items**, 100% con eje
    (`resource_axes`). `resource_axes` **FK apunta acá**, no a coach_resources.
  - `coach_resources` (lo que sube el coach, el deck de `formato.tsx`): **8
    publicados**, 100% con `topic_id`, **0% con `wellness_goal`, 0% con eje**.
- **`wellness_goal` = 0 de 8 publicados.** Se captura en el alta pero **ningún
  recurso publicado lo tiene**. → La **Fase 2 (descubrir por intención) no tiene
  con qué** hoy.
- **Eje en coach_resources = 0 de 8.** → El factor #1 del ranker que propuse
  (match de eje, +3) **está muerto para el deck de coaches**. El eje solo existe
  en el catálogo curado `resources` (3 items).
- **Comportamiento poblacional ≈ nulo:** `resource_events` = 91 view / 25 play /
  16 complete, pero de **solo 2-3 usuarios** (cuentas de test). `resource_saves`
  = 2, `pinned` = 4, `saved_resources` = 1.
- **Perfil declarado flaco:** `user_quiz_answers` = 3 filas, **1 con eje**.
  `mood_entries` = 42 filas / **5 usuarios** (decente por-usuario, ínfimo en
  población).

**Qué implica (concreto, esto SÍ cambia el plan):**

1. **El cold-start es el caso DEFAULT, no un borde.** Con 2-5 usuarios, casi
   todos son cold-start. La propuesta original framea el comportamiento como
   central; la realidad dice que **lo declarado (quiz) + lo estructural
   (`topic_id`) + orden editorial + novedad cargan el peso**, y el comportamiento
   es un bonus cuando existe. Hay que reordenar la prioridad del ranker (§5.1).
2. **Reordenar pesos:** para `coach_resources`, **`topic_id` (8/8) es el factor
   estructural principal, NO el eje (0/8)**. El eje +3 baja o se condiciona por
   catálogo. El eje solo aplica al catálogo curado `resources`.
3. ✅ **La Fase 2 ya tiene con qué — backfill HECHO (03/09).** Se pobló
   `wellness_goal` en los **8/8** publicados (0/8 → 8/8), cada uno mapeado por
   título/tema: `calmar_ansiedad`, `dormir_mejor`(×2), `construir_habitos`,
   `mover_el_cuerpo`, `mejorar_animo`, `entender_emociones`(×2). ✅ **Lo
   estructural YA estaba hecho** (verificado 04/09): el alta del coach
   (`coach-recurso-nuevo.tsx`, `validate()`) **ya exige `wellness_goal`** — bloquea
   el guardado con "Elegí para qué sirve el recurso" si falta. El 0/8 era solo la
   data de seed (creada por un script que saltea el form), ya backfilleada. Los
   uploads reales de coach nunca pudieron quedar en null.
   - 🔴 **Hallazgo de taxonomía para Andre:** los 8 objetivos **no cubren
     "relaciones"** — el recurso "El mapa de tus relaciones" (topic `relaciones`)
     tuvo que caer en `entender_emociones` como lo menos malo. Y `ganar_foco` /
     `alimentacion` quedaron sin ningún recurso. Vale revisar si la lista de 8
     objetivos es la correcta antes de construir el filtro por intención.
4. **La Fase 3 (colaborativo) no está gateada solo por consent — está gateada por
   tener BASE de usuarios.** Con 2-5 no hay co-ocurrencia posible. Es "cuando haya
   gente", no "más adelante".
5. **La buena noticia:** el comportamiento existe **por-usuario** (Joaquín tiene
   plays/completes), así que el loop personal *"porque escuchaste X"* **funciona
   para un individuo sin necesidad de multitud**. La Fase 1 **personal** (no
   colaborativa) es viable ya.
6. **Decisión de superficie nueva (§10):** ¿el ranker apunta primero a
   `coach_resources` (deck/momento, matchea por `topic_id`) o a `resources`
   (home curado, matchea por eje, pero son 3 items)? Son cosas distintas.

📝 Nada de esto invalida la propuesta — la **afina**. El mensaje de fondo: hoy el
motor tiene que ser bueno en **cold-start con señal declarada + estructural**, y
tratar el comportamiento/colaborativo como algo que **crece con la base**, no
como el punto de partida.

## 5. Cómo se construiría (dos módulos puros + una card)

Todo con **reglas/plantillas hoy** (la IA sigue apagada); cuando se prenda, es un
multiplicador, no un requisito. Todo **corre en el teléfono** con datos del
propio usuario, nada de perfilar en el server.

### 5.1 · `lib/resourceRanking.ts` (NUEVO, puro) — el "qué ofrecer"
Función pura y testeada (estilo `lib/payout.ts`). Entra la biblioteca + señales,
sale una lista puntuada con un `why` por ítem. Pesos como constantes nombradas y
ajustables. Arranque propuesto:

| Factor | Señal (tabla) | Peso | Sensible? |
|---|---|---|---|
| Match de eje | `interestAxes` (quiz) ∩ `resource_axes` | +3 | no |
| Afinidad de formato | `resource_events` por formato | +2 | no |
| Afinidad de coach | `resource_events`/saves de ese coach | +2 | no |
| Afinidad de tema | `resource_events` por `topic_id` | +1.5 | no |
| Guardado antes | `resource_saves` / `pinned_resources` | +1 | no |
| Ajuste por ánimo | `mood_entries` → `wellness_goal` | +2 | **SÍ (gateado)** |
| Ya hecho reciente | completados últimos 7 días | −4 | no |
| Diversidad | mismo coach repetido en la lista | −1 | no |

Sin ninguna señal → cae al orden actual (`created_at`), así que **nunca queda
peor que hoy**.

### 5.2 · `lib/momentoRecurso.ts` (NUEVO, puro) — el "cómo se dice"
Es el módulo que hace la *bajada en palabras* sin un LLM. Entra
`{señales, recurso elegido, tieneCoach, consentAnimo}`, sale
`{presencia?, ofrecimiento, handoff?}`. Determinista y testeado. **Reusa los
guardrails que Andre ya escribió para la voz** (el mismo criterio de
`rejectCopy`): nunca vende (§3.4), nunca finge sentir (§3.5), nunca prescribe. Y
la presencia *pregunta más de lo que afirma* (§3.2).

### 5.3 · La card de momento en `recursos.tsx`
Arriba de `FormatGrid`. Renderiza las tres partes según lo que haya. Cada parte
se cae sola sin romper el resto.

## 6. El punto que lo desbloquea legalmente: la presencia degrada por consentimiento

- **Sin opt-in (hoy, y default):** la presencia usa **solo señales
  no-sensibles** (comportamiento): *"Volviste a los audios de foco"*,
  *"Guardaste tres cosas sobre sueño"*. Ya se siente que la app te notó, **sin
  tocar dato sensible y sin bloqueo legal**. Esto sale ahora.
- **Con opt-in:** se habilita la presencia sobre lo emocional (*"Contaste que
  dormiste poco esta semana"*). Es enchufar un flag.

🔴 **Dependencia con lo tuyo, Andre:** la presencia emocional usa `mood_entries`,
que es dato sensible (art. 7), y depende de la tabla **`user_consents`** que
dejaste diseñada pero sin construir en la sesión 157. **No es bloqueante** — la
Fase 1 sale entera con comportamiento no-sensible. Pero cuando armes el opt-in,
esta card es un consumidor natural de ese consentimiento. Vale alinearlo.

## 7. El silencio (que no sea empapelado)

Reusar `lib/sobreVosSilencio.ts`: la card **puede callarse** algunos días (§3.3).
Un día sin señal fuerte, o con la misma señal de ayer, muestra la biblioteca
pelada y listo. Una presencia idéntica cada mañana se vuelve empapelado en una
semana.

## 8. Fases

- **F1 — ranker + card de momento con presencia de comportamiento.** Sin
  migración, sin consent, **sale ya**.
- **F2 — intención (`wellness_goal`, los 8 objetivos que hoy se capturan y no
  usa nadie) + presencia emocional** cuando exista `user_consents`.
- **F3 — señal colaborativa agregada** ("gente en un momento parecido también
  escuchó…") copiando el molde de privacidad de `coach_trending_stats` (vista con
  `security_invoker=false`, `GRANT` solo de la vista, nunca filas crudas). Solo
  con opt-in. Esta sí lleva migración (una VIEW).

## 9. Analítica
`momento_mostrado {señal, consent}`, `momento_recurso_abierto {motivo}`,
`momento_callado` — para medir si de verdad ayuda o es empapelado, y cortar si no
sirve.

## 10. Lo que falta decidir entre los dos

1. **Seco vs. para-qué suave** (ver §3): ¿la card solo ofrece, o además nombra
   livianamente para qué sirve el recurso?
2. **Los pesos del ranker** (§5.1): ¿te cierran, o priorizás distinto (ej. que el
   coach que ya seguís pese más que el eje)?
3. **Formato de la card:** ¿carrusel horizontal "Para vos", o un bloque
   destacado (1 principal + 3 chicos)?
4. **Ánimo sin `user_consents`:** ¿arrancamos con el flag en `false` (100%
   no-sensible hasta que exista la tabla) — que es lo que propone Joaquín — o
   querés otra cosa?
5. **Dónde vive:** ¿solo en Recursos, o el momento también asoma en Inicio? (ojo
   con pisarse con la card de Sofía; §4 del doc de la voz dice "una voz, no dos").

## 11. El pedido, de nuevo

Andre: **revisá esto con tu Claude Code en modo crítico.** Buscá:
- Dónde se rompe la idea (casos borde, señales pobres, usuario nuevo sin datos).
- Dónde roza la línea legal o la de "presencia vs. interpretación".
- Qué le falta para que no sea otra card vacía.
- Qué de esto choca con lo que vos ya tenés en la cabeza para la voz de Sofía.

Es decisión de los dos. Si después de esa revisión te cierra, **arrancamos por
los dos módulos puros** (`resourceRanking.ts` + `momentoRecurso.ts`) con sus
tests, sin tocar UI — así revisamos en aislado lo más delicado (qué se ofrece y,
sobre todo, qué palabras salen) antes de que aparezca en pantalla.
