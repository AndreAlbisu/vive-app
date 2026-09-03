# Revisión crítica de las dos propuestas — para Joaquín

> 2026-09-03. Andre (con Claude Code), a pedido explícito de Joaquín en
> `recomendacion-recursos.md` §11 y `card-sobre-vos.md`: *"cuanto más lo rompan
> antes de construir, mejor"*. Así que va sin diplomacia.
>
> Respuesta a: `plan-integral-acompanamiento.md` · `recomendacion-recursos.md` ·
> `card-sobre-vos.md`.

---

## Lo primero: el rumbo está bien y la auditoría es lo mejor de los tres docs

Chequeaste los datos **antes** de escribir código y la auditoría te rompió medio
plan: `wellness_goal` en 0/8, el eje en 0/8, el comportamiento de tres cuentas de
test. La mayoría de las propuestas nunca se entera de que sus datos no existen.
Eso solo ya justificó la sesión.

Y hay una observación que no es obvia y es correcta: **el ranker y la voz son el
mismo proyecto.** El motivo por el que Sofía suena básica es que le llegan
señales pobres; enriquecer señales *es* el recomendador. Eso está bien visto y no
lo había pensado así.

Lo que discuto abajo es **el orden**, no la dirección.

## 1. 🔴 Encontraste lo que invalida tu Fase 1 y seguiste igual

Once recursos: 8 `coach_resources` + 3 `resources`. Lo archivaste como "el
bloqueo silencioso" en el §7 del paraguas y después el roadmap sigue como si no
existiera.

El punto no es "son pocos" en abstracto. Es que **el ranker no ordena una
biblioteca: elige dentro de un grupo.** Hay 8 objetivos y 8 recursos de coaches
— **uno por objetivo**. Cuando alguien busca "dormir mejor", el ranker no está
eligiendo el mejor de varios: devuelve el único que hay. Los ocho factores y sus
pesos no cambian el resultado porque no hay nada que reordenar.

Para que un peso mueva algo hacen falta **3 o 4 por objetivo**, o sea **25-30
recursos de coaches**. Hoy hay 8.

**Lo que sí vale hoy y es mucho más barato: un filtro por intención.** "Mostrame
lo de dormir" es útil con once recursos, y es un `where`, no un módulo con pesos
ajustables y tests.

## 2. 🔴 La Fase 1 no está destrabada legalmente

Tu §6 dice que sin opt-in la presencia usa "solo señales no sensibles" de
comportamiento, y que eso sale ya. **No se sostiene.**

- **TJUE, C-184/20** (01/08/2022): los datos que, *"mediante una operación
  intelectual de comparación o deducción"*, permiten revelar información
  sensible **son datos de categoría especial**. El caso era sobre orientación
  sexual deducida del nombre de una pareja — datos que en sí mismos no eran
  sensibles. *"Volviste a los audios de ansiedad"* es una deducción de un paso.
- **My Health My Data (Washington)** define *health care services* como
  "cualquier servicio para evaluar, medir, mejorar o aprender sobre la salud
  mental o física", y protege el dato de alguien **buscándolos**.
- En Argentina no hay fallo equivalente, pero el art. 2 dice "información
  **referente a** la salud", y no veo por qué la AAIP razonaría distinto.

**Consecuencia:** `user_consents` pasa de Fase 2 a **prerrequisito**. No es que
la Fase 1 se bloquee — es que nunca estuvo tan destrabada como decía el doc.

Ya actualicé `docs/consentimiento-datos-sensibles.md`: el opt-in que había
diseñado cubría ánimo/diario/gratitud y ahora cubre también qué recursos usás.
Misma pantalla, misma tabla, cambia el texto informado.

## 3. ✅ Decisión cerrada: NO toda card lleva acción

Tu capa 3 quiere una acción cada vez que la card habla. Eso choca de frente con
`sobreVosSilencio.ts`, que la hace **callarse** los días sin novedad — y que vos
mismo proponés reusar.

El problema no se arregla con tono. Si te pregunta algo todos los días, **la
falta de respuesta se acumula como algo pendiente** por más suave que sea el
copy. Palabras de Andre: *satura*.

**Resolución:** día con señal, habla y ofrece una acción. Día sin señal, se calla
y no pide nada. La decisión 1 de `card-sobre-vos.md` queda respondida por el
código que ya existe.

## 4. ✅ Decisión cerrada: el paquete va primero

La decisión 4 —"¿el paquete primero o la card como on-ramp?"— no es una decisión.
Es una dependencia de una sola vía:

