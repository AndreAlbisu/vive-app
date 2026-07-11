// mp-process-refunds — procesa las reservas marcadas para reembolso.
//
// SCAFFOLD v1 — estructura lista; la llamada de refund a MP está marcada TODO y
// hay que verificarla contra la doc vigente de MercadoPago antes de producción.
//
// Corre por cron (pg_net cada ~5 min, ver add-payments-v1.sql). Toma los bookings
// en payment_status = 'reembolso_pendiente' (los marcó expire_pending_bookings al
// vencer una pendiente pagada, o el rechazo del coach), llama al refund de MP y
// los pasa a 'reembolsado'. Idempotente: si ya está reembolsado, lo saltea.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Solo service role (lo llama el cron con la service key en el Authorization).
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: pending } = await supabase
    .from('bookings')
    .select('id, payment_id, coach_id')
    .eq('payment_status', 'reembolso_pendiente')
    .not('payment_id', 'is', null)
    .limit(50)

  let ok = 0, fail = 0
  for (const b of pending ?? []) {
    // El refund se hace con el token del COACH (el que cobró el split).
    const { data: mp } = await supabase
      .from('coach_mp_accounts')
      .select('access_token')
      .eq('coach_id', b.coach_id)
      .single()
    if (!mp?.access_token) { fail++; continue }

    try {
      // TODO(MP): verificar contra docs — POST /v1/payments/{id}/refunds (refund total)
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${b.payment_id}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mp.access_token}`,
          'X-Idempotency-Key': `refund-${b.id}`,
        },
        body: JSON.stringify({}), // refund total; parcial llevaría { amount }
      })
      if (!r.ok) { console.error('[mp-refunds] refund error', b.id, await r.text()); fail++; continue }

      await supabase
        .from('bookings')
        .update({ payment_status: 'reembolsado', refunded_at: new Date().toISOString() })
        .eq('id', b.id)
      ok++
    } catch (e) {
      console.error('[mp-refunds] error', b.id, e); fail++
    }
  }

  return new Response(JSON.stringify({ processed: ok, failed: fail }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
