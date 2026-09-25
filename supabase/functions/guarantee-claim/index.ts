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
//   Authorization: Bearer <SERVICE_ROLE_KEY>          (runbook, por curl)
//                  Bearer <access_token de un admin>  (panel de administración)
//   { "booking_id": "...", "resolved_by": "andre", "dry_run": true }
//   { "booking_id": "...", "resolved_by": "andre", "reject": "motivo" }
//
// `dry_run` valida y no escribe: sirve para contestar el mail sabiendo si
// califica antes de comprometerse.
//
// ⚠️ `resolved_by` del body se IGNORA cuando llama un admin logueado: ahí la
// identidad sale del JWT. Solo lo usa el runbook, donde no hay ninguna.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { guaranteeFailures, alertasDeAbuso, scheduledAtMs } from '../_shared/guarantee.ts'
import { esServiceRole } from '../_shared/service-role.ts'
import { enviarMail, nombreSeguro } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Las condiciones de §9.3 viven en ../_shared/guarantee.ts: son puras, así que
// se pueden testear sin levantar Supabase. Esta función solo consulta y escribe.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Deja pasar al service role (curl del runbook) o a un admin logueado (panel).
 *  El panel corre con la anon key, así que no puede mandar la service key —
 *  pero tampoco hay que duplicar las validaciones de §9.3 en otra función.
 *  Se resuelve la identidad desde el token, que el cliente no puede falsificar.
 *
 *  Devuelve TAMBIÉN quién es, no solo si puede: `resolved_by` queda escrito en
 *  `guarantee_claims` y es el único rastro de quién resolvió una garantía. Si
 *  saliera del body, sería un campo de auditoría que su propio actor elige —
 *  el mismo problema que un `is_admin` que viniera del cliente. Para el runbook
 *  (service role) no hay identidad que derivar y ahí sí vale lo que mande. */
async function authorize(authHeader: string): Promise<{ ok: boolean; identity: string | null }> {
  if (esServiceRole(authHeader, SUPABASE_SERVICE_ROLE_KEY)) return { ok: true, identity: null }
  if (!authHeader.startsWith('Bearer ')) return { ok: false, identity: null }

  const asCaller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return { ok: false, identity: null }

  // El chequeo va con service role: con el cliente del invocador, una política
  // mal puesta podría devolver null y hacer que esto fallara ABIERTO.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()

  if (!profile?.is_admin) return { ok: false, identity: null }
  return { ok: true, identity: user.email ?? user.id }
}

