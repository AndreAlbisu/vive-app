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

/** Las fechas de `bookings` son hora local de Argentina, sin timezone guardada.
 *  Argentina no aplica horario de verano, así que el offset fijo es correcto. */
export const AR_OFFSET = '-03:00';

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
 */
export function scheduledAtMs(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return NaN;
  return Date.parse(`${date}T${time.slice(0, 5)}:00${AR_OFFSET}`);
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
