// booking-effects — los efectos de una reserva cuyo pago ACABA de acreditarse,
// del lado del servidor.
//
// Hasta la sesión 116 esto vivía SOLO en el cliente
// (`BookingScreen_Confirm.applyBookingEffects`), y podía: el checkout se abría
// EMBEBIDO en un `<WebView>`, así que la app quedaba en primer plano durante
// todo el pago, sondeaba `payment_status` y aplicaba los efectos ella misma.
//
// Desde la sesión 117 el checkout SALTA A LA APP NATIVA de Mercado Pago (o al
// browser, con PayPal): la app pasa a segundo plano y el sistema operativo
// puede matarla en cualquier momento. Con los efectos en el cliente, un pago
// aprobado con la app ya muerta dejaba plata cobrada, la reserva en 'pendiente'
// y al coach sin enterarse — el espejo exacto de las 27 reservas fantasma del
// 09/08/2026, cobrado-sin-confirmar en vez de confirmado-sin-cobrar.
//
// Ahora los aplica quien SIEMPRE está vivo: el proceso que acredita el pago.
// Los tres rieles lo llaman desde el mismo lugar — el punto en el que ganaron
// la carrera por marcar `payment_status = 'aprobado'`:
//   · mp-webhook           (Mercado Pago)
//   · paypal-webhook       (PayPal)
//   · usdt-check-payments  (USDT, por cron)
//
// ⚠️ IDEMPOTENCIA: esta función NO se defiende sola de correr dos veces. Los
// tres llamadores ya reclaman la transición con un update condicional que
// devuelve filas solo la primera vez (`.eq('payment_status','pendiente')` o
// `.neq('payment_status','aprobado')` + `.select('id')`), y solo llaman acá si
// ganaron. Llamarla sin ese reclamo duplica el push al coach y el mensaje de
// sistema en la sala. El paso de 'pendiente' → 'confirmada' sí lleva su propia
// guarda, porque ahí compite además con el coach aceptando a mano.

// deno-lint-ignore no-explicit-any
type Admin = any

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  // Mediodía UTC para que el día del mes no se corra por zona horaria: la edge
  // function corre en UTC y `scheduled_date` es una fecha local sin zona.
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return `${DAY_NAMES[date.getUTCDay()]}, ${day} de ${MONTH_NAMES[month - 1]}`
}

// Mismo cifrado que `lib/encryption.ts` en el cliente — XOR + base64. No es
// cifrado de verdad (es obfuscación), pero los mensajes de sistema tienen que
// quedar guardados con el MISMO formato que los del cliente o `decryptMessage`
// los muestra como basura al abrir la sala.
//
// ⚠️ La clave TIENE que ser la misma de las dos puntas: `MESSAGE_ENCRYPTION_KEY`
// acá y `EXPO_PUBLIC_ENCRYPTION_KEY` en el `.env` de la app. Si no coincide, el
// mensaje se escribe igual y se lee ilegible.
const ENCRYPTION_KEY = Deno.env.get('MESSAGE_ENCRYPTION_KEY') ?? 'vive_mvp_key_2026'

export function encryptMessage(text: string): string {
  try {
    const plain = encodeURIComponent(text)
    let out = ''
    for (let i = 0; i < plain.length; i++) {
      out += String.fromCharCode(plain.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return btoa(out)
  } catch {
    return text
  }
}

async function sendPush(token: string | null | undefined, title: string, body: string) {
  if (!token) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, sound: 'default', title, body }),
    })
  } catch (e) {
    // Un push que no sale no puede tumbar la acreditación del pago.
    console.error('[booking-effects] push falló:', e)
  }
}

/**
 * Aplica todo lo que hasta ahora hacía `applyBookingEffects` en el cliente,
 * para una reserva cuyo pago acaba de quedar 'aprobado'.
 *
 * - Siempre: le avisa al coach (solicitud nueva, o reserva ya confirmada).
 * - Solo si el coach tiene `instant_booking`: pasa la reserva a 'confirmada',
 *   notifica al usuario, deja el mensaje de sistema en la sala y cancela las
 *   solicitudes de otras personas que competían por el mismo horario.
 *
 * No crea la sala de Daily a propósito: `SalaScreen` la crea sola la primera
 * vez que alguien entra (`createOrGetMeetingUrl`), así que acá sería solo un
 * adelanto, y `create-meeting-room` exige el JWT de un participante — que un
 * webhook no tiene.
 */
