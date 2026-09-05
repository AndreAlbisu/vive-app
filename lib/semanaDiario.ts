import { localDayKey } from '@/lib/dates';

// La franja "Esta semana" del Diario: lunes a domingo de la semana en curso,
// diciendo en qué días hay al menos una entrada escrita.
//
// Vive acá y no adentro de la pantalla porque tiene dos bordes que se rompen
// solos y en silencio: dónde empieza la semana, y en qué día cae una entrada.
// Lo segundo ya falló una vez en este mismo archivo de pantalla —
// `toISOString()` da la fecha UTC, así que en Argentina (UTC-3) todo lo escrito
// después de las 21:00 contaba para el día siguiente—. Por eso el día de cada
// entrada sale de `localDayKey`, y por eso hay tests.

export const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export type DiaDeSemana = {
  /** Fecha del día, `YYYY-MM-DD` en hora local. */
  key: string;
  /** Inicial para mostrar debajo del punto. */
  label: string;
  /** Hay al menos una entrada escrita ese día. */
  escrito: boolean;
  esHoy: boolean;
};

/**
 * @param fechas  `created_at` de las entradas (ISO, como vienen de Supabase).
 * @param hoy     Inyectable para los tests; por defecto, ahora.
 */
export function semanaDeEscritura(fechas: string[], hoy: Date = new Date()): DiaDeSemana[] {
  // getDay() devuelve 0 para domingo; acá la semana arranca el lunes.
  const offset = (hoy.getDay() + 6) % 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - offset);

  const hoyKey = localDayKey(hoy);
  const escritos = new Set(fechas.map(f => localDayKey(new Date(f))));

  return DIAS_CORTOS.map((label, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    const key = localDayKey(d);
    return { key, label, escrito: escritos.has(key), esHoy: key === hoyKey };
  });
}
