// booking-return — bounce público para el back_url del checkout de un booking.
//
// Por qué existe: Checkout Pro de MP EXIGE que `back_urls` sea https — un deep
// link (`viveapp://booking/result`) directo da `invalid_back_urls` al crear la
// preferencia (ver mp-create-payment). Hasta ahora `CHECKOUT_RETURN_URL` no
// tenía ningún valor https configurado, así que `mp-create-payment` nunca
// mandaba `back_urls`/`auto_return` — el pago quedaba aprobado en la pantalla
// de MP y la persona tenía que cerrar la pestaña a mano para volver a la app.
//
// Esta función es el único trabajo que hace: recibe la vuelta de MP acá (que
// SÍ es https) y hace un 302 al deep link real, reenviando los query params
// que MP agrega (`payment_id`, `status`/`collection_status`, `external_reference`)
// por si algún día hacen falta — hoy la app no los lee: sigue confiando en
// `payment_status` escrito por `mp-webhook` + el sondeo de `BookingScreen_Confirm`.
//
// Mismo patrón que `mp-oauth-callback` → `APP_DEEP_LINK` (conexión de MP del
// coach), pero para el checkout de una reserva. No toca la base, no necesita
// JWT: la llama el navegador de MP, no la app con sesión.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOOKING_DEEP_LINK = Deno.env.get('BOOKING_DEEP_LINK') ?? 'viveapp://booking/result'

// ⚠️ Lista blanca. Esta function es PÚBLICA (`verify_jwt = false`) y su salida
// entra a la app por un deep link, así que reenviar TODO lo que llegue —que era
// lo que hacía— convierte cualquier URL de internet en un canal para meter
// parámetros arbitrarios adentro de la app. Hoy no los lee nadie y por eso era
// inerte; el día que alguien lea uno, el agujero ya está puesto y nada en el
// código lo recuerda. Son los tres que MP agrega de verdad.
const PARAMS_DE_MP = ['payment_id', 'status', 'collection_status', 'external_reference', 'preference_id']

serve((req) => {
  const url = new URL(req.url)
  const target = new URL(BOOKING_DEEP_LINK)
  for (const key of PARAMS_DE_MP) {
    const value = url.searchParams.get(key)
    // Tope de largo: son ids y estados cortos. Nada que llegue acá justifica
    // más que esto, y acota lo que puede empujarse por el deep link.
    if (value !== null && value.length <= 128) target.searchParams.set(key, value)
  }
  return Response.redirect(target.toString(), 302)
})
