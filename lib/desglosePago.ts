import {
  COMMISSION_LOCAL_FIRST,
  COMMISSION_LOCAL_RECURRING,
  COMMISSION_INTL_FIRST,
  COMMISSION_INTL_RECURRING,
  MP_FEE_PCT_OBSERVED,
  PAYPAL_PCT,
  PAYPAL_FIXED_USD,
} from './pricing';

/**
 * El desglose de una sesión, para mostrárselo al coach.
 *
 * 🔴 Por qué existe. La app le decía "te cobramos 20%" y **nunca le mencionaba
 * la tarifa de Mercado Pago**, que en el riel local la paga él: leía 20 y
 * recibía 76. El dato estaba en `SCHEMA.md` y en los T&C §8.5, o sea en dos
 * lugares donde no va a entrar nunca. Decisión de Andre del 08/09/2026: ser
 * hipertransparente con el coach sobre por qué cobramos lo que cobramos, y eso
 * empieza por **mostrar el neto real y no el porcentaje de comisión**.
 *
 * ⚠️ Los tres rieles tratan el costo del procesador distinto, y no es un
 * descuido — cada uno salió de su restricción (ver `SCHEMA.md` → `bookings`):
 * en Mercado Pago el comerciante es el coach y le paga a su propio procesador;
 * en PayPal y USDT el comerciante es VIVE, así que lo absorbe de su comisión.
 * Por eso la escalera internacional es 5 puntos más alta.
 */

export type Riel = 'mp' | 'paypal' | 'usdt';
export type Tramo = 'primera' | 'recurrente';

export type Desglose = {
  /** Lo que paga el cliente. En USDT puede ser hasta 0,99 MENOS que el precio. */
  cliente: number;
  /** Comisión de VIVE. */
  vive: number;
  /** Costo del procesador y quién lo paga. `null` si no hay (USDT no tiene). */
  procesador: { monto: number; loPaga: 'coach' | 'vive' } | null;
  /** Lo que efectivamente le queda al coach. */
  coach: number;
  /** `coach` como porcentaje de lo que paga el cliente, redondeado. */
  coachPct: number;
};

export function comisionPct(riel: Riel, tramo: Tramo): number {
  if (riel === 'mp') {
    return tramo === 'primera' ? COMMISSION_LOCAL_FIRST : COMMISSION_LOCAL_RECURRING;
  }
  return tramo === 'primera' ? COMMISSION_INTL_FIRST : COMMISSION_INTL_RECURRING;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `precio` es el precio que fijó el profesional, en la moneda del riel (pesos
 * para `mp`, dólares para los otros dos).
 *
 * 📌 En USDT el cliente paga hasta 0,99 menos que el precio —los centavos son el
 * identificador de la reserva y desde el 08/09/2026 se restan en vez de sumarse,
 * a costa de VIVE— pero **el coach cobra siempre sobre el precio entero**. Como
 * el descuento es variable y no le cambia nada al coach, acá se muestra el
 * precio: mostrarle un número que no es el suyo confundiría más de lo que
 * aclara.
 */
export function desglose(precio: number, riel: Riel, tramo: Tramo): Desglose {
  const pct = comisionPct(riel, tramo);
  const vive = round2((precio * pct) / 100);

  if (riel === 'mp') {
    // La tarifa de Mercado Pago se la cobran a la cuenta DEL COACH: en el split
    // él es el `collector`. Verificado en un pago real — `fee_details` trae
    // `fee_payer: "collector"`.
    const procesador = round2((precio * MP_FEE_PCT_OBSERVED) / 100);
    const coach = round2(precio - vive - procesador);
    return { cliente: precio, vive, procesador: { monto: procesador, loPaga: 'coach' }, coach, coachPct: Math.round((coach / precio) * 100) };
  }

  // PayPal y USDT: el comerciante es VIVE, así que el costo sale de su comisión
  // y al coach le llega el precio menos la comisión, limpio.
  const coach = round2(precio - vive);
  const procesador = riel === 'paypal'
    ? { monto: round2(precio * PAYPAL_PCT + PAYPAL_FIXED_USD), loPaga: 'vive' as const }
    : null;
  return { cliente: precio, vive, procesador, coach, coachPct: Math.round((coach / precio) * 100) };
}
