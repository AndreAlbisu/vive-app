// mp-webhook — recibe notificaciones de MercadoPago sobre el estado de un pago.
//
// SCAFFOLD v1 — estructura lista; el fetch al pago y la validación de firma
// están marcados TODO y hay que verificarlos contra la doc vigente de MP.
//
// MP hace POST acá cuando cambia un pago. Buscamos el pago, lo mapeamos a la
// reserva por `external_reference` (= booking_id) y actualizamos payment_status.
// Idempotente: MP puede reintentar la misma notificación varias veces.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')! // token de la app plataforma

serve(async (req) => {
  try {
    // TODO(MP): validar la firma del webhook (header x-signature) antes de confiar.
    const body = await req.json().catch(() => ({}))
    const url = new URL(req.url)

    // MP manda el id del pago por query (?id=&topic=payment) o en el body (data.id).
    const paymentId = url.searchParams.get('id') ?? body?.data?.id
    const topic = url.searchParams.get('topic') ?? body?.type
    if (!paymentId || (topic && topic !== 'payment')) {
      return new Response('ignored', { status: 200 }) // 200 para que MP no reintente
    }

    // TODO(MP): verificar contra docs — GET https://api.mercadopago.com/v1/payments/{id}
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

    // TODO: si newStatus === 'aprobado', disparar la confirmación existente
    //   (notificación reserva_confirmada / mensaje system_confirmed en la sala).
    //   Reusar la lógica de CoachReservasScreen.accept() / instant_booking.

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('[mp-webhook] error:', e)
    return new Response('error', { status: 500 })
  }
})
