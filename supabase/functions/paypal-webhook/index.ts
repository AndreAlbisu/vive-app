// paypal-webhook — recibe las notificaciones de PayPal sobre una orden.
//
// Es la pieza equivalente a `mp-webhook`, y se escribe con la lección de aquel
// puesta desde el primer commit: **el webhook de Mercado Pago estuvo MUERTO un
// mes entero sin que nadie se enterara** (leía el pago con el token equivocado y
// cortaba en 502), con los pagos acreditándose del lado del procesador y las
// reservas quedando en 'pendiente' para siempre. Un webhook que falla en
// silencio es peor que no tenerlo: promete un estado que nunca llega.
//
// Por eso acá: fail-closed sin el secret de firma, verificación real contra la
// API de PayPal, e idempotencia explícita en la escritura.
//
// ── El flujo de PayPal, que NO es el de Mercado Pago ─────────────────────────
// La orden se crea con `intent: CAPTURE`, pero aprobar y capturar son dos pasos:
//   1. La persona aprueba en PayPal        → CHECKOUT.ORDER.APPROVED
//   2. Alguien tiene que CAPTURAR la plata → PAYMENT.CAPTURE.COMPLETED
// El paso 2 no ocurre solo. Se dispara desde acá y no desde el cliente al
// volver: si dependiera de que la persona vuelva a la app, cerrar el navegador
// después de aprobar dejaría el dinero autorizado y nunca cobrado — con la
// reserva impaga y el horario ocupado.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET') ?? ''
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? ''
const PAYPAL_MODE = Deno.env.get('PAYPAL_MODE') ?? 'sandbox'
const PAYPAL_API = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string | null> {
  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    console.error('[paypal-webhook] oauth falló:', res.status, await res.text())
    return null
  }
  return (await res.json()).access_token ?? null
}

/**
 * Verifica la firma contra la API de PayPal.
 *
 * PayPal no firma con HMAC como Mercado Pago: se le manda la notificación de
 * vuelta con sus headers y él responde si es auténtica. Cuesta una llamada de
 * red por notificación, y se paga con gusto — la alternativa es confiar en un
 * POST público que escribe `payment_status`, o sea permitirle a cualquiera
 * regalarse sesiones.
 */
async function verificarFirma(token: string, headers: Headers, rawBody: string): Promise<boolean> {
  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: PAYPAL_WEBHOOK_ID,
      // El body va como objeto ya parseado, no como string: así lo espera la API.
      webhook_event: JSON.parse(rawBody),
    }),
  })
  if (!res.ok) {
    console.error('[paypal-webhook] verify falló:', res.status, await res.text())
    return false
  }
  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}

