// send-push — manda un push a un destinatario SIN que el que llama tenga que
// leer su `push_token`.
//
// 🔴 POR QUÉ EXISTE (A4, docs/problemas-abiertos.md). Hasta acá el envío de push
// era client-side en 6 lugares: el que mandaba leía el `push_token` del que
// recibía desde el dispositivo (`select push_token from profiles`). Eso obligaba
// a que CUALQUIER usuario logueado pudiera leer el `push_token` (y el mail) de
// todos los coaches — el mismo agujero que se cerró para `anon` en la sesión
// 205, una puerta más adentro. Con el envío acá, el token se lee con service
// role y `authenticated` puede dejar de verlo (fase 3 de A4).
//
// 🔴 EL VECTOR QUE ESTO NO PUEDE ABRIR: si la función aceptara
// `{ recipientId, title, body }` a secas, cualquiera con una cuenta podría
// mandarle un push a cualquier otro. Por eso valida la RELACIÓN: el que llama
// tiene que compartir con el destinatario la sala o el booking que declara. Es
// la misma lógica que ya tenía el cliente por RLS, movida al server.
//
// El patrón (service role + getUser del caller) es el de create-meeting-room.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function enviarPush(token: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, sound: 'default', title, body }),
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // Un solo client con service role: identifica al caller por su JWT y de paso
    // sirve para leer el token del destinatario saltando la RLS (que es
    // justamente lo que `authenticated` va a dejar de poder hacer).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authErr } = await admin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
    const callerId = user.id

    const { salaId, bookingId, recipientId, title, body } = await req.json()
    if (!recipientId || typeof title !== 'string' || typeof body !== 'string') {
      return json({ error: 'Missing recipientId/title/body' }, 400)
    }
    // Mandarse un push a uno mismo no es un error, pero tampoco se hace: los
    // llamadores nunca deberían, y si pasa lo cortamos sin ruido.
    if (recipientId === callerId) return json({ ok: true, skipped: 'self' })

    // ── Autorización por relación ────────────────────────────────────────────
    let autorizado = false

    if (salaId) {
      // Sala: los dos participantes son `user_id` y `coach_id` (ambos profiles.id).
      const { data: sala } = await admin
        .from('salas')
        .select('user_id, coach_id')
        .eq('id', salaId)
        .maybeSingle()
      if (sala) {
        const participantes = [sala.user_id, sala.coach_id]
        autorizado = participantes.includes(callerId) && participantes.includes(recipientId)
      }
    } else if (bookingId) {
      const { data: booking } = await admin
        .from('bookings')
        .select('user_id, coach_id, scheduled_date, scheduled_time')
        .eq('id', bookingId)
        .maybeSingle()
      if (booking) {
        // `bookings.coach_id` es `coaches.id` (el PK), no el profile. El push
        // vive en `profiles`, que se alcanza por `coaches.profile_id`.
        const { data: coach } = await admin
          .from('coaches')
          .select('profile_id')
          .eq('id', booking.coach_id)
          .maybeSingle()
        const participantes = [booking.user_id, coach?.profile_id].filter(Boolean)

        if (participantes.includes(callerId)) {
          if (participantes.includes(recipientId)) {
            autorizado = true
          } else {
            // ¿El destinatario es un "competidor"? — un usuario con un booking en
            // el MISMO coach, día y hora, o sea uno de los que se cancelan al
            // confirmar otra reserva del mismo slot. Se busca SIN filtrar por
            // status a propósito: para cuando llega este push el cliente ya lo
            // pasó a 'cancelada'.
            const { data: comp } = await admin
              .from('bookings')
              .select('id')
              .eq('coach_id', booking.coach_id)
              .eq('scheduled_date', booking.scheduled_date)
              .eq('scheduled_time', booking.scheduled_time)
              .eq('user_id', recipientId)
              .limit(1)
            autorizado = !!comp && comp.length > 0
          }
        }
      }
    } else {
      return json({ error: 'Missing salaId or bookingId' }, 400)
    }

    if (!autorizado) return json({ error: 'Forbidden' }, 403)

    // ── Envío ────────────────────────────────────────────────────────────────
    const { data: perfil } = await admin
      .from('profiles')
      .select('push_token')
      .eq('id', recipientId)
      .maybeSingle()
    if (!perfil?.push_token) return json({ ok: true, skipped: 'no-token' })

    try {
      await enviarPush(perfil.push_token, title, body)
    } catch (e) {
      // Best-effort, igual que cuando era client-side: un push que no sale no es
      // un error del que llamó.
      console.error('[send-push] exp.host falló:', e)
    }
    return json({ ok: true })
  } catch (e) {
    console.error('[send-push] error:', e)
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
