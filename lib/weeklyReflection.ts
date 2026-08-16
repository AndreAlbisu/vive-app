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
// 3. CEDE EL TONO. Cuando `CoachSuggestionCard` está visible justo arriba —
//    porque el ánimo cayó fuerte hoy— esta tarjeta no puede decir algo liviano
//    dos centímetros más abajo. La señal `sharpDrop` gana sobre todas y baja
//    el registro.
//
// ── Sobre la IA ──────────────────────────────────────────────────────────────
// La idea es que en algún momento esto lo escriba un modelo con tono Vita. El
// enganche es `Reflection.source`: la IA produciría exactamente esta misma
// forma, y estas reglas quedan como piso para cuando no hay red, el modelo
// falla, o la persona es nueva y no hay nada que contar. Por eso las reglas se
// escriben para ser buenas, no para ser un placeholder.

export type ReflectionTone = 'gentle' | 'neutral' | 'warm';

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
  /** ¿`CoachSuggestionCard` está visible arriba? Ver decisión 3. */
  sharpDrop: boolean;
  /** Fecha local (YYYY-MM-DD). Fija la variante del día — ver `variantFor`. */
  dayKey: string;
};

// Cuánto tiene que moverse el promedio para llamarlo un cambio y no ruido.
// Sobre una escala de 1 a 5, 0,4 es medio nivel: suficiente para que la persona
// lo haya sentido, poco para que un solo día raro lo dispare.
const CHANGE_THRESHOLD = 0.4;

// Mínimo de registros para poder comparar dos períodos sin decir cualquier cosa.
const MIN_SAMPLE = 3;

const LEVEL_LABEL: Record<number, string> = {
  1: 'para abajo', 2: 'cansada', 3: 'pareja', 4: 'bien', 5: 'muy bien',
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
    sharpDrop, dayKey,
  } = input;

  const r = (before: string, bold: string, after: string, tone: ReflectionTone, signal: string): Reflection =>
    ({ before, bold, after, tone, signal, source: 'rules' });

  // ── 1. El ánimo cayó fuerte hoy ───────────────────────────────────────────
  // Arriba hay una tarjeta sugiriendo hablar con alguien. Acá no se agrega otra
  // acción ni se levanta el ánimo a la fuerza: se acusa recibo y se corre.
  if (sharpDrop) {
    return pick(dayKey, [
      r('Hoy venís ', 'más abajo', '. No hace falta que hagas nada con eso ahora.', 'gentle', 'sharp-drop'),
      r('', 'Un día flojo', ' no borra la semana.', 'gentle', 'sharp-drop'),
      r('Registraste un día difícil. ', 'Eso también cuenta', '.', 'gentle', 'sharp-drop'),
    ]);
  }

  // ── 2. Todavía no hay con qué ─────────────────────────────────────────────
  if (recentMoods.length === 0) {
    return r('Contame cómo venís y ', 'acá te lo devuelvo', '.', 'neutral', 'empty');
  }

  const avgRecent = average(recentMoods);

  // ── 3. Varios días seguidos abajo ─────────────────────────────────────────
  // Va antes de la comparación con el histórico a propósito: a alguien que
  // viene en 2 hace una semana no le sirve enterarse de que "mejoró" respecto
  // de un mes peor. El nivel manda sobre la tendencia cuando el nivel es bajo.
  if (recentMoods.length >= MIN_SAMPLE && avgRecent <= 2) {
    return pick(dayKey, [
      r('Venís sostenido en ', 'días difíciles', '. Registrarlo igual ya es algo.', 'gentle', 'sustained-low'),
      r('La semana viene ', 'cuesta arriba', '. No tiene que estar buena para que valga anotarla.', 'gentle', 'sustained-low'),
    ]);
  }

  // ── 4. Cambio de dirección ────────────────────────────────────────────────
  // Solo la dirección: ninguna de estas frases nombra el nivel absoluto.
  if (recentMoods.length >= MIN_SAMPLE && historicMoods.length >= MIN_SAMPLE) {
    const delta = avgRecent - average(historicMoods);

    if (delta >= CHANGE_THRESHOLD) {
      return pick(dayKey, [
        r('Esta semana venís ', 'mejor', ' que las anteriores.', 'warm', 'trend-up'),
        r('Algo se ', 'acomodó', ' esta semana.', 'warm', 'trend-up'),
        r('Venís ', 'levantando', ' respecto del último mes.', 'warm', 'trend-up'),
      ]);
    }

    if (delta <= -CHANGE_THRESHOLD) {
      return pick(dayKey, [
        r('Esta semana viene ', 'más pesada', ' que las anteriores.', 'gentle', 'trend-down'),
        r('Venís ', 'un poco más abajo', ' que el último mes.', 'gentle', 'trend-down'),
      ]);
    }
  }

  // ── 5. Sesiones ───────────────────────────────────────────────────────────
  // Antes que la racha: una sesión es lo más importante que pasó esa semana.
  if (sessionsThisWeek > 0) {
    return pick(dayKey, [
      r('Tuviste ', sessionsThisWeek === 1 ? 'una sesión' : `${sessionsThisWeek} sesiones`, ' esta semana.', 'warm', 'sessions'),
      r('Esta semana te ', 'hiciste el tiempo', ' para una sesión.', 'warm', 'sessions'),
    ]);
  }

  // ── 6. Racha ──────────────────────────────────────────────────────────────
  // Desde 3 días: menos que eso no es una racha, es haber entrado dos veces.
  if (streak >= 3) {
    return pick(dayKey, [
      r('Van ', `${streak} días seguidos`, ' que registrás cómo venís.', 'warm', 'streak'),
      r('', `${streak} días`, ' sin saltearte el check-in.', 'warm', 'streak'),
    ]);
  }

  // ── 7. Práctica ───────────────────────────────────────────────────────────
  const practices = resourcesThisWeek + writingThisWeek;
  if (practices >= 2) {
    return pick(dayKey, [
      r('Esta semana hiciste ', practices === 1 ? 'una práctica' : `${practices} prácticas`, '.', 'warm', 'practices'),
      r('Volviste a tus ', 'herramientas', ' esta semana.', 'warm', 'practices'),
    ]);
  }

  // ── 8. Nivel, sin comparar ────────────────────────────────────────────────
  // Último recurso: no hay cambio, ni sesión, ni racha, ni práctica. Se dice el
  // nivel y nada más — sin "que de costumbre", que es lo que rompía antes.
  const level = LEVEL_LABEL[Math.round(avgRecent)] ?? 'pareja';
  return r('Tu semana viene ', level, '.', 'neutral', 'level');
}
