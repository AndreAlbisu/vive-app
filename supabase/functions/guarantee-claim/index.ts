// guarantee-claim — resuelve una solicitud de garantía de primera sesión (T&C §9.3).
//
// El intake es POR MAIL: §9.3 dice que el Cliente escribe a vitaappar@gmail.com,
// así que esta función la invoca el equipo, no la app. Lo que aporta es que
// aprobar deje de ser editar filas a mano: valida las cinco condiciones de la
// cláusula y, si pasan, marca el reembolso.
//
// NO hace el refund contra MP. Solo pone payment_status = 'reembolso_pendiente';
// `mp-process-refunds` (cron cada 5 min) hace el resto. Eso es deliberado —
// selecciona solo por payment_status y nunca mira `status`, así que la sesión
// sigue siendo 'completada' y no se reescribe historia.
//
// La comisión se resuelve sola y no hay nada que calcular acá: el refund va sin
// `amount` con el token del coach, así que MP revierte el pago entero incluido
// el application_fee. Es exactamente lo que §9.3 promete ("se debita de los
// fondos del Profesional", "Vita no percibe comisión sobre lo reintegrado").
//
// Uso:
//   POST /guarantee-claim
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "booking_id": "...", "resolved_by": "andre", "dry_run": true }
//   { "booking_id": "...", "resolved_by": "andre", "reject": "motivo" }
//
// `dry_run` valida y no escribe: sirve para contestar el mail sabiendo si
// califica antes de comprometerse.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// §9.3: la solicitud se hace "dentro de las 48 horas posteriores al horario en
// que la Sesión estaba agendada".
const WINDOW_HOURS = 48

// Las fechas de `bookings` son hora local de Argentina (scheduled_date es un
// `date` y scheduled_time un `text` 'HH:MM'), sin timezone guardada. El resto
// del proyecto asume lo mismo (ver complete_confirmed_sessions).
const AR_OFFSET = '-03:00'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Fecha+hora agendada como instante real, interpretando la hora de Argentina. */
function scheduledAt(date: string, time: string): number {
  return Date.parse(`${date}T${time.slice(0, 5)}:00${AR_OFFSET}`)
}

/** Deja pasar al service role (curl del runbook) o a un admin logueado (panel).
 *  El panel corre con la anon key, así que no puede mandar la service key —
 *  pero tampoco hay que duplicar las validaciones de §9.3 en otra función.
 *  Se resuelve la identidad desde el token, que el cliente no puede falsificar. */
