// usdt-check-payments — acredita los cobros en USDT que llegaron a la wallet.
//
// Corre por cron. Es el equivalente de `mp-webhook`, pero al revés: Tron no nos
// avisa nada, así que preguntamos nosotros. Lee las transferencias TRC20
// recientes hacia la dirección de VIVE y las cruza contra las reservas que
// esperan cobro, reconociéndolas por su monto único (ver _shared/usdt.ts).
//
// Idempotente por diseño: filtra por `payment_status = 'pendiente'`, y el índice
// único sobre `payment_id` impide que dos reservas se acrediten con la misma
// transferencia aunque dos corridas se solapen.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { USDT_TRC20_CONTRACT, findPayment, type TronTransfer } from '../_shared/usdt.ts'
import { applyPaidBookingEffects } from '../_shared/booking-effects.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const USDT_WALLET = Deno.env.get('USDT_WALLET_TRC20')!        // dirección de cobro de VIVE
const TRONGRID_API_KEY = Deno.env.get('TRONGRID_API_KEY') ?? '' // opcional: sube el rate limit

// Ventana de búsqueda. Generosa a propósito: una reserva puede pagarse tarde, y
// una transferencia vista de más no cuesta nada — el cruce es por monto exacto.
const VENTANA_MS = 24 * 60 * 60 * 1000

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!USDT_WALLET) {
    console.error('[usdt-check] falta USDT_WALLET_TRC20')
    return new Response('wallet not configured', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 🔴 `status <> 'cancelada'` NO es un detalle. `expire_unpaid_checkouts()`
  // cancela poniendo `status = 'cancelada'` y **deja** `payment_status =
  // 'pendiente'` (correcto: no se pagó nada). Sin este filtro, cada checkout
  // abandonado se quedaba en esta lista para siempre, con tres efectos:
  //
  //   1. Una reserva cancelada podía quedar 'aprobado' si la plata llegaba
  //      tarde: paga, sin sesión, y fuera del alcance del trigger de reembolso
  //      —que dispara en la transición a 'cancelada', que ya había ocurrido.
  //   2. 🔴 El peor: `fix-usdt-amount-index.sql` hizo que el índice único de
  //      montos excluya las canceladas, así que su monto queda LIBRE para una
  //      reserva nueva. Con las dos en esta lista, un pago tardío del dueño de
  //      la cancelada podía acreditarse sobre la reserva de OTRA persona.
  //   3. Con el `.limit(200)`, las canceladas acumuladas terminan desplazando a
  //      las pendientes de verdad, que dejan de acreditarse sin ningún error.
  //
  // Cuarta vez del mismo patrón en este proyecto: `status` y `payment_status`
  // cuentan historias distintas y mezclarlas genera fugas.
  const { data: pendientes, error: errPend } = await supabase
    .from('bookings')
    .select('id, usdt_amount, user_id, status')
    .eq('payment_provider', 'usdt')
    .eq('payment_status', 'pendiente')
    .neq('status', 'cancelada')
    .not('usdt_amount', 'is', null)
    .limit(200)

  if (errPend) {
    console.error('[usdt-check] no se pudieron leer las pendientes:', errPend.message)
    return new Response('db error', { status: 502 })
  }
  if (!pendientes?.length) {
    return new Response(JSON.stringify({ pendientes: 0, acreditadas: 0 }), { status: 200 })
  }

  // Transferencias recientes hacia la wallet. `only_to=true` descarta las
  // salidas: nos interesan los cobros, no los pagos a coaches desde la misma
  // dirección — que si no, se cruzarían por monto y acreditarían de más.
  const desde = Date.now() - VENTANA_MS
  const url = `https://api.trongrid.io/v1/accounts/${USDT_WALLET}/transactions/trc20`
    + `?only_to=true&limit=200&min_timestamp=${desde}&contract_address=${USDT_TRC20_CONTRACT}`

  const res = await fetch(url, {
    headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {},
  })
  if (!res.ok) {
    console.error('[usdt-check] TronGrid', res.status, await res.text())
    return new Response('tron error', { status: 502 })
  }
  const body = await res.json()
  const transfers = (body?.data ?? []) as TronTransfer[]

  // Hashes ya acreditados: el índice único los rechazaría igual, pero saltearlos
  // acá evita un error por cada corrida y deja el log limpio.
  const { data: usadas } = await supabase
    .from('bookings')
    .select('payment_id')
    .eq('payment_provider', 'usdt')
    .not('payment_id', 'is', null)
  const hashesUsados = new Set((usadas ?? []).map(u => u.payment_id as string))

  let acreditadas = 0
  const menores: unknown[] = []

  for (const b of pendientes) {
    const r = findPayment(transfers, {
      direccion: USDT_WALLET,
      monto: Number(b.usdt_amount),
      hashesUsados,
    })

    if (r.kind === 'monto_menor') {
      // No se acredita solo: casi siempre es la comisión de retiro del exchange,
      // y decidir si se acepta es una decisión de negocio, no del cron.
      console.warn('[usdt-check] monto menor al esperado', {
        booking: b.id, recibido: r.recibido, esperado: r.esperado, tx: r.transfer.transaction_id,
      })
      menores.push({ booking: b.id, recibido: r.recibido, esperado: r.esperado })
      continue
    }
    if (r.kind !== 'match') continue

    const { data: acreditada, error: errUpd } = await supabase
      .from('bookings')
      .update({
        payment_status: 'aprobado',
        payment_id: r.transfer.transaction_id,
        paid_at: new Date(r.transfer.block_timestamp).toISOString(),
      })
      .eq('id', b.id)
      .eq('payment_status', 'pendiente')   // no pisar si otra corrida ganó
      // La misma guarda, en la escritura: entre la consulta y este update la
      // reserva pudo expirar. La consulta filtra para no traerla; esto impide
      // acreditarla si se canceló en el medio.
      .neq('status', 'cancelada')
      // El `.select()` es lo que convierte las dos guardas de arriba en un
      // RECLAMO: solo la corrida que de verdad hizo la transición recibe fila,
      // y por lo tanto solo ella aplica los efectos de abajo.
      .select('id')

    if (errUpd) {
      console.error('[usdt-check] no se pudo acreditar', b.id, errUpd.message)
      continue
    }
    if (!acreditada?.length) continue   // ganó otra corrida, o se canceló en el medio

    // 🔴 Esto FALTABA (agregado en la sesión 117, junto con el salto a la app
    // nativa de MP). El riel de USDT nunca confirmó nada: `BookingScreen_Confirm`
    // sale por `router.replace('/pago-usdt')` ANTES de `applyBookingEffects`, y
    // acá solo se escribía `payment_status`. Resultado: la persona pagaba, la
    // pantalla le decía "Tu sesión quedó confirmada" y la reserva se quedaba en
    // 'pendiente' — sin avisarle al coach, sin liberar el horario de los
    // competidores y sin nadie del otro lado. Ahora lo aplica el mismo helper
    // que usan los webhooks de MP y PayPal.
    await applyPaidBookingEffects(supabase, b.id)

    hashesUsados.add(r.transfer.transaction_id)
    acreditadas++
    console.log('[usdt-check] acreditada', b.id, r.transfer.transaction_id)
  }

  return new Response(
    JSON.stringify({ pendientes: pendientes.length, transfers: transfers.length, acreditadas, menores }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
