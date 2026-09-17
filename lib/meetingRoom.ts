import { Linking, Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
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

/**
 * Abre la videollamada. Las dos pantallas que entran a la sala (la Sala y el
 * carrusel de próximas sesiones) llaman a esto y no a un navegador directo.
 *
 * 🔴 EN iPHONE NO PUEDE SER EL NAVEGADOR IN-APP. `WebBrowser.openBrowserAsync`
 * en iOS es `SFSafariViewController`, y ahí el permiso de cámara y micrófono
 * (`getUserMedia`, que es de lo que vive Daily) **no se pide de forma
 * confiable**: a veces aparece, a veces se deniega solo y la persona entra a la
 * sesión sin imagen ni voz, sin ningún mensaje que explique por qué. Es una
 * limitación conocida de Apple (los foros de desarrolladores lo documentan desde
 * iOS 14) y no hay opción de `openBrowserAsync` que la esquive: la lista entera
 * de opciones de iOS es color, botón de cerrar, estilo de presentación y modo
 * lectura. La alternativa dentro de la app sería un WKWebView propio
 * (`react-native-webview`), que sí soporta getUserMedia desde iOS 14.3, pero eso
 * es una dependencia nueva y permisos nativos declarados; se puede hacer después
 * si vale la pena recuperar el "no salir de la app".
 *
 * Así que en iOS se abre **Safari de verdad** con `Linking.openURL`. El costo es
 * real y conocido: la persona sale de Vita y vuelve sola. Se paga igual, porque
 * una sesión de terapia muda es peor que un cambio de app — es, textual, la
 * queja técnica más repetida contra el competidor que hace lo mismo
 * (`docs/competencia-selia.md` §24.3).
 *
 * En Android el navegador in-app es una Custom Tab, o sea Chrome de verdad con
 * su permiso normal, así que se queda como estaba. En web ya estamos en un
 * navegador; `openBrowserAsync` abre otra pestaña.
 *
 * Devuelve `false` solo si no se pudo abrir nada, para que la pantalla lo diga
 * en vez de quedarse muda.
 */
export async function abrirVideollamada(url: string): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL(url)
      return true
    } catch (e) {
      // Que `openURL` falle acá es raro (es una URL https), pero si pasa, el
      // navegador in-app es mejor que nada: puede que la cámara ande.
      console.warn('[meetingRoom] Linking.openURL fallo, abro in-app:', e)
    }
  }
  try {
    await WebBrowser.openBrowserAsync(url)
    return true
  } catch (e) {
    console.error('[meetingRoom] no se pudo abrir la videollamada:', e)
    return false
  }
}

/** El título del aviso, compartido por las dos pantallas que entran a la sala. */
export function tituloDeAviso(estado: 'temprano' | 'terminada'): string {
  return estado === 'terminada' ? 'La sesión terminó' : 'Todavía no es la hora'
}
