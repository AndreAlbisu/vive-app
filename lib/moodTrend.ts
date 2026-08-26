/**
 * Lectura del propio ánimo — el promedio, la dirección y cómo se dice.
 *
 * 🔴 Existe primero para la PERSONA. Hoy hace su check-in todos los días y en
 * Progreso ve las caritas, pero nadie le devuelve una lectura: ni promedio, ni
 * tendencia, ni "venís mejor que la semana pasada". El dato es suyo y es el
 * único que no lo tiene interpretado.
 *
 * ⚠️ **Los umbrales tienen que coincidir con `mood_trend_for_client`**
 * (`scripts/add-mood-para-coach.sql`), que calcula lo mismo del lado del
 * servidor para el profesional. Si se separan, la persona y su coach ven dos
 * lecturas distintas del mismo dato — y la que va a discutirse en una sesión es
 * justo esa. Cualquier cambio acá va también allá.
 */

/** Con menos registros no hay tendencia, hay ruido: un martes malo no es "venís
 *  cayendo". Mismo piso que la función SQL. */
export const MINIMO_REGISTROS = 3;

/** Cuánto tiene que moverse el promedio entre la primera y la segunda mitad del
 *  período para llamarlo un cambio y no una oscilación normal. */
export const UMBRAL_DIRECCION = 0.5;

export type MoodEntry = { moodId: number; fecha: string };

export type LecturaAnimo = {
  registros: number;
  promedio: number;
  direccion: 'sube' | 'baja' | 'igual';
  /** El día más reciente registrado, 1-5. */
  ultimo: number;
};

/**
 * @param entries  check-ins del período, en cualquier orden
 * @returns `null` si no hay registros suficientes — y eso NO es un cero. Un
 *   promedio 0 se leería como "pésimo"; la ausencia de lectura se lee como
 *   "todavía no hay con qué".
 */
export function leerAnimo(entries: MoodEntry[]): LecturaAnimo | null {
  if (entries.length < MINIMO_REGISTROS) return null;

  const ord = [...entries].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const promedio = ord.reduce((s, e) => s + e.moodId, 0) / ord.length;

  const mitad = Math.floor(ord.length / 2);
  const prom = (xs: MoodEntry[]) => xs.reduce((s, e) => s + e.moodId, 0) / xs.length;
  const primera = prom(ord.slice(0, mitad));
  const segunda = prom(ord.slice(ord.length - mitad));
  const delta = segunda - primera;

  return {
    registros: ord.length,
    promedio: Math.round(promedio * 100) / 100,
    direccion: delta > UMBRAL_DIRECCION ? 'sube' : delta < -UMBRAL_DIRECCION ? 'baja' : 'igual',
    ultimo: ord[ord.length - 1].moodId,
  };
}

/**
 * Cómo se dice en criollo.
 *
 * 📝 En palabras y no con el número: "venís con el ánimo bajo" es lo que una
 * persona entiende de sí misma; "promedio 2,4" invita a tratarse como un score,
 * que es exactamente lo que este producto dice no ser.
 */
export function textoAnimo(l: LecturaAnimo, persona: 'vos' | 'tercero' = 'vos'): string {
  const nivel =
    l.promedio <= 2.4 ? 'con el ánimo bajo'
    : l.promedio >= 3.6 ? 'con buen ánimo'
    : 'con el ánimo parejo';

  const rumbo =
    l.direccion === 'sube' ? ', y mejorando'
    : l.direccion === 'baja' ? ', y cayendo'
    : '';

  return `${persona === 'vos' ? 'Venís' : 'Viene'} ${nivel}${rumbo}`;
}
