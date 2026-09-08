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

/** Adjetivos en masculino que solo pueden estar describiendo a **la persona**.
 *
 *  `LEVEL_LABEL` las define en femenino a propósito, para concordar con
 *  "semana" — ver la nota de la rama de nivel. Así que un `cansado` o un
 *  `parejo` solo pueden estar describiendo a **la persona**, que es justo lo que
 *  no se puede hacer sin saber su género.
 *
 *  🔴 También salió de una frase real: *"llevás una semana **parejo**"*. Un
 *  regex genérico de adjetivos no la agarraba sin rechazar de paso "el mes
 *  **pasado**", así que la regla se hizo angosta: solo estas palabras, que no
 *  tienen otro uso legítimo acá.
 *
 *  📌 La lista creció el 04/09 con las que el modelo produjo de verdad en las
 *  corridas del ensayo: *"**Tranquilo** mantener el ritmo"* y *"no está **solo**
 *  en esto"*. **El femenino sí puede ser legítimo** —"la semana viene tranquila"
 *  concuerda con "semana"— así que solo entran las formas masculinas; hay un
 *  test que lo fija.
 *
 *  ⚠️ Dos palabras se probaron y salieron, y el motivo importa:
 *
 *   · **`solo` suelto** rechazaba una frase propia — *"eso no pasa **solo**"*,
 *     donde es adverbio y no describe a nadie. Quedó acotado a `estás solo`,
 *     que sí es sobre la persona.
 *   · **`contento`** le ganaba a `FINGE_SENTIR` en *"me pone contento verlo"*,
 *     que es la app atribuyéndose un sentimiento — un motivo de rechazo más
 *     preciso. Se fue de la lista; esa frase la frena la otra regla.
 *
 *  ⚠️ Es una lista, no una regla general, y va a quedar corta. Es a propósito:
 *  cada palabra que se agrega se paga en falsos rechazos, y un rechazo cae al
 *  texto escrito a mano, que es bueno. Ampliar cuando aparezca una frase real,
 *  no por anticipación. */
const NIVEL_MASCULINO = re('\\b(cansado|parejo|plano|tranquilo|preocupado|perdido)#|\\best[áa]s?\\s+solo#');

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

/** 🔴 Concordancia rota con "la semana", que es el sujeto elidido de estas frases.
 *
 *  `GENDERED` mira `venís + adjetivo` y **excluye `más`** (porque "venís más
 *  bien/mejor/peor" es legítimo), así que no ve dos huecos que el ensayo del
 *  07/09 encontró en una sola corrida: la **tercera persona** (`viene`, `vino`)
 *  y el `más` en el medio. La frase real fue *"Viene más **complicado** que hace
 *  un mes"* — y sus dos variantes hermanas decían "pesada" y "complicada",
 *  concordando bien. `NIVEL_MASCULINO` no la agarró porque `complicado` no está
 *  en la lista, y **meterlo suelto rechazaría "un día complicado", que es
 *  correcto** (ahí concuerda con "día").
 *
 *  Por eso la regla es posicional y no una palabra más: en estas frases el
 *  sujeto tácito de `viene`/`vino` es siempre **la semana**, así que un
 *  adjetivo masculino ahí solo puede estar describiendo a la persona. */
const CONCORDANCIA_SEMANA = re('\\b(viene|vino)\\s+(m[áa]s\\s+)?[a-záéíóúñ]+(ad|id|os)o#');

/** Tuteo. La voz es rioplatense de "vos" y el `SYSTEM` lo pide explícitamente.
 *
 *  Salió del ensayo del 07/09: *"**Llevas** unos días complicados"*. Ninguna de
 *  estas formas es válida en rioplatense —todas tienen su par en voseo, que se
 *  distingue por el acento— así que no hay falso positivo posible. */
const TUTEO = re('\\b(tienes|puedes|quieres|llevas|vienes|sientes|sabes|debes|haces|necesitas|piensas|empiezas|vuelves|registras|escribes|eres|est[aá]s tú)#');

