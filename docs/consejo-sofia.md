# Consejo sobre la voz de Sofía — 07/09/2026

> Cinco advisors independientes (Contrarian, First Principles, Expansionist,
> Outsider, Executor) respondieron por separado *"¿es correcta la dirección de
> Sofía?"*, y después tres revisores leyeron las cinco respuestas anonimizadas y
> se las criticaron entre sí. Esto es el resultado, **reorganizado para decidir**
> — no es la transcripción.
>
> Contexto que recibieron: `la-voz-de-sofia.md` entero (§2 bis incluido), el
> estado real del código, y que hay **cero usuarios reales**.
>
> 🔴 **Lo más importante que salió no estaba en ninguna de las cinco respuestas.**
> Los cinco puntos ciegos del §3 aparecieron recién cuando los advisors se
> leyeron entre ellos.

---

## 1. El veredicto, en una línea

**La dirección es correcta. El orden está invertido: se encendió la máquina de
apego y se dejó apagada la red.**

Ningún advisor atacó la idea de fondo —ni siquiera el Contrarian, que atacó la
ejecución— pero tres llegaron por caminos independientes al mismo lugar: el piso
de seguridad construido, testeado y **apagado** mientras la voz se vuelve más
cercana es el problema real, y no se arregla pensando más sobre el apego.

Frase textual del Contrarian, que es la que más duele porque es cierta:

> *"El piso de seguridad construido y apagado es la prueba: la salvaguarda más
> importante que tienen está desactivada. No es un detalle técnico, es la
> prioridad real hablando."*

---

## 2. Lo que el consejo NO discutió

