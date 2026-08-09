// mp-webhook — recibe notificaciones de MercadoPago sobre el estado de un pago.
//
// MP hace POST acá cuando cambia un pago. Validamos la firma x-signature, buscamos
// el pago, lo mapeamos a la reserva por `external_reference` (= booking_id) y
// actualizamos payment_status. Idempotente: MP puede reintentar la misma
// notificación varias veces.
//
// Las dos incógnitas que este archivo marcaba como "PENDIENTE DE VERIFICAR"
// quedaron RESUELTAS con el primer pago real (09/08/2026, payment 172908775452):
//   1. El token de plataforma (MP_ACCESS_TOKEN) NO puede leer el pago del coach.
//      Las 3 notificaciones v2 de ese pago pasaron la firma y murieron en el
//      `GET /v1/payments/{id}` → 502, y la reserva quedó en 'pendiente' con el
//      pago ya acreditado en MP. En marketplace el pago es del VENDEDOR, así que
//      ahora se lee con el token del COACH (ver resolveCoachToken abajo).
//   2. El manifest de firma es correcto: las notificaciones v2 validaron bien.
//      Las que daban 401 eran las IPN v1 legacy, que MP manda SIN firmar.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyWebhookSignature, getFreshCoachToken } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!    // token de la app plataforma (fallback)
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET')! // secret de firma de Webhooks
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!           // para refrescar el token del coach
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!

