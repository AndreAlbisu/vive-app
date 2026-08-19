// pricing — el precio de las sesiones internacionales, puro y sin imports.
//
// Dos cosas distintas viven acá: qué precio puede fijar el profesional, y cuánto
// hay que cobrarle al cliente para que ese precio le llegue entero.
//
// ⚠️ Las reglas están DUPLICADAS como CHECK en la base
// (`scripts/add-paypal-rail.sql`). La duplicación es deliberada, mismo criterio
// que `lib/payout.ts`: acá para que el error se vea mientras se escribe, allá
// porque la pantalla nunca es la frontera. Si cambia una, cambia la otra.

/** Piso del precio internacional, en USD. Ver `paypalGrossUp` para el porqué. */
export const MIN_PRICE_USD = 20;
export const MAX_PRICE_USD = 10000;

/** Comisión de PayPal para una cuenta argentina recibiendo de cualquier mercado.
 *  Confirmado en la tarifa oficial de PayPal (19/08/2026): 5,40% + USD 0,30 al
 *  recibir en dólares, sin comisión extra por ser internacional.
 *
 *  ⚠️ NO incluye el spread de conversión de divisa (4,50% para Argentina). Eso
 *  se evita manteniendo el saldo en dólares y retirando por una vía que no
 *  convierta en PayPal — decisión de Andre, 19/08/2026. Si algún día se retira
 *  dejando que PayPal convierta, este número deja de reflejar el costo real y
 *  hay que revisar el precio. */
export const PAYPAL_PCT = 0.054;
export const PAYPAL_FIXED_USD = 0.30;

/** `null` si el precio es válido; si no, el motivo en criollo. */
export function priceUsdError(input: string | number): string | null {
  const parsed = typeof input === 'number'
    ? input
    : parseInt(String(input).replace(/[^0-9]/g, ''), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) return 'Ingresá un monto en dólares';
  if (parsed < MIN_PRICE_USD) return `El mínimo para sesiones del exterior es USD ${MIN_PRICE_USD}`;
  if (parsed > MAX_PRICE_USD) return `El máximo es USD ${MAX_PRICE_USD}`;
  return null;
}

/**
 * Cuánto hay que cobrarle al cliente para que al profesional le llegue su precio
 * entero después de la comisión de PayPal.
 *
 * 🔴 El costo NO sale de la parte del coach: se suma al precio. Si saliera de
 * adentro, la comisión real de VIVE sería 21-22% y el copy le promete 15% —
 * `bookings.amount` sigue siendo el precio del profesional y esta función
 * calcula aparte lo que se cobra (`bookings.charged_amount`).
 *
 * ⚠️ NO es un porcentaje fijo, y ese fue el error de la primera propuesta. Como
 * los USD 0,30 no escalan, el recargo real depende del precio: +6,0% sobre 100,
 * +6,2% sobre 60, +7,3% sobre 20 y +37% sobre 1. Un porcentaje plano cobraría de
 * menos en los precios bajos, que es justo donde el fijo pesa. Por eso además
 * existe `MIN_PRICE_USD`.
 *
 * Se redondea hacia ARRIBA al centavo: redondear hacia abajo dejaría a VIVE
 * poniendo la diferencia en cada transacción.
 */
export function paypalGrossUp(priceUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return NaN;
  const bruto = (priceUsd + PAYPAL_FIXED_USD) / (1 - PAYPAL_PCT);
  return Math.ceil(bruto * 100) / 100;
}

/** Lo que efectivamente queda después de que PayPal cobre lo suyo. Sirve para
 *  verificar que el gross-up alcanza — tiene que dar >= el precio del coach. */
export function netAfterPaypal(chargedUsd: number): number {
  return Math.round((chargedUsd * (1 - PAYPAL_PCT) - PAYPAL_FIXED_USD) * 100) / 100;
}