serve(async (req) => {
  // ── Fail-closed ───────────────────────────────────────────────────────────
  // Sin el webhook id no se puede verificar nada, y procesar sin verificar
  // convierte este endpoint público en "cualquiera marca su reserva como
  // pagada". Se rechaza con 503 y no con 200: un 200 le diría a PayPal que la
  // notificación se procesó bien y no la reintentaría nunca más.
  if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    console.error('[paypal-webhook] faltan credenciales o PAYPAL_WEBHOOK_ID — se rechaza sin procesar')
    return new Response('not configured', { status: 503 })
  }

  const rawBody = await req.text()
  let evento: any
  try {
    evento = JSON.parse(rawBody)
  } catch {
    // Un body ilegible no se puede verificar ni procesar. 400 y no 500: el
    // problema es de quien lo mandó, y con 400 PayPal no lo reintenta en loop.
    return new Response('bad json', { status: 400 })
  }

  const tipo: string = evento?.event_type ?? ''

  // Los eventos que no nos interesan se descartan con 200 ANTES de gastar la
  // llamada de verificación. PayPal manda muchos tipos por orden; devolverle
  // cualquier cosa distinta de 2xx lo hace reintentar, y eso fue lo que en MP
  // generó 8 reintentos por un solo pago. Descartar sin verificar es seguro
  // porque estas ramas no leen ni escriben nada.
  const RELEVANTES = ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED']
  if (!RELEVANTES.includes(tipo)) {
    return new Response('ignored', { status: 200 })
  }

  const token = await getAccessToken()
  if (!token) return new Response('oauth failed', { status: 502 })

  if (!await verificarFirma(token, req.headers, rawBody)) {
    console.error('[paypal-webhook] firma inválida, evento descartado:', tipo)
    return new Response('invalid signature', { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const recurso = evento.resource ?? {}

  // ── 1. Aprobada pero sin capturar → capturar ──────────────────────────────
  if (tipo === 'CHECKOUT.ORDER.APPROVED') {
    const orderId: string = recurso.id ?? ''
    if (!orderId) return new Response('no order id', { status: 200 })

    const capRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Idempotencia: si PayPal reintenta la notificación, no se captura dos
        // veces. Sin esto un reintento puede devolver error y parecer un fallo
        // real cuando la plata ya está cobrada.
        'PayPal-Request-Id': `capture-${orderId}`,
      },
    })

    if (!capRes.ok) {
      const texto = await capRes.text()
      // 422 con ORDER_ALREADY_CAPTURED es el caso normal de un reintento: la
      // plata ya está. No es un error y no hay que pedirle a PayPal que insista.
      if (texto.includes('ORDER_ALREADY_CAPTURED')) {
        return new Response('already captured', { status: 200 })
      }
      console.error('[paypal-webhook] capture falló:', capRes.status, texto)
      // 502 para que PayPal reintente: la orden está aprobada y sin capturar,
      // que es el peor estado posible para quedarse.
      return new Response('capture failed', { status: 502 })
    }

    // La captura exitosa dispara PAYMENT.CAPTURE.COMPLETED, que es donde se
    // escribe el estado. No se escribe acá para tener UN solo lugar que lo haga.
    return new Response('captured', { status: 200 })
  }

  // ── 2. Capturada → marcar la reserva como pagada ──────────────────────────
  // `custom_id` viaja desde la creación de la orden (`paypal-create-payment`) y
  // es el booking id. Es el equivalente al `external_reference` de MP — y la
  // razón por la que este riel no tiene que adivinar por monto como USDT.
  const bookingId: string = recurso.custom_id ?? ''
  const captureId: string = recurso.id ?? ''
  if (!bookingId) {
    console.error('[paypal-webhook] captura sin custom_id, no se puede asociar:', captureId)
    // 200 a propósito: reintentar no va a hacer aparecer el custom_id, y dejar a
    // PayPal insistiendo sobre algo irrecuperable solo genera ruido. Queda el
    // log, que es lo que permite encontrarlo a mano.
    return new Response('no custom_id', { status: 200 })
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, payment_status, charged_amount')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) {
    console.error('[paypal-webhook] custom_id sin reserva:', bookingId)
    return new Response('unknown booking', { status: 200 })
  }

  // 🔴 Se compara lo capturado contra lo que se pidió cobrar. La orden se crea
  // del lado del servidor, así que un desvío acá significa que algo no cierra —
  // y marcar como pagada una reserva por la que entró menos plata es
  // exactamente el error que nadie encuentra después.
  const capturado = Number(recurso?.amount?.value ?? NaN)
  const esperado = Number(booking.charged_amount ?? NaN)
  if (Number.isFinite(capturado) && Number.isFinite(esperado) && Math.abs(capturado - esperado) > 0.01) {
    console.error(
      `[paypal-webhook] monto distinto al esperado en ${bookingId}: capturado ${capturado}, esperado ${esperado}`,
    )
    return new Response('amount mismatch', { status: 200 })
  }

  // Idempotente: el `.eq('payment_status', 'pendiente')` hace que un reintento
  // no reescriba una reserva ya resuelta (ni pise un reembolso en curso).
  const { data: actualizada, error } = await admin
    .from('bookings')
    .update({
      payment_status: 'aprobado',
      payment_id: captureId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('payment_provider', 'paypal')
    .eq('payment_status', 'pendiente')
    .select('id')

  if (error) {
    console.error('[paypal-webhook] no se pudo marcar como pagada:', error.message)
    // 502 para que PayPal reintente: la plata está cobrada y la reserva no lo
    // sabe, que es justo el estado en el que quedó MP durante un mes.
    return new Response('update failed', { status: 502 })
  }

  if (!actualizada || actualizada.length === 0) {
    // Ya estaba marcada (reintento normal) o cambió de estado mientras tanto.
    return new Response('no change', { status: 200 })
  }

  return new Response('ok', { status: 200 })
})
