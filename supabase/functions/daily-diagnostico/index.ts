// daily-diagnostico — se deploya, se lee el veredicto, y se BORRA el deploy.
// El archivo queda en el repo, igual que `paypal-diagnostico`: el chequeo vuelve
// a hacer falta entero el día que se cambie de cuenta o de plan en Daily.
//
// Se hace desde adentro y no mirando el dashboard porque `supabase secrets list`
// devuelve los valores HASHEADOS: desde afuera no hay forma de saber si la key
// que está cargada es la de la cuenta nueva o la vieja. Este es el único lugar
// donde la credencial se puede probar de verdad.
//
// Contesta las cuatro cosas que deciden si la videollamada puede funcionar:
//
//   1. ¿La key autentica, y contra qué dominio de Daily?
//   2. ¿El plan deja crear una sala PRIVADA por API? (en el gratuito no, y ese
//      fue el bloqueante desde julio)
//   3. ¿Se puede acuñar un meeting token para esa sala? (sin token no se entra
//      a una sala privada, aunque la creación ande)
//   4. ¿Se puede consultar `/meetings`? (es de lo que vive `session-attendance`,
//      la prueba de asistencia para disputas)
//
// Limpia lo que crea: la sala de prueba se borra al final, pase lo que pase.
// No devuelve ninguna credencial ni el token — solo largos y veredictos.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') ?? ''
const DAILY_API = 'https://api.daily.co/v1'

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${DAILY_API_KEY}`,
}

type Check = { ok: boolean; detalle: string }

serve(async () => {
  const out: Record<string, unknown> = {}
  const roomName = `vive-diag-${Date.now().toString(36)}`
  let creada = false

  if (!DAILY_API_KEY) {
    return new Response(
      JSON.stringify({ veredicto: 'FALTA DAILY_API_KEY en los secrets' }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  out.key_length = DAILY_API_KEY.length

  // 1 — ¿autentica? ¿qué dominio?
  let c1: Check
  try {
    const res = await fetch(`${DAILY_API}/`, { headers })
    const body = await res.text()
    if (res.ok) {
      const json = JSON.parse(body)
      c1 = { ok: true, detalle: `dominio: ${json.domain_name ?? '(sin domain_name)'}` }
      out.domain_name = json.domain_name ?? null
    } else {
      c1 = { ok: false, detalle: `GET /v1/ → ${res.status}: ${body.slice(0, 300)}` }
    }
  } catch (e) {
    c1 = { ok: false, detalle: String(e) }
  }
  out['1_autentica'] = c1

  // 2 — ¿sala privada por API? Es lo que el plan gratuito NO deja.
  let c2: Check
  const ahora = Math.floor(Date.now() / 1000)
  try {
    const res = await fetch(`${DAILY_API}/rooms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: { nbf: ahora, exp: ahora + 600 },
      }),
    })
    const body = await res.text()
    if (res.ok) {
      creada = true
      const json = JSON.parse(body)
      c2 = { ok: json.privacy === 'private', detalle: `creada, privacy = ${json.privacy}` }
    } else {
      c2 = { ok: false, detalle: `POST /v1/rooms → ${res.status}: ${body.slice(0, 300)}` }
    }
  } catch (e) {
    c2 = { ok: false, detalle: String(e) }
  }
  out['2_sala_privada'] = c2

  // 3 — ¿meeting token? Sin esto la sala privada se crea y NADIE puede entrar.
  let c3: Check
  if (!creada) {
    c3 = { ok: false, detalle: 'no se probó: la sala no se creó' }
  } else {
    try {
      const res = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: { room_name: roomName, user_name: 'diagnostico', is_owner: true, exp: ahora + 600 },
        }),
      })
      const body = await res.text()
      if (res.ok) {
        const token = JSON.parse(body).token as string | undefined
        c3 = token
          ? { ok: true, detalle: `token acuñado (${token.length} chars, no se muestra)` }
          : { ok: false, detalle: '200 pero sin campo token' }
      } else {
        c3 = { ok: false, detalle: `POST /v1/meeting-tokens → ${res.status}: ${body.slice(0, 300)}` }
      }
    } catch (e) {
      c3 = { ok: false, detalle: String(e) }
    }
  }
  out['3_meeting_token'] = c3

  // 4 — ¿/meetings? Es de lo que vive `session-attendance`.
  let c4: Check
  try {
    const res = await fetch(`${DAILY_API}/meetings?limit=1`, { headers })
    const body = await res.text()
    c4 = res.ok
      ? { ok: true, detalle: 'consultable' }
      : { ok: false, detalle: `GET /v1/meetings → ${res.status}: ${body.slice(0, 300)}` }
  } catch (e) {
    c4 = { ok: false, detalle: String(e) }
  }
  out['4_meetings'] = c4

  // Limpieza: la sala de prueba no se queda.
  if (creada) {
    try {
      const del = await fetch(`${DAILY_API}/rooms/${roomName}`, { method: 'DELETE', headers })
      out.limpieza = del.ok ? 'sala de prueba borrada' : `no se pudo borrar (${del.status}) — borrala a mano: ${roomName}`
    } catch (e) {
      out.limpieza = `no se pudo borrar: ${String(e)} — borrala a mano: ${roomName}`
    }
  }

  const todo = [c1, c2, c3, c4].every(c => c.ok)
  out.veredicto = todo
    ? 'TODO OK — la videollamada puede funcionar de punta a punta'
    : 'HAY ALGO ROTO — mirá qué chequeo dio ok:false'

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
