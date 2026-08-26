// pricing — el precio de las sesiones internacionales, puro y sin imports.
//
// Dos cosas distintas viven acá: qué precio puede fijar el profesional, y cuánto
// hay que cobrarle al cliente para que ese precio le llegue entero.
//
// ⚠️ Las reglas están DUPLICADAS como CHECK en la base
// (`scripts/add-paypal-rail.sql`). La duplicación es deliberada, mismo criterio
// que `lib/payout.ts`: acá para que el error se vea mientras se escribe, allá
// porque la pantalla nunca es la frontera. Si cambia una, cambia la otra.

/** Piso del precio internacional, en USD.
 *
 *  📝 Cambió de motivo el 20/08/2026. Existía porque la comisión FIJA de PayPal
 *  (USD 0,30) se comía el recargo que se le sumaba al precio en los montos
 *  chicos. Con la comisión plana del 25% eso dejó de ser un problema aritmético
 *  —el margen aguanta hasta precios muy bajos—, así que el piso se queda por una
 *  razón distinta y más simple: **una sesión de USD 5 no es un producto serio**. */
/**
 * La escalera de comisión de los rieles internacionales, para MOSTRÁRSELA al
 * coach. 25% en la primera sesión con cada persona, 20% de la segunda en
 * adelante (D3, 25/08/2026).
 *
 * ⚠️ **La fuente de verdad es `supabase/functions/_shared/commission.ts`**, que
 * es quien la aplica al cobrar. Estos valores están duplicados acá solo porque
 * aquel corre en Deno y esto es la app — y la duplicación **está atada por un
 * test** (`pricing.test.ts`) que compara los dos y falla si se separan. Sin ese
 * test, cambiar la escalera del lado servidor dejaría a la pantalla del coach
 * prometiéndole un neto que no va a cobrar.
 */
export const COMMISSION_INTL_FIRST = 25;
export const COMMISSION_INTL_RECURRING = 20;

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
 * Lo que efectivamente queda después de que PayPal cobre lo suyo.
 *
 * Ya no se usa para fijar precios —el cliente paga el precio del coach y el
 * costo sale de la comisión del 25%— pero sirve para estimar el margen real de
 * una sesión y para el modelo de costos.
 */
export function netAfterPaypal(chargedUsd: number): number {
  return Math.round((chargedUsd * (1 - PAYPAL_PCT) - PAYPAL_FIXED_USD) * 100) / 100;
}
