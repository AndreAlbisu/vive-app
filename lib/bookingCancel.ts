// bookingCancel — cancelar una reserva, desde donde sea.
//
// Vivía inline dentro de `SalaScreen.handleCancelBooking`, con dos ramas casi
// idénticas (coach y usuario) que solo se diferencian en tres textos y en a
// quién se le avisa. Al necesitarla también en la lista de próximas sesiones, la
// alternativa era duplicarla — y la regla de las 24hs duplicada se desincroniza
// tarde o temprano.
//
// Hace tres cosas, y las tres importan: cancela, deja el mensaje de sistema en
// la sala (si no, la otra parte ve la sesión desaparecer sin explicación), y
// notifica. `cancelled_late` lo lee `trg_mark_refund_on_cancel` para decidir si
// corresponde reembolso.

import { supabase } from '@/lib/supabase';
import { encryptMessage } from '@/lib/encryption';
import { sendPushNotification } from '@/lib/notifications';
import { isCancelLate } from '@/lib/bookingHelpers';

export type CancelActor = 'coach' | 'usuario';

export type CancelBookingParams = {
  bookingId: string;
  /** Sala del par. Si falta, no se puede dejar el mensaje de sistema. */
  salaId: string | null;
  /** Quién cancela (auth uid). */
  actorId: string;
  actorRole: CancelActor;
  /** La otra parte, para notificarle. */
  recipientId: string | null;
  scheduledDate: string;
  scheduledTime: string;
  /** Fecha ya formateada para el mensaje de sistema (cada pantalla la formatea a su modo). */
  fechaLegible: string;
};

/** Qué pasa con la plata. Lo decide la base (el trigger `trg_mark_refund_on_cancel`),
 *  no esta función: acá solo se lee el resultado para poder contárselo a la persona.
 *   · `mp`      → vuelve sola, pero tarda en verse en el resumen de la tarjeta.
 *   · `usdt`    → hay que pedirle la dirección; el envío es manual.
 *   · `tardia`  → canceló con menos de 24hs y pierde el reembolso (política).
 *   · `sin_pago`→ no había nada cobrado. */
export type RefundOutcome = 'mp' | 'usdt' | 'tardia' | 'sin_pago';

export type CancelResult =
  | { ok: true; refund: RefundOutcome }
  | { ok: false; error: string };

export async function cancelBookingFlow(p: CancelBookingParams): Promise<CancelResult> {
  const horaLegible = p.scheduledTime.slice(0, 5);
  const esCoach = p.actorRole === 'coach';

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelada',
      cancelled_by: p.actorRole,
      // ⚠️ Este valor ya NO decide nada: desde `add-late-cancel-server-side.sql`
      // el trigger recalcula la tardanza con la zona de Argentina y PISA lo que
      // llegue de acá. Se sigue mandando porque quitarlo del UPDATE no cambia el
      // resultado y sí obligaría a tocar el grant de columnas — y porque las
      // builds viejas lo mandan igual. La regla vive en la base, que es donde se
      // puede verificar contra scheduled_date/time.
      cancelled_late: isCancelLate(p.scheduledDate, p.scheduledTime),
    })
    .eq('id', p.bookingId)
    // El trigger es BEFORE UPDATE, así que la fila que vuelve ya trae el
    // `payment_status` Y el `cancelled_late` que él decidió. Es la forma de
    // saber qué pasó con la plata sin duplicar acá la regla de las 24hs — y
    // ahora además significa que el mensaje que ve la persona sigue la decisión
    // del servidor, no la que había calculado su teléfono.
    .select('id, payment_status, payment_provider, cancelled_late');

  // Postgrest no devuelve error cuando RLS bloquea: devuelve 0 filas. Sin este
  // chequeo, la pantalla diría "cancelada" con la reserva intacta.
  if (error || !data || data.length === 0) {
    return { ok: false, error: error?.message ?? 'No se pudo cancelar. Probá de nuevo' };
  }

  const fila = data[0] as { payment_status: string; payment_provider: string | null; cancelled_late: boolean | null };
  const refund: RefundOutcome =
    fila.payment_status === 'reembolso_pendiente'
      ? (fila.payment_provider === 'usdt' ? 'usdt' : 'mp')
      : fila.payment_status === 'aprobado' && fila.cancelled_late
        ? 'tardia'
        : 'sin_pago';

  // Lo que sigue es best-effort: la reserva YA está cancelada. Si falla el aviso
  // no se revierte nada — sería peor dejarla viva por no haber podido notificar.
  if (p.salaId) {
    await supabase.from('messages').insert({
      sala_id: p.salaId,
      sender_id: p.actorId,
      sender_type: 'system_cancelled',
      content: encryptMessage(
        `${esCoach ? 'El profesional' : 'El usuario'} canceló la sesión\n${p.fechaLegible} · ${horaLegible} hs`,
      ),
    }).then(({ error: e }) => { if (e) console.warn('[cancel] mensaje de sistema:', e.message); });
  }

  if (p.recipientId) {
    const title = 'Sesión cancelada';
    const body = esCoach
      ? 'Tu profesional canceló la sesión agendada'
      : 'El usuario canceló la sesión agendada';

    const { data: perfil } = await supabase
      .from('profiles').select('push_token').eq('id', p.recipientId).maybeSingle();

    await Promise.all([
      supabase.from('notifications').insert({
        recipient_id: p.recipientId,
        type: 'reserva_cancelada',
        booking_id: p.bookingId,
        title,
        body,
      }),
      perfil?.push_token ? sendPushNotification(perfil.push_token, title, body) : Promise.resolve(),
    ]).catch(e => console.warn('[cancel] no se pudo notificar:', e));
  }

  return { ok: true, refund };
}

/** El mensaje que ve la persona después de cancelar.
 *
 *  Existe acá y no en cada pantalla porque son tres pantallas las que cancelan
 *  (el carrusel, la sala, y el coach) y el texto sobre la plata tiene que ser
 *  el mismo en las tres. Un usuario que lee "te devolvemos el dinero" en un
 *  lado y nada en el otro, escribe a soporte.
 *
 *  El "puede tardar unos días" no es un descargo: Mercado Pago procesa el
 *  reembolso al instante, pero el banco emisor tarda en reflejarlo en el
 *  resumen. Sin decirlo, la persona da por hecho que no le devolvieron nada.
 */
export function refundMessage(refund: RefundOutcome): { title: string; body: string } {
  switch (refund) {
    case 'mp':
      return {
        title: 'Sesión cancelada',
        body: 'Te devolvemos el total a tu medio de pago. El reembolso sale ahora, pero puede tardar unos días en aparecer en tu resumen — depende de tu banco, no de nosotros.',
      };
    case 'usdt':
      return {
        title: 'Sesión cancelada',
        body: 'Te devolvemos el total. Necesitamos que nos digas a qué dirección mandártelo: vas a ver el aviso en Sesiones.',
      };
    case 'tardia':
      return {
        title: 'Sesión cancelada',
        body: 'Como la cancelaste con menos de 24hs de anticipación, no corresponde reembolso. El profesional ya había reservado ese tiempo.',
      };
    case 'sin_pago':
      return { title: 'Sesión cancelada', body: 'Liberamos ese horario.' };
  }
}
