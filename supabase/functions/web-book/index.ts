// web-book — crea la reserva que nace en la página pública `/c/<slug>`.
//
// ── Por qué existe una función y no un insert desde la página ────────────────
//
// La reserva no es una fila simple: la app la arma con seis cosas derivadas —la
// sala del par, la duración del patrón semanal, el precio VIGENTE en el momento
// de reservar, la zona horaria observada— y con reglas que ya costaron caro
// (ver `BookingScreen_Confirm`). **Duplicar eso en el JavaScript de la web es la
// forma segura de que las dos copias se separen**, y este proyecto ya tiene un
// historial de exactamente eso.
//
// 🔴 Y hay un motivo más fuerte: **el horario no se puede validar en el
// cliente.** Si la página mandara `fecha` y `hora` y acá se insertara sin
// mirar, cualquiera podría reservar un turno que el coach no ofreció, o uno ya
// tomado, cambiando dos campos en el navegador. Acá se vuelve a preguntar.
//
// ── Lo que NO hace ───────────────────────────────────────────────────────────
//
// No cobra. Devuelve el `bookingId` y la página llama después a
// `mp-create-payment`, que es la misma que usa la app. Separado a propósito: el
// cobro ya tiene su función, sus reintentos y su webhook, y meterlo acá sería
// una segunda puerta a la plata.
//
// ⚠️ La reserva SIEMPRE nace `'pendiente'`, también acá. Es la lección de la
// sesión 116: cuando nacía confirmada, cerrar el checkout sin pagar dejaba una
// sesión confirmada y al coach notificado sin que entrara un peso (27 casos
// medidos). Quien la confirma es el pago, vía `mp-webhook`.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── Quién está pidiendo ────────────────────────────────────────────────────
  // El id sale del token, NUNCA del cuerpo: si viniera del body, cualquiera
  // podría reservar a nombre de otro.
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'sin sesión' }, 401)

  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: errUser } = await comoUsuario.auth.getUser()
  if (errUser || !user) return json({ error: 'sesión inválida' }, 401)

  let body: { slug?: string; fecha?: string; hora?: string; tz?: string | null }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'cuerpo inválido' }, 400)
  }

  const slug = String(body.slug ?? '').trim()
  const fecha = String(body.fecha ?? '').trim()
  const hora = String(body.hora ?? '').trim()
  if (!slug || !fecha || !hora) return json({ error: 'faltan datos' }, 400)

  const admin = createClient(url, serviceKey)

  // ── El coach ───────────────────────────────────────────────────────────────
  // Los mismos filtros que la página pública: un profesional que no pasó la
  // revisión no tiene link, y por lo tanto tampoco reservas.
  const { data: coach } = await admin
    .from('coaches')
    .select('id, profile_id, price_per_session, specialty, verified, availability_status')
    .eq('slug', slug)
    .eq('verified', true)
    .eq('availability_status', 'activo')
    .maybeSingle()

  if (!coach) return json({ error: 'profesional no disponible' }, 404)

  // ── 🔴 El horario, preguntado de nuevo ─────────────────────────────────────
  // Se usa `slots_libres`, la MISMA función que dibuja los horarios en la
  // página. No se reimplementa la regla acá: si se escribiera otra vez, en
  // algún momento las dos dirían cosas distintas y la que gana sería la de
  // abajo, que es la que reserva.
  const { data: libres, error: errLibres } = await admin
    .rpc('slots_libres', { p_slug: slug })

  if (errLibres) {
    console.error('[web-book] slots_libres falló:', errLibres.message)
    return json({ error: 'no se pudo verificar el horario' }, 502)
  }

  const hhmm = (t: unknown) => {
    const [h = '', m = ''] = String(t).split(':')
    return `${h.padStart(2, '0')}:${m.slice(0, 2)}`
  }
  const disponible = (libres ?? []).some(
    (s: { fecha: string; hora: string }) => s.fecha === fecha && hhmm(s.hora) === hhmm(hora),
  )
  if (!disponible) return json({ error: 'ese horario ya no está disponible' }, 409)

  // ── El precio, leído AHORA ─────────────────────────────────────────────────
  // No se acepta del cliente. Es el número que después leen el informe del
  // contador y lo que se le debe al coach.
  const monto = Number(coach.price_per_session)
  if (!Number.isFinite(monto) || monto <= 0) {
    return json({ error: 'este profesional todavía no fijó su precio' }, 409)
  }

  // ── La sala del par ────────────────────────────────────────────────────────
  // ⚠️ `salas.coach_id` es el **profile_id** del coach, no `coaches.id`. Es la
  // confusión que SCHEMA.md marca en rojo y la que rompe estas consultas.
  let salaId: string
  const { data: salaExistente } = await admin
    .from('salas')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_id', coach.profile_id)
    .maybeSingle()

  if (salaExistente) {
    salaId = salaExistente.id as string
  } else {
    const { data: salaNueva, error: errSala } = await admin
      .from('salas')
      .insert({ user_id: user.id, coach_id: coach.profile_id })
      .select('id')
      .single()
    if (errSala || !salaNueva) {
      console.error('[web-book] no se pudo crear la sala:', errSala?.message)
      return json({ error: 'no se pudo preparar la sesión' }, 500)
    }
    salaId = salaNueva.id as string
  }

  const [{ data: perfilCoach }, { data: patron }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', coach.profile_id).maybeSingle(),
    admin.from('coach_weekly_pattern').select('slot_duration_minutes').eq('coach_id', coach.id).limit(1).maybeSingle(),
  ])

  // ── La reserva ─────────────────────────────────────────────────────────────
  const { data: booking, error: errBooking } = await admin
    .from('bookings')
    .insert({
      user_id: user.id,
      coach_id: coach.id,
      sala_id: salaId,
      coach_name: perfilCoach?.name ?? null,
      coach_specialty: coach.specialty ?? null,
      scheduled_date: fecha,
      scheduled_time: hora,
      amount: monto,
      status: 'pendiente',
      // D2: se guarda la OBSERVACIÓN cruda, no una conclusión. Acá la manda el
      // navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`), igual
      // que la app manda la del dispositivo.
      ...(body.tz ? {
        user_tz_observed: String(body.tz),
        user_observation_source: 'timezone',
        user_observed_at: new Date().toISOString(),
      } : {}),
      ...(patron?.slot_duration_minutes ? { duration_minutes: patron.slot_duration_minutes } : {}),
    })
    .select('id')
    .single()

  if (errBooking || !booking) {
    console.error('[web-book] no se pudo crear la reserva:', errBooking?.message)
    return json({ error: 'no se pudo crear la reserva' }, 500)
  }

  return json({ bookingId: booking.id })
})
