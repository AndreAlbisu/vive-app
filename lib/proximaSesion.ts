// M6 (docs/problemas-abiertos.md): "próxima sesión sugerida por el profesional".
//
// Al terminar la sesión, el profesional dice cada cuánto le parece bien volver
// ("en una semana"). El cliente lo ve en la tarjeta de cierre de la Sala y el
// calendario abre directamente en esa fecha. Refuerza la anti-fuga n.º 1
// (re-reservar en un toque).
//
// Todo lo de acá es puro: opción → fecha y texto. La tabla es
// `next_session_suggestions` (ver SCHEMA.md); las cinco opciones tienen que
// coincidir exactamente con su CHECK, por eso están en un solo lugar.
//
// ⚠️ La fecha que sale de acá es una SUGERENCIA, no una reserva ni un turno
// reservado: el calendario la usa para abrir en el mes correcto y marcarla, y
// si ese día el profesional no tiene horario libre, el cliente elige otro.

import { localDayKey } from './dates';

export type CuandoVolver = '1_semana' | '2_semanas' | '3_semanas' | '1_mes' | 'cuando_lo_necesite';

export const OPCIONES_PROXIMA_SESION: { valor: CuandoVolver; label: string }[] = [
  { valor: '1_semana',           label: 'En 1 semana' },
  { valor: '2_semanas',          label: 'En 2 semanas' },
  { valor: '3_semanas',          label: 'En 3 semanas' },
  { valor: '1_mes',              label: 'En 1 mes' },
  { valor: 'cuando_lo_necesite', label: 'Cuando lo necesite' },
];

const DIAS: Record<CuandoVolver, number | null> = {
  '1_semana': 7,
  '2_semanas': 14,
  '3_semanas': 21,
  '1_mes': 30,
  cuando_lo_necesite: null,
};

export function esCuandoVolver(v: unknown): v is CuandoVolver {
  return typeof v === 'string' && v in DIAS;
}

/** Fecha sugerida `YYYY-MM-DD`, contando desde el día de la sesión.
 *
 *  Devuelve null para "cuando lo necesite": ahí no hay fecha que proponer, y
 *  poner una cualquiera sería inventarle al cliente un compromiso que el
 *  profesional no dio.
 *
 *  ⚠️ "1 mes" son 30 días y no `setMonth(+1)` a propósito: el salto de mes cae
 *  en días distintos según el mes (31 de enero → 3 de marzo) y acá lo que
 *  importa es el ritmo del proceso, no la fecha del almanaque.
 *
 *  Si la cuenta cae en el pasado (sesión vieja que recién se mira hoy), se
 *  devuelve hoy: un calendario abierto en un día ya pasado no se puede tocar. */
export function fechaSugerida(
  cuando: CuandoVolver,
  desdeDia: string,
  hoy: string = localDayKey(),
): string | null {
  const dias = DIAS[cuando];
  if (dias === null) return null;
  const [y, m, d] = desdeDia.split('-').map(Number);
  if (!y || !m || !d) return null;
  // UTC para que un cambio de horario de verano no corra la cuenta un día.
  const destino = localDayKeyFromUTC(Date.UTC(y, m - 1, d) + dias * 86400000);
  return destino < hoy ? hoy : destino;
}

function localDayKeyFromUTC(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** Lo que lee el CLIENTE en la tarjeta de cierre de la Sala. */
export function textoSugerencia(cuando: CuandoVolver, nombre?: string): string {
  const quien = (nombre ?? '').trim().split(' ')[0] || 'Tu profesional';
  if (cuando === 'cuando_lo_necesite') {
    return `${quien} te dejó abierta la próxima sesión: cuando lo necesites.`;
  }
  const cada: Record<Exclude<CuandoVolver, 'cuando_lo_necesite'>, string> = {
    '1_semana': 'en una semana',
    '2_semanas': 'en dos semanas',
    '3_semanas': 'en tres semanas',
    '1_mes': 'en un mes',
  };
  return `${quien} sugiere volver a verse ${cada[cuando]}.`;
}

/** Lo que lee el PROFESIONAL una vez que ya eligió. */
export function textoSugerenciaCoach(cuando: CuandoVolver): string {
  if (cuando === 'cuando_lo_necesite') return 'Le dijiste que vuelva cuando lo necesite.';
  const label = OPCIONES_PROXIMA_SESION.find(o => o.valor === cuando)?.label ?? '';
  return `Le sugeriste volver ${label.toLowerCase()}.`;
}