- **El paquete no necesita a la card.** Tiene demanda comprobada (Mónica ya lo
  hace a mano), no depende del catálogo, y su valor es propio.
- **La card sí necesita al paquete.** Sin él, la capa 2 entera se queda sin
  destino y la mitad de las acciones de la capa 3 aterrizan en el aire — le
  prometen a la persona que algo se acumula hacia su sesión, y no se acumula en
  ningún lado.

## 5. El caso más común es el que ninguna de las dos propuestas diseña

Los dos docs nombran "usuario nuevo sin datos" como difícil y los dos lo dejan
como decisión abierta. Pero tu propia auditoría dice que **el cold-start es el
default**: con cinco usuarios, todos son el usuario nuevo. El caso que postergan
es el único que van a ver en producción los primeros meses.

**Y buscándolo apareció un bug que ya estaba en producción**, que arreglé en la
sesión 159: con **un solo check-in** la card decía *"Tu semana viene pareja"*.
`empty` solo cubría cero registros, las ramas que comparan exigen `MIN_SAMPLE`, y
uno o dos registros caían al fallback `level`, que afirma sobre **la semana** a
partir de **un día**. Hay una señal nueva `early` entre medio, con dos juegos de
variantes —gentle si el ánimo es bajo, neutral si no— porque la primera versión
del arreglo le daba una invitación neutra a alguien que había registrado un día
malo.

O sea: el usuario nuevo no era una decisión abierta, era un defecto. Ya está.

## 6. El `why` del ranker es una fuga hacia el modo analista

Querés que el ranker devuelva un `why` por ítem y que la voz lo use. Bien, pero:

- *"Porque escuchaste tres audios de foco"* → describe lo que hizo. Correcto.
- *"Porque venís con ansiedad"* → afirma sobre su estado. Es el modo analista que
  la propuesta rechaza.

Si el `why` es texto libre, es la puerta por la que vuelve la interpretación.
`rejectCopy` revisa vocabulario, no detecta "esto es una inferencia sobre la
persona".

**Que sea un enum cerrado** —`mismo_tema`, `mismo_coach`, `formato_preferido`,
`guardado_antes`— con la plantilla escrita de antemano. El ranker elige de una
lista, no redacta. Así no hay dónde colar una interpretación.

## 7. Aclaración: dónde vive el recomendador

Tu decisión 5 mezcla dos preguntas. **¿Dónde corre el motor?** y **¿dónde aparece
la card?** No son la misma.

Fijate que la capa 3 de la card incluye *"¿te viene bien un audio para eso?"* —
para ofrecer eso, Inicio necesita saber **cuál** audio, o sea que el ranker ya
está corriendo ahí.

- **El motor** (`resourceRanking.ts`) es puro y **compartido**. Corre donde se lo
  llame.
- **La card de momento** —presencia + ofrecimiento + hand-off— vive en
  **Recursos**.
- **Inicio no la repite.** Como mucho hace un ofrecimiento de una línea dentro de
  la card que ya existe, y manda para allá.

Con eso la decisión 5 se resuelve sin romper "una voz, no dos", y de paso baja la
tensión de la decisión 3 de la card.

## El orden que propongo

En vez de arrancar por los dos módulos puros:

1. **`user_consents`** — dejó de ser opcional para la Fase 1 (punto 2).
2. **El paquete de la sesión** — demanda comprobada, no depende del catálogo, y
   es el destino al que apunta todo lo demás (punto 4).
3. **La capa 1 de la card** — el giro a presente en `weeklyReflection.ts`.
   Barato, mejora el texto que la gente lee hoy, no depende de nada.
4. **La conversación del catálogo** — tu §7. Es la que más mueve la aguja y no es
   de código.
5. **Recién ahí el ranker**, cuando haya qué rankear.

Las dos propuestas están bien pensadas. Lo que discuto es que la auditoría que
hiciste apunta a un orden distinto del que proponés — y la escribiste vos.

## Lo que queda para cerrar entre los dos

De las diez decisiones abiertas, **quedan seis**: la 1 y la 4 de la card están
cerradas acá, la 5 del recomendador está resuelta en el punto 7, y la del
`why` no estaba numerada.

Las que siguen abiertas y necesitan a los dos: seco vs. para-qué suave · los
pesos del ranker (que conviene discutir **después** de que haya catálogo) ·
formato de la card · el check-in como acción principal · la relación con Sofía ·
y la que no está numerada en ningún lado y es la más importante, **cómo crece el
catálogo**.
