// mp-process-refunds — procesa las reservas marcadas para reembolso.
//
// Corre por cron (pg_net cada ~5 min, ver add-payments-v1.sql). Toma los bookings
// en payment_status = 'reembolso_pendiente' (los marcó expire_pending_bookings al
// vencer una pendiente pagada, el trigger trg_mark_refund_on_cancel al cancelar, o
// el rechazo del coach), llama al refund de MP y los pasa a 'reembolsado'.
// Idempotente: si ya está reembolsado, no lo agarra (filtra por estado).
//
// Dead-letter: cada intento fallido incrementa bookings.refund_attempts; al llegar
// a MAX_ATTEMPTS la fila deja de reintentarse (queda en 'reembolso_pendiente',
// visible por query) para no golpear MP en loop eterno ante un fallo permanente
// (pago no reembolsable, cuenta del coach desconectada, etc.). Requiere la columna
// refund_attempts (scripts/add-refund-attempts.sql).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getFreshCoachToken } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!            // para refrescar el token del coach
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!

// A ~5 min por corrida, 6 intentos ≈ 30 min de reintentos antes de rendirse.
const MAX_ATTEMPTS = 6

serve(async (req) => {
  // Solo service role (lo llama el cron con la service key en el Authorization).
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: pending } = await supabase
    .from('bookings')
    .select('id, payment_id, coach_id, refund_attempts')
    .eq('payment_status', 'reembolso_pendiente')
    // ⚠️ Solo las que cobró Mercado Pago. `trg_mark_refund_on_cancel` marca
    // 'reembolso_pendiente' venga de donde venga el pago, así que sin este
    // filtro una reserva cobrada por otro rail terminaría acá: le pediríamos a
    // MP reembolsar un `payment_id` que no es suyo, fallaría, y a los cinco
    // intentos quedaría en el dead-letter — el usuario sin su plata y sin
    // ningún error visible. Cada rail nuevo necesita su propio procesador.
    .eq('payment_provider', 'mp')
    .not('payment_id', 'is', null)
    .lt('refund_attempts', MAX_ATTEMPTS)
    .limit(50)

  let ok = 0, fail = 0

  // Registra un intento fallido; si con este toca el tope, lo deja loud para
  // intervención manual (no se reintenta más hasta que alguien lo mire).
  async function markFailure(b: { id: string; refund_attempts: number | null }, reason: string) {
    const attempts = (b.refund_attempts ?? 0) + 1
    await supabase.from('bookings').update({ refund_attempts: attempts }).eq('id', b.id)
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`[mp-refunds] DEAD-LETTER booking ${b.id} tras ${attempts} intentos — ${reason}`)
    } else {
      console.error(`[mp-refunds] intento ${attempts} falló booking ${b.id} — ${reason}`)
    }
    fail++
  }

  for (const b of pending ?? []) {
    // Token del coach (el que cobró el split), refrescado si está por vencer.
    const coachToken = await getFreshCoachToken(supabase, b.coach_id, MP_CLIENT_ID, MP_CLIENT_SECRET)
    if (!coachToken) { await markFailure(b, 'coach sin MP conectado'); continue }

    try {
      // POST /v1/payments/{id}/refunds sin body = refund total; parcial llevaría { amount }.
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${b.payment_id}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${coachToken}`,
          'X-Idempotency-Key': `refund-${b.id}`,
        },
        body: JSON.stringify({}),
      })
      if (!r.ok) { await markFailure(b, `refund ${r.status}: ${await r.text()}`); continue }

      await supabase
        .from('bookings')
        .update({ payment_status: 'reembolsado', refunded_at: new Date().toISOString() })
        .eq('id', b.id)
      ok++
    } catch (e) {
      await markFailure(b, String(e))
    }
  }

  return new Response(JSON.stringify({ processed: ok, failed: fail }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
