// usdt-claim — "pagué en USDT y no se acreditó": el cliente presenta su comprobante.
//
// El cobro en USDT se reconoce solo por el monto exacto (ver _shared/usdt.ts).
// Cuando no coincide —el exchange descontó su comisión, se tipeó mal, o se pagó
// después de que la reserva venciera— la plata está en la billetera pero ninguna
// reserva la reconoce. Acá la persona pega el hash de su transferencia.
//
// 🔴 NO ACREDITA. Las transferencias de Tron son públicas: cualquiera puede ver
// una que llegó a nuestra billetera y presentarla como propia. Esta función solo
// comprueba que la transferencia existe y deja el comprobante para que lo
// apruebe una persona (`admin-actions` → `resolve_usdt_claim`).
//
//   body: { booking_id, tx_id }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { USDT_TRC20_CONTRACT, fromRaw, type TronTransfer } from '../_shared/usdt.ts'
import { WEB_ORIGIN } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const USDT_WALLET = Deno.env.get('USDT_WALLET_TRC20') ?? ''
const TRONGRID_API_KEY = Deno.env.get('TRONGRID_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  // Mismo freno que el resto del riel: cerrado hasta que se configure a propósito.
  if (!USDT_WALLET || Deno.env.get('USDT_LEDGER_WALLET') !== USDT_WALLET) {
    return json({ error: 'Los pagos USDT están temporalmente en revisión' }, 503)
  }

  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id : ''
  const txId = typeof body.tx_id === 'string' ? body.tx_id.trim().toLowerCase() : ''
  if (!bookingId) return json({ error: 'Falta booking_id' }, 400)
  if (!/^[0-9a-f]{64}$/.test(txId)) {
    return json({ error: 'El comprobante tiene que ser el código de la transferencia: 64 letras y números' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Cada intento consulta la red: sin tope se podría usar para probar hashes ajenos.
  const { data: dentroDelTope, error: topeError } = await admin.rpc('consume_rate_limit', {
    p_bucket: 'usdt_claim', p_subject: `user:${user.id}`, p_max: 5, p_window: '1 hour',
  })
  if (topeError) return json({ error: 'No se pudo validar el pedido' }, 503)
  if (!dentroDelTope) return json({ error: 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.' }, 429)

  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id, status, payment_status, payment_provider, usdt_amount, created_at')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return json({ error: 'Reserva inexistente' }, 404)
  if (booking.user_id !== user.id) return json({ error: 'Unauthorized' }, 403)
  // Sirve para una reserva que espera el pago y para una que venció esperándolo
  // (ahí lo que corresponde es el reintegro, lo decide quien revisa).
  if (booking.payment_provider !== 'usdt' || booking.usdt_amount == null
      || booking.payment_status !== 'pendiente' || !['pendiente', 'cancelada'].includes(booking.status)) {
    return json({ error: 'Esta reserva no está esperando un pago en USDT' }, 409)
  }

  const { data: yaPago } = await admin.from('bookings').select('id').eq('payment_id', txId).limit(1)
  if (yaPago?.length) return json({ error: 'Ese comprobante ya se usó para otra reserva' }, 409)
  const { data: yaPresentado } = await admin.from('usdt_claims').select('id, booking_id').eq('tx_id', txId).neq('estado', 'rechazado').limit(1)
  if (yaPresentado?.length) {
    return yaPresentado[0].booking_id === booking.id
      ? json({ ok: true, estado: 'pendiente', ya_estaba: true })
      : json({ error: 'Ese comprobante ya fue presentado' }, 409)
  }

  // ¿Existe esa transferencia, confirmada, en USDT de verdad y hacia nuestra billetera?
  const desde = Date.parse(booking.created_at as string) - 5 * 60 * 1000
  const url = `https://api.trongrid.io/v1/accounts/${USDT_WALLET}/transactions/trc20`
    + `?only_to=true&only_confirmed=true&limit=200&min_timestamp=${desde}&contract_address=${USDT_TRC20_CONTRACT}`
  let transfers: TronTransfer[] = []
  try {
    const res = await fetch(url, { headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {} })
    if (!res.ok) throw new Error(`TronGrid ${res.status}`)
    transfers = ((await res.json())?.data ?? []) as TronTransfer[]
  } catch (e) {
    console.error('[usdt-claim] no se pudo consultar la red:', e)
    return json({ error: 'No pudimos consultar la red en este momento. Probá de nuevo en unos minutos.' }, 502)
  }
  const t = transfers.find(x => x.transaction_id === txId
    && x.type === 'Transfer'
    && (x.token_info?.address ?? '') === USDT_TRC20_CONTRACT   // contrato, no símbolo
    && x.to === USDT_WALLET)
  if (!t || !Number.isFinite(t.block_timestamp)) {
    return json({
      error: 'Todavía no vemos esa transferencia. Revisá que el código sea el correcto, que la red sea TRC20 y que sea posterior a tu reserva; si recién la hiciste, probá de nuevo en unos minutos.',
    }, 404)
  }

  const { error: insertError } = await admin.from('usdt_claims').insert({
    booking_id: booking.id,
    user_id: user.id,
    tx_id: txId,
    amount: fromRaw(t.value),
    from_address: t.from,
    block_time: new Date(t.block_timestamp).toISOString(),
  })
  if (insertError) {
    // 23505: otro comprobante ganó la carrera (mismo hash o misma reserva en espera).
    if ((insertError as { code?: string }).code === '23505') {
      return json({ error: 'Ya hay un comprobante en revisión para esta reserva o con ese código' }, 409)
    }
    console.error('[usdt-claim] no se pudo guardar:', insertError.message)
    return json({ error: 'No se pudo guardar el comprobante' }, 500)
  }

  return json({ ok: true, estado: 'pendiente' })
})
