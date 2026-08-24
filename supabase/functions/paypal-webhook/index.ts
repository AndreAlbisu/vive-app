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
import { applyPaidBookingEffects } from '../_shared/booking-effects.ts'

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
  // Se loguea el veredicto siempre. Sin esto, cuando la verificación se comporta
  // distinto de lo esperado no hay forma de saberlo desde afuera — y es
  // exactamente lo que pasó al probarla con una firma inventada.
  console.log('[paypal-webhook] verification_status:', data.verification_status)
  return data.verification_status === 'SUCCESS'
}

/**
 * Lee la captura desde la API de PayPal, con nuestras propias credenciales.
 *
 * 🔴 Esta es la defensa que de verdad sostiene el webhook, y existe por un
 * hallazgo concreto del 20/08/2026: **la verificación de firma de PayPal aceptó
 * un evento enteramente falsificado.** Medido y reproducido en sandbox:
 *
 *   - sin el header `paypal-cert-url`  → verification_status FAILURE (rechaza)
 *   - con un `cert_url` INVENTADO      → verification_status SUCCESS (acepta)
 *
 * O sea que un POST público con headers fabricados pasaba el control y llegaba
 * a escribir. No está verificado si en producción se comporta igual, y da lo
 * mismo: un endpoint abierto que marca reservas como pagadas no puede depender
 * de que un tercero valide bien. La firma queda como defensa en profundidad,
 * nunca como la única.
 *
 * Nadie puede fabricar una captura que exista dentro de NUESTRA cuenta de
 * PayPal. Por eso el cuerpo de la notificación pasa a ser solo un disparador, y
 * el monto, el estado y el `custom_id` se toman de esta lectura y no de él.
 *
 * Es el mismo camino al que terminó llegando `mp-webhook`: leer el pago del
 * procesador en vez de creerle a la notificación.
 */
async function leerCaptura(token: string, captureId: string): Promise<
  { status: string; value: number; customId: string } | null
