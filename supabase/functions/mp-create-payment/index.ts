// mp-create-payment — crea la preferencia de Checkout Pro para una reserva.
//
// COBRO AL RESERVAR: la app llama a esta función al confirmar la reserva. Crea
// una preferencia con `marketplace_fee` (comisión VITA server-side, 20/15% según
// el par coach-usuario) usando el token del COACH (split), y devuelve el
// init_point (URL de Checkout Pro) que la app abre en WebBrowser. El resultado
// real del pago llega por mp-webhook.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { commissionPctFor, marketplaceFeeFor } from '../_shared/commission.ts'
import { getFreshCoachToken } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!            // para refrescar el token del coach
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!
const MP_WEBHOOK_URL = Deno.env.get('MP_WEBHOOK_URL')!         // URL pública de mp-webhook
// ⚠️ Tiene que ser https — MP exige eso para `back_urls` (un deep link directo
// da `invalid_back_urls` al crear la preferencia). Por eso el default de acá
// abajo NO se usa nunca en la práctica (no empieza con https, ver el `if` de
// más abajo): apunta a `booking-return`, la función que rebota a
// `viveapp://booking/result` — mismo patrón que `mp-oauth-callback`/`APP_DEEP_LINK`.
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
    //   20% la PRIMERA sesión COMPLETADA del par coach-usuario ·
    //   15% de la 2da en adelante (permanente).
    // Contador POR PAR (user_id + coach_id), solo 'completada', nunca resetea.
    // El 20% es el costo de adquisición: VIVE aporta el cliente nuevo (sesión 1),
    // la relación de ahí en más la sostiene el coach. Bajar en la 2da pone el
    // descuento justo en el momento de máxima fuga (fin de la sesión 1).
    //
    // Excluye checkouts ABANDONADOS que igual llegaron a 'completada' (preference_id
    // seteado, payment_status nunca salió de 'pendiente' — nadie pagó nada). Antes del
    // 09/08 (expire_unpaid_checkouts) esto podía colarse: el checkout se abandonaba,
    // la reserva seguía viva y complete_confirmed_sessions() la barría igual al pasar
    // el horario. 16 reservas así en prod (auditoría sesión 87) empujaban al par al
    // tramo del 15% sin que hubiera pasado ninguna sesión paga de verdad. Hoy ya no
    // debería poder pasar (el checkout abandonado se cancela a los 30 min, mucho antes
    // de la fecha agendada), pero el filtro queda por las 16 viejas y como red por si
    // algún camino nuevo repite el patrón. Una sesión sin cobro por diseño (coach sin
    // MP conectado) nunca tiene preference_id, así que no la toca.
    // ⚠️ El filtro de checkouts abandonados vive DOS veces: acá como predicado
    // SQL (`.or(...)`) y en `countsAsCompletedSession` de _shared/commission.ts
    // como predicado JS. Son la misma regla escrita en dos lenguajes y pueden
    // divergir — si se toca una, tocar la otra. El JS es el que está testeado.
    const promoUntil = Deno.env.get('FOUNDER_PROMO_UNTIL') // ISO date, TBD
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', booking.user_id)
      .eq('coach_id', booking.coach_id)
      .eq('status', 'completada')
      .or('preference_id.is.null,payment_status.neq.pendiente')

    // La decisión de tramo es pura y está en _shared/commission.ts, testeada.
    const commissionPct = commissionPctFor(count ?? 0, Date.now(), promoUntil)

    // marketplace_fee = comisión pura (20/15%), SIN IVA — y así queda.
    // Figura fiscal DECIDIDA (Andre, 06/08/2026): persona humana en Monotributo.
    // Factura tipo C, sin IVA discriminado ⇒ la comisión que se retiene acá es
    // exactamente lo que percibe Vita y lo que dice el copy del coach. Nada que sumar.
    // Si algún día pasa a Responsable Inscripto, ACÁ hay que decidir: o el coach
    // pasa a pagar 24,2% (20% + IVA 21%) y este cálculo lo suma, o el 20% se
    // vuelve IVA incluido y el ingreso real cae a ~16,5%. Es decisión de precio,
    // no de código: cambiar esto sin cambiar el copy de CoachProfileScreen y el
    // §8.4 de los T&C deja las tres cosas contradiciéndose.
    const marketplaceFee = marketplaceFeeFor(Number(booking.amount), commissionPct)

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
    // → "algo salió mal" al aprobar). Sin una URL https configurada, MP nunca redirige
    // y la persona se queda mirando la pantalla de "Pago aprobado" hasta cerrarla a
    // mano — el pago funciona igual (lo confirma mp-webhook, no el redirect), pero
    // la vuelta a la app no es automática. Con `CHECKOUT_RETURN_URL` apuntando a
    // `booking-return` (https, rebota a `viveapp://booking/result`), sí lo es:
    // `openAuthSessionAsync` del lado del cliente cierra el browser solo en cuanto
    // ve ese redirect. Si el secret no está seteado, se omiten y el pago sigue
    // funcionando igual — solo se pierde el cierre automático.
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
