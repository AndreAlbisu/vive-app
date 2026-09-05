// weeklyReflection — la devolución de la tarjeta "Tu semana" en Inicio.
//
// Toma lo que la persona viene haciendo (ánimo, sesiones, prácticas, diario) y
// devuelve UNA frase. Es puro: sin red, sin estado, sin `Date.now()` adentro —
// todo entra por parámetro, así que se puede testear entero.
//
// ── Tres decisiones que explican la forma de este archivo ────────────────────
//
// 1. DICE UNA SOLA COSA. Un amigo no te recita un tablero: elige lo que más
//    llama la atención esta semana y comenta eso. Por eso hay una lista de
//    señales con prioridad y se devuelve la primera que aplica, en vez de
//    concatenar todo lo que se sabe.
//
// 2. NUNCA MEZCLA NIVEL CON DIRECCIÓN. Este es el bug que reemplaza. La versión
//    anterior armaba "Veniste más {etiqueta} que de costumbre" usando la
//    etiqueta del promedio ABSOLUTO, y la frase afirma una COMPARACIÓN. Los dos
//    se contradicen la mitad de las veces:
//      · promedio 4 (bien) contra un histórico de 4,6 → empeoraste, y decía
//        "Veniste más BIEN que de costumbre".
//      · promedio 2 (cansado) contra un histórico de 1,7 → mejoraste, saliste
//        de un pozo, y decía "Veniste más CANSADO que de costumbre — se nota".
//    El segundo es el peor: le dice a alguien que está remontando que está
//    peor, y encima se felicita. Acá una frase habla del nivel O de la
//    dirección, nunca de las dos con la gramática de la otra.
//
// 3. CEDE EL TONO. Cuando el ánimo cayó fuerte hoy, esta tarjeta no puede decir
//    algo liviano como si nada — la señal `sharpDrop` gana sobre todas y baja
//    el registro. (Hasta la sesión 97 coordinaba con `CoachSuggestionCard`,
//    una tarjeta aparte que sugería hablar con un coach justo arriba — se
//    sacó por sentirse demasiado orientada a vender un booking justo en el
//    peor momento para pedir algo. Esta señal quedó igual: sigue siendo la
//    única reacción a un bajón fuerte, y tiene más razón todavía para ser
//    gentil, no menos.)
//
// ── Sobre la IA ──────────────────────────────────────────────────────────────
// La idea es que en algún momento esto lo escriba un modelo con tono Vita. El
// enganche es `Reflection.source`: la IA produciría exactamente esta misma
// forma, y estas reglas quedan como piso para cuando no hay red, el modelo
// falla, o la persona es nueva y no hay nada que contar. Por eso las reglas se
// escriben para ser buenas, no para ser un placeholder.

export type ReflectionTone = 'gentle' | 'neutral' | 'warm';

// ─────────────────────────────────────────────────────────────────────────────
// Guardarraíl para el texto que escribe un modelo
// ─────────────────────────────────────────────────────────────────────────────
//
// Las reglas de abajo garantizan su propia salida con tests. Un modelo no: hay
// que revisar lo que devuelve ANTES de mostrarlo. Esto es lo mismo que los
// tests verifican sobre las reglas, pero corriendo en producción sobre cada
// frase generada — y lo que decide caer al texto determinístico.
//
// El criterio para agregar una regla acá es que su violación sea un daño, no
// un matiz de estilo. Una frase apenas rara se muestra; una que le asigna
// género a quien lee, o que anima a alguien que hoy cayó fuerte, no.

