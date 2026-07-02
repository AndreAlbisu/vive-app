import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Idempotente: si ya tiene URL, devuélvela
    if (booking.meeting_url) {
      return new Response(
        JSON.stringify({ url: booking.meeting_url }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
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
    const [year, month, day] = (booking.scheduled_date as string).split('-').map(Number)
    const [h, m] = (booking.scheduled_time as string).split(':').map(Number)
    const startMs = new Date(year, month - 1, day, h, m, 0).getTime()
    const durationMs = ((booking.duration_minutes as number | null) ?? 60) * 60 * 1000
    const endMs = startMs + durationMs

    const nbf = Math.floor((startMs - 15 * 60 * 1000) / 1000) // 15 min antes
    const exp = Math.floor((endMs + 60 * 60 * 1000) / 1000)   // 1h después del fin

    const roomName = `vive-${(booking_id as string).replace(/-/g, '').slice(0, 16)}`

    const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: { nbf, exp },
      }),
    })

    if (!dailyRes.ok) {
      const detail = await dailyRes.text()
      console.error('[create-meeting-room] Daily API error:', detail)
      return new Response(
        JSON.stringify({ error: 'Daily API error', detail }),
        { status: 502, headers: cors }
      )
    }

    const room = await dailyRes.json()
    const meetingUrl = room.url as string

    await supabase
      .from('bookings')
      .update({ meeting_url: meetingUrl })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ url: meetingUrl }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[create-meeting-room] unexpected error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
