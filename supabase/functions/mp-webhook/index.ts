// mp-webhook — recibe notificaciones de MercadoPago sobre el estado de un pago.
//
// MP hace POST acá cuando cambia un pago. Validamos la firma x-signature, buscamos
// el pago, lo mapeamos a la reserva por `external_reference` (= booking_id) y
// actualizamos payment_status. Idempotente: MP puede reintentar la misma
// notificación varias veces.
//
// ⚠️ PENDIENTE DE VERIFICAR EN SANDBOX (no bloquea el deploy, sí el "listo"):
//   1. Que el token de plataforma (MP_ACCESS_TOKEN) pueda LEER el pago del coach
//      (marketplace); si no, hay que leerlo con el token del coach (ver abajo).
//   2. El template exacto del manifest de firma (ver verifyWebhookSignature).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyWebhookSignature } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!    // token de la app plataforma
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET')! // secret de firma de Webhooks

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

    // Validar la firma x-signature ANTES de procesar (rechaza notificaciones forjadas).
    const sigOk = await verifyWebhookSignature({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId,
      secret: MP_WEBHOOK_SECRET,
    })
    if (!sigOk) return new Response('invalid signature', { status: 401 })

    const body = await req.json().catch(() => ({}))
    const paymentId = dataId ?? body?.data?.id
    const topic = url.searchParams.get('topic') ?? url.searchParams.get('type') ?? body?.type
    if (!paymentId || (topic && topic !== 'payment')) {
      return new Response('ignored', { status: 200 }) // 200 para que MP no reintente
    }

    // GET /v1/payments/{id}. ⚠️ Verificar qué token lo lee: en marketplace el pago
    // es del vendedor (coach). Si el token de plataforma (MP_ACCESS_TOKEN) no puede
    // leerlo, hay que usar el token del coach — pero el coach recién se conoce por
    // external_reference (booking→coach). Confirmar contra MP si la plataforma
    // puede leer pagos de sus vendedores de marketplace con su propio token.
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
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
