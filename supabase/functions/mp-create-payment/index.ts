// mp-create-payment — crea la preferencia de Checkout Pro para una reserva.
//
// COBRO AL RESERVAR: la app llama a esta función al confirmar la reserva. Crea
// una preferencia con `marketplace_fee` (comisión VITA server-side, 20/15% según
// el par coach-usuario) usando el token del COACH (split), y devuelve el
// init_point (URL de Checkout Pro) que la app abre en WebBrowser. El resultado
// real del pago llega por mp-webhook.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getFreshCoachToken } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!            // para refrescar el token del coach
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!
const MP_WEBHOOK_URL = Deno.env.get('MP_WEBHOOK_URL')!         // URL pública de mp-webhook
const CHECKOUT_RETURN_URL = Deno.env.get('CHECKOUT_RETURN_URL') ?? 'viveapp://booking/result'
// Split on/off. Default true (prod). Poner MP_SPLIT_ENABLED=false para diagnosticar
// si el marketplace_fee es lo que rompe el checkout (app sin marketplace activado).
const MP_SPLIT_ENABLED = Deno.env.get('MP_SPLIT_ENABLED') !== 'false'
// Sandbox: en test hay que devolver el sandbox_init_point (checkout de prueba).
const MP_TEST_MODE = Deno.env.get('MP_TEST_MODE') === 'true'

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

    // Token del coach (split), refrescado si está por vencer. Sin cuenta MP
    // conectada, no se puede cobrar.
    const coachToken = await getFreshCoachToken(
      supabase, booking.coach_id, MP_CLIENT_ID, MP_CLIENT_SECRET,
    )
    if (!coachToken) return json({ error: 'Coach sin Mercado Pago conectado' }, 409)

    // Idempotente: si ya hay preferencia pendiente, reusarla — pero devolviendo el
    // init_point real (leído de MP), no solo el id. Devolver solo preference_id
    // dejaba al cliente sin URL de checkout → mandaba al usuario a "reserva ok" sin
    // pagar. Se recupera con un GET de la preferencia existente.
    if (booking.preference_id && booking.payment_status === 'pendiente') {
      const prefRes = await fetch(
        `https://api.mercadopago.com/checkout/preferences/${booking.preference_id}`,
        { headers: { Authorization: `Bearer ${coachToken}` } },
      )
      const pref = await prefRes.json().catch(() => ({}))
      if (prefRes.ok) {
        const checkoutUrl = MP_TEST_MODE ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point
        return json({ preference_id: booking.preference_id, init_point: checkoutUrl }, 200)
      }
      // Si no se pudo leer (preferencia vencida/borrada), caemos a crear una nueva.
      console.warn('[mp-create-payment] no se pudo leer preferencia existente, se crea otra:', pref)
    }

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

    // ⚠️ MONEY RELEASE (RE-VERIFICADO en docs MP, 07/2026): con Checkout Pro NO hay
    // parámetro para setear/demorar el release por transacción. `money_release_date`
    // existe pero es un campo de RESPUESTA del pago (lo calcula MP, ~14 días post-
    // aprobación por default), no seteable desde acá. Cambiar el timing del release
    // = config a nivel CUENTA con el account manager de MP (ahí sí hay parte
    // comercial). Nuance útil: el default ~14d ya actúa de buffer — si la sesión y un
    // posible refund caen dentro de esos ~14d, los fondos del coach siguen retenidos.
    // El riesgo real es sesión a >14d del pago (o coach que ya retiró): ahí el refund
    // sale de su balance, crítico en promo 0%. => nada que codear acá; leverage = MP.

    const prefBody: Record<string, unknown> = {
      items: [{
        title: `Sesión con ${booking.coach_name ?? 'tu coach'}`,
        quantity: 1,
        unit_price: Number(booking.amount),
        currency_id: booking.currency ?? 'ARS',
      }],
      external_reference: booking.id,           // clave para mp-webhook
      notification_url: MP_WEBHOOK_URL,
    }
    // Split: comisión VITA (tier server-side). Se puede apagar para diagnóstico.
    if (MP_SPLIT_ENABLED) prefBody.marketplace_fee = marketplaceFee
    // MP EXIGE back_urls https (un deep link `viveapp://` da error `invalid_back_urls`
    // → "algo salió mal" al aprobar). El retorno a la app ya lo maneja el WebBrowser
    // (se cierra) + el webhook, así que solo mandamos back_urls/auto_return si hay una
    // URL https real. Con el deep link default → se omiten y el pago funciona igual.
    if (CHECKOUT_RETURN_URL.startsWith('https://')) {
      prefBody.back_urls = { success: CHECKOUT_RETURN_URL, failure: CHECKOUT_RETURN_URL, pending: CHECKOUT_RETURN_URL }
      prefBody.auto_return = 'approved'
    }

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coachToken}`, // token del COACH (refrescado)
      },
      body: JSON.stringify(prefBody),
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

    // En modo test hay que abrir el checkout de SANDBOX (sandbox_init_point);
    // el init_point de producción con una preferencia de prueba tira "algo anduvo mal".
    const checkoutUrl = MP_TEST_MODE ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point
    return json({ preference_id: pref.id, init_point: checkoutUrl }, 200)
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
