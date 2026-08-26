import { scheduledAtMs } from '@/lib/time';

/** ¿Cancelar AHORA cuenta como tardía? Menos de 24hs antes del inicio.
 *
 *  🔴 La hora guardada es hora de ARGENTINA, y hasta la sesión 112 esto se
 *  calculaba con `new Date(year, month - 1, day, h, m)`, que la interpreta en la
 *  zona del dispositivo. En un teléfono argentino coincide; en uno en Madrid el
 *  instante caía 5 horas antes, así que a alguien cancelando con 29hs de
 *  anticipación le escribía "tardía" — y `trg_mark_refund_on_cancel` le negaba
 *  el reembolso. `scheduledAtMs` convierte con la zona de Argentina, así que da
 *  el mismo instante desde donde sea.
 *
 *  ⚠️ Esta ya no es la única palabra: el trigger recalcula la tardanza por su
 *  cuenta y pisa lo que mande el cliente (`add-late-cancel-server-side.sql`).
 *  Esto queda para lo que la pantalla necesita ANTES de cancelar — habilitar o
 *  no el botón, y decir qué va a pasar con la plata. Las dos tienen que decir lo
 *  mismo: si divergen, la app promete un reembolso que la base no da.
 */
export function isCancelLate(scheduledDate: string, scheduledTime: string): boolean {
  const sessionMs = scheduledAtMs(scheduledDate, scheduledTime);
  // Con datos ilegibles se asume lo conservador: no bloquear la cancelación.
  // Quien decide de verdad es el trigger.
  if (!Number.isFinite(sessionMs)) return false;
  return Date.now() > sessionMs - 24 * 60 * 60 * 1000;
}
/** ¿Se puede cancelar una sesión confirmada? Solo con 24hs o más de margen.
 *
 *  Es la contracara de `isCancelLate` y vivía duplicada dentro de SalaScreen.
 *  Se mudó acá al necesitarla también en la lista de próximas sesiones: dos
 *  copias de la regla de las 24hs se desincronizan tarde o temprano, y el día
 *  que pase, una pantalla va a permitir lo que la otra prohíbe.
 */
export function canCancelConfirmed(scheduledDate: string, scheduledTime: string): boolean {
  return !isCancelLate(scheduledDate, scheduledTime);
}

/** Lo mínimo de una reserva para saber quién está esperando a quién. */
export type ReservaPendiente = {
  status: string;
  payment_status: string | null;
  /** Id del checkout. Lo escriben Mercado Pago **y PayPal** (`order.id`). */
  preference_id: string | null;
  /** Marcador del cobro en cripto, mismo rol que `preference_id`. */
  usdt_amount?: number | string | null;
};

/**
 * ¿Esta reserva está esperando que el COACH la confirme?
 *
 * 🔴 No alcanza con `status === 'pendiente'`. Una reserva con un cobro iniciado
 * y sin acreditar también está pendiente, pero ahí **no espera al coach: espera
 * a la plata**, y el coach no puede confirmarla — confirmar compromete el
 * horario, le avisa al usuario y cancela a los competidores del slot, todo eso
 * sin que haya entrado un peso.
 *
 * Contarlas juntas le diría al coach "3 personas esperan tu confirmación"
 * cuando no lo espera nadie, y lo mandaría a una pantalla donde esas filas no
 * tienen botón. La regla es la misma que `CoachReservasScreen` aplicaba puertas
 * adentro; vive acá para que no haya dos copias que se separen.
 */
export function esperaConfirmacionDelCoach(b: ReservaPendiente): boolean {
  if (b.status !== 'pendiente') return false;
  const cobroIniciado =
    b.payment_status === 'pendiente' && (b.preference_id != null || b.usdt_amount != null);
  return !cobroIniciado;
}
