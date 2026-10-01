// Lo que el perfil público del profesional calcula y no es pantalla.
//
// Vive aparte de `ProfesionalScreen` para poder probarlo sin montar nada: son
// las cuatro decisiones del rediseño del 01/10/2026 que, si se rompen, se
// rompen en silencio (un nombre completo publicado, un "no disponible" que en
// realidad era la red, una hora del día equivocado).

import { localEquivalent, deviceIsOffArgentina, daysFromTodayAr } from './time';

/**
 * Cómo se firma una reseña en el perfil: "Martina G.".
 *
 * 🔴 Antes salía `profiles.name` entero. En un servicio de salud mental, que
 * "Martina González" reseñó a una psicóloga cuenta en público que Martina va a
 * terapia. Nombre e inicial alcanzan para que se lea como una persona real y
 * no alcanzan para encontrarla.
 *
 * Sin nombre usable (vacío, o la lápida de una cuenta borrada) firma
 * "Alguien de Vita": la reseña sigue valiendo, quien la escribió no se muestra.
 */
export function firmaDeResena(nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio || limpio === 'Usuario eliminado' || limpio === 'Usuario') return 'Alguien de Vita';
  const [primero, ...resto] = limpio.split(' ');
  const pila = primero.charAt(0).toUpperCase() + primero.slice(1);
  const apellido = resto.find(p => /\p{L}/u.test(p));
  return apellido ? `${pila} ${apellido.charAt(0).toUpperCase()}.` : pila;
}

/**
 * ¿El perfil no existe, o no se pudo preguntar?
 *
 * `PGRST116` es la respuesta de PostgREST a un `.single()` sin filas: el perfil
 * no está. Cualquier otro error (sin señal, timeout, 5xx) es que no sabemos, y
 * decir "ya no está disponible" ahí le hace creer a la persona que el
 * profesional se fue. Mismo bug que tuvo el catálogo hasta el 26/09.
 */
export function motivoSinPerfil(error: { code?: string } | null): 'no_existe' | 'error_red' {
  return !error || error.code === 'PGRST116' ? 'no_existe' : 'error_red';
}

/**
 * La duración de la sesión, solo si es UNA. Un profesional puede tener franjas
 * de 45 y de 60 minutos; ahí cualquier número sería mentir para la mitad de los
 * turnos, así que no se dice ninguno.
 */
export function duracionUnica(duraciones: (number | null | undefined)[]): number | null {
  const validas = [...new Set(duraciones.filter((d): d is number => typeof d === 'number' && d > 0))];
  return validas.length === 1 ? validas[0] : null;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function hhmm(hora: string): string {
  const [h, m = '0'] = hora.split(':');
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
}

/**
 * "Hoy a las 18:00", "Mañana a las 09:00", "El jueves 9 de octubre a las 18:00".
 *
 * 🔴 `fecha` y `hora` son de Argentina: así los guarda `coach_availability` y así
 * los devuelve `slots_libres`. Quien mira desde otra zona lee la hora SUYA,
 * con el día también corrido si cae en otro (las 21:00 de acá son la mañana
 * siguiente en Asia). Mismo criterio que `BookingScreen_Time`.
 */
export function etiquetaProximoLugar(
  fecha: string,
  hora: string,
  now: number = Date.now(),
  tz?: string,
): string {
  const eq = deviceIsOffArgentina(now, tz) ? localEquivalent(fecha, hora, tz) : null;

  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d, 12) + (eq?.dayShift ?? 0) * 86_400_000);
  const horaTxt = eq?.time ?? hhmm(hora);

  // "Hoy" y "mañana" se cuentan en el calendario de quien lee: a la 01:00 en
  // Madrid, el "mañana" de Argentina ya es hoy.
  const enDias = eq ? diasDesdeHoyEn(dia, now, tz) : daysFromTodayAr(fecha, now);
  if (enDias === 0) return `Hoy a las ${horaTxt}`;
  if (enDias === 1) return `Mañana a las ${horaTxt}`;
  const diaSemana = DIAS[dia.getUTCDay()];
  if (enDias > 1 && enDias < 7) return `El ${diaSemana} a las ${horaTxt}`;
  return `El ${diaSemana} ${dia.getUTCDate()} de ${MESES[dia.getUTCMonth()]} a las ${horaTxt}`;
}

function diasDesdeHoyEn(dia: Date, now: number, tz?: string): number {
  const [hy, hm, hd] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now).split('-').map(Number);
  return Math.round((dia.getTime() - Date.UTC(hy, hm - 1, hd, 12)) / 86_400_000);
}
