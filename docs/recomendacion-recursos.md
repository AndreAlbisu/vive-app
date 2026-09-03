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
