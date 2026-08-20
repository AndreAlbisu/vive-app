// pricing — las constantes de costo del riel de PayPal. Puro, sin imports.
//
// 📝 Acá vivía `paypalGrossUp`, que calculaba cuánto sumarle al precio para que
// al coach le llegara entero. Se eliminó el 20/08/2026 al pasar el riel
// internacional a una comisión plana del 25%: **el cliente paga el precio del
// coach y el costo sale de la comisión**, así que ya no hay nada que sumar.
// Quedan las constantes porque describen lo que cobra PayPal y sirven para
// estimar el margen real de una sesión.
//
// ⚠️ Espejo de `lib/pricing.ts`, duplicado porque `supabase/functions` está
// fuera del tsconfig de la app. Hay un test que exige que las constantes no se
// desincronicen.

/** Comisión de PayPal para una cuenta argentina recibiendo de cualquier mercado.
 *  Confirmado en la tarifa oficial de PayPal (19/08/2026): 5,40% + USD 0,30 al
 *  recibir en dólares, sin comisión extra por ser internacional.
 *
 *  ⚠️ NO incluye el spread de conversión de divisa (4,50% para Argentina): se
 *  evita manteniendo saldo en dólares y retirando por una vía que no convierta
 *  en PayPal (decisión de Andre, 19/08/2026). Si algún día se retira dejando que
 *  PayPal convierta, este número deja de reflejar el costo real. */
export const PAYPAL_PCT = 0.054;
export const PAYPAL_FIXED_USD = 0.30;

/** Piso del precio internacional. Ya no por aritmética —la comisión plana del
 *  25% aguanta precios bajos— sino porque una sesión de USD 5 no es un producto
 *  serio. Espejo del CHECK en `scripts/add-paypal-rail.sql`. */
export const MIN_PRICE_USD = 20;
