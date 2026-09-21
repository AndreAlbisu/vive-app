import { scheduledAtMs } from '@/lib/time';
import { VENTANA_24H_MS } from '@/lib/bookingHelpers';

/**
 * M15: mover una sesión en vez de perderla.
 *
 * 🔴 **El problema que resuelve, en una línea: hoy a quien se le complica tres
 * horas antes la única salida es cancelar, y cancelar tarde le hace perder la
 * plata.** Sale de las reseñas de Selia (`docs/competencia-selia.md` §24.3), que
 * es la queja más razonada de su App Store, y donde Selia está MEJOR que
 * nosotros: ellos al menos dejan mover con más de 24hs.
 *
 * ── La regla, decidida por Andre el 21/09/2026 ───────────────────────────────
 *
 *   · **Con más de 24hs**: se mueve a cualquier horario libre del profesional,
 *     sin pedirle permiso a nadie y sin perder el pago.
 *   · **Dentro de las 24hs**: se puede pedir **una sola vez por reserva**, y el
 *     profesional acepta o no. Una vez es por RESERVA y no por persona: mover
 *     tres sesiones distintas no es abusar, mover la misma tres veces sí.
 *
 * ── Lo que esta regla NO toca, y es lo que la hace segura ────────────────────
 *
 * 📌 **Mover no toca la plata.** Es la misma reserva con otra fecha: el pago, la
 * comisión y el tramo (20%/15%) no se recalculan, y `trg_mark_refund_on_cancel`
 * ni se entera porque nadie cancela nada. Todo el riesgo de M15 estaría en
 * mezclarlo con el camino del reembolso; no se mezcla.
 *
 * ⚠️ **Esto decide, no ejecuta.** El cliente no puede escribir `scheduled_date`:
 * `authenticated` tiene UPDATE sobre 5 columnas de `bookings` y esa no está
 * (verificado el 21/09). El movimiento real lo hace el servidor, que vuelve a
 * validar todo esto. Acá vive lo que la PANTALLA necesita saber antes de
 * ofrecer el botón, y tiene que decir exactamente lo mismo que el servidor: si
 * divergen, la app ofrece mover algo que después le van a rechazar.
 */

/** Lo mínimo de una reserva para saber si se puede mover. */
export type ReservaAMover = {
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  /** ¿Ya usó su única movida de último momento? Por reserva. */
  movida_tarde?: boolean | null;
};

export type MotivoNo =
  /** No está confirmada: no hay nada que mover todavía. */
  | 'no_confirmada'
  /** La sesión ya empezó o ya pasó. */
  | 'ya_empezo'
  /** Ya usó su única movida dentro de las 24hs. */
  | 'ya_la_movio';

export type Reagendable =
  /** Se mueve y listo. */
  | { puede: 'libre' }
  /** Se puede pedir, pero lo decide el profesional. */
  | { puede: 'pide_permiso' }
  | { puede: 'no'; motivo: MotivoNo };

export function puedeReagendar(b: ReservaAMover, ahoraMs: number = Date.now()): Reagendable {
  if (b.status !== 'confirmada') return { puede: 'no', motivo: 'no_confirmada' };

  const inicioMs = scheduledAtMs(b.scheduled_date, b.scheduled_time);

  // ⚠️ Una fecha ilegible acá NO se trata como la trata `isCancelLate`, que ante
  // la duda deja cancelar. Los dos casos eligen lo conservador, pero lo
  // conservador es distinto: cancelar es un derecho y bloquearlo sería peor que
  // permitirlo de más; mover es un favor, y moverle la sesión a alguien sobre
  // una fecha que no se pudo leer es peor que pedirle permiso al profesional.
  if (!Number.isFinite(inicioMs)) return { puede: 'pide_permiso' };

  if (ahoraMs >= inicioMs) return { puede: 'no', motivo: 'ya_empezo' };

  const esTarde = ahoraMs > inicioMs - VENTANA_24H_MS;
  if (!esTarde) return { puede: 'libre' };

  return b.movida_tarde ? { puede: 'no', motivo: 'ya_la_movio' } : { puede: 'pide_permiso' };
}

/**
 * ¿Sirve este horario como destino?
 *
 * 📌 **No mira la agenda del profesional**: eso solo lo sabe el servidor, y
 * preguntárselo a la base desde acá haría que la pantalla dependiera de una
 * consulta más para dibujar un botón. Acá se filtra lo que es imposible sin
 * consultar nada, que es lo que evita ofrecer horarios que ya pasaron.
 *
 * ⚠️ Mover a un horario que cae dentro de las próximas 24hs está PERMITIDO. La
 * ventana mide qué tan cerca está la sesión que se mueve, no adónde va: a quien
 * se le complica el jueves y quiere pasar a mañana no se le está haciendo ningún
 * favor prohibiéndoselo.
 */
export function destinoValido(
  fecha: string,
  hora: string,
  origen: { scheduled_date: string; scheduled_time: string },
  ahoraMs: number = Date.now(),
): boolean {
  if (fecha === origen.scheduled_date && hora.slice(0, 5) === origen.scheduled_time.slice(0, 5)) {
    return false;
  }
  const destinoMs = scheduledAtMs(fecha, hora);
  if (!Number.isFinite(destinoMs)) return false;
  return destinoMs > ahoraMs;
}

/** Lo que la pantalla le dice a la persona. Sin rayas: punto o dos puntos. */
export function textoReagendar(r: Reagendable): string {
  switch (r.puede) {
    case 'libre':
      return 'Elegí otro horario. Tu pago se mueve con la sesión.';
    case 'pide_permiso':
      return 'Falta menos de un día, así que el cambio lo tiene que aceptar tu profesional. Podés pedirlo una vez.';
    case 'no':
      switch (r.motivo) {
        case 'no_confirmada':
          return 'Todavía no está confirmada, así que no hay nada que mover.';
        case 'ya_empezo':
          return 'Esta sesión ya empezó.';
        case 'ya_la_movio':
          return 'Ya moviste esta sesión sobre la hora. Si no podés ir, podés cancelarla.';
      }
  }
}
