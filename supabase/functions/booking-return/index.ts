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

// 🔴 La vuelta de quien reservó desde la WEB (`/c/<slug>`), que no tiene la app
// y para quien el deep link no lleva a ningún lado.
//
// ⚠️ Es una constante de entorno y NO un parámetro: si la página pudiera mandar
// a dónde volver, esta function —que es pública— se convertiría en un redirector
// abierto, y un link de `vitaapp.com.ar` mandando a cualquier lado es
// exactamente la forma de un phishing. El destino lo decide el servidor.
const WEB_RETURN_URL = Deno.env.get('WEB_RETURN_URL') ?? 'https://vitaapp.com.ar/reserva'

// ⚠️ Lista blanca. Esta function es PÚBLICA (`verify_jwt = false`) y su salida
// entra a la app por un deep link, así que reenviar TODO lo que llegue —que era
// lo que hacía— convierte cualquier URL de internet en un canal para meter
// parámetros arbitrarios adentro de la app. Hoy no los lee nadie y por eso era
// inerte; el día que alguien lea uno, el agujero ya está puesto y nada en el
// código lo recuerda. Son los tres que MP agrega de verdad.
const PARAMS_DE_MP = ['payment_id', 'status', 'collection_status', 'external_reference', 'preference_id']

serve((req) => {
  const url = new URL(req.url)
  // `destino=web` lo pone `mp-create-payment` al armar las `back_urls` cuando la
  // reserva nació en la página pública. No viene del navegador de la persona:
  // viaja adentro de la URL que MP recibió de nosotros.
  const esWeb = url.searchParams.get('destino') === 'web'
  const target = new URL(esWeb ? WEB_RETURN_URL : BOOKING_DEEP_LINK)
  for (const key of PARAMS_DE_MP) {
    const value = url.searchParams.get(key)
    // Tope de largo: son ids y estados cortos. Nada que llegue acá justifica
    // más que esto, y acota lo que puede empujarse por el deep link.
    if (value !== null && value.length <= 128) target.searchParams.set(key, value)
  }
  return Response.redirect(target.toString(), 302)
})