export async function applyPaidBookingEffects(admin: Admin, bookingId: string): Promise<void> {
  const { data: booking, error: errBooking } = await admin
    .from('bookings')
    .select('id, user_id, coach_id, sala_id, coach_name, scheduled_date, scheduled_time, status, user_message')
    .eq('id', bookingId)
    .maybeSingle()

  if (errBooking || !booking) {
    console.error('[booking-effects] no se pudo leer la reserva', bookingId, errBooking?.message)
    return
  }

  // Pago aprobado sobre una reserva ya cancelada: no hay nada que confirmar ni a
  // quién avisarle. El reembolso lo encola quien llamó acá (mp-webhook) o el
  // trigger `trg_mark_refund_on_cancel`.
  if (booking.status === 'cancelada') {
    console.warn('[booking-effects] reserva cancelada, no se aplican efectos:', bookingId)
    return
  }

  // `bookings.coach_id` es `coaches.id`; el push token vive en `profiles`, que
  // se alcanza por `coaches.profile_id` (reglas 1 y 2 de SCHEMA.md).
  const { data: coach } = await admin
    .from('coaches')
    .select('profile_id, instant_booking')
    .eq('id', booking.coach_id)
    .maybeSingle()

  const isInstant = !!coach?.instant_booking
  const fecha = formatDate(booking.scheduled_date as string)
  const hora = booking.scheduled_time as string
  const coachName = (booking.coach_name as string | null) ?? 'tu coach'

  const [{ data: coachProfile }, { data: userProfile }] = await Promise.all([
    coach?.profile_id
      ? admin.from('profiles').select('push_token').eq('id', coach.profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('profiles').select('name').eq('id', booking.user_id).maybeSingle(),
  ])

  const userName = (userProfile?.name as string | null) ?? 'Un usuario'

  await sendPush(
    coachProfile?.push_token,
    isInstant ? 'Nueva reserva confirmada 📅' : 'Nueva solicitud de sesión 📅',
    isInstant
      ? `${userName} reservó una sesión el ${fecha} a las ${hora} hs. Ya está confirmada.`
      : `${userName} quiere reservar una sesión el ${fecha} a las ${hora} hs`,
  )

  // Sin reserva instantánea la sesión sigue siendo una SOLICITUD: la confirma el
  // coach desde CoachReservasScreen, con los mismos efectos de abajo. Pagar no
  // saltea esa decisión.
  if (!isInstant) return

  // Guarda propia: acá se compite con el coach aceptando a mano en el mismo
  // instante. Solo sigue quien de verdad hizo la transición.
  const { data: confirmada } = await admin
    .from('bookings')
    .update({ status: 'confirmada' })
    .eq('id', booking.id)
    .eq('status', 'pendiente')
    .select('id')

  if (!confirmada || confirmada.length === 0) {
    console.warn('[booking-effects] la reserva ya no estaba pendiente, no se confirma:', bookingId)
    return
  }

  const notifTitle = '¡Tu sesión fue confirmada! ✅'
  const notifBody = `Tu sesión con ${coachName} el ${fecha} está confirmada`

  await admin.from('notifications').insert({
    recipient_id: booking.user_id,
    type: 'reserva_confirmada',
    booking_id: booking.id,
    title: notifTitle,
    body: notifBody,
  })

  const mensajeUsuario = (booking.user_message as string | null)?.trim()
  const confirmLine1 = `Sesión reservada · ${fecha} · ${hora} hs`
  const confirmMsg = mensajeUsuario ? `${confirmLine1}\n${mensajeUsuario}` : confirmLine1

  if (booking.sala_id) {
    await admin.from('messages').insert({
      sala_id: booking.sala_id,
      sender_id: booking.user_id,
      sender_type: 'system_confirmed',
      content: encryptMessage(confirmMsg),
    })
  }

  await cancelarCompetidores(admin, booking, fecha, hora)
}

// Las otras solicitudes 'pendiente' por el mismo coach, día y hora. El horario
// ya es de quien pagó: al resto se le cancela, se le avisa y se le deja el
// mensaje de sistema en su propia sala.
// deno-lint-ignore no-explicit-any
async function cancelarCompetidores(admin: Admin, booking: any, fecha: string, hora: string) {
  const { data: conflicting } = await admin
    .from('bookings')
    .select('id, user_id, sala_id')
    .eq('coach_id', booking.coach_id)
    .eq('scheduled_date', booking.scheduled_date)
    .eq('scheduled_time', booking.scheduled_time)
    .eq('status', 'pendiente')
    .neq('id', booking.id)

  if (!conflicting?.length) return

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, push_token')
    // deno-lint-ignore no-explicit-any
    .in('id', conflicting.map((c: any) => c.user_id))

  const tokenMap: Record<string, string | null> = {}
  // deno-lint-ignore no-explicit-any
  profiles?.forEach((p: any) => { tokenMap[p.id] = p.push_token ?? null })

  const cancelTitle = 'Horario no disponible'
  const cancelBody = 'Ese horario ya no está disponible. Podés elegir otro horario con tu profesional'
  const cancelSystemMsg = `Solicitud cancelada automáticamente\n${fecha} · ${hora} hs`

  await Promise.all(
    // deno-lint-ignore no-explicit-any
    conflicting.map(async (cb: any) => {
      // 🔴 La cancelación va PRIMERO y sola: si el pago de esta competidora ya
      // estaba aprobado, `trg_mark_refund_on_cancel` la marca
      // 'reembolso_pendiente' en esta misma transición. Avisarle a alguien que
      // su reserva se cayó sin haber disparado el reembolso sería lo peor de
      // los dos mundos.
      await admin.from('bookings').update({ status: 'cancelada' }).eq('id', cb.id)

      const ops: Promise<unknown>[] = [
        admin.from('notifications').insert({
          recipient_id: cb.user_id,
          type: 'reserva_cancelada',
          booking_id: cb.id,
          title: cancelTitle,
          body: cancelBody,
        }),
        sendPush(tokenMap[cb.user_id], cancelTitle, cancelBody),
      ]
      if (cb.sala_id) {
        ops.push(
          admin.from('messages').insert({
            sala_id: cb.sala_id,
            // El mensaje de sistema va firmado por el dueño de ESA sala, no por
            // quien ganó el horario: en el cliente iba `user.id` (el que
            // reservaba), que en la sala ajena es alguien que no participa.
            sender_id: cb.user_id,
            sender_type: 'system_cancelled',
            content: encryptMessage(cancelSystemMsg),
          }),
        )
      }
      await Promise.all(ops)
    }),
  )
}
