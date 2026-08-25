// paypal-diagnostico — NO DEPLOYADA. Se conserva a propósito.
//
// Se deployó el 24/08/2026, hizo su trabajo y se borró el mismo día. El archivo
// queda porque el chequeo vuelve a hacer falta ENTERO en el pase a producción:
// el webhook id es por app y por modo, así que el de live va a ser otro, y el
// scope de Payouts recién es concluyente con credenciales live.
//
// Ese día: `supabase functions deploy paypal-diagnostico`, invocarla desde el
// SQL Editor con `net.http_post` y la service_role key del Vault (así ningún
// secret pasa por otro lado), leer el veredicto, y borrar el deploy.
//
// 🔴 Lo que encontró la primera vez, para que no se subestime: `PAYPAL_WEBHOOK_ID`
// apuntaba a un webhook que no existía en ese modo. Con eso,
// verify-webhook-signature devuelve FAILURE, el webhook contesta 401 y NUNCA
// captura — el pago queda aprobado sin cobrar y la reserva en 'pendiente', sin
// ningún error visible del lado de la app.
//
// Contesta, desde adentro (que es el único lugar donde conviven las credenciales
// y el PAYPAL_WEBHOOK_ID), las tres preguntas que deciden si la prueba de punta
// a punta puede funcionar:
//
//   1. ¿En qué modo está el riel? (sandbox / live)
//   2. ¿Hay un webhook registrado, y su URL es la de nuestra función?
//   3. ¿PAYPAL_WEBHOOK_ID es el id de ESE webhook, y están suscritos los dos
//      eventos que el riel necesita?
//   4. ¿La cuenta tiene aprobado el acceso a PAYOUTS? (para pagarle a los
//      coaches que eligen cobrar en su PayPal)
//
// Se hace así y no mirando los dos dashboards porque la comparación a ojo entre
// un id de PayPal y un secret de Supabase es justo el tipo de chequeo que
// "parece" que da bien. Y porque `supabase secrets list` devuelve los valores
// hasheados, así que desde afuera no hay forma de verificarlo.
//
// No devuelve ninguna credencial: solo el modo, la URL registrada, los eventos
// y el veredicto de la comparación.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET') ?? ''
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? ''
const PAYPAL_MODE = Deno.env.get('PAYPAL_MODE') ?? 'sandbox'
const PAYPAL_API = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// Los dos que el riel necesita. Con solo el primero, el webhook captura la
// plata y la reserva nunca se entera: el peor estado de los posibles.
const EVENTOS_NECESARIOS = ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED']

const URL_ESPERADA = `${SUPABASE_URL}/functions/v1/paypal-webhook`

serve(async (req) => {
  // Mismo guardián que `paypal-process-refunds`: se invoca desde el SQL Editor
  // con la service_role key del Vault, así que ningún secret pasa por otro lado.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    return json({ error: 'faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET' }, 503)
  }

  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!tokenRes.ok) {
    // 401 acá casi siempre significa credenciales de un modo apuntando al otro:
    // los dos hosts son distintos y las credenciales no son intercambiables.
    return json({
      modo: PAYPAL_MODE,
      api: PAYPAL_API,
      error: 'el handshake con PayPal falló',
      status: tokenRes.status,
      detalle: await tokenRes.text(),
    }, 502)
  }
  const tokenBody = await tokenRes.json()
  const token = tokenBody.access_token

  // ── Payouts ────────────────────────────────────────────────────────────────
  // 🔴 Se lee del `scope` que devuelve el propio handshake, y NO probando un
  // payout: un intento real movería plata si resultara que sí está habilitado,
  // y un intento inválido devolvería un error de validación que taparía la
  // respuesta que buscamos. El scope es lectura pura y no mueve un dólar.
  //
  // ⚠️ En SANDBOX suele estar concedido siempre. Que acá diga que sí NO prueba
  // que producción esté aprobado — PayPal aprueba Payouts por separado, y para
  // la cuenta live. Este chequeo recién es concluyente con credenciales live.
  const scopes: string[] = String(tokenBody.scope ?? '').split(' ').filter(Boolean)
  const scopesPayouts = scopes.filter((sc) => sc.includes('payouts'))

  const whRes = await fetch(`${PAYPAL_API}/v1/notifications/webhooks`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!whRes.ok) {
    return json({ modo: PAYPAL_MODE, error: 'no se pudieron listar los webhooks', detalle: await whRes.text() }, 502)
  }

  const { webhooks = [] } = await whRes.json()

  const registrados = webhooks.map((w: any) => {
    const eventos = (w.event_types ?? []).map((e: any) => e.name)
    return {
      id: w.id,
      url: w.url,
      es_el_configurado: w.id === PAYPAL_WEBHOOK_ID,
      url_correcta: w.url === URL_ESPERADA,
      eventos_totales: eventos.length,
      // `*` = todos los eventos, que también sirve.
      faltantes: eventos.includes('*')
        ? []
        : EVENTOS_NECESARIOS.filter((e) => !eventos.includes(e)),
    }
  })

  const elNuestro = registrados.find((w: any) => w.es_el_configurado)

  return json({
    modo: PAYPAL_MODE,
    api: PAYPAL_API,
    payouts: {
      scopes_concedidos: scopesPayouts,
      veredicto: scopesPayouts.length
        ? (PAYPAL_MODE === 'live'
            ? '✅ Payouts aprobado en la cuenta live'
            : '🟡 concedido en SANDBOX — no dice nada sobre la cuenta live, que es la que hay que mirar en el dashboard')
        : (PAYPAL_MODE === 'live'
            ? '🔴 la cuenta live NO tiene Payouts aprobado — no se le puede pagar a un coach por PayPal, y "enviar dinero" común le cobraría A ÉL al recibir'
            : '🔴 ni siquiera en sandbox aparece el scope de Payouts'),
    },
    url_esperada: URL_ESPERADA,
    webhook_id_configurado: PAYPAL_WEBHOOK_ID || '(vacío)',
    registrados,
    veredicto: !PAYPAL_WEBHOOK_ID
      ? '🔴 PAYPAL_WEBHOOK_ID está vacío — el webhook rechaza todo con 503'
      : !elNuestro
      ? '🔴 PAYPAL_WEBHOOK_ID no corresponde a ningún webhook registrado en este modo — verify-webhook-signature va a dar FAILURE y el webhook va a contestar 401'
      : !elNuestro.url_correcta
      ? `🔴 el webhook configurado apunta a ${elNuestro.url}, no a la función`
      : elNuestro.faltantes.length
      ? `🔴 faltan eventos suscritos: ${elNuestro.faltantes.join(', ')}`
      : '✅ todo en orden: el webhook existe, apunta a la función y tiene los dos eventos',
  })
})
