// coachBookingActions — fuente única de las acciones del coach sobre una reserva.
//
// La lógica de confirmar/rechazar vivía dentro de CoachReservasScreen (accept /
// confirmReject). Se extrae acá SIN cambiarla para que Inicio (hub "Hoy") y
// Reservas la ejecuten idéntica (confirmar crea la sala Daily, notifica, inserta
// el mensaje de sistema y cancela conflictos). Ambas pantallas llaman a esto y
// después refrescan su propia data.

import { supabase, registrarEvento } from '@/lib/supabase';
import { notifyViaServer } from '@/lib/notifications';
import { encryptMessage } from '@/lib/encryption';
import { ensureMeetingRoom } from '@/lib/meetingRoom';

function formatBookingDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const monthName = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month - 1];
  return `${dayName} ${day} ${monthName}`;
}

// Confirma una solicitud pendiente. `coachAuthUserId` = profiles.id del coach
// (auth.uid()), usado como sender_id de los mensajes de sistema y para leer el
// nombre del coach en la notificación. Espeja CoachReservasScreen.accept().
export async function confirmBooking(bookingId: string, coachAuthUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmada' })
    .eq('id', bookingId)
    .select('id, user_id, coach_id, sala_id, scheduled_date, scheduled_time, user_message');
  if (error || !data?.[0]) return false;

  const booking = data[0];

  const [{ data: coachProfile }, { data: conflicting }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', coachAuthUserId).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, user_id, sala_id')
      .eq('coach_id', booking.coach_id)
      .eq('scheduled_date', booking.scheduled_date)
      .eq('scheduled_time', booking.scheduled_time)
      .eq('status', 'pendiente')
      .neq('id', bookingId),
  ]);

  const notifTitle = '¡Tu sesión fue confirmada! ✅';
  const notifBody = `Tu sesión con ${coachProfile?.name ?? 'tu profesional'} el ${formatBookingDate(booking.scheduled_date)} está confirmada`;

  await Promise.all([
    supabase.from('notifications').insert({
      recipient_id: booking.user_id,
      type: 'reserva_confirmada',
      booking_id: bookingId,
      title: notifTitle,
      body: notifBody,
    }),
    notifyViaServer({ bookingId, recipientId: booking.user_id, title: notifTitle, body: notifBody }),
    // Analytics: el coach ACEPTÓ una reserva pendiente. Distinto de
    // 'reserva_confirmada' (ese lo dispara el usuario al reservar). registrarEvento
    // anota user_id = coach (su sesión); client_id guarda al usuario de la reserva.
    registrarEvento('reserva_aceptada', {
      booking_id: bookingId,
      coach_id: booking.coach_id,
      client_id: booking.user_id,
      scheduled_date: booking.scheduled_date,
    }),
  ]);

  if (booking.sala_id) {
    const confirmDateStr = formatBookingDate(booking.scheduled_date);
    const confirmTimeStr = booking.scheduled_time.slice(0, 5);
    const confirmLine1 = `Sesión reservada · ${confirmDateStr} · ${confirmTimeStr} hs`;
    const confirmMsg = booking.user_message
      ? `${confirmLine1}\n${booking.user_message}`
      : confirmLine1;
    await supabase.from('messages').insert({
      sala_id: booking.sala_id,
      sender_id: coachAuthUserId,
      sender_type: 'system_confirmed',
      content: encryptMessage(confirmMsg),
    });
  }

  if (conflicting && conflicting.length > 0) {
    const cancelTitle = 'Horario no disponible';
    const cancelBody = 'Ese horario ya no está disponible. Podés elegir otro horario con tu profesional';
    const cancelDateStr = formatBookingDate(booking.scheduled_date);
    const cancelTimeStr = booking.scheduled_time.slice(0, 5);
    const cancelSystemMsg = `Solicitud cancelada automáticamente\n${cancelDateStr} · ${cancelTimeStr} hs`;

    await Promise.all(
      conflicting.map((cb) => {
        const ops: PromiseLike<unknown>[] = [
          supabase.from('bookings').update({ status: 'cancelada' }).eq('id', cb.id),
          supabase.from('notifications').insert({
            recipient_id: cb.user_id,
            type: 'reserva_cancelada',
            booking_id: cb.id,
            title: cancelTitle,
            body: cancelBody,
          }),
        ];
        if (cb.sala_id) {
          ops.push(
            supabase.from('messages').insert({
              sala_id: cb.sala_id,
              sender_id: coachAuthUserId,
              sender_type: 'system_cancelled',
              content: encryptMessage(cancelSystemMsg),
            })
          );
        }
        // El destinatario es un competidor: el push se autoriza porque comparte
        // con quien confirmó el mismo coach+día+hora. Se pasa el booking ganador
        // (`bookingId`) como contexto — el cliente ya pasó `cb` a 'cancelada'.
        ops.push(notifyViaServer({ bookingId, recipientId: cb.user_id, title: cancelTitle, body: cancelBody }));
        return Promise.all(ops);
      })
    );
  }

  // Crear sala de videollamada en Daily.co en segundo plano
  // Ídem `BookingScreen_Confirm`: recuperable al entrar a la sala, pero un
  // fallo sistemático de Daily no puede quedar sin rastro.
  ensureMeetingRoom(bookingId).catch((e) => {
    console.warn('[booking] no se pudo crear la sala de video:', bookingId, e?.message ?? e);
  });

  return true;
}

// Rechaza una solicitud pendiente. Espeja CoachReservasScreen.confirmReject().
export async function rejectBooking(bookingId: string, coachAuthUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelada' })
    .eq('id', bookingId)
    .select();
  if (error) return false;

  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return true;

  const { data: coachProfile } = await supabase
    .from('profiles').select('name').eq('id', coachAuthUserId).maybeSingle();

  const notifTitle = 'Ese horario no está disponible';
  const notifBody = `${coachProfile?.name ?? 'Tu profesional'} no puede en ese horario. Podés elegir otro horario disponible u otro profesional`;

  await Promise.all([
    supabase.from('notifications').insert({
      recipient_id: booking.user_id,
      type: 'reserva_rechazada',
      booking_id: bookingId,
      title: notifTitle,
      body: notifBody,
    }),
    notifyViaServer({ bookingId, recipientId: booking.user_id, title: notifTitle, body: notifBody }),
  ]);

  return true;
}
