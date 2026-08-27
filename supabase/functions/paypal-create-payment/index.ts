// paypal-create-payment — arma el cobro de una reserva por PayPal.
//
// Tercer riel, para clientes del exterior que no pueden pagar con Mercado Pago
// (rechaza tarjetas emitidas fuera de Argentina) ni quieren usar cripto.
//
// A diferencia del riel de MP, acá **cobra VIVE y después le transfiere al
// coach**: PayPal no hace split de marketplace en esta configuración. Por eso la
// reserva queda registrada con `platform_fee_pct`, que es lo que después lee el
// panel de pagos para calcular cuánto se le debe (ver `lib/admin.ts`).
//
// El precio sale de `coaches.price_usd` y NO del body: si lo mandara el cliente,
// cualquiera podría reservar por un dólar. Mismo criterio que la comisión.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { commissionPctFor, PAIR_SESSION_FILTER } from '../_shared/commission.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET') ?? ''

// ⚠️ Flag EXPLÍCITO y no inferido. Las dos APIs son hosts distintos y las
// credenciales no son intercambiables: apuntar a producción con credenciales de
// sandbox da un 401 genérico que parece cualquier otra cosa. Se declara acá
// arriba —y no se lee suelto más abajo— porque `MP_TEST_MODE` ya rompió una
// función entera por usarse sin declarar (sesión 87).
const PAYPAL_MODE = Deno.env.get('PAYPAL_MODE') ?? 'sandbox'
const PAYPAL_API = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// Adónde vuelve PayPal después de pagar. Es el mismo rebote https que usa
// Mercado Pago (`booking-return`), que hace un 302 al deep link de la app: un
// `viveapp://` directo no lo acepta ningún procesador como return URL.
// Mismo default que `mp-create-payment` (sesión 117): sin esto la vuelta a la
// app quedaba apagada salvo que alguien se acordara de setear el secret, y
// desde que el checkout se abre FUERA de la app eso significa dejar a la
// persona parada en PayPal después de pagar.
const CHECKOUT_RETURN_URL = Deno.env.get('CHECKOUT_RETURN_URL')
  ?? `${SUPABASE_URL}/functions/v1/booking-return`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Token de acceso de la aplicación (client_credentials). Vive ~9 horas, pero no
 *  se cachea entre invocaciones a propósito: cada instancia de la función es
 *  efímera y un token guardado en memoria global sobreviviría de forma
 *  impredecible. Pedirlo cuesta una llamada y evita razonar sobre expiración. */
