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

export type CancelResult = { ok: true } | { ok: false; error: string };

export async function cancelBookingFlow(p: CancelBookingParams): Promise<CancelResult> {
  const horaLegible = p.scheduledTime.slice(0, 5);
  const esCoach = p.actorRole === 'coach';

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelada',
      cancelled_by: p.actorRole,
      // Lo usa trg_mark_refund_on_cancel: una cancelación tardía DEL USUARIO
      // pierde el reembolso; la del coach no.
      cancelled_late: isCancelLate(p.scheduledDate, p.scheduledTime),
    })
    .eq('id', p.bookingId)
    .select('id');

  // Postgrest no devuelve error cuando RLS bloquea: devuelve 0 filas. Sin este
  // chequeo, la pantalla diría "cancelada" con la reserva intacta.
  if (error || !data || data.length === 0) {
    return { ok: false, error: error?.message ?? 'No se pudo cancelar. Probá de nuevo' };
  }

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

  return { ok: true };
}