/** Días de la semana. **Al modelo NUNCA se le pasa uno.**
 *
 *  🔴 `facts` solo lleva números (y `level`, que es una etiqueta de nivel), así
 *  que un día nombrado en la salida está SIEMPRE inventado. Del ensayo del
 *  07/09: con `dias_hasta_proxima_sesion: 2` el modelo escribió *"**El sábado**
 *  hablás con tu profesional"*. Si hoy es martes, la sesión es el jueves.
 *
 *  📌 Que la regla pueda ser absoluta es lo que la hace barata: no hay que
 *  mirar el contexto, porque no existe el caso legítimo. */
const DIA_INVENTADO = re('\\b(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)#');

/** Alguien acompañando a la persona.
 *
 *  El `SYSTEM` ya lo dice —*"no hay nadie acompañando a quien lee salvo que yo
 *  lo diga"*— y el modelo lo rompió igual, **dos veces en una corrida**:
 *  *"guardá eso para contárselo **a quien te acompaña**"*, con `facts` vacío.
 *
 *  ⚠️ A diferencia de la anterior, esta NO puede ser absoluta: nombrar al
 *  profesional es legítimo y §3.4 lo defiende expresamente ("eso decíselo el
 *  sábado" hace lo contrario de vender). Lo que la vuelve chequeable es que hay
 *  un dato que lo autoriza — por eso `rejectCopy` ahora recibe el contexto. */
const ACOMPANANTE = re('\\b(quien te acompa[ñn]a|tu profesional|tu psic[óo]log[ao]|tu coach|tu terapeuta|con quien te ves)#');

/** Lo que el modelo efectivamente sabía cuando escribió.
 *
 *  🔴 Sin esto `rejectCopy` no puede distinguir un hecho de un invento, que es
 *  el hueco más viejo del guardarraíl — está anotado como abierto desde la
 *  sesión 168. No lo cierra entero (la **inferencia causal** sigue afuera: *"eso
 *  que hacés está funcionando"* no tiene ninguna palabra prohibida), pero sí
 *  cierra la invención de HECHOS, que es la mitad detectable. */
export type CopyContext = {
  /** La señal que se le pidió. */
  signal?: string;
  /** Los `facts` que viajaron — lo ÚNICO que el modelo sabe del mundo. */
  facts?: Record<string, number | string>;
};

export type CopyRejection =
  | 'vacío' | 'muy corto' | 'muy largo' | 'genera a la persona'
  | 'lenguaje clínico' | 'tono gurú' | 'anima en tono suave' | 'pide una acción en tono suave'
  | 'pide una reserva' | 'finge sentir'
  | 'signos de exclamación' | 'markdown o comillas' | 'etiquetas internas'
  | 'tutea' | 'inventa un día de la semana' | 'inventa que hay alguien acompañando'
  | 'la app se pone de testigo';

/** ¿Se puede mostrar esta frase? `null` = sí. Si no, el motivo — que se loguea
 *  para poder ver qué rechaza el guardarraíl sin tener que adivinar. */