serve(async (req) => {
  try {
    // Fail-closed: sin el secret de firma NO se procesa nada (no correr sin validar).
    if (!MP_WEBHOOK_SECRET) {
      console.error('[mp-webhook] falta MP_WEBHOOK_SECRET — no se valida firma, se rechaza')
      return new Response('webhook secret not configured', { status: 500 })
    }

    const url = new URL(req.url)
    // El id del recurso llega por query: ?data.id=... (v2) o ?id=... (IPN v1).
    const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')
    const body = await req.json().catch(() => ({}))
    const paymentId = dataId ?? body?.data?.id
    const topic = url.searchParams.get('topic') ?? url.searchParams.get('type') ?? body?.type

    // Por CADA pago, MP manda hasta tres notificaciones al mismo notification_url:
    // la v2 (`?data.id=…&type=payment`), la IPN v1 (`?id=…&topic=payment`) y una o
    // más de merchant_order. Procesamos SOLO la v2 y descartamos el resto con 200.
    //
    // El descarte va ANTES de validar la firma, y esa es la parte que importa: si
    // se responde 401, MP lo toma como fallo y reintenta la misma notificación en
    // loop. Con el filtro puesto después de la firma, un solo pago generaba 8
    // reintentos (medido el 09/08/2026). Descartar sin mirar la firma es seguro
    // porque estas ramas no leen ni escriben nada: solo devuelven 200.

    // IPN v1 (legacy): se reconoce por el query param `topic` (la v2 usa `type`).
    // Ojo, contra lo que parecía a primera vista, estas SÍ vienen firmadas, pero con
    // un manifest que no es el de la v2 — por eso seguían cayendo en el 401 después
    // del primer arreglo. No vale la pena reproducir ese template: la v2 del mismo
    // evento ya trae todo y es la que se procesa.
    if (url.searchParams.has('topic')) {
      return new Response('ignored (legacy IPN v1)', { status: 200 })
    }

    if (!paymentId || (topic && topic !== 'payment')) {
      return new Response('ignored', { status: 200 })
    }

    // Sin firma no hay nada que validar. Cae acá cualquier notificación v2 que
    // llegue sin el header; se ignora en vez de rechazarse, por lo mismo de arriba.
    if (!req.headers.get('x-signature')) {
      return new Response('ignored (unsigned)', { status: 200 })
    }

    // Validar la firma x-signature ANTES de procesar (rechaza notificaciones forjadas).
    const sigOk = await verifyWebhookSignature({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId,
      secret: MP_WEBHOOK_SECRET,
    })
    if (!sigOk) return new Response('invalid signature', { status: 401 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // GET /v1/payments/{id} con el token del COACH: en marketplace el pago es del
    // vendedor y el token de plataforma no lo puede leer (verificado, ver cabecera).
    const token = await resolveCoachToken(supabase, body?.user_id)
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payment = await payRes.json()
    if (!payRes.ok) {
      console.error('[mp-webhook] payment fetch error:', payment)
      return new Response('error', { status: 502 })
    }

    const bookingId = payment.external_reference
    if (!bookingId) return new Response('no ref', { status: 200 })

    // Mapear estado MP → payment_status interno
    const statusMap: Record<string, string> = {
      approved: 'aprobado',
      rejected: 'rechazado',
      cancelled: 'rechazado',
      refunded: 'reembolsado',
      charged_back: 'reembolsado',
    }
    const newStatus = statusMap[payment.status as string]
    if (!newStatus) return new Response('unhandled status', { status: 200 })

    const patch: Record<string, unknown> = { payment_status: newStatus, payment_id: String(paymentId) }
    if (newStatus === 'aprobado') patch.paid_at = new Date().toISOString()
    if (newStatus === 'reembolsado') patch.refunded_at = new Date().toISOString()

    await supabase.from('bookings').update(patch).eq('id', bookingId)

    // NO disparar acá la confirmación de sesión (reserva_confirmada /
    // system_confirmed). En este flujo el pago ocurre DESPUÉS de crear el
    // booking, y la confirmación ya la emite quien corresponde:
    //   · instant_booking → BookingScreen_Confirm al reservar (status nace 'confirmada')
    //   · no-instant      → CoachReservasScreen.accept() cuando el coach acepta
    // Emitirla también acá duplicaría la notificación en instant o saltearía la
    // aceptación del coach. El webhook solo trackea payment_status.
    //
    // NO auto-cancelar la reserva en 'rechazado'. VERIFICADO en docs MP (07/2026):
    // Checkout Pro RECUPERA pagos rechazados — tras un rechazo el usuario reintenta
    // con otro medio en el mismo flujo, generando un nuevo payment_id que puede
    // llegar 'approved'. Un webhook 'rejected' NO es final. Cancelar acá mataría una
    // reserva que el usuario está por pagar.
    //
    // El caso incómodo (instant_booking ya 'confirmada' + competidores cancelados al
    // reservar, y el pago nunca se aprueba) NO se resuelve acá: hoy los pagos son
    // OPCIONALES (coach sin MP → reserva sin cobro), así que "confirmada sin pago" es
    // un estado VÁLIDO, indistinguible del abandono. Recién cuando el pago sea
    // OBLIGATORIO (todos los coaches con MP) tiene sentido un sweep que cancele
    // instants sin 'aprobado' tras una ventana de gracia. Diferido a ese momento.

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('[mp-webhook] error:', e)
    return new Response('error', { status: 500 })
  }
})

// Token con el que leer el pago. El huevo-y-gallina aparente —el coach sale del
// booking, y el booking sale del `external_reference` que está DENTRO del pago—
// se resuelve sin leer el pago: la notificación v2 trae `user_id`, que es el
// collector, o sea el `mp_user_id` del coach que cobró. De ahí sale el coach_id.
//
// Fallback al token de plataforma si MP no mandó `user_id` o el coach no está en
// coach_mp_accounts (p. ej. desconectó MP después de cobrar). Sabemos que ese token
// no puede leer pagos de marketplace, así que en la práctica va a dar 502 → MP
// reintenta y queda el error en los logs, que es mejor que tragarlo con un 200.
// deno-lint-ignore no-explicit-any
async function resolveCoachToken(supabase: any, collectorUserId: unknown): Promise<string> {
  if (collectorUserId == null) return MP_ACCESS_TOKEN

  const { data: acct } = await supabase
    .from('coach_mp_accounts')
    .select('coach_id')
    .eq('mp_user_id', String(collectorUserId))
    .maybeSingle()
  if (!acct?.coach_id) {
    console.warn('[mp-webhook] sin coach para mp_user_id', collectorUserId, '— se usa el token de plataforma')
    return MP_ACCESS_TOKEN
  }

  const token = await getFreshCoachToken(supabase, acct.coach_id, MP_CLIENT_ID, MP_CLIENT_SECRET)
  return token ?? MP_ACCESS_TOKEN
}