/** Quién pide, cuando el que pide es el CLIENTE y no un admin (M5). */
async function quienPide(authHeader: string): Promise<string | null> {
  if (!authHeader.startsWith('Bearer ')) return null
  const asCaller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  return user?.id ?? null
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''

  let body: { booking_id?: string; resolved_by?: string; reject?: string; dry_run?: boolean; solicitar?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }

  // ── M5: el pedido lo hace el CLIENTE desde la app ──────────────────────────
  //
  // 🔴 Hasta el 21/09/2026 §9.3 se ejercía **escribiendo un mail**. Se le pedía
  // a alguien que acaba de pasar una hora incómoda que además redactara un
  // correo contando por qué. La mayoría no lo hace: se va en silencio, y ni
  // siquiera sabemos que se fue.
  //
  // 📌 **No se aprueba solo.** El pedido queda `pendiente` y lo resuelve un
  // humano por el panel, igual que antes, porque §9.3 permite denegar por uso
  // abusivo y eso no lo puede decidir un `if`. Lo que cambia es el INTAKE.
  //
  // 📌 Y no se duplican las condiciones: se evalúan más abajo, con el mismo
  // `guaranteeFailures` del runbook. Esta rama solo decide QUIÉN puede pedir.
  const solicitante = body.solicitar === true ? await quienPide(authHeader) : null
  if (body.solicitar === true && !solicitante) {
    return new Response('Unauthorized', { status: 401 })
  }

  let identidadAdmin: string | null = null
  if (!solicitante) {
    const auth = await authorize(authHeader)
    if (!auth.ok) return new Response('Unauthorized', { status: 401 })
    identidadAdmin = auth.identity
  }

  const bookingId = body.booking_id
  if (!bookingId) return json({ error: 'falta booking_id' }, 400)

  // Quien resuelve. Si vino por el panel, es la identidad del JWT y el body no
  // puede pisarla; si vino por el runbook con service role, no hay identidad
  // que derivar y vale lo que mande el curl.
  const resolvedBy = identidadAdmin ?? body.resolved_by ?? null

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, coach_id, status, payment_status, payment_id, preference_id, scheduled_date, scheduled_time, amount, payer_fingerprint')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingErr) return json({ error: `no se pudo leer la reserva: ${bookingErr.message}` }, 500)
  if (!booking) return json({ error: 'esa reserva no existe' }, 404)

  // El cliente solo puede pedir sobre SU propia reserva. Va acá y no antes
  // porque necesita la fila de la reserva para comparar.
  if (solicitante && booking.user_id !== solicitante) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Rechazo explícito ──────────────────────────────────────────────────────
  // Va ANTES de validar: §9.3 permite denegar por uso abusivo, y ese rechazo
  // tiene que poder registrarse aunque la solicitud además no calificara. Si
  // no, un caso abusivo que encima no cumple la ventana no dejaría rastro y
  // sería invisible la próxima vez que la misma persona lo intente.
  if (body.reject && !solicitante) {
    const { error } = await supabase.from('guarantee_claims').upsert({
      booking_id: booking.id,
      user_id: booking.user_id,
      coach_id: booking.coach_id,
      status: 'rechazada',
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
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
  // 🔴 **Corregido el 21/09/2026, el mismo día que se agregó el pedido desde la
  // app.** Antes bastaba con que existiera una fila para cortar acá, y eso
  // convertía el intake nuevo en una trampa: el cliente pedía la garantía, la
  // fila quedaba `pendiente`, y cuando el admin iba a aprobarla desde el panel
  // esta guarda le devolvía 409. O sea que se podía pedir y NO se podía
  // conceder. Lo probó nadie porque las dos mitades se escribieron seguidas.
  //
  // Ahora una `pendiente` no frena al admin: es justo lo que viene a resolver.
  // Lo que sigue frenando es una ya resuelta, que es lo que la guarda quería
  // decir desde el principio.
  const yaResuelta = existing && existing.status !== 'pendiente'
  if (existing && (solicitante || yaResuelta)) {
    return json({
      error: solicitante
        ? `ya pediste la garantía para esta sesión (${existing.status})`
        : `esta reserva ya tiene una solicitud ${existing.status} del ${existing.requested_at}`,
      claim: existing,
    }, 409)
  }

  // (2) a (5) — las cuatro condiciones restantes de §9.3. La evaluación vive en
  // `_shared/guarantee.ts`, pura y testeada; acá solo se juntan los datos.
  //
  // Las sesiones del par se traen enteras y se filtran en JS en vez de encadenar
  // un segundo `.or()`: PostgREST no compone dos `or` sobre el mismo request de
  // forma predecible, y por par hay un puñado de filas.
  const { data: pairBookings } = await supabase
    .from('bookings')
    .select('id, scheduled_date, scheduled_time, preference_id, payment_status')
    .eq('user_id', booking.user_id)
    .eq('coach_id', booking.coach_id)
    .eq('status', 'completada')

  // Cuenta APROBADAS, no pedidas: si contara pedidas, un rechazo por abuso le
  // quemaría el único intento a alguien que después reclama legítimamente.
  const { count: usedBefore } = await supabase
    .from('guarantee_claims')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', booking.user_id)
    .eq('status', 'aprobada')

  const now = Date.now()
  const startedAt = scheduledAtMs(booking.scheduled_date, booking.scheduled_time)
  const hoursSince = (now - startedAt) / 3_600_000

  failures.push(...guaranteeFailures({
    booking,
    pairBookings: pairBookings ?? [],
    approvedClaimsByUser: usedBefore ?? 0,
    now,
  }))

  // ── Avisos para quien revisa (25/09/2026) ─────────────────────────────────
  // No descalifican: ver `alertasDeAbuso`. Se calculan acá y viajan en todas
  // las respuestas que ve una persona (la revisión del panel y el mail), porque
  // el límite de "una vez por Cliente" es por cuenta y abrir otra es gratis.
  let alertas: string[] = []
  if (booking.payer_fingerprint) {
    const { data: mismoPagador } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('payer_fingerprint', booking.payer_fingerprint)
      .neq('user_id', booking.user_id)
    const otrasCuentas = [...new Set((mismoPagador ?? []).map(r => r.user_id as string))]
    let garantiasDeOtrasCuentas = 0
    if (otrasCuentas.length > 0) {
      const { count } = await supabase
        .from('guarantee_claims')
        .select('id', { count: 'exact', head: true })
        .in('user_id', otrasCuentas)
        .eq('status', 'aprobada')
      garantiasDeOtrasCuentas = count ?? 0
    }
    alertas = alertasDeAbuso({ otrasCuentas: otrasCuentas.length, garantiasDeOtrasCuentas })
  }

  if (failures.length > 0) {
    // El cliente que pide no ve los avisos: son para quien revisa.
    return json({ eligible: false, booking_id: booking.id, reasons: failures, ...(solicitante ? {} : { alertas }) }, 422)
  }

  if (body.dry_run) {
    return json({
      eligible: true,
      dry_run: true,
      booking_id: booking.id,
      amount: booking.amount,
      hours_since_session: Math.floor(hoursSince),
      alertas,
    })
  }

  // ── M5: el pedido del cliente queda PENDIENTE ─────────────────────────────
  // Pasó las cinco condiciones de §9.3, pero no se aprueba solo: §9.3 permite
  // denegar por uso abusivo, y eso lo mira una persona. Lo que se ganó es que
  // el pedido llegue con todos los datos en vez de un mail escrito a mano por
  // alguien incómodo.
  if (solicitante) {
    const { error: pedidoErr } = await supabase.from('guarantee_claims').insert({
      booking_id: booking.id,
      user_id: booking.user_id,
      coach_id: booking.coach_id,
      status: 'pendiente',
      notes: 'Pedida desde la app',
    })
    if (pedidoErr) return json({ error: `no se pudo registrar el pedido: ${pedidoErr.message}` }, 500)

    // 📌 El aviso va al MISMO buzón al que antes escribía la persona, así que el
    // runbook no cambia de lugar: cambia quién escribe el mail y con qué datos.
    // Si el mail falla, el pedido ya está guardado igual: se vería en el panel.
    const { data: quien } = await supabase
      .from('profiles').select('name, email').eq('id', booking.user_id).maybeSingle()
    await enviarMail({
      para: 'vitaappar@gmail.com',
      asunto: `Garantía §9.3 pedida desde la app`,
      titulo: 'Alguien pidió el reintegro de su primera sesión',
      lineas: [
        `<b>Reserva:</b> ${booking.id}`,
        // El nombre lo escribe la persona y va adentro de HTML: escapado, igual
        // que en el resto de los mails (`nombreSeguro`).
        `<b>Cliente:</b> ${nombreSeguro(quien?.name ?? 'sin nombre')} (${nombreSeguro(quien?.email ?? 'sin mail')})`,
        `<b>Sesión:</b> ${booking.scheduled_date} ${booking.scheduled_time}`,
        `<b>Monto:</b> ${booking.amount}`,
        'Pasó las cinco condiciones de §9.3. Falta aprobarla desde Administración → Garantías.',
        // Texto nuestro, sin datos de la persona: no hace falta escapar.
        ...alertas.map(a => `<b>⚠️ Revisar antes de aprobar:</b> ${a}.`),
      ],
      pie: 'No hace falta contestarle: el reintegro se procesa al aprobar.',
    }).catch(() => false)

    return json({ result: 'pendiente', booking_id: booking.id })
  }

  // ── Aprobar ────────────────────────────────────────────────────────────────
  // El claim se escribe ANTES de marcar el reembolso. Si se hiciera al revés y
  // fallara el insert, quedaría un reembolso en curso sin registro de que la
  // garantía se usó — y el "una sola vez por Cliente" se volvería incontable.
  // Al revés el peor caso es un claim aprobado sin reembolso disparado, que se
  // ve en una query y se arregla marcando el booking a mano.
  // `upsert` y no `insert`: si el pedido entró desde la app, la fila ya existe
  // en `pendiente` y aprobarla es actualizarla. Con `insert` esto reventaba
  // contra el UNIQUE de `booking_id`.
  const { error: claimErr } = await supabase.from('guarantee_claims').upsert({
    booking_id: booking.id,
    user_id: booking.user_id,
    coach_id: booking.coach_id,
    status: 'aprobada',
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
    notes: existing ? 'Pedida desde la app, aprobada desde el panel' : null,
  }, { onConflict: 'booking_id' })
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
