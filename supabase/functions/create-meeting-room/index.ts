// create-meeting-room — prepara la videollamada de una reserva.
//
// Devuelve DOS cosas distintas y no hay que confundirlas:
//
//   · `room_url`  — la URL pelada de la sala. Es estable, es la que se guarda en
//                   `bookings.meeting_url`, y es la que usa `session-attendance`
//                   para cruzar la asistencia. **No sirve para entrar.**
//   · `url`       — la URL de entrada PARA QUIEN LLAMÓ: `room_url?t=<token>`.
//                   Es por participante y vence con la sesión. **Nunca se
//                   guarda** — ni en la base, ni en el estado de la pantalla,
//                   ni en el calendario del teléfono.
//
// 🔴 POR QUÉ EL TOKEN: la sala se crea `privacy: 'private'`, y a una sala privada
// de Daily no se entra abriendo su URL. Hay dos formas y hasta el 28/08/2026 no
// estaba ninguna: un meeting token, o `enable_knocking: true` con un owner
// adentro que admita a mano. Sin eso el botón "Unirse" abría una pantalla de
// permiso denegado. No se había detectado porque en el plan gratuito de Daily
// fallaba antes, en la creación misma de la sala privada — así que el camino de
// entrada nunca se pudo probar de punta a punta.
//
// Por eso el token se acuña en CADA llamada y la función ya no corta temprano
// cuando la sala existe: la sala se reusa, el token no. Es de un solo
// participante (`user_name`, `user_id`) y el coach entra como owner.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { scheduledAtMs } from '../_shared/guarantee.ts'

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DAILY_API = 'https://api.daily.co/v1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const dailyHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${DAILY_API_KEY}`,
}

/**
 * La sala de esta reserva, creándola si todavía no existe.
 *
 * 🔴 El caso "ya existe" no es raro ni es un error: la sala se crea al confirmar
 * y `bookings.meeting_url` se escribe DESPUÉS, en otra llamada a la base. Si esa
 * escritura falla, o si dos personas entran a la vez, el POST vuelve a intentar
 * crear un nombre que ya está tomado. Daily contesta 400 y hay que ir a
 * buscarla, no abortar — abortar dejaría la sesión sin sala teniéndola.
 */
async function ensureRoom(roomName: string, nbf: number, exp: number): Promise<string> {
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: { nbf, exp },
    }),
  })

  if (res.ok) {
    const room = await res.json()
    return room.url as string
  }

  const detail = await res.text()

  // Nombre ya tomado → la sala es nuestra y ya está bien configurada.
  if (res.status === 400 && /exist/i.test(detail)) {
    const get = await fetch(`${DAILY_API}/rooms/${encodeURIComponent(roomName)}`, {
      headers: dailyHeaders,
    })
    if (get.ok) {
      const room = await get.json()
      return room.url as string
    }
    throw new Error(`Daily: la sala ${roomName} existe pero no se pudo leer (${get.status})`)
  }

  throw new Error(`Daily /rooms respondió ${res.status}: ${detail}`)
}

/** El pase de entrada de UNA persona a esa sala. Vence con la sesión. */
async function mintToken(opts: {
  roomName: string
  userName: string
  userId: string
  isOwner: boolean
  nbf: number
  exp: number
}): Promise<string> {
  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_name: opts.userName,
        user_id: opts.userId,
        is_owner: opts.isOwner,
        nbf: opts.nbf,
        exp: opts.exp,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Daily /meeting-tokens respondió ${res.status}: ${await res.text()}`)
  }

  const body = await res.json()
  const token = body.token as string | undefined
  if (!token) throw new Error('Daily /meeting-tokens no devolvió token')
  return token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
    }

    const { booking_id } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'Missing booking_id' }), { status: 400, headers: cors })
    }

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, user_id, scheduled_date, scheduled_time, duration_minutes, sala_id, meeting_url')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: cors })
    }

    // Validar que el caller es participante de la sala
    const { data: sala } = await supabase
      .from('salas')
      .select('user_id, coach_id')
      .eq('id', booking.sala_id)
      .single()

    if (!sala || (sala.user_id !== user.id && sala.coach_id !== user.id)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors })
    }

    // Calcular ventana de la sala
    //
    // 🔴 Antes: `new Date(year, month - 1, day, h, m, 0)`. Ese constructor
    // interpreta los componentes en la zona horaria DEL RUNTIME, y las edge
    // functions corren en UTC — mientras que `scheduled_date`/`scheduled_time`
    // son hora local de Argentina, sin zona guardada. Una sesión de las 15:00
    // ART se calculaba como 15:00 UTC (12:00 ART): la sala abría 3 horas antes
    // y, con `exp` = fin + 1h, **expiraba antes de que la sesión empezara**.
    // Nadie podía entrar.
    //
    // `scheduledAtMs` aplica el offset fijo de Argentina (no hay horario de
    // verano) y ya valida la forma de los campos — es el mismo helper que usa
    // `guarantee-claim`, y el criterio que ya usaban los crons en SQL con
    // `AT TIME ZONE 'America/Argentina/Buenos_Aires'`. Esta función era la
    // única que había quedado afuera.
    const startMs = scheduledAtMs(booking.scheduled_date as string, booking.scheduled_time as string)
    if (!Number.isFinite(startMs)) {
      console.error('[create-meeting-room] fecha/hora ilegible:', booking.scheduled_date, booking.scheduled_time)
      return new Response(
        JSON.stringify({ error: 'Fecha de la sesión inválida' }),
        { status: 422, headers: cors }
      )
    }
    const durationMs = ((booking.duration_minutes as number | null) ?? 60) * 60 * 1000
    const endMs = startMs + durationMs

    const nbf = Math.floor((startMs - 15 * 60 * 1000) / 1000) // 15 min antes
    const exp = Math.floor((endMs + 60 * 60 * 1000) / 1000)   // 1h después del fin

    const roomName = `vive-${(booking_id as string).replace(/-/g, '').slice(0, 16)}`

    // La sala se reusa; el token no. Si ya hay URL guardada nos ahorramos el
    // viaje a Daily, pero el token igual se acuña abajo — es lo que caducó.
    let roomUrl = (booking.meeting_url as string | null) ?? null
    if (!roomUrl) {
      roomUrl = await ensureRoom(roomName, nbf, exp)
      await supabase
        .from('bookings')
        .update({ meeting_url: roomUrl })
        .eq('id', booking_id)
    }

    // El nombre que ve la otra persona en la llamada. Si el perfil no tiene
    // nombre no se corta: Daily acepta el token igual y se muestra el genérico.
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const isCoach = sala.coach_id === user.id

    const token = await mintToken({
      roomName,
      userName: ((profile?.name as string | null) ?? '').trim() || (isCoach ? 'Profesional' : 'Invitado'),
      userId: user.id,
      // El coach es el dueño de la llamada: es quien la conduce, y el owner es
      // el único que puede admitir a alguien si algún día se prende el knocking.
      isOwner: isCoach,
      nbf,
      exp,
    })

    return new Response(
      JSON.stringify({ url: `${roomUrl}?t=${token}`, room_url: roomUrl }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[create-meeting-room] unexpected error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
