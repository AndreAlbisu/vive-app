// usdt-create-payment — arma el cobro en USDT de una reserva.
//
// Equivale a `mp-create-payment`, pero como en cripto no hay checkout ni
// referencia externa, lo que devuelve es una dirección y un MONTO ÚNICO: ese
// monto es lo que después permite reconocer la transferencia y acreditarla
// (ver _shared/usdt.ts y usdt-check-payments).
//
// El precio sale de `coaches.price_usd` y NO del body: si lo mandara el cliente,
// cualquiera podría reservar por un dólar. Mismo criterio que la comisión en
// `mp-create-payment`, que se calcula server-side.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { uniqueAmount, NONCE_DIGITS } from '../_shared/usdt.ts'
import { commissionPctFor, PAIR_SESSION_FILTER } from '../_shared/commission.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const USDT_WALLET = Deno.env.get('USDT_WALLET_TRC20') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Cuántas veces reintentar si el nonce que elegimos ya lo tiene otra reserva.
// Con 10.000 combinaciones y decenas de pendientes, chocar dos veces seguidas
// es improbable; 8 intentos lo vuelven despreciable.
const MAX_INTENTOS = 8

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  if (!USDT_WALLET) {
    console.error('[usdt-create] falta USDT_WALLET_TRC20')
    return json({ error: 'Cobro en USDT no disponible' }, 503)
  }

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
    .select('id, user_id, coach_id, payment_status, payment_provider, usdt_amount')
    .eq('id', booking_id)
    .maybeSingle()

  if (!booking) return json({ error: 'Reserva inexistente' }, 404)
  if (booking.user_id !== user.id) return json({ error: 'Unauthorized' }, 403)
  if (booking.payment_status === 'aprobado') return json({ error: 'Esta reserva ya está pagada' }, 409)

  // Idempotente: si ya se armó el cobro, se devuelve el mismo monto. Volver a
  // sortear un nonce dejaría al usuario mirando una cifra distinta de la que
  // ya copió, y a la reserva sin poder reconocer la transferencia que mande.
  if (booking.payment_provider === 'usdt' && booking.usdt_amount != null) {
    return json({ address: USDT_WALLET, amount: Number(booking.usdt_amount), network: 'TRC20' })
  }

  const { data: coach } = await admin
    .from('coaches')
    .select('id, price_usd, accepts_international')
    .eq('id', booking.coach_id)
    .maybeSingle()

  if (!coach?.accepts_international) {
    return json({ error: 'Este profesional no atiende sesiones desde el exterior' }, 409)
  }
  if (!coach.price_usd) {
    return json({ error: 'Este profesional todavía no fijó su precio en dólares' }, 409)
  }
  // Sin datos de cobro no habría cómo pagarle después: mejor frenar acá que
  // cobrarle al usuario y descubrirlo el día de la transferencia.
  const { data: payout } = await admin
    .from('coach_payout_accounts')
    .select('coach_id')
    .eq('coach_id', coach.id)
    .maybeSingle()
  if (!payout) {
    return json({ error: 'Este profesional todavía no completó sus datos de cobro' }, 409)
  }

  // ── Comisión (server-side, igual que en `mp-create-payment`) ────────────────
  // Mismo esquema y mismo contador por par: 0% promo · 20% la primera sesión
  // completada del par · 15% de la 2da en adelante. El tramo NO depende del
  // riel — un par que ya hizo su primera sesión en pesos entra al 15% aunque la
  // segunda la pague en dólares, porque el contador es de la relación, no del
  // método de pago.
  //
  // 🔴 Acá el número pesa MÁS que en Mercado Pago. Allá el split ya repartió la
  // plata y `platform_fee_pct` queda como registro; acá entra el 100% a la
  // wallet de VIVE y este porcentaje es lo ÚNICO que después dice cuánto se le
  // debe al coach. Hasta ahora esta función no lo escribía: toda reserva
  // internacional se quedaba con el default 20 de la columna, así que un par en
  // el tramo del 15% —o en plena promo fundador de 0%— iba a cobrar de menos el
  // día de la transferencia, sin que nada lo delatara.
  const promoUntil = Deno.env.get('FOUNDER_PROMO_UNTIL') // ISO date, TBD
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', booking.user_id)
    .eq('coach_id', booking.coach_id)
    .eq('status', 'completada')
    .or(PAIR_SESSION_FILTER)

  const commissionPct = commissionPctFor(count ?? 0, Date.now(), promoUntil)

  // Sorteo del nonce. La unicidad la garantiza el índice parcial de la base
  // (bookings_usdt_pending_amount_uniq), no esta función: dos invocaciones
  // simultáneas podrían elegir el mismo número, y ahí una de las dos rebota y
  // reintenta. Comprobar antes con un SELECT no serviría — habría una ventana
  // entre el chequeo y la escritura.
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const nonce = Math.floor(Math.random() * 10 ** NONCE_DIGITS)
    const monto = uniqueAmount(coach.price_usd, nonce)

    const { data, error } = await admin
      .from('bookings')
      .update({
        payment_provider: 'usdt',
        payment_status: 'pendiente',
        currency: 'USD',
        // `amount` es el precio real; `usdt_amount` es ese precio MÁS el nonce
        // en los centavos. La comisión y lo que se le paga al coach se calculan
        // siempre sobre `amount` — el sobrante de hasta 0,99 USD es el
        // identificador del pago, no parte del precio de la sesión.
        amount: coach.price_usd,
        usdt_amount: monto,
        platform_fee_pct: commissionPct,
      })
      .eq('id', booking.id)
      .select('usdt_amount')

    if (!error && data?.length) {
      return json({ address: USDT_WALLET, amount: monto, network: 'TRC20' })
    }
    // 23505 = unique_violation → ese monto ya lo espera otra reserva.
    if (error && (error as { code?: string }).code !== '23505') {
      console.error('[usdt-create] update falló:', error.message)
      return json({ error: 'No se pudo armar el cobro' }, 502)
    }
  }

  console.error('[usdt-create] sin nonce libre tras', MAX_INTENTOS, 'intentos')
  return json({ error: 'No se pudo armar el cobro. Probá de nuevo' }, 503)
})
