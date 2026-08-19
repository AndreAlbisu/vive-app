// pricing — cuánto cobrarle al cliente en el riel de PayPal. Puro, sin imports.
//
// ⚠️ Es la MISMA regla que `lib/pricing.ts` en el cliente, duplicada porque
// `supabase/functions` está fuera del tsconfig de la app y no se puede importar
// desde ahí (mismo caso que `lib/payout.ts` con los CHECK de la base). Hay un
// test que exige que las dos devuelvan el mismo número: si divergen, la app le
// muestra un precio al usuario y el servidor le cobra otro.

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

/** Piso del precio internacional. Existe porque la comisión FIJA no escala. */
export const MIN_PRICE_USD = 20;

/**
 * Cuánto cobrarle al cliente para que al profesional le llegue su precio entero.
 *
 * 🔴 El costo se SUMA al precio, no sale de la parte del coach. Si saliera de
 * adentro, la comisión real de VIVE sería 21-22% y el copy le promete 15%.
 * Por eso `bookings.amount` guarda el precio del profesional (la base del
 * payout) y `bookings.charged_amount` el total cobrado: son números distintos.
 *
 * ⚠️ No es un porcentaje fijo. Como los USD 0,30 no escalan, el recargo real va
 * de +6,0% sobre USD 100 a +37% sobre USD 1 — un porcentaje plano cobraría de
 * menos justo donde el fijo pesa.
 *
 * Redondea al centavo de ARRIBA: hacia abajo VIVE pondría la diferencia en cada
 * transacción.
 */
export function paypalGrossUp(priceUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return NaN;
  const bruto = (priceUsd + PAYPAL_FIXED_USD) / (1 - PAYPAL_PCT);
  return Math.ceil(bruto * 100) / 100;
}