// ⚠️ `\b` de JavaScript NO sirve para cerrar una palabra en español. Se define
// sobre `\w` = [A-Za-z0-9_], así que una vocal acentuada ya cuenta como
// "no-palabra": en "reservá" no hay borde después de la `á` —los dos lados son
// no-word— y por eso `/\breservá\b/` **nunca matchea**. Un guardarraíl escrito
// así deja pasar justo lo que tiene que frenar, y en silencio.
//
// El arranque con `\b` sí es correcto (todos estos patrones empiezan con letra
// ASCII); lo que hay que reemplazar es el cierre, con un lookahead que
// contemple acentos y ñ. Se evita `lookbehind` a propósito: no está garantizado
// en todos los motores de JS de React Native.
const FIN = '(?![a-záéíóúüñ])';
const re = (body: string) => new RegExp(body.replace(/#/g, FIN), 'i');

/** Adjetivo que generiza a la persona: "venís cansada", "venís sostenido". */
const GENDERED = /\bven[íi]s\s+(?!a |m[áa]s |un |bien|mejor|peor|para |atravesando|levantando)\w+(ada|ado|osa|oso|ida|ido)\b/i;

/** El mismo error con un rodeo en el medio: *"venís **de estar** más cansado"*.
 *
 *  🔴 Salió de una frase real que el modelo escribió el 04/09 y que **pasó los
 *  once controles**. `GENDERED` busca el adjetivo pegado al verbo; con "de
 *  estar" en el medio no lo ve. */
const GENDERED_PERIFRASIS = re('\\b(ven[íi]s|est[áa]s|and[áa]s|segu[íi]s) de (estar|andar|sentirte|venir) [^.]{0,24}?[a-záéíóúñ]+(ad[oa]|id[oa]|os[oa])#');

/** Las etiquetas de nivel en MASCULINO.
 *
 *  `LEVEL_LABEL` las define en femenino a propósito, para concordar con
 *  "semana" — ver la nota de la rama de nivel. Así que un `cansado` o un
 *  `parejo` solo pueden estar describiendo a **la persona**, que es justo lo que
 *  no se puede hacer sin saber su género.
 *
 *  🔴 También salió de una frase real: *"llevás una semana **parejo**"*. Un
 *  regex genérico de adjetivos no la agarraba sin rechazar de paso "el mes
 *  **pasado**", así que la regla se hizo angosta: solo estas palabras, que no
 *  tienen otro uso legítimo acá. */
const NIVEL_MASCULINO = re('\\b(cansado|parejo|plano)#');

/** Vocabulario clínico o de diagnóstico. La app acompaña, no diagnostica. */
const CLINICAL = /\b(depresi[óo]n|depresiv|ansiedad generalizada|trastorno|s[íi]ntoma|diagn[óo]stic|patol[óo]g|terapia cognitiv|episodio)/i;

/** Promesas y tono de gurú, prohibidos por el brief de marca. */
const GURU = re('\\b(transformar[áa]#|vas a lograr#|te lo mereces#|el universo#|energ[íi]a positiva#|todo pasa por algo#|s[óo]lo depende de vos#|solo depende de vos#)');

/** Con tono `gentle` no se anima ni se pide nada: alguien la está pasando mal
 *  y una devolución liviana sería lo contrario de acompañar. */
const CHEER = re('\\b(felicit[a-záéíóúñ]*#|buen[íi]simo#|excelente#|genial#|orgullo[a-záéíóúñ]*#|segu[íi] as[íi]#|no bajes los brazos#)');
const ASKS  = re('\\b(prob[áa]#|anot[áa]te#|escrib[íi]le#|clicke[áa]#|toc[áa] (ac[áa]|aqu[íi])#)');

/** 🔴 Pedir una reserva. Corre en TODOS los tonos, no solo en `gentle`.
 *
 *  Hasta la sesión 153 `reservá` vivía adentro de `ASKS`, que solo se evalúa
 *  con tono suave — o sea que en `warm` la tarjeta podía pedir un booking sin
 *  que nada lo frenara. `docs/la-voz-de-sofia.md` §3.4 es explícito: el día que
 *  la voz cálida sugiere reservar deja de ser un amigo y es un vendedor, y eso
 *  no depende del ánimo del día. Ya se aprendió una vez acá — `CoachSuggestionCard`
 *  se sacó en la sesión 97 por lo mismo.
 *
 *  ⚠️ Nombrar al profesional NO es vender (corrección del 28/08: *"eso decíselo
 *  el sábado"* hace lo contrario de un vendedor, reconoce su límite). Por eso
 *  los patrones apuntan al **pedido**, no a la palabra: `decíselo`, `hablalo`,
 *  `tu sesión del sábado` pasan.
 *
 *  ⚠️ Compensación deliberada: `reserv[áa]#` también matchea el sustantivo
 *  ("una reserva el sábado"), así que rechaza alguna frase legítima. Se deja
 *  ancho a propósito — el costo de rechazar de más es caer al texto de las
 *  reglas, que es bueno; el de dejar pasar es publicar un pedido de venta en el
 *  peor momento posible. */
const VENDE = re('\\b(reserv[áa]#|reserv[áa]te#|reservar una sesi[óo]n#|agend[áa]#|agendar una sesi[óo]n#|sac[áa] un turno#|ped[íi] (un )?turno#|contrat[áa]#)');

/** 🔴 La app fingiendo sentir algo. `docs/la-voz-de-sofia.md` §3.5: *"«Me alegro
 *  por vos» de una app es mentira. Cálida y presente, sí. Persona, no."*
 *
 *  Corre en todos los tonos. Los patrones son de **primera persona**: lo que
 *  está prohibido es que el sistema se atribuya un estado, no que la frase hable
 *  de lo que siente quien lee. Por eso `siento que` cae y `lo que sentís` pasa.
 *
 *  📌 Desde el 01/09/2026 esto además coincide con una obligación: el art. 50(1)
 *  del Reglamento de IA europeo exige que se sepa que hay una IA del otro lado
 *  (ver §3.6 del mismo doc). Una voz que dice "me alegro" está haciendo lo
 *  contrario. */
const FINGE_SENTIR = re('\\b(me alegr[a-záéíóúñ]*#|me pone#|me da (gusto|alegr[íi]a|orgullo|pena|tristeza|bronca)#|me emocion[a-záéíóúñ]*#|me encant[a-záéíóúñ]*#|te entiendo#|me siento#|siento que#|estoy orgullos[oa]#|me duele#|me alivia#)');

export type CopyRejection =
  | 'vacío' | 'muy corto' | 'muy largo' | 'genera a la persona'
  | 'lenguaje clínico' | 'tono gurú' | 'anima en tono suave' | 'pide una acción en tono suave'
  | 'pide una reserva' | 'finge sentir'
  | 'signos de exclamación' | 'markdown o comillas' | 'etiquetas internas';

/** ¿Se puede mostrar esta frase? `null` = sí. Si no, el motivo — que se loguea
 *  para poder ver qué rechaza el guardarraíl sin tener que adivinar. */
export function rejectCopy(text: string, tone: ReflectionTone): CopyRejection | null {
  const t = text.trim();
  if (!t) return 'vacío';

  // Los límites salen de la forma que ya tienen las frases de las reglas: dos
  // oraciones. Menos de 6 palabras es un rótulo; más de 45 no entra en la
  // tarjeta sin empujar todo lo de abajo.
  const words = t.split(/\s+/).length;
  if (words < 6) return 'muy corto';
  if (words > 45) return 'muy largo';

  // Un modelo que devuelve markdown o se pone a citar está respondiendo a otra
  // pregunta, no escribiendo la línea.
  if (/[*_#`]|^["“']/.test(t)) return 'markdown o comillas';
  if (/!/.test(t)) return 'signos de exclamación';

  // 🔴 Etiquetas internas del modelo. Hoy no puede pasar —la función corre en
  // Haiku, que no entra en la rama que apaga el thinking— pero `REFLECTION_MODEL`
  // es un override por variable de entorno, y el código elige la configuración
  // por PREFIJO (`!MODEL.startsWith('claude-haiku')`). Apuntarlo a un modelo
  // Opus le manda `thinking: disabled`, y con el thinking apagado esos modelos
  // pueden derramar `<thinking>` en la respuesta visible.
  //
  // Sin este chequeo la etiqueta pasaba entera: los filtros de arriba miran
  // markdown, comillas y exclamaciones, ninguno mira `<` ni `>`. O sea que un
  // cambio de una variable de entorno alcanzaba para publicarle una etiqueta
  // interna a la persona en su pantalla de inicio.
  if (/<[^>]*>/.test(t)) return 'etiquetas internas';

  if (GENDERED.test(t) || GENDERED_PERIFRASIS.test(t) || NIVEL_MASCULINO.test(t)) {
    return 'genera a la persona';
  }
  if (CLINICAL.test(t)) return 'lenguaje clínico';
  if (GURU.test(t)) return 'tono gurú';

  // Los dos que NO dependen del tono. Van con los de arriba y no en el bloque
  // `gentle` de abajo a propósito: pedir una reserva y fingir un sentimiento
  // están mal el día bueno igual que el malo.
  if (VENDE.test(t)) return 'pide una reserva';
  if (FINGE_SENTIR.test(t)) return 'finge sentir';

  if (tone === 'gentle') {
    if (CHEER.test(t)) return 'anima en tono suave';
    if (ASKS.test(t)) return 'pide una acción en tono suave';
  }

  return null;
}

export type Reflection = {
  before: string;
  bold: string;
  after: string;
  tone: ReflectionTone;
  /** Qué regla la produjo. Sirve para tests y para telemetría futura. */
  signal: string;
  source: 'rules' | 'ai';
};

export type ReflectionInput = {
  /** mood_id (1-5) de los últimos 7 días. Orden indistinto. */
  recentMoods: number[];
  /** mood_id de los 30 días anteriores a esos 7. */
  historicMoods: number[];
  /** Días consecutivos con check-in, terminando hoy. */
  streak: number;
  /** Recursos completados en los últimos 7 días. */
  resourcesThisWeek: number;
  /** Sesiones con profesional en los últimos 7 días. */
  sessionsThisWeek: number;
  /** Entradas de diario y gratitud en los últimos 7 días. */
  writingThisWeek: number;
  /** ¿El ánimo cayó fuerte hoy respecto del check-in anterior? Ver decisión 3. */
  sharpDrop: boolean;
  /** ¿Corresponde el piso de seguridad? Lo decide `lib/pisoSeguridad.ts`, que
   *  mira la secuencia de registros y no promedios. Llega ya calculado —y ya
   *  pasado por el flag— porque este archivo es puro y la decisión de encenderlo
   *  no le corresponde. */
  pisoSeguridad: boolean;
  /** Fecha local (YYYY-MM-DD). Fija la variante del día — ver `variantFor`. */
  dayKey: string;
  /** Cuántos días faltan para la próxima sesión agendada, o `null`.
   *
   *  📌 **Las reglas escritas a mano NO lo usan** — ninguna de las 32 frases lo
   *  menciona. Está acá solo para pasárselo al modelo, que es donde demostró
   *  valer: en el ensayo del 04/09, *"en dos días ves a tu profesional, eso ya es
   *  algo"* fue lo único que la versión enriquecida ganaba de verdad, y en
   *  `sustained-low`, que es cuando más falta hace.
   *
   *  Es un entero de calendario: **no describe el ánimo de nadie**, y por eso se
   *  eligió sobre mandar la secuencia de días del §5 bis. */
  diasHastaProximaSesion?: number | null;
};

// Cuánto tiene que moverse el promedio para llamarlo un cambio y no ruido.
// Sobre una escala de 1 a 5, 0,4 es medio nivel: suficiente para que la persona
// lo haya sentido, poco para que un solo día raro lo dispare.
const CHANGE_THRESHOLD = 0.4;

// Mínimo de registros para poder comparar dos períodos sin decir cualquier cosa.
const MIN_SAMPLE = 3;

// ⚠️ Las etiquetas concuerdan con **"semana"** (femenino), así que solo se
// pueden usar en el marco "(Tu|La) semana viene ___". Metidas en una frase cuyo
// sujeto sea la persona la misgenerizan.
//
// 🔴 `pareja` fue `pareja` hasta el 04/09 y se cambió a `estable` por una razón
// que solo apareció al probar el modelo: **lo leía como pareja sentimental.**
// Escribió *"la pareja está en tu cabeza hoy"*, *"tenés a la pareja en el radar…
// cuando la veas"* y *"esta semana tenés pareja"* — le hablaba de su relación a
// alguien que había tenido una semana estable. Y `level` es la señal que MÁS se
// muestra.
//
// Se intentó primero desambiguar desde afuera: primero en el prompt (ya lo
// decía), después mandando la clave `la_semana_viene` en vez de `level`. **Las
// dos fallaron**: la palabra es demasiado fuerte y el modelo la agarra igual. Lo
// único que lo resolvió fue sacar la palabra.
//
// 📌 Y `estable` trae un beneficio que no buscábamos: **es neutra en género**,
// así que esa etiqueta deja de depender del marco para no misgenerizar.
const LEVEL_LABEL: Record<number, string> = {
  1: 'para abajo', 2: 'cansada', 3: 'estable', 4: 'bien', 5: 'muy bien',
};

function average(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Índice estable dentro del día y distinto entre días.
 *
 *  Que la frase cambie sola de un día para el otro es parte del efecto: si
 *  dijera siempre lo mismo se leería como un cartel, no como alguien que te
 *  está mirando. Que NO cambie dentro del mismo día es igual de importante —
 *  la tarjeta se re-monta cada vez que volvés a Inicio, y una devolución que
 *  se reescribe cada vez que scrolleás rompe justo la ilusión que busca. */
function variantFor(dayKey: string, options: number): number {
  let h = 0;
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) | 0;
  return Math.abs(h) % options;
}

function pick(dayKey: string, variants: Reflection[]): Reflection {
  return variants[variantFor(dayKey, variants.length)];
}

export function buildReflection(input: ReflectionInput): Reflection {
  const {
    recentMoods, historicMoods, streak,
    resourcesThisWeek, sessionsThisWeek, writingThisWeek,
    sharpDrop, pisoSeguridad, dayKey,
  } = input;

  const r = (before: string, bold: string, after: string, tone: ReflectionTone, signal: string): Reflection =>
    ({ before, bold, after, tone, signal, source: 'rules' });

  // ── 0. El piso de seguridad ───────────────────────────────────────────────
  // 🔴 GANA SOBRE TODO, incluida `sharp-drop`. Es el punto donde la tarjeta deja
  // de hacer de amigo: `docs/la-voz-de-sofia.md` §5 ter dice que una voz cálida
  // no alcanza cuando alguien viene registrando el fondo, y que no puede simular
  // que sí.
  //
  // ⚠️ Va PRIMERO y sin variantes por día. Las otras señales rotan su redacción
  // para no volverse un cartel; esta no. Cuando lo que hay que decir es "acá hay
  // ayuda", decirlo distinto cada mañana sería tratarlo como copy.
  //
  // 📌 El texto de acá es CORTO a propósito: los números de las líneas de ayuda
  // no entran en una frase de tarjeta, y meterlos ahí sería ilegible justo
  // cuando importa que se lean. Su presentación es trabajo aparte, y espera el
  // texto revisado — ver el pendiente en CHANGELOG_SESIONES.
  if (pisoSeguridad) {
    return r(
      'Hace varios días que venís registrando lo mismo. ',
      'Esto es más de lo que una app puede acompañar',
      '.', 'gentle', 'piso-seguridad',
    );
  }

  // ── 1. El ánimo cayó fuerte hoy ───────────────────────────────────────────
  // Arriba hay una tarjeta sugiriendo hablar con alguien. Acá no se agrega otra
  // acción ni se levanta el ánimo a la fuerza: se acusa recibo y se corre.
  if (sharpDrop) {
    return pick(dayKey, [
      r('Hoy venís ', 'más abajo', '. No hace falta que hagas nada con eso ahora — alcanza con haberlo registrado.', 'gentle', 'sharp-drop'),
      r('', 'Un día flojo', ' no borra la semana. Mañana es otro día y no le debés nada a nadie.', 'gentle', 'sharp-drop'),
      r('Registraste un día difícil, y eso ya es ', 'mirarse de frente', '. Quedate tranqui.', 'gentle', 'sharp-drop'),
    ]);
  }

  // ── 2. Todavía no hay con qué ─────────────────────────────────────────────
  if (recentMoods.length === 0) {
    return pick(dayKey, [
      r('Todavía no nos conocemos mucho. Contame cómo venís unos días y ', 'empiezo a devolverte', ' lo que voy viendo.', 'neutral', 'empty'),
      r('Acá te voy a ir contando lo que noto en tu semana. Para eso necesito que ', 'me cuentes cómo venís', '.', 'neutral', 'empty'),
      r('Recién arrancamos. Con un par de registros más, ', 'esto se pone interesante', '.', 'neutral', 'empty'),
    ]);
  }

  const avgRecent = average(recentMoods);

  // ── 3. Varios días seguidos abajo ─────────────────────────────────────────
  // Va antes de la comparación con el histórico a propósito: a alguien que
  // viene en 2 hace una semana no le sirve enterarse de que "mejoró" respecto
  // de un mes peor. El nivel manda sobre la tendencia cuando el nivel es bajo.
  if (recentMoods.length >= MIN_SAMPLE && avgRecent <= 2) {
    return pick(dayKey, [
      // 📌 Revisión de voz del 04/09. Dos cambios, y ninguno es "sacar el
      // reconocimiento" — reconocer está bien y en `gentle` es casi lo único que
      // se puede hacer. Lo que se sacó es otra cosa:
      //
      //  · *"dice bastante de vos"* concluía sobre **quién sos** a partir de que
      //    abriste la app. Reconocer el acto sí; sacar conclusiones de la persona
      //    es de la misma familia que el "algo estás haciendo distinto" que se
      //    quitó de `trend-up`.
      //  · *"a veces solo hay que atravesarlo"* es consejo, y a alguien que lleva
      //    días abajo le suena liviano. Le dice qué hacer con eso.
      //
      // La primera variante ahora **pregunta**, que es el movimiento que la
      // psicóloga consultada usa: abrir, no cerrar. Y no presume que haya una
      // causa — valida explícitamente que no la haya, que es el caso más común y
      // el que peor se siente cuando alguien te pide explicarlo.
      r('Hace unos días que ', 'venís abajo', '. ¿Pasó algo, o es más difuso que eso?', 'gentle', 'sustained-low'),
      r('', 'Días difíciles', ', y los registrás igual. Eso no es poco.', 'gentle', 'sustained-low'),
      r('La semana viene ', 'cuesta arriba', '. No tiene que estar buena para que valga la pena anotarla.', 'gentle', 'sustained-low'),
    ]);
  }

  // ── 4. Cambio de dirección ────────────────────────────────────────────────
  // Solo la dirección: ninguna de estas frases nombra el nivel absoluto.
  if (recentMoods.length >= MIN_SAMPLE && historicMoods.length >= MIN_SAMPLE) {
    const delta = avgRecent - average(historicMoods);

    // ⚠️ Dos cosas que la revisión de voz del 04/09 sacó de acá y conviene no
    // volver a poner:
    //
    //  · **Inferir sobre la persona.** Una variante decía "algo estás haciendo
    //    distinto, aunque no lo tengas del todo claro". El dato es que el
    //    promedio subió — no que cambió una conducta, y menos que la persona no
    //    se dio cuenta. Eso es el modo analista y contradice §2: la app no tiene
    //    ventaja de información sobre vos. Preguntar "¿sabés qué se movió?" dice
    //    lo mismo sin afirmar nada.
    //  · **"Se te nota…"** El `SYSTEM` de la edge function prohíbe arrancar con
    //    "Parece que", "Se nota que", "Veo que". Las reglas tienen que cumplir lo
    //    que le exigen al modelo, o el día que se prenda la IA vamos a estar
    //    rechazándole frases que las nuestras usan.
    //
    // 📌 Giro a presente (capa 1, `la-voz-de-sofia.md` §1): la tendencia se
    // nombra en PRESENTE y se pregunta, en vez de reportar una comparación con
    // "las anteriores" (que era el modo devolución/pasado). El delta sigue
    // decidiendo QUÉ rama, pero la frase ya no dice "más/menos que antes".
    // Se mantiene la invariante de que la tendencia NO nombra un nivel absoluto.
    if (delta >= CHANGE_THRESHOLD) {
      return pick(dayKey, [
        r('Algo se está ', 'acomodando', ' estos días. ¿Lo notás vos también?', 'warm', 'trend-up'),
        r('Hay un ', 'cambio', ' esta semana, para arriba. No sé qué se movió, pero algo se movió.', 'warm', 'trend-up'),
        r('Venís ', 'levantando', ', y eso no pasa solo. ¿Sabés qué se movió?', 'warm', 'trend-up'),
      ]);
    }

    if (delta <= -CHANGE_THRESHOLD) {
      return pick(dayKey, [
        r('Estos días vienen ', 'más cuesta arriba', '. Si necesitás bajar un cambio, bajalo.', 'gentle', 'trend-down'),
        r('Venís ', 'un poco más abajo', ' de lo habitual. Pasa, y no dice nada malo de vos.', 'gentle', 'trend-down'),
        r('La semana viene ', 'más cargada', '. No todas tienen que rendir.', 'gentle', 'trend-down'),
      ]);
    }
  }

  // ── 5. Sesiones ───────────────────────────────────────────────────────────
  // Antes que la racha: una sesión es lo más importante que pasó esa semana.
  if (sessionsThisWeek > 0) {
    const varias = sessionsThisWeek > 1;
    // 📌 Giro a presente: en vez de reportar "esta semana te sentaste", refiere
    // lo que pasó y pregunta por el ahora (la-voz §3.1: usar lo que sabe para
    // preguntar, no para informar).
    return pick(dayKey, [
      varias
        ? r('Te sentaste a hablar con alguien ', `${sessionsThisWeek} veces`, ' esta semana. ¿Cómo venís después?', 'warm', 'sessions')
        : r('Te estás haciendo el tiempo para ', 'hablar con alguien', '. ¿Te dejó algo dando vueltas?', 'warm', 'sessions'),
      r('Sentarte a hablar con alguien ', 'sostiene', ' más de lo que parece desde afuera. No es poco.', 'warm', 'sessions'),
      // ⚠️ Las dos ramas del ternario son el MISMO slot —plural y singular de la
      // variante 1—, así que nunca conviven; la que sí convive con las dos es la
      // de acá arriba. Al revisar el copy hay que mirar ese par, no las tres
      // líneas sueltas: la primera corrección del 04/09 le devolvió a la rama
      // singular el cierre "más de lo que parece desde afuera" y quedó pisándose
      // con esta, que ya lo tenía.
    ]);
  }

  // ── 6. Racha ──────────────────────────────────────────────────────────────
  // Desde 3 días: menos que eso no es una racha, es haber entrado dos veces.
  if (streak >= 3) {
    return pick(dayKey, [
      r('Van ', `${streak} días seguidos`, ' parando un segundo a ver cómo venís. Es más de lo que parece.', 'warm', 'streak'),
      r('', `${streak} días`, ' sin saltearte el check-in. Esa constancia después se nota en otras cosas.', 'warm', 'streak'),
    ]);
  }

  // ── 7. Práctica ───────────────────────────────────────────────────────────
  const practices = resourcesThisWeek + writingThisWeek;
  if (practices >= 2) {
    // 📌 Giro a presente: refiere el conteo y pregunta por el ahora, en vez de
    // reportar la actividad como un logro cerrado.
    return pick(dayKey, [
      r('Volviste ', `${practices} veces`, ' a tus herramientas esta semana. ¿Alguna te está sirviendo?', 'warm', 'practices'),
      r('Ya van ', `${practices} veces`, ' que volvés a tus prácticas esta semana. ¿Se está armando algo?', 'warm', 'practices'),
    ]);
  }

  // ── 8. Primeros días ──────────────────────────────────────────────────────
  // 🔴 Con UN check-in, la rama de abajo decía "Tu semana viene pareja".
  // `empty` solo cubre cero registros, y las dos ramas que comparan exigen
  // `MIN_SAMPLE`, así que uno o dos registros caían directo al fallback — que
  // afirma algo sobre LA SEMANA a partir de un día. Es sobreafirmar, y le tocaba
  // justo a quien recién llega, que es el caso más común mientras la base sea
  // chica.
  //
  // Va acá abajo y no arriba a propósito: `sessions`, `streak` y `practices` no
  // dependen de cuántos moods haya. Si esta semana hubo una sesión, eso es cierto
  // con un check-in o con siete, y merece decirse. Lo único que hay que frenar es
  // la afirmación sobre el nivel de la semana.
  if (recentMoods.length < MIN_SAMPLE) {
    // ⚠️ Dos juegos de variantes, y la distinción importa. Alguien que registró
    // UN día y ese día fue un bajón no puede recibir una invitación neutra a
    // seguir registrando: eso es no acusar recibo justo cuando más hace falta.
    // Lo que no se puede es hablar de "la semana" —no hay semana todavía—, pero
    // sí del día. Se nombra el día y se cede el tono, igual que `sharp-drop`.
    if (avgRecent <= 2) {
      return pick(dayKey, [
        r('Arrancaste registrando ', 'un día difícil', '. Todavía no sé lo suficiente para decirte nada más, pero lo anoté.', 'gentle', 'early'),
        r('', 'Un día pesado', ', y lo registraste igual. Con eso alcanza por ahora.', 'gentle', 'early'),
        r('Empezaste por ', 'un día de los que cuestan', '. No hace falta que sea otra cosa.', 'gentle', 'early'),
      ]);
    }
    return pick(dayKey, [
      r('Recién empezamos a conocernos. Unos días más de registro y ', 'te puedo devolver algo', ' que valga la pena.', 'neutral', 'early'),
      r('Ya tengo tus primeros registros. Todavía son pocos para ', 'sacar una conclusión', ', pero por algo se arranca.', 'neutral', 'early'),
      r('', 'Por ahora te escucho', '. Con unos registros más te empiezo a contar lo que voy notando.', 'neutral', 'early'),
    ]);
  }

  // ── 9. Nivel, sin comparar ────────────────────────────────────────────────
  // Último recurso: no hay cambio, ni sesión, ni racha, ni práctica. Se dice el
  // nivel y nada más — sin "que de costumbre", que es lo que rompía antes.
  //
  // ⚠️ Es la rama que más se toca, sobre todo al principio: alguien con el
  // ánimo parejo y poca actividad cae acá todos los días. Por eso tiene tantas
  // variantes como las demás — con una sola, la app le decía literalmente la
  // misma frase cada mañana y se leía como un cartel.
  //
  // ⚠️ Las etiquetas concuerdan con **"semana"** (femenino): `cansada`,
  // `pareja`. Solo se pueden usar en el marco "(Tu|La) semana viene ___" —
  // metidas en una frase cuyo sujeto sea la persona misma la misgenerizan
  // ("venís pareja" a un varón, "venís cansada" a quien no lo es). Lo que
  // varía entre variantes es la segunda oración, nunca el marco.
  const level = LEVEL_LABEL[Math.round(avgRecent)] ?? 'estable';
  // 📌 La primera variante PREGUNTA, y solo la primera. `level` es la que más se
  // muestra: si las cuatro preguntaran, en una racha plana la app estaría
  // interrogando todas las mañanas, que es la otra forma de volverse empapelado.
  //
  // Y esa pregunta hace algo que ninguna otra frase de este archivo hace: en vez
  // de informar, **ofrece corregir**. Responde de frente a la objeción de §2 del
  // doc de la voz —que la app no sabe nada que vos no sepas— admitiéndolo.
  return pick(dayKey, [
    // "según lo que registraste" no es relleno para llegar al mínimo de palabras:
    // dice de dónde sale la lectura. La app no sabe cómo viene tu semana, sabe
    // qué anotaste — y admitirlo es lo que le da derecho a preguntar.
    r('Tu semana viene ', level, ', según lo que registraste. ¿Vos la sentís así?', 'neutral', 'level'),
    r('La semana viene ', level, ', sin grandes sobresaltos. A veces sostener ya es bastante.', 'neutral', 'level'),
    r('Tu semana viene ', level, '. Está bien que algunas sean así.', 'neutral', 'level'),
    r('La semana viene ', level, '. No hace falta que pase algo para que cuente.', 'neutral', 'level'),
  ]);
}