Conviene decirlo porque cambia cómo leer el resto: **nadie propuso volver atrás.**
Nadie dijo que la tarjeta debería seguir llamándose "Sobre vos", que el modelo de
la hermana mayor esté mal, ni que la tesis (*"a veces eso es todo lo que la gente
necesita para seguir"*) sea falsa. El Expansionist además sostuvo, sin que nadie
lo refutara, que la **historia de origen real es un activo inimitable**: Headspace
tiene una voz corporativa; esto tiene una historia verdadera.

Lo que se discutió es **con qué frenos**.

---

## 3. 🔴 Los cinco puntos ciegos

Ninguno salió de los advisors. Todos aparecieron en la revisión cruzada. **Cuatro
de los cinco son sobre personas concretas.**

**PC-1 — Nadie representa a Sofía, la persona.** Su nombre está en un producto que
ella no controla y que puede evolucionar sin su consentimiento continuo. Y nadie
calculó el **costo reputacional para ella** si el producto falla en un caso de
crisis real.

**PC-2 — El piso de seguridad probablemente se puede desacoplar.** No hace falta la
revisión completa de una psicóloga para tener *algún* filtro mínimo. Hoy, con el
piso apagado y el chat del orbe deshabilitado, **no hay ninguna red activa**. Es
el hallazgo más accionable del consejo entero.

**PC-3 — Dejar el piso apagado es una decisión de producto con consecuencias, no
un ítem de backlog.** Textual de la revisión con lente ética: *"si el sistema ya
sabe detectar 5 lecturas consecutivas en el fondo y decide no actuar por un mail
no enviado, eso es negligencia potencial."*

**PC-4 — El consentimiento informado tiene que ser diseño de onboarding, no letra
chica.** La persona tiene derecho a saber que es un producto —y no alguien
mirándole el ánimo— **antes** de que se forme el apego.

**PC-5 — No hay gobernanza.** Nadie definió quién tiene **poder de veto** cuando
"más apego" compita con "más seguridad", ni con qué dato se resuelve. Sin métrica
de capacidad, *engagement* gana por default porque es lo único que sí se mide.

---

## 4. ACCIONES — no necesitan decisión, necesitan hacerse

| id | qué | costo | quién lo levantó |
|---|---|---|---|
| **A-1** | 🔴 Mandar el mail a Mónica | 10 min | Executor + Contrarian, convergentes |
| **A-2** | 🔴 Sacar el coach de $1 del catálogo de producción | 1 línea de SQL | Executor (*"antes del café"*) |
| **A-3** | Agendar la device review pendiente | — | Executor |
| **A-4** | Blanquear quién es Sofía en un "sobre nosotros" | una tarde | Outsider + revisión |
| **A-5** | Hablar con Sofía (la persona) y dejar algo escrito | una charla | PC-1 |

---

## 5. DECISIONES — necesitan una respuesta de Andre

**D-1 — El chat deshabilitado del orbe.** Hoy promete *"Muy pronto vas a poder
escribirme"* sin plan ni fecha. Consenso de tres advisors: **sacarlo del build o
ponerle fecha, no hay tercera opción.** ¿Cuál?

**D-2 — Los dos Sofía.** El Outsider fue el más duro acá y no es un detalle de
diseño: *"se siente como dos productos pegados con el mismo nombre, y eso me haría
dudar de la seriedad de la app."* Una habla con frases cerradas y firma; la otra
dice "soy Sofía" y no puede conversar. ⚠️ Choca de frente con la decisión de la
sesión 174 de **no** unificar todavía — que se tomó por un motivo bueno (§4: unificar
hace más visible el chat que falta). D-1 y D-2 se resuelven juntas o no se
resuelven.

**D-3 — ¿Se desacopla el piso de seguridad?** (PC-2) ¿Va un filtro mínimo mientras
el mail circula, o se espera la revisión completa? Espera A-1.

**D-4 — El apego: ¿meta o subproducto?** Es el único choque frontal del consejo. La
síntesis del chairman: la historia de origen sí es un activo y nadie lo refutó;
lo que no se sostiene es tratar el apego como algo a **maximizar**. Hay que
elegir cómo queda escrito en `la-voz-de-sofia.md` §2 bis.

**D-5 — El sensor que le falta al criterio.** "¿Más capaz o más dependiente?" no
restringe nada sin una métrica. ¿Qué se mide, y quién puede vetar un feature que
sube retención y falla el test? (PC-5)

**D-6 — Consentimiento informado en el onboarding.** (PC-4) ¿Dónde y cómo se
declara que es una IA, antes de que la voz se ponga cercana?

**D-7 — La memoria de largo plazo** (*"esto ya lo pasaste en julio"*). 🟡 Choque:
el Expansionist la ve como la próxima frontera; el Executor dice cero usuarios,
cero datos, **ni la toquen**. ⚠️ Y el Outsider agregó lo que ninguno vio: *"me da
paz e inquietud a la vez — si se siente vigilancia constante en vez de
acompañamiento, me asusta."*

**D-8 — El catálogo de recursos.** El Executor lo bajó de "decisión estratégica" a
**reunión de 30 minutos entre los hermanos**. Sigue abierta hace semanas.

**D-9 — Validación barata antes de seguir invirtiendo en la voz.** Propuesta del
Executor: mandarle el mensaje de Sofía a usuarios de prueba y programarles el
check-in tres días. *"Si no vuelven, el nombre no importó nunca."*

---

## 6. ABIERTOS — no son de ahora, pero quedan anotados

**X-1 — Modelo de negocio.** El Expansionist propuso TAM más allá de "gente que
puede pagar terapia", B2B2C y seguros corporativos. ⚠️ **Las dos revisiones de
fondo marcaron este bloque entero como el punto ciego más grande del consejo**,
por reencuadrar riesgos de seguridad como oportunidades de negocio sin mencionar
daño una sola vez. Una lo llamó *"la respuesta más peligrosa de las cinco si
alguien la toma como guía"*. Queda registrado con esa advertencia al lado.

**X-2 — La ventana de datos de 7+30 días** como límite de lo que la voz puede
decir. Depende de D-7.

**X-3 — La contradicción entre nombre propio y declaración de IA** (art. 50(1)).
El Contrarian: *"le están poniendo cara y biografía real a algo que legalmente
tiene que declararse IA"*. Se cruza con D-6.

**X-4 — Qué pasa con el nombre si Sofía (la persona) algún día no quiere.**
Encuadre del chairman, distinto al del Contrarian: **el riesgo no es que ella
desaparezca, es que hoy no tiene voz formal.** Se atiende con A-5, no sacando el
nombre.

---

## 7. 🔴 Lo que el consejo NO resolvió: la personalidad de Sofía

§2 bis definió **el vínculo** (una hermana mayor) y §3 define **las prohibiciones**
(no fingir sentir, no concluir, no vender, no animar en tono suave). Entre esas
dos cosas falta la del medio: **cómo ES ella.**

No es lo mismo una hermana mayor tierna que una irónica, una que te deja en paz
que una que insiste, una que se ríe con vos que una que solo escucha. Hoy las 32
frases tienen un tono coherente **por accidente** —las escribió una sola persona
en una tarde— y eso no escala: ni a más frases, ni a un modelo redactando, ni a
que Joaquín escriba una.

⚠️ **Y es lo que hace falta para que el mail a Mónica sea completo**: se le va a
pedir que evalúe una frase en el contexto de una voz que todavía no está descrita.

Queda pendiente y es la próxima pieza del doc de la voz.
