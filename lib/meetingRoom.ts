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
type MeetingRoomResponse = {
  url?: string
  room_url?: string
  // Fuera del horario de la sesión la función devuelve la sala pero no la
  // entrada, y dice por qué (ver `create-meeting-room`).
  fuera_de_horario?: boolean
  estado?: 'temprano' | 'terminada'
  error?: string
}

/** Lo que devuelve pedir la entrada: el link, o por qué todavía (o ya) no. */
export type Entrada =
  | { url: string }
  | { aviso: string; estado: 'temprano' | 'terminada' }
  | null

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
export async function getJoinUrl(bookingId: string): Promise<Entrada> {
  const res = await callCreateMeetingRoom(bookingId)
  if (res?.url) return { url: res.url }
  // 🔴 Antes, fuera de horario la función devolvía igual el link, y Daily
  // mostraba su pantalla en inglés. Ahora devuelve el motivo, y la pantalla
  // tiene que decirlo — no "no se pudo preparar la sala", que haría reintentar.
  if (res?.fuera_de_horario && res.error) {
    return { aviso: res.error, estado: res.estado === 'terminada' ? 'terminada' : 'temprano' }
  }
  return null
}

/** El título del aviso, compartido por las dos pantallas que entran a la sala. */
export function tituloDeAviso(estado: 'temprano' | 'terminada'): string {
  return estado === 'terminada' ? 'La sesión terminó' : 'Todavía no es la hora'
}
