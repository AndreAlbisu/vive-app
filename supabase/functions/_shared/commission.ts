// commission — las reglas de comisión, puras y sin dependencias.
//
// Vivían inline dentro de `mp-create-payment`, mezcladas con la query a
// Supabase y con `Deno.env`, así que no había forma de probarlas sin levantar
// medio entorno. Acá quedan como funciones que reciben datos y devuelven
// números — la función sigue siendo la que consulta la base y lee el entorno.
//
// Sin imports a propósito: así lo puede cargar tanto Deno (la edge function)
// como Jest (los tests), que corren en runtimes distintos.
//
// Esquema (ver memoria project_vive_payments):
//   0% promo fundador (hasta FOUNDER_PROMO_UNTIL) ·
//   20% la PRIMERA sesión COMPLETADA del par coach-usuario ·
//   15% de la 2da en adelante (permanente).
// El 20% es el costo de adquisición: Vita aporta el cliente nuevo. El descuento
// cae en la 2da sesión, que es el momento de máxima fuga.

export const COMMISSION_FIRST = 20;
export const COMMISSION_RECURRING = 15;
export const COMMISSION_PROMO = 0;

/** Una reserva, vista desde el contador de sesiones del par. */
export type BookingForCount = {
  status: string;
  preference_id: string | null;
  payment_status: string;
};

/**
 * ¿Esta reserva cuenta como una sesión cumplida del par?
 *
 * Excluye los **checkouts abandonados** que igual llegaron a `'completada'`:
 * `preference_id` seteado (el checkout arrancó, o sea que el coach tiene MP) y
 * `payment_status` que nunca salió de `'pendiente'` (nadie pagó nada). Hubo 27
 * así en producción, 16 de ellas ya completadas — empujaban al par al tramo del
 * 15% sin que hubiera pasado una sola sesión paga.
 *
 * Una sesión legítimamente sin cobro (coach sin MP conectada) **nunca** tiene
 * `preference_id`, así que este filtro no la toca: esa sí cuenta.
 */
export function countsAsCompletedSession(b: BookingForCount): boolean {
  if (b.status !== 'completada') return false;
  const abandonedCheckout = !!b.preference_id && b.payment_status === 'pendiente';
  return !abandonedCheckout;
}

/**
 * Porcentaje de comisión para una reserva nueva del par.
 *
 * @param completedPairSessions cuántas sesiones del par ya cuentan (contadas con
 *   `countsAsCompletedSession`)
 * @param now milisegundos — se pasa en vez de leer el reloj adentro, para que el
 *   comportamiento en el borde de la promo sea testeable
 * @param founderPromoUntil fecha ISO, o null/undefined si no hay promo. ⚠️ Si no
 *   está definida NO hay promo: el default silencioso es cobrar el 20%.
 */
export function commissionPctFor(
  completedPairSessions: number,
  now: number,
  founderPromoUntil?: string | null,
): number {
  if (founderPromoUntil) {
    const until = Date.parse(founderPromoUntil);
    // Una fecha inválida no puede activar la promo: `NaN` en cualquier
    // comparación da false, pero se chequea explícito para que se lea.
    if (!Number.isNaN(until) && now < until) return COMMISSION_PROMO;
  }
  return completedPairSessions < 1 ? COMMISSION_FIRST : COMMISSION_RECURRING;
}

/**
 * `marketplace_fee` en pesos a partir del monto y el porcentaje.
 *
 * El redondeo va sobre `amount * pct` y recién después divide por 100, para no
 * arrastrar el error de coma flotante de calcular el porcentaje primero.
 *
 * ⚠️ Comisión PURA, sin IVA — y así se queda mientras Vita sea Monotributo
 * (decisión del 06/08/2026): factura C sin IVA discriminado, o sea que lo que
 * se retiene acá es exactamente lo que percibe Vita.
 */
export function marketplaceFeeFor(amount: number, pct: number): number {
  return Math.round(amount * pct) / 100;
}