async function isAuthorized(authHeader: string): Promise<boolean> {
  if (authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) return true
  if (!authHeader.startsWith('Bearer ')) return false

  const asCaller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return false

  // El chequeo va con service role: con el cliente del invocador, una política
  // mal puesta podría devolver null y hacer que esto fallara ABIERTO.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return !!profile?.is_admin
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!(await isAuthorized(authHeader))) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { booking_id?: string; resolved_by?: string; reject?: string; dry_run?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }

  const bookingId = body.booking_id
  if (!bookingId) return json({ error: 'falta booking_id' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, coach_id, status, payment_status, payment_id, preference_id, scheduled_date, scheduled_time, amount')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingErr) return json({ error: `no se pudo leer la reserva: ${bookingErr.message}` }, 500)
  if (!booking) return json({ error: 'esa reserva no existe' }, 404)

  // ── Rechazo explícito ──────────────────────────────────────────────────────
  // Va ANTES de validar: §9.3 permite denegar por uso abusivo, y ese rechazo
  // tiene que poder registrarse aunque la solicitud además no calificara. Si
  // no, un caso abusivo que encima no cumple la ventana no dejaría rastro y
  // sería invisible la próxima vez que la misma persona lo intente.
  if (body.reject) {
    const { error } = await supabase.from('guarantee_claims').upsert({
      booking_id: booking.id,
      user_id: booking.user_id,
      coach_id: booking.coach_id,
      status: 'rechazada',
      resolved_at: new Date().toISOString(),
      resolved_by: body.resolved_by ?? null,
      notes: body.reject,
    }, { onConflict: 'booking_id' })
    if (error) return json({ error: `no se pudo registrar el rechazo: ${error.message}` }, 500)
    return json({ result: 'rechazada', booking_id: booking.id, notes: body.reject })
  }

  // ── Condiciones de §9.3 ────────────────────────────────────────────────────
  const failures: string[] = []

  // (1) Que exista una solicitud previa para esta misma reserva. El UNIQUE de la
  // tabla lo impide igual, pero acá el mensaje explica por qué en vez de tirar
  // un error de constraint.
  const { data: existing } = await supabase
    .from('guarantee_claims')
    .select('id, status, requested_at')
    .eq('booking_id', booking.id)
    .maybeSingle()
  if (existing) {
    return json({
      error: `esta reserva ya tiene una solicitud ${existing.status} del ${existing.requested_at}`,
      claim: existing,
    }, 409)
  }

  // (2) Que se haya pagado de verdad por la Plataforma. Una sesión sin cobro
  // (coach sin MP conectado) no tiene nada que reintegrar.
  if (booking.payment_status !== 'aprobado') {
    failures.push(`el pago está en '${booking.payment_status}', no 'aprobado' — no hay nada que reintegrar`)
  }
  if (!booking.payment_id) {
    failures.push('la reserva no tiene payment_id: nunca se cobró por MP')
  }

  // (3) Ventana de 48hs desde el horario agendado.
  const startedAt = scheduledAt(booking.scheduled_date, booking.scheduled_time)
  const hoursSince = (Date.now() - startedAt) / 3_600_000
  if (Number.isNaN(startedAt)) {
    failures.push(`no se pudo interpretar la fecha agendada (${booking.scheduled_date} ${booking.scheduled_time})`)
  } else if (hoursSince < 0) {
    failures.push('la sesión todavía no ocurrió: para eso está la cancelación de §9.1, no la garantía')
  } else if (hoursSince > WINDOW_HOURS) {
    failures.push(`pasaron ${Math.floor(hoursSince)}hs del horario agendado y la ventana de §9.3 es de ${WINDOW_HOURS}hs`)
  }

  // (4) Que sea la PRIMERA Sesión de ese vínculo Cliente-Profesional.
  //
  // Se cuenta con el mismo criterio que la comisión en `mp-create-payment`:
  // 'completada' + excluyendo checkouts abandonados (preference_id seteado y
  // payment_status que nunca salió de 'pendiente'). Sin ese filtro, una reserva
  // basura vieja del par haría que la primera sesión REAL no calificara — el
  // mismo bug que empujaba a los pares al tramo del 15% antes de la sesión 88.
  // El "anterior a esta" se compara por fecha Y hora, y se filtra en JS en vez de
  // encadenar un segundo .or() en la query: PostgREST no compone dos `or` sobre
  // el mismo request de forma predecible, y comparar solo por `scheduled_date`
  // dejaba pasar el caso de dos sesiones el MISMO día (la de las 10 y la de las
  // 15) — la segunda habría calificado como "primera del vínculo". Por par hay
  // un puñado de filas, así que traerlas sale gratis.
  const { data: pairBookings } = await supabase
    .from('bookings')
    .select('id, scheduled_date, scheduled_time, preference_id, payment_status')
    .eq('user_id', booking.user_id)
    .eq('coach_id', booking.coach_id)
    .eq('status', 'completada')

  const previousOfPair = (pairBookings ?? []).filter((b) => {
    if (b.id === booking.id) return false
    // Checkout abandonado que igual llegó a 'completada': no cuenta como sesión.
    if (b.preference_id && b.payment_status === 'pendiente') return false
    return scheduledAt(b.scheduled_date, b.scheduled_time) < startedAt
  }).length

  if (previousOfPair > 0) {
    failures.push(`ya hubo ${previousOfPair} sesión(es) previa(s) con ese profesional: §9.3 alcanza solo a la primera del vínculo`)
  }

  // (5) Una sola vez por Cliente en TODA la Plataforma.
  //
  // Cuenta APROBADAS, no pedidas: si contara las pedidas, una solicitud
  // rechazada por abusiva le quemaría el único intento a alguien que después
  // reclama de forma legítima — y el rechazo dejaría de ser gratis para Vita.
  const { count: usedBefore } = await supabase
    .from('guarantee_claims')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', booking.user_id)
    .eq('status', 'aprobada')
  if ((usedBefore ?? 0) > 0) {
    failures.push('este Cliente ya usó la garantía: §9.3 se ejerce una sola vez en toda la Plataforma')
  }

  if (failures.length > 0) {
    return json({ eligible: false, booking_id: booking.id, reasons: failures }, 422)
  }

  if (body.dry_run) {
    return json({
      eligible: true,
      dry_run: true,
      booking_id: booking.id,
      amount: booking.amount,
      hours_since_session: Math.floor(hoursSince),
    })
  }

  // ── Aprobar ────────────────────────────────────────────────────────────────
  // El claim se escribe ANTES de marcar el reembolso. Si se hiciera al revés y
  // fallara el insert, quedaría un reembolso en curso sin registro de que la
  // garantía se usó — y el "una sola vez por Cliente" se volvería incontable.
  // Al revés el peor caso es un claim aprobado sin reembolso disparado, que se
  // ve en una query y se arregla marcando el booking a mano.
  const { error: claimErr } = await supabase.from('guarantee_claims').insert({
    booking_id: booking.id,
    user_id: booking.user_id,
    coach_id: booking.coach_id,
    status: 'aprobada',
    resolved_at: new Date().toISOString(),
    resolved_by: body.resolved_by ?? null,
    notes: null,
  })
  if (claimErr) return json({ error: `no se pudo registrar la solicitud: ${claimErr.message}` }, 500)

  // `status` NO se toca: la sesión ocurrió y sigue siendo 'completada'.
  // refund_attempts se resetea por si esta reserva arrastraba intentos viejos de
  // un reembolso anterior fallido — si no, entraría al dead-letter sin haberlo
  // intentado ni una vez.
  const { data: marked, error: markErr } = await supabase
    .from('bookings')
    .update({ payment_status: 'reembolso_pendiente', refund_attempts: 0 })
    .eq('id', booking.id)
    .eq('payment_status', 'aprobado')   // guarda contra una carrera con otro path
    .select('id')

  // El `.select()` no es decorativo: sin él, si el guard de arriba no matchea
  // ninguna fila, Postgrest devuelve error null y esto reportaría un reembolso
  // marcado que nunca se marcó. Hay que mirar las filas afectadas, no el error.
  if (markErr || !marked || marked.length === 0) {
    return json({
      error: `la solicitud quedó APROBADA pero NO se marcó el reembolso: ${markErr?.message ?? 'el pago dejó de estar en aprobado entre la validación y el update'}`,
      booking_id: booking.id,
      action: 'revisar payment_status de la reserva y, si corresponde, marcarlo a mano en reembolso_pendiente',
    }, 500)
  }

  console.log(`[guarantee-claim] aprobada booking ${booking.id} — reembolso marcado, lo toma mp-process-refunds`)

  return json({
    result: 'aprobada',
    booking_id: booking.id,
    amount: booking.amount,
    next: 'mp-process-refunds lo reembolsa en la próxima corrida (cada 5 min)',
  })
})
