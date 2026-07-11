// mp-create-payment — crea la preferencia de Checkout Pro para una reserva.
//
// SCAFFOLD v1 — estructura lista; la llamada a MP está marcada TODO y hay que
// verificarla contra la doc vigente de MercadoPago antes de producción.
//
// COBRO AL RESERVAR: la app llama a esta función al confirmar la reserva. Crea
// una preferencia con `marketplace_fee` (comisión VITA 10%) usando el token del
// COACH (split), y devuelve el init_point (URL de Checkout Pro) que la app abre
// en WebBrowser. El resultado real del pago llega por mp-webhook.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_WEBHOOK_URL = Deno.env.get('MP_WEBHOOK_URL')!         // URL pública de mp-webhook
const CHECKOUT_RETURN_URL = Deno.env.get('CHECKOUT_RETURN_URL') ?? 'vive://booking/result'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { booking_id } = await req.json()
    if (!booking_id) return json({ error: 'Missing booking_id' }, 400)

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, user_id, coach_id, coach_name, amount, currency, payment_status, preference_id, platform_fee_pct')
      .eq('id', booking_id)
      .single()

    if (!booking) return json({ error: 'Booking not found' }, 404)
    if (booking.user_id !== user.id) return json({ error: 'Forbidden' }, 403)
    // Idempotente: si ya hay preferencia y no fue rechazada, reusarla
    if (booking.preference_id && booking.payment_status === 'pendiente') {
      return json({ preference_id: booking.preference_id }, 200)
    }

    // Token del coach (split). Sin cuenta MP conectada, no se puede cobrar.
    const { data: mp } = await supabase
      .from('coach_mp_accounts')
      .select('access_token')
      .eq('coach_id', booking.coach_id)
      .single()
    if (!mp?.access_token) return json({ error: 'Coach sin Mercado Pago conectado' }, 409)

    // ── Comisión (server-side; el cliente NUNCA la calcula) ──────────────────
    // Esquema definitivo (ver memoria project_vive_payments):
    //   0% promo fundador (hasta FOUNDER_PROMO_UNTIL) ·
    //   20% las primeras 3 sesiones COMPLETADAS del par coach-usuario ·
    //   15% de la 4ta en adelante (permanente).
    // Contador POR PAR (user_id + coach_id), solo 'completada', nunca resetea.
    const promoUntil = Deno.env.get('FOUNDER_PROMO_UNTIL') // ISO date, TBD
    let commissionPct: number
    if (promoUntil && Date.now() < Date.parse(promoUntil)) {
      commissionPct = 0
    } else {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', booking.user_id)
        .eq('coach_id', booking.coach_id)
        .eq('status', 'completada')
      commissionPct = (count ?? 0) < 3 ? 20 : 15
    }

    // marketplace_fee = comisión pura (20/15%). El IVA NO se hornea acá: depende
    // de la figura fiscal de VITA (monotributo → factura C sin IVA discriminado
    // vs. RI → con IVA), todavía sin decidir. El IVA vive en la factura, no en el
    // schema ni en este cálculo. TODO(fiscal): si VITA queda RI, sumar el IVA acá.
    const marketplaceFee = Math.round(Number(booking.amount) * commissionPct) / 100

    // TODO(MP) CRÍTICO: configurar el MONEY RELEASE del split para RETENER el
    // dinero del coach hasta DESPUÉS de la sesión. Sin esto, un reembolso (o el
    // 100% durante la promo 0%) puede no tener fondos en la cuenta del coach.
    // Verificar en la doc de "liberación de dinero" del marketplace de MP.

    // TODO(MP): verificar contra docs — POST https://api.mercadopago.com/checkout/preferences
    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mp.access_token}`, // token del COACH
      },
      body: JSON.stringify({
        items: [{
          title: `Sesión con ${booking.coach_name ?? 'tu coach'}`,
          quantity: 1,
          unit_price: Number(booking.amount),
          currency_id: booking.currency ?? 'ARS',
        }],
        marketplace_fee: marketplaceFee,          // comisión VITA (10%)
        external_reference: booking.id,           // clave para mp-webhook
        notification_url: MP_WEBHOOK_URL,
        back_urls: { success: CHECKOUT_RETURN_URL, failure: CHECKOUT_RETURN_URL, pending: CHECKOUT_RETURN_URL },
        auto_return: 'approved',
      }),
    })
    const pref = await prefRes.json()
    if (!prefRes.ok) {
      console.error('[mp-create-payment] preference error:', pref)
      return json({ error: 'No se pudo crear el pago' }, 502)
    }

    await supabase
      .from('bookings')
      .update({ preference_id: pref.id, payment_status: 'pendiente', platform_fee_pct: commissionPct })
      .eq('id', booking.id)

    return json({ preference_id: pref.id, init_point: pref.init_point }, 200)
  } catch (e) {
    console.error('[mp-create-payment] error:', e)
    return json({ error: 'Error interno' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