> {
  const res = await fetch(`${PAYPAL_API}/v2/payments/captures/${captureId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('[paypal-webhook] no se pudo leer la captura:', captureId, res.status, await res.text())
    return null
  }
  const c = await res.json()
  return {
    status: c.status ?? '',
    value: Number(c?.amount?.value ?? NaN),
    customId: c.custom_id ?? '',
  }
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
  const captureId: string = recurso.id ?? ''
  if (!captureId) {
    console.error('[paypal-webhook] evento de captura sin id')
    return new Response('no capture id', { status: 200 })
  }

  // 🔴 Del body solo se usa el ID. Todo lo demás —estado, monto, a qué reserva
  // corresponde— sale de leer la captura contra la API con nuestras credenciales.
  const captura = await leerCaptura(token, captureId)
  if (!captura) {
    // No existe bajo nuestra cuenta, o PayPal no responde. En cualquiera de los
    // dos casos NO se escribe nada. 200 porque si la captura no existe,
    // reintentar no la va a hacer aparecer.
    return new Response('capture not found', { status: 200 })
  }

  if (captura.status !== 'COMPLETED') {
    console.error('[paypal-webhook] captura no COMPLETED:', captureId, captura.status)
    return new Response('capture not completed', { status: 200 })
  }

  const bookingId = captura.customId
  if (!bookingId) {
    console.error('[paypal-webhook] captura sin custom_id, no se puede asociar:', captureId)
    // 200 a propósito: reintentar no va a hacer aparecer el custom_id, y dejar a
    // PayPal insistiendo sobre algo irrecuperable solo genera ruido. Queda el
    // log, que es lo que permite encontrarlo a mano.
    return new Response('no custom_id', { status: 200 })
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, payment_status, charged_amount')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) {
    console.error('[paypal-webhook] custom_id sin reserva:', bookingId)
    return new Response('unknown booking', { status: 200 })
  }

  // 🔴 Se compara lo capturado (leído de la API, no del body) contra lo que se
  // pidió cobrar. La orden se crea del lado del servidor, así que un desvío acá
  // significa que algo no cierra — y marcar como pagada una reserva por la que
  // entró menos plata es exactamente el error que nadie encuentra después.
  const capturado = captura.value
  const esperado = Number(booking.charged_amount ?? NaN)
  if (Number.isFinite(capturado) && Number.isFinite(esperado) && Math.abs(capturado - esperado) > 0.01) {
    console.error(
      `[paypal-webhook] monto distinto al esperado en ${bookingId}: capturado ${capturado}, esperado ${esperado}`,
    )
    return new Response('amount mismatch', { status: 200 })
  }

  const patch: Record<string, unknown> = {
    payment_status: 'aprobado',
    payment_id: captureId,
    // Se conserva aunque abajo el estado pase a 'reembolso_pendiente': la plata
    // entró en este momento, y es el dato con el que se concilia contra PayPal.
    paid_at: new Date().toISOString(),
  }

  // 🔴 Captura acreditada sobre una reserva YA cancelada. Misma rama que
  // `mp-webhook`, y acá es MÁS probable que allá: en Mercado Pago abandonar el
  // checkout no cobra nada, mientras que en PayPal aprobar dispara
  // CHECKOUT.ORDER.APPROVED y **este mismo webhook captura la plata**. O sea
  // que cualquier aprobación posterior a la cancelación termina en un cobro.
  //
  // Cómo se llega: `soltarReserva()` cancela la reserva en cuanto el cobro no
  // se acredita (sesión 117), y `expire_unpaid_checkouts()` la barre a los 30
  // min — las dos dejan `payment_status = 'pendiente'`, así que la persona que
  // vuelve a la pestaña de PayPal y aprueba tarde cae justo acá.
  //
  // Marcarlo 'aprobado' a secas dejaría la plata adentro sin que nada la
  // devuelva: `trg_mark_refund_on_cancel` solo mira la transición a
  // 'cancelada', que en este orden ya ocurrió. Se encola el reembolso y
  // `paypal-process-refunds` lo devuelve — ya tiene todo lo que necesita
  // (`payment_id` = id de la captura, `charged_amount`, `payment_provider`).
  //
  // ⚠️ Queda la misma ventana que en `mp-webhook`: entre esta lectura y el
  // update, alguien podría cancelar. Es angosta y del lado seguro — las dos
  // vías de cancelación exigen `payment_status <> 'aprobado'`, así que si el
  // webhook llega primero la cancelación no ocurre.
  if (booking.status === 'cancelada') {
    patch.payment_status = 'reembolso_pendiente'
    console.warn('[paypal-webhook] captura sobre reserva cancelada, se encola reembolso:', bookingId)
  }

  // Idempotente: el `.eq('payment_status', 'pendiente')` hace que un reintento
  // no reescriba una reserva ya resuelta (ni pise un reembolso en curso).
  const { data: actualizada, error } = await admin
    .from('bookings')
    .update(patch)
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

  // Efectos de confirmación, server-side (sesión 117): confirmar la reserva,
  // avisarle al coach y liberar a los competidores del horario. Va acá y no en
  // el cliente porque PayPal también abre su checkout FUERA de la app, así que
  // no hay ninguna pantalla nuestra garantizada viva cuando el pago entra.
  // El `.select('id')` de arriba es lo que hace que corra una sola vez.
  //
  // `patch.payment_status` y no la constante: si la reserva ya estaba
  // cancelada, la rama de arriba lo dejó en 'reembolso_pendiente' y no hay
  // ninguna sesión que confirmar. (`applyPaidBookingEffects` igual se defiende
  // sola de ese caso; esto le ahorra la lectura y deja la intención escrita.)
  if (patch.payment_status === 'aprobado') {
    await applyPaidBookingEffects(admin, bookingId)
  }

  return new Response('ok', { status: 200 })
})
