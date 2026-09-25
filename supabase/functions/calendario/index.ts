// calendario — el calendario de sesiones de un profesional, para suscribirse
// desde Google Calendar o el calendario del iPhone (24/09/2026).
//
// GET /functions/v1/calendario?t=<token>  →  text/calendar (iCalendar, RFC 5545)
//
// Pública (`verify_jwt = false`): una app de calendario no manda credenciales,
// solo pide la URL cada tanto. El control es el token: 256 bits al azar, uno por
// profesional, regenerable (`mi_link_calendario(true)`), y con tope de lecturas.
//
// 🔴 Qué NO sale acá: el nombre del cliente, el chat, el link de la sala. Solo
// horarios con el título "Sesión · Vita". Ver `scripts/add-calendario-profesional.sql`.
//
// 📌 Las sesiones canceladas simplemente no están: cuando la app de calendario
// vuelve a leer, las borra sola. Una sesión movida conserva su UID (el id de la
// reserva), así que se actualiza en el lugar en vez de duplicarse.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOKEN_OK = /^[0-9a-f]{64}$/

// Google y Apple vuelven a leer por su cuenta (Google cada varias horas); 120
// lecturas por hora por link sobra para cualquier app y frena a un script.
const TOPE_POR_HORA = 120

function utc(iso: string): string {
  // 2026-09-24T13:00:00+00:00 → 20260924T130000Z
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// RFC 5545: líneas de hasta 75 octetos, CRLF.
function plegar(linea: string): string {
  const out: string[] = []
  let resto = linea
  while (new TextEncoder().encode(resto).length > 75) {
    let corte = 75
    while (new TextEncoder().encode(resto.slice(0, corte)).length > 75) corte--
    out.push(resto.slice(0, corte))
    resto = ' ' + resto.slice(corte)
  }
  out.push(resto)
  return out.join('\r\n')
}

serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Método no permitido', { status: 405 })
  }
  const token = new URL(req.url).searchParams.get('t') ?? ''
  // Mismo 404 para un token mal formado y uno que no existe: no se le dice a
  // nadie cuál de los dos probó.
  if (!TOKEN_OK.test(token)) return new Response('No encontrado', { status: 404 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: dentro, error: errTope } = await admin.rpc('consume_rate_limit', {
    p_bucket: 'calendario', p_subject: token, p_max: TOPE_POR_HORA, p_window: '1 hour',
  })
  if (errTope) return new Response('No disponible', { status: 503 })
  if (!dentro) return new Response('Demasiadas lecturas', { status: 429 })

  const { data: existe } = await admin
    .from('coach_calendar_feeds').select('coach_id').eq('token', token).maybeSingle()
  if (!existe) return new Response('No encontrado', { status: 404 })

  const { data: sesiones, error } = await admin.rpc('sesiones_para_calendario', { p_token: token })
  if (error) {
    console.error('[calendario] no se pudieron leer las sesiones:', error.message)
    return new Response('No disponible', { status: 503 })
  }

  const ahora = utc(new Date().toISOString())
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vita//Sesiones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Vita · Sesiones',
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    // Sugerencia de cada cuánto volver a leer (Apple la respeta; Google no).
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  for (const s of (sesiones ?? []) as { id: string; inicio: string; fin: string; estado: string }[]) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@vitaapp.com.ar`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${utc(s.inicio)}`,
      `DTEND:${utc(s.fin)}`,
      'SUMMARY:Sesión · Vita',
      'DESCRIPTION:Abrí Vita para ver con quién es y entrar a la videollamada.',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')

  const cuerpo = lineas.map(plegar).join('\r\n') + '\r\n'
  return new Response(req.method === 'HEAD' ? null : cuerpo, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="vita-sesiones.ics"',
      'Cache-Control': 'private, max-age=300',
      // El token va en la URL: que no se filtre por referer ni quede indexado.
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  })
})
