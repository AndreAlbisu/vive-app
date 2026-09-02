# Qué es Vita frente a la ley — el encuadre de salud y la responsabilidad

> **01/09/2026.** Investigación para **A.4** y **A.7** de `paquete-abogado.md`.
> **No es asesoramiento legal.**
>
> Los anoté como dos preguntas. Investigándolos resultaron ser **el mismo
> problema visto desde dos lados**, así que van juntos. Y es el documento con
> peores noticias de los cuatro.
>
> Serie: [`transferencias-internacionales.md`](./transferencias-internacionales.md) (A.3) ·
> [`consentimiento-datos-sensibles.md`](./consentimiento-datos-sensibles.md) (A.2, B.3) ·
> [`consumo.md`](./consumo.md) (A.1, A.5, A.6, A.9).

---

## 1. 🔴 A.7 — Declararse intermediaria probablemente no alcance

**Ley 24.240, art. 40:** si el daño al consumidor resulta del vicio o riesgo de
la cosa **o de la prestación del servicio**, responden el productor, el
distribuidor, el proveedor, el vendedor y **quien haya puesto su marca** en la
cosa o servicio. **La responsabilidad es solidaria.**

No hay norma expresa sobre plataformas, pero sí criterio judicial. El caso de
referencia es **Mercado Libre**: el tribunal sostuvo que **no actuó como mero
intermediario neutral** sino que tuvo un **rol activo**, y por eso integró la
cadena de comercialización del art. 40. Los indicadores que pesaron:

| Lo que hacía Mercado Libre | Lo que hace Vita |
|---|---|
| Compra Protegida | **Garantía de primera sesión** (T&C §9.3) — funcionalmente lo mismo |
| Mercado Pago | Opera el cobro; y en PayPal y USDT **tiene los fondos** |
| Mercado Envíos | **Provee la sala de video**, que es donde el servicio se presta |
| Percibía comisión | Comisión del 20% / 15% |

**Vita marca en las cuatro.** Y suma dos que Mercado Libre no tenía:

- 🔴 **Cura y verifica a los prestadores.** Aprueba postulaciones, revisa
  credenciales, verifica matrículas. Eso es control de calidad sobre quién presta
  el servicio — lo contrario de un tablón de anuncios neutral.
- 🔴 **La cláusula anti-elusión (§10) impide que las partes se vayan de la
  plataforma.** Es buena estrategia de negocio y está bien defendida en
  `project_vive_anti_disintermediation`, pero **como prueba juega en contra**:
  quien controla que la relación no salga de su circuito difícilmente sea ajeno
  a esa relación.

**Conclusión honesta:** la declaración de intermediario de T&C §4 **no decide
nada por sí sola**. Un juez mira el rol real, y el rol real de Vita es más activo
que el de la plataforma que ya fue condenada. Escribir "soy intermediaria" en el
contrato es necesario pero no suficiente, y construir toda la postura de riesgo
sobre esa frase es apoyarse en algo que probablemente ceda.

⚠️ **Esto empeoró con los rieles en dólares.** Con solo Mercado Pago, Vita nunca
tocaba los fondos y eso era un argumento real. Con PayPal y USDT **cobra ella y
transfiere después**. La decisión fue correcta por lo fiscal —evita que cada
coach sea exportador de servicios— pero tiene este costo, y hasta ahora no
estaba anotado en ningún lado.

### Qué hacer, sabiendo eso

No es "arreglable" con redacción. Lo que se puede es bajar la exposición:

1. **Dejar de apoyarse solo en la declaración.** §4 se queda, pero el plan de
   riesgo no puede terminar ahí.
2. 🔴 **Seguro de responsabilidad civil.** Es la mitigación que de verdad
   corresponde a una responsabilidad solidaria por daños. Averiguar costo es
   gratis y es lo primero que haría.
3. **Exigirle al profesional su propio seguro de mala praxis**, o al menos
   declararlo. Hoy no se pide.
4. **Mantener y documentar la verificación de credenciales.** Es ambiguo: prueba
   rol activo, pero también prueba diligencia. Ante un daño, haber verificado la
   matrícula es lo que separa un accidente de una negligencia propia. **La
   diligencia gana.**
5. Revisar §18-§19 (limitación de responsabilidad) sabiendo que **frente a un
   consumidor gran parte de eso es letra muerta** — ver B.1.

## 2. A.4 — El riesgo no es la redacción del aviso, es la confusión de roles

Tu pregunta decía *"es el punto donde más me preocupa quedarme corto"*. La buena
noticia es que **el aviso está bien**. La mala es que el riesgo estaba en otro
lado.

### Lo que está bien y no hay que tocar

T&C §5 declara que Vita no presta servicios de salud, no diagnostica y no
reemplaza atención profesional, e incluye las líneas de crisis (911, 135,
0800-345-1435), con la vigencia verificada al escribirlas. Eso es correcto y
está por encima de lo que hace la mayoría.

