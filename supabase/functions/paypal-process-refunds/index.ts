// paypal-process-refunds — devuelve la plata de las reservas del riel de PayPal.
//
// Gemelo de `mp-process-refunds`, con la misma forma: corre por cron, toma las
// que `trg_mark_refund_on_cancel` (o el vencimiento de una pendiente pagada)
// dejó en 'reembolso_pendiente', llama al refund y las pasa a 'reembolsado'.
//
// ⚠️ Cada riel necesita SU procesador, y el filtro por `payment_provider` no es
// decorativo. El trigger marca 'reembolso_pendiente' venga de donde venga el
// pago; sin el filtro, este le pediría a PayPal reembolsar un `payment_id` de
// Mercado Pago, fallaría seis veces y caería al dead-letter — con el usuario sin
// su plata y sin ningún error visible. Ese razonamiento ya está escrito en
// `mp-process-refunds` y vale igual acá, en el otro sentido.
//
// ── Lo que este reembolso NO recupera ────────────────────────────────────────
// PayPal **se queda con su comisión aunque devuelvas** (5,40% + USD 0,30). Al
// cliente se le devuelve todo lo que pagó (`charged_amount`); esos ~USD 3,74 los
// pone VIVE. Es un costo estructural del riel, no un error de este archivo: el
// modelo es cobro-al-reservar con reembolso automático, así que los reembolsos
// son parte del diseño. Las sesiones que sí se completan lo financian, y por eso
// existe el markup del precio.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esServiceRole } from '../_shared/service-role.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET') ?? ''
const PAYPAL_MODE = Deno.env.get('PAYPAL_MODE') ?? 'sandbox'
const PAYPAL_API = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// A ~5 min por corrida, 6 intentos ≈ 30 min antes de rendirse. Mismo número que
// el de Mercado Pago a propósito: dos dead-letters con ventanas distintas se
// vuelven imposibles de razonar juntos.
const MAX_ATTEMPTS = 6

async function getAccessToken(): Promise<string | null> {
  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    console.error('[paypal-refunds] oauth falló:', res.status, await res.text())
    return null
  }
  return (await res.json()).access_token ?? null
}

serve(async (req) => {
  // Solo service role (lo llama el cron con la service key en el Authorization).
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!esServiceRole(authHeader, SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    console.error('[paypal-refunds] faltan credenciales')
    return new Response('not configured', { status: 503 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: pending } = await supabase
    .from('bookings')
    .select('id, payment_id, charged_amount, refund_attempts')
    .eq('payment_status', 'reembolso_pendiente')
    .eq('payment_provider', 'paypal')
    // `payment_id` es el id de la CAPTURA, que es lo que se reembolsa. Lo escribe
    // `paypal-webhook` al confirmar el cobro; si está en null, el pago nunca se
    // capturó y no hay nada que devolver.
    .not('payment_id', 'is', null)
    .lt('refund_attempts', MAX_ATTEMPTS)
    .limit(50)

  let ok = 0, fail = 0

  async function markFailure(b: { id: string; refund_attempts: number | null }, reason: string) {
    const attempts = (b.refund_attempts ?? 0) + 1
    await supabase.from('bookings').update({ refund_attempts: attempts }).eq('id', b.id)
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`[paypal-refunds] DEAD-LETTER booking ${b.id} tras ${attempts} intentos — ${reason}`)
    } else {
      console.error(`[paypal-refunds] intento ${attempts} falló booking ${b.id} — ${reason}`)
    }
    fail++
  }

  const token = await getAccessToken()
  if (!token) return new Response('oauth failed', { status: 502 })

  for (const b of pending ?? []) {
    try {
      // Se manda el monto explícito y NO un body vacío. En PayPal un refund sin
      // `amount` es total, pero mandarlo explícito hace que la cifra devuelta
      // quede escrita en la petición: si alguna vez hubiera un desvío entre lo
      // cobrado y lo devuelto, se ve en el log de PayPal y no hay que deducirlo.
      const monto = Number(b.charged_amount ?? NaN)
      const body = Number.isFinite(monto)
        ? JSON.stringify({ amount: { value: monto.toFixed(2), currency_code: 'USD' } })
        : JSON.stringify({})

      const r = await fetch(`${PAYPAL_API}/v2/payments/captures/${b.payment_id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // Idempotencia: dos corridas del cron solapadas no devuelven dos veces.
          'PayPal-Request-Id': `refund-${b.id}`,
        },
        body,
      })

      if (!r.ok) {
        const texto = await r.text()
        // Ya reembolsada: no es un fallo. Sin este caso, una reserva devuelta a
        // mano desde el panel de PayPal se quedaría reintentando hasta el
        // dead-letter y figuraría como pendiente para siempre.
        if (texto.includes('CAPTURE_FULLY_REFUNDED') || texto.includes('ALREADY_REFUNDED')) {
          await supabase
            .from('bookings')
            .update({ payment_status: 'reembolsado', refunded_at: new Date().toISOString() })
            .eq('id', b.id)
          ok++
          continue
        }
        await markFailure(b, `refund ${r.status}: ${texto}`)
        continue
      }

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
