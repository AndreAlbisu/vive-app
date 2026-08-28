import { supabase } from './supabase'

/**
 * La videollamada tiene DOS URLs y confundirlas rompe la entrada:
 *
 *   · la sala (`room_url`) es estable y se puede guardar y mostrar, pero es
 *     privada — abrirla sola da pantalla de permiso denegado;
 *   · la entrada (`url`) lleva un token de un solo participante que vence con
 *     la sesión, y por eso se pide en el momento de entrar y no se guarda.
 *
 * Las dos salen de la misma edge function; lo que cambia es cuál se usa.
 */
type MeetingRoomResponse = { url?: string; room_url?: string }

async function callCreateMeetingRoom(bookingId: string): Promise<MeetingRoomResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-meeting-room', {
      body: { booking_id: bookingId },
    })
    if (error) {
      console.error('[meetingRoom] Edge function error:', error)
      return null
    }
    return (data as MeetingRoomResponse) ?? null
  } catch (e) {
    console.error('[meetingRoom] unexpected error:', e)
    return null
  }
}

/**
 * Deja la sala creada y devuelve su URL pelada. Es la que se guarda y la que
 * sirve para saber si la sala ya está lista — **no** para entrar.
 *
 * Se llama en segundo plano al confirmar la reserva, para que la sala exista
 * antes de que alguien la necesite.
 */
export async function ensureMeetingRoom(bookingId: string): Promise<string | null> {
  const res = await callCreateMeetingRoom(bookingId)
  return res?.room_url ?? null
}

/**
 * La URL con la que ESTA persona entra, ahora. Se abre y se descarta:
 * guardarla la deja vencida, y compartirla le da a otro tu identidad en la
 * llamada. Pedila siempre al momento de abrir la videollamada.
 */
export async function getJoinUrl(bookingId: string): Promise<string | null> {
  const res = await callCreateMeetingRoom(bookingId)
  return res?.url ?? null
}