### 🔴 El problema real: la ley reserva el acto, no el título

**Ley 23.277, ejercicio profesional de la psicología.** El ejercicio comprende
**el diagnóstico, el pronóstico y el tratamiento** de la personalidad, y la
recuperación, conservación y prevención de la salud mental. Eso está reservado a
quien tiene título habilitante y matrícula.

Un **coach no puede hacer nada de eso**. Y la ley mira **lo que se hace**, no
cómo se lo llama: rebautizar el tratamiento como "acompañamiento" no lo saca del
ámbito reservado si el acto es el mismo.

**Dónde queda expuesta Vita:** la plataforma tiene coaches **y** psicólogos/as
juntos, bajo el mismo rótulo de "profesional", en la misma grilla, con el mismo
flujo de reserva y el mismo tipo de perfil. Alguien que la está pasando mal
**puede no distinguir** si está reservando terapia o coaching. Si termina en un
coach creyendo que es tratamiento, el problema es de Vita: ella diseñó la
presentación que los volvió indistinguibles.

Y esto **se compone con la sección 1**: si Vita integra la cadena del art. 40, no
es espectadora de esa confusión.

### Lo que ya está construido a favor

Esto es genuinamente bueno y hay que decirlo:

- `coach_credentials` distingue `titulo` / `matricula` / `certificacion`, con
  `registration_number` para el número de matrícula.
- **El coach no puede auto-verificarse**: el `update` de `status` está revocado
  por columna, verificado contra la base.
- **Editar una credencial verificada la devuelve a `pendiente`** — el trigger
  existe justamente para bloquear el ataque de "hacerse verificar como coach de
  hábitos y después editarlo a Lic. en Psicología".
- El documento no se publica; se publica el dato con la marca de verificado.

Los cimientos están. **Lo que falta es que la distinción llegue a la pantalla.**

### Recomendaciones

1. 🔴 **Que se vea, antes de reservar, si la persona es psicólogo/a matriculado/a
   o coach.** No en la letra chica del perfil: en la tarjeta, en el buscador, en
   la pantalla de confirmación. Es la mitigación más barata y la que más baja el
   riesgo.
2. **Disciplina de lenguaje.** Un coach no puede describirse con verbos de
   tratamiento — "trabajamos tu ansiedad", "te ayudo a superar". Eso es
   moderación de perfiles, que ya está en la estrategia anti-fuga; acá hay una
   segunda razón, más seria.
3. **Que el aviso de §5 aparezca en el flujo de reserva**, no solo en los T&C que
   nadie abre.
4. **Revisar el copy de los 28 temas.** Si alguno se enuncia en términos
   clínicos, un coach que lo elige queda ofreciendo algo reservado.

## 3. Cómo se cruza esto con lo que ya estaba decidido

Tres cosas que este documento cambia de lugar:

- **El piso de seguridad de `la-voz-de-sofia.md` §5 ter deja de ser una cuestión
  de tono.** Si Vita integra la cadena y no distingue bien los roles, el
  mecanismo que reacciona ante alguien que registra el fondo varios días seguidos
  es parte de la diligencia, no un detalle de producto.
- **La detección de crisis determinística antes del modelo**, que ya estaba
  decidida como no negociable, queda ratificada por otra vía.
- **La estrategia anti-fuga tiene un costo que no estaba anotado.** No digo que
  haya que abandonarla: digo que §10 es prueba de rol activo y conviene saberlo
  al decidir cuánto se aprieta.

## 4. Qué preguntar si hay una sola consulta

En orden, y estas dos valen más que cualquiera de los otros documentos:

1. 🔴 **¿Vita integra la cadena de comercialización del art. 40?** Y si sí, qué
   mitigación real existe: seguro, exigencia de seguro al profesional, otra cosa.
2. 🔴 **¿Tener coaches sin matrícula junto a psicólogos/as matriculados/as, bajo
   la misma presentación, genera exposición propia** por facilitar el ejercicio
   de actos reservados? ¿Alcanza con distinguirlos visualmente?

---

## Fuentes

- [Ley 24.240](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion) — art. 40 (responsabilidad solidaria de la cadena), art. 37.
- [Ley 23.277 — Ejercicio profesional de la psicología](https://www.argentina.gob.ar/normativa/nacional/ley-23277-20059/actualizacion).
- [Ley 26.657 — Salud mental](https://www.argentina.gob.ar/normativa/nacional/ley-26657-175977/texto).
- [Pautas para dirimir la responsabilidad de las plataformas (UCA)](https://repositorio.uca.edu.ar/bitstream/123456789/18760/1/Pautas_dirimir_%20responsabilidad.pdf) — criterios jurisprudenciales, incluido el caso Mercado Libre.
