// guarantee — las condiciones de la garantía de primera sesión (T&C §9.3),
// puras y sin dependencias.
//
// Vivían inline dentro de `guarantee-claim`, entreveradas con las queries. Acá
// quedan como funciones que reciben datos y devuelven motivos de rechazo; la
// edge function sigue siendo la que consulta la base y escribe.
//
// Sin imports a propósito: lo carga tanto Deno como Jest.

/** §9.3: "dentro de las 48 horas posteriores al horario en que la Sesión estaba agendada". */
export const WINDOW_HOURS = 48;

/** Las fechas de `bookings` son hora local de Argentina, sin timezone guardada. */
export const AR_TZ = 'America/Argentina/Buenos_Aires';

/** Se conserva como fallback, no como la regla. Argentina no aplica horario de
 *  verano desde 2009, así que hoy da el mismo resultado que la zona; se usa solo
 *  si el runtime no sabe convertir por nombre. */
export const AR_OFFSET = '-03:00';

/** ¿El runtime sabe convertir por nombre de zona? Chequeo FUNCIONAL: soportar un
 *  locale no es lo mismo que soportar la opción `timeZone`, y un feature-detect
 *  que solo mire si la API existe devolvería `true` en un motor que después
 *  ignora la zona en silencio. */
const TZ_SUPPORTED: boolean = (() => {
  try {
    // 2026-01-01T12:00Z son las 09:00 en Argentina.
    const s = new Intl.DateTimeFormat('en-US', { timeZone: AR_TZ, hour: '2-digit', hour12: false })
      .format(new Date(Date.UTC(2026, 0, 1, 12, 0, 0)));
    return parseInt(s, 10) === 9;
  } catch {
    return false;
  }
})();

/** Offset de Argentina (ms) en un instante dado. */
function arOffsetMsAt(instantMs: number): number {
  if (!TZ_SUPPORTED) return -3 * 60 * 60_000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (t: string): number => {
    const p = parts.find(x => x.type === t);
    return p ? parseInt(p.value, 10) : 0;
  };
  const hour = get('hour') % 24;
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) - instantMs;
}

/**
 * `scheduled_date` + `scheduled_time` como instante real. `NaN` si la forma no
 * es la esperada.
 *
 * ⚠️ La forma se valida con regex y NO se confía en que `Date.parse` devuelva
 * `NaN` ante basura: el parser legacy de V8 es tolerante y saca una fecha de
 * casi cualquier cosa. `Date.parse('xTy:00-03:00')` devuelve el año 2000, no
 * `NaN`. Con la guarda anterior, una fila corrupta se interpretaba como el
 * 2000 y la solicitud se rechazaba con "pasaron 233337hs" en vez de decir que
 * la fecha no se pudo leer. Encontrado por los tests, 14/08/2026.
 *
 * ⚠️ Convierte por NOMBRE de zona y no con el offset fijo. Hoy dan el mismo
 * número —Argentina no tiene DST—, pero el día que vuelva a haberlo el offset
 * fijo se rompería en silencio y con él la ventana de la garantía y la de la
 * sala de video, una hora corridas. Tiene que decir lo mismo que `lib/time.ts`
 * en el cliente y que el `AT TIME ZONE` de los crons SQL: las tres partes
 * calculan sobre los mismos datos y si divergen, la app promete una cosa y la
 * base hace otra.
 */
export function scheduledAtMs(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return NaN;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.slice(0, 5).split(':').map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Dos pasadas: en un salto de DST el offset del instante estimado puede no ser
  // el del instante real. Sin DST las dos dan igual.
  const primera = asIfUtc - arOffsetMsAt(asIfUtc);
  return asIfUtc - arOffsetMsAt(primera);
}

export type ClaimBooking = {
  payment_status: string;
  payment_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
};

export type PairBooking = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  preference_id: string | null;
  payment_status: string;
};

export type EligibilityInput = {
  booking: ClaimBooking & { id: string };
  /** Sesiones `'completada'` del MISMO par cliente-profesional, incluida la reclamada. */
  pairBookings: PairBooking[];
  /** Cuántas garantías APROBADAS tiene ya este cliente en toda la plataforma. */
  approvedClaimsByUser: number;
  /** Milisegundos. Se pasa en vez de leer el reloj adentro, para poder testear los bordes. */
  now: number;
};

/**
 * Cuántas sesiones del par ocurrieron ANTES que la reclamada.
 *
 * Compara fecha **y hora**: comparar solo por `scheduled_date` dejaba pasar el
 * caso de dos sesiones el mismo día — la segunda calificaba como "primera del
 * vínculo".
 *
 * Descarta los checkouts abandonados que igual llegaron a `'completada'`, con
 * el mismo criterio que el contador de comisión: sin ese filtro, una reserva
 * basura vieja del par haría que la primera sesión REAL no calificara.
 */
export function countPreviousOfPair(
  booking: { id: string; scheduled_date: string; scheduled_time: string },
  pairBookings: PairBooking[],
): number {
  const startedAt = scheduledAtMs(booking.scheduled_date, booking.scheduled_time);
  return pairBookings.filter((b) => {
    if (b.id === booking.id) return false;
    if (b.preference_id && b.payment_status === 'pendiente') return false;
    return scheduledAtMs(b.scheduled_date, b.scheduled_time) < startedAt;
  }).length;
}

/**
 * Motivos por los que la solicitud NO califica. Array vacío = califica.
 *
 * Devuelve TODOS los motivos y no solo el primero, a propósito: quien contesta
 * el mail necesita poder decir todo lo que falla de una vez, no de a uno.
 */
export function guaranteeFailures(input: EligibilityInput): string[] {
  const { booking, pairBookings, approvedClaimsByUser, now } = input;
  const failures: string[] = [];

  // (1) Que se haya pagado de verdad por la Plataforma.
  if (booking.payment_status !== 'aprobado') {
    failures.push(`el pago está en '${booking.payment_status}', no 'aprobado' — no hay nada que reintegrar`);
  }
  if (!booking.payment_id) {
    failures.push('la reserva no tiene payment_id: nunca se cobró por MP');
  }

  // (2) Ventana de 48hs desde el horario agendado.
  const startedAt = scheduledAtMs(booking.scheduled_date, booking.scheduled_time);
  if (Number.isNaN(startedAt)) {
    failures.push(`no se pudo interpretar la fecha agendada (${booking.scheduled_date} ${booking.scheduled_time})`);
  } else {
    const hoursSince = (now - startedAt) / 3_600_000;
    if (hoursSince < 0) {
      failures.push('la sesión todavía no ocurrió: para eso está la cancelación de §9.1, no la garantía');
    } else if (hoursSince > WINDOW_HOURS) {
      failures.push(`pasaron ${Math.floor(hoursSince)}hs del horario agendado y la ventana de §9.3 es de ${WINDOW_HOURS}hs`);
    }
  }

  // (3) Que sea la PRIMERA Sesión del vínculo.
  const previous = countPreviousOfPair(booking, pairBookings);
  if (previous > 0) {
    failures.push(`ya hubo ${previous} sesión(es) previa(s) con ese profesional: §9.3 alcanza solo a la primera del vínculo`);
  }

  // (4) Una sola vez por Cliente en toda la Plataforma.
  //
  // Cuenta APROBADAS, no pedidas: si contara pedidas, un rechazo por abuso le
  // quemaría el único intento a alguien que después reclama legítimamente.
  if (approvedClaimsByUser > 0) {
    failures.push('este Cliente ya usó la garantía: §9.3 se ejerce una sola vez en toda la Plataforma');
  }

  return failures;
}