async function getAccessToken(): Promise<string | null> {
  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    console.error('[paypal-create] oauth falló:', res.status, await res.text())
    return null
  }
  const data = await res.json()
  return data.access_token ?? null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    console.error('[paypal-create] faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET')
    return json({ error: 'Pago con PayPal no disponible' }, 503)
  }

  // 🔴 Se pide ACÁ, ya — no depende de la reserva ni del coach, así que
  // esperar a tenerlos resueltos antes de pedirlo solo suma un viaje de red
  // entero (el OAuth de PayPal) al camino crítico entre apretar "Reservar
  // sesión" y abrir el checkout. Se resuelve en paralelo con todo lo de abajo
  // y se espera recién al final, cuando ya hace falta.
  const tokenPromise = getAccessToken()

  // Identidad desde el JWT — lo único que el cliente no puede falsificar.
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { booking_id } = await req.json().catch(() => ({}))
  if (!booking_id) return json({ error: 'Falta booking_id' }, 400)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id, coach_id, payment_status, payment_provider, preference_id, charged_amount')
    .eq('id', booking_id)
    .maybeSingle()

  if (!booking) return json({ error: 'Reserva inexistente' }, 404)
  if (booking.user_id !== user.id) return json({ error: 'Unauthorized' }, 403)
  if (booking.payment_status === 'aprobado') return json({ error: 'Esta reserva ya está pagada' }, 409)

  // 🔴 El coach y el conteo de sesiones del par (comisión, más abajo) tampoco
  // dependen entre sí — los dos solo necesitan `booking`, que ya está. Antes
  // iban uno atrás del otro; en paralelo.
  const [{ data: coach }, { count: sesionesDelPar }] = await Promise.all([
    admin.from('coaches').select('id, price_usd, accepts_international').eq('id', booking.coach_id).maybeSingle(),
    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', booking.user_id)
      .eq('coach_id', booking.coach_id)
      .eq('status', 'completada')
      .or(PAIR_SESSION_FILTER),
  ])

  if (!coach?.accepts_international) {
    return json({ error: 'Este profesional no atiende sesiones desde el exterior' }, 409)
  }
  if (!coach.price_usd) {
    return json({ error: 'Este profesional todavía no fijó su precio en dólares' }, 409)
  }
  // Sin datos de cobro no habría cómo pagarle después. Mejor frenar acá que
  // cobrarle al cliente y descubrirlo el día de la transferencia. Mismo chequeo
  // que hace `usdt-create-payment`.
  const { data: payout } = await admin
    .from('coach_payout_accounts')
    .select('coach_id, accepts_paypal')
    .eq('coach_id', coach.id)
    .maybeSingle()
  if (!payout) {
    return json({ error: 'Este profesional todavía no completó sus datos de cobro' }, 409)
  }
  // 🔴 Y que acepte ESTE riel — la regla espejo (D4), del lado del servidor.
  // Hasta ahora solo se validaba que existiera fila de datos de cobro, o sea
  // "tiene ALGÚN medio", y la elección de cuál ofrecer vivía únicamente en la
  // UI. Los flags se leen una sola vez al abrir la pantalla de confirmación, así
  // que un cliente con la pantalla vieja abierta —o una llamada directa a la
  // función— podía cobrarle a alguien por un riel que el coach no acepta. Con
  // dólares cobrados y sin destino donde pagarlos: exactamente el pozo que la
  // regla existe para evitar.
  if (!payout.accepts_paypal) {
    return json({ error: 'Este profesional no acepta cobrar por PayPal' }, 409)
  }

  const token = await tokenPromise
  if (!token) return json({ error: 'No se pudo conectar con PayPal' }, 502)

  // ── Comisión: el tramo del par, igual que en Mercado Pago ─────────────────
  // 🔴 Desde el 25/08/2026 estos rieles también tienen escalera (D3). El contador
  // del par es **uno solo** y cuenta todas las sesiones cumplidas sin mirar el
  // riel; cada riel lee su tarifa en la posición que le toca. Por eso el caso
  // "pagó una vez por PayPal y después por Mercado Pago" se resuelve solo.
  //
  // Es la misma consulta que hace `mp-create-payment`, con el mismo filtro de
  // checkouts abandonados importado de `_shared/commission.ts` — si se toca una,
  // se toca la otra. `sesionesDelPar` ya se pidió en paralelo más arriba, junto
  // con `coach`.
  const promoUntil = Deno.env.get('FOUNDER_PROMO_UNTIL')
  const commissionPct = commissionPctFor(sesionesDelPar ?? 0, Date.now(), promoUntil, 'paypal')

  // ── Precio ─────────────────────────────────────────────────────────────────
  //
  // 🔴 El cliente paga el precio del coach, sin recargo encima. El costo de
  // procesamiento sale de la comisión, no del precio ni de la parte del coach —
  // por eso `charged_amount` es igual a `amount` en este riel y existe solo para
  // el día que algún rail vuelva a cobrar algo distinto del precio.
  const precio = coach.price_usd

  const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotencia del lado de PayPal: si esta misma reserva reintenta, PayPal
      // devuelve la orden que ya existe en vez de crear una segunda. Sin esto,
      // un doble tap puede dejar dos órdenes pagables para la misma sesión.
      'PayPal-Request-Id': `booking-${booking.id}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        // 🔴 `custom_id` es el external_reference de PayPal: es por donde el
        // webhook sabe a qué reserva corresponde el pago. Sin esto habría que
        // adivinar por monto, que es el problema que USDT tiene por diseño y
        // acá no hace falta tener.
        custom_id: booking.id,
        amount: { currency_code: 'USD', value: precio.toFixed(2) },
        description: 'Sesión en VIVE',
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'VIVE',
            user_action: 'PAY_NOW',
            ...(CHECKOUT_RETURN_URL ? {
              return_url: CHECKOUT_RETURN_URL,
              cancel_url: CHECKOUT_RETURN_URL,
            } : {}),
          },
        },
      },
    }),
  })

  if (!orderRes.ok) {
    console.error('[paypal-create] crear orden falló:', orderRes.status, await orderRes.text())
    return json({ error: 'No se pudo iniciar el pago' }, 502)
  }
  const order = await orderRes.json()
  const approveUrl = (order.links ?? []).find((l: { rel?: string }) => l.rel === 'payer-action' || l.rel === 'approve')?.href

  if (!order.id || !approveUrl) {
    console.error('[paypal-create] respuesta sin id o sin link:', JSON.stringify(order))
    return json({ error: 'No se pudo iniciar el pago' }, 502)
  }

  // ⚠️ El id de la orden va en `preference_id`, la misma columna que usa el
  // checkout de Mercado Pago. NO es pereza: `expire_unpaid_checkouts()` y el
  // filtro de checkouts abandonados de la comisión (`PAIR_SESSION_FILTER`) ya
  // tratan `preference_id is not null` como "arrancó un cobro". Con una columna
  // nueva habría que acordarse de agregarla en los dos lados — y ya pasó con
  // USDT, que por no estar en ese filtro empujaba pares al tramo del 15% sin que
  // se hubiera pagado nada. `payment_provider` dice de qué riel es.
  const { error: updErr } = await admin
    .from('bookings')
    .update({
      payment_provider: 'paypal',
      payment_status: 'pendiente',
      currency: 'USD',
      amount: precio,
      charged_amount: precio,
      preference_id: order.id,
      platform_fee_pct: commissionPct,
    })
    .eq('id', booking.id)

  if (updErr) {
    // La orden ya existe en PayPal pero la reserva no la registró. Se devuelve
    // error en vez del link: si la persona pagara, el webhook llegaría con un
    // `custom_id` que no tiene la orden asociada y el pago quedaría huérfano.
    console.error('[paypal-create] no se pudo registrar la orden:', updErr.message)
    return json({ error: 'No se pudo iniciar el pago' }, 502)
  }

  return json({ order_id: order.id, approve_url: approveUrl, amount: precio, currency: 'USD' })
})