export function rejectCopy(
  text: string,
  tone: ReflectionTone,
  ctx: CopyContext = {},
): CopyRejection | null {
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

  // 🔴 La app declarando que percibe. El `SYSTEM` lo prohíbe —*No empieces con
  // "Parece que", "Se nota que", "Veo que"*— pero **estaba escrito como una
  // regla de ARRANQUE**, y el guardarraíl la copiaba anclada con `^`.
  //
  // El ensayo del 07/09 (segunda corrida, ya con el prompt corregido) la esquivó
  // sin proponérselo: *"Días complicados, **lo veo**."* Mismo movimiento, mitad
  // de la frase, y pasaba los catorce controles.
  //
  // ⚠️ La prohibición nunca fue sobre la posición sino sobre la POSTURA: la app
  // no observa a nadie, y ponerse de testigo es el modo analista que §2 rechaza.
  // Por eso ahora corre en toda la frase.
  if (/\b(lo veo|te veo|se te nota|se nota que|veo que|noto que)\b/i.test(t)) {
    return 'la app se pone de testigo';
  }
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

  if (GENDERED.test(t) || GENDERED_PERIFRASIS.test(t) || NIVEL_MASCULINO.test(t)
      || CONCORDANCIA_SEMANA.test(t)) {
    return 'genera a la persona';
  }
  if (TUTEO.test(t)) return 'tutea';
  if (CLINICAL.test(t)) return 'lenguaje clínico';
  if (GURU.test(t)) return 'tono gurú';

  // Los dos que NO dependen del tono. Van con los de arriba y no en el bloque
  // `gentle` de abajo a propósito: pedir una reserva y fingir un sentimiento
  // están mal el día bueno igual que el malo.
  if (VENDE.test(t)) return 'pide una reserva';
  if (FINGE_SENTIR.test(t)) return 'finge sentir';

  // ── Invención de hechos ────────────────────────────────────────────────────
  // 🔴 VAN DESPUÉS DE `VENDE` A PROPÓSITO, y el orden importa para el motivo que
  // se loguea. *"Agendá algo con tu profesional"* menciona a alguien Y pide una
  // reserva: las dos cosas están mal, pero **pedir una reserva es el problema
  // más grave y el más específico**, así que es el que tiene que aparecer en el
  // log. Con el orden invertido, un pedido de venta se reportaba como "inventa
  // que hay alguien acompañando" y el bug real quedaba disfrazado.
  //
  // Corren en TODOS los tonos: inventar un hecho no es peor un día que otro. Y
  // las dos salieron de frases REALES del ensayo del 07/09, no de imaginar qué
  // podría salir mal.
  if (DIA_INVENTADO.test(t)) return 'inventa un día de la semana';
  if (ACOMPANANTE.test(t)) {
    // Nombrar al profesional es legítimo cuando hay uno a la vista, o cuando la
    // señal ES sobre las sesiones que ya tuvo. Sin ninguna de las dos, se lo
    // inventó.
    const haySesion = ctx.facts?.dias_hasta_proxima_sesion != null;
    if (!haySesion && ctx.signal !== 'sessions') return 'inventa que hay alguien acompañando';
  }

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

/** ¿Esta frase la puede redactar un modelo, o va sí o sí la de las reglas?
 *
 *  Puro y acá —en vez de suelto adentro del `useEffect` del hook— porque es una
 *  decisión de producto con historia, y merece un test que la fije.
 *
 *  ── Lo que se saltea, y por qué cada uno ──────────────────────────────────
 *
 *  🔴 **`piso-seguridad`: requisito escrito**, no una preferencia.
 *  `docs/legal-instrucciones.md` exige que la reacción ante señales de riesgo
 *  sea determinística. Que además sea texto fijo es lo que la vuelve revisable
 *  por una profesional, cosa que una frase generada no puede ser.
 *
 *  **`empty` y `early`: no hay con qué.** Lo único honesto que se puede decir es
 *  "todavía no sé lo suficiente", y para eso no hace falta un modelo — sería
 *  gastar una llamada por cada persona que abre la app sin registrar.
 *
 *  🔴 **Tono `gentle`: APAGADO el 07/09/2026, y es un paso atrás a propósito.**
 *
 *  Sale de tres corridas de `scripts/ensayo-gentle.mjs` contra tres versiones
 *  del prompt (v20, v21, v22), no de una impresión. Lo que devolvieron:
 *
 *  · **~30% rechazado por el guardarraíl** en cada corrida, y `trend-down` quedó
 *    **3 de 3** en la última: ahí el modelo no aporta nada, siempre cae a las
 *    reglas igual.
 *  · **Inventa un acompañante de forma sistemática** —*"contárselo a quien te
 *    acompaña"* con `facts` vacío— pese a que el `SYSTEM` lo prohíbe explícito.
 *    Cinco de quince en la última corrida. La instrucción no alcanzó.
 *  · **Reintroduce fórmulas ya descartadas** en la revisión de voz del 04/09:
 *    *"Eso es lo que cuenta"*, *"No es poco empezar"* — la app dictaminando, que
 *    es justo lo que §2 ter pide sacar.
 *  · 🔴 **Escribió *"lo que importa es que seguís viniendo acá"*** — la app
 *    elogiando que vuelvas a la app. Pasa los quince controles y va en contra
 *    directa del techo del apego (`la-voz-de-sofia.md` §2 bis) y del criterio
 *    *"¿más capaz o más dependiente?"*.
 *  · **Sus dos mejores salidas eran copias textuales de ejemplos del prompt.**
 *    El modelo no aprendió el patrón: le dimos una frase y la repitió.
 *
 *  ⚠️ Y `gentle` es el tono con el que la app le habla a alguien que la está
 *  pasando mal — o sea donde una frase mala cuesta más y donde las reglas ya son
 *  mejores. **Se apaga donde el riesgo es alto y el aporte es negativo; `warm` y
 *  `neutral` siguen con modelo, que es donde hay margen y equivocarse sale
 *  barato.**
 *
 *  📌 Es reversible en esta función, y `ensayo-gentle.mjs` queda para volver a
 *  probarlo cuando cambie el modelo o el prompt. */
export function puedeRedactarloElModelo(signal: string, tone: ReflectionTone): boolean {
  if (signal === 'piso-seguridad') return false;
  if (signal === 'empty' || signal === 'early') return false;
  if (tone === 'gentle') return false;
  return true;
}

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
    // 🔴 REESCRITO el 07/09/2026 con la devolución de Mónica Grando, que
    // encontró un error de diseño y no de texto (ver `la-voz-de-sofia.md` §5 ter).
    //
    // Decía *"Esto es más de lo que una app puede acompañar"*, que es una
    // afirmación sobre la GRAVEDAD — y la gravedad es justo lo que no medimos.
    // El detector detecta "hace rato que viene así", que es otra cosa.
    //
    // ⚠️ El modo de falla que eso abría: **una persona en tratamiento puede
    // registrar el fondo dos semanas porque el tratamiento está FUNCIONANDO.**
    // Textual de Mónica: *"las sesiones pueden destapar ansiedades y generar
    // falta de apetito, angustia, etcétera, como parte del proceso de sanación"*.
    // A esa persona le decíamos que lo suyo excedía lo que la app puede
    // acompañar, y le ofrecíamos líneas de crisis. No es peligroso, pero es
    // falso y puede leerse como que su proceso no sirve.
    //
    // 🔴 Y de ahí sale la rama: **si hay un profesional en juego, el lugar donde
    // esto se trabaja es la sesión, no una línea de crisis.** El dato ya existía
    // y esta señal lo ignoraba por completo.
    //
    // ⚠️ `sessionsThisWeek` entra en la condición además de la sesión agendada:
    // alguien en tratamiento puede no tener la próxima ya reservada, y quedarse
    // sin la rama correcta por un hueco de agenda sería exactamente el caso que
    // Mónica describe.
    //
    // 📌 Sigue SIN variantes por día — ver la nota de abajo. Esto no es
    // rotación: son dos situaciones distintas, no dos maneras de decir lo mismo.
    const dias = input.diasHastaProximaSesion;
    const hayProfesional = (dias != null && dias >= 0) || sessionsThisWeek > 0;
    return hayProfesional
      ? r('Hace varios días que venís registrando lo mismo. ',
          'Llevalo a tu próxima sesión',
          '.', 'gentle', 'piso-seguridad')
      : r('Hace varios días que venís registrando lo mismo. ',
          'Hay gente preparada para acompañar esto',
          '.', 'gentle', 'piso-seguridad');
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
      // 📌 Revisión del 07/09 (`la-voz-de-sofia.md` §2 ter). Antes cerraba con
      // *"Eso no es poco"*, que es la app **validando**: la frase empieza y
      // termina en ella. El movimiento 4 de Sofía era el contrario — te subía el
      // piso y después **te lo dejaba a cargo** ("y así debía mantenerme").
      //
      // 🔴 Y por qué NO dice "sos capaz": eso concluiría sobre quién es la
      // persona a partir de cinco registros de ánimo, que es el modo analista
      // que §2 prohíbe. Ella podía decirlo porque los conocía hace años; la app
      // no. Lo que sí puede hacer es **material y no conclusión**: nombrar un
      // hecho que la persona efectivamente hizo y atribuírselo. El sujeto de la
      // frase deja de ser la app y pasa a ser ella.
      r('', 'Días difíciles', ', y los registrás igual. Eso lo estás sosteniendo vos.', 'gentle', 'sustained-low'),
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
