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

/**
 * Comisión de los rieles PayPal y USDT.
 *
 * 🔴 **Tienen escalera igual que Mercado Pago, y el motivo importa** (decisión del
 * 25/08/2026, D3 en `docs/decisiones-pagos.md`). Hasta esa fecha era **plana**, y
 * el argumento escrito acá era que en Argentina VIVE "deja de aportar" tras la
 * presentación mientras que en el exterior cobra y transfiere siempre.
 *
 * **Ese razonamiento estaba mal, y la escalera no es lo que decía.** No es un
 * descuento por fidelidad ni un premio por seguir: **el 20% recupera el costo de
 * ADQUISICIÓN del cliente y la baja al 15% es RETENCIÓN.** Las dos cosas aplican
 * igual en cualquier riel — también en el exterior hubo un costo de conseguir a
 * esa persona, y también hay que retenerla. Que VIVE siga cobrando y transfiriendo
 * es un costo operativo, y de eso se ocupa la diferencia entre 25 y 20, no la
 * existencia de la escalera.
 *
 * **Y hay un motivo que no es de costos: la comisión decreciente es una de las
 * cinco medidas anti-fuga.** Un par internacional recurrente pagando 25% para
 * siempre, contra uno local pagando 15%, es exactamente donde el incentivo a
 * arreglar por afuera es más fuerte.
 *
 * ── Por qué 25 y no 20 en la primera ────────────────────────────────────────
 * El 25% es lo que permite dejar de preguntar **cómo** pagó el cliente y **cómo**
 * cobra el coach. Sobre una sesión de USD 60 el neto iba de ~8,56 (PayPal + salida
 * en USDT, la peor combinación) a ~13,20 (la mejor). Con 20% la peor caía a ~5,60.
 *
 * ── Por qué 20 alcanza en las recurrentes ───────────────────────────────────
 * 🔴 **Porque la regla espejo (D4) eliminó las combinaciones cruzadas.** Ya no
 * existe "cobrado por PayPal y pagado en USDT": cada reserva se paga por el riel
 * por el que entró. Las dos que quedan, al 20%:
 *   · PayPal → PayPal, USD 60: se cobra 12, PayPal se lleva 3,54 al procesar y
 *     0,96 al pagar → quedan ~7,50 (12,5% del ticket).
 *   · USDT → USDT, USD 60: quedan 12.
 * Las dos por encima del 9,3% que dejaba la peor combinación de antes.
 *
 * ⚠️ Esa cuenta usa la tarifa verificada de PayPal, **no una medición**. La
 * medición de USD 50 pendiente es lo que la confirma.
 *
 * ⚠️ El costo de red de USDT **no escala con la facturación sino con la cantidad
 * de coaches**: es por pago, no por sesión. Desde el 25/08 lo absorbe VIVE (D5),
 * así que ese riesgo es nuestro. Si algún día la mayoría cobra en USDT, revisarlo.
 */
export const COMMISSION_INTERNATIONAL_FIRST = 25;
export const COMMISSION_INTERNATIONAL_RECURRING = 20;

/**
 * Los rieles de cobro y su escalera.
 *
 * 🔴 **La comisión sale del RIEL, no del encuadre fiscal**, y no es un
 * acoplamiento a romper sino lo correcto: la comisión cubre lo que cuesta cobrar
 * por ese riel, y PayPal cuesta ~8 puntos más que el split de Mercado Pago, que no
 * cuesta nada. Cobrar según lo que costó cobrar no es cobrar de más.
 *
 * Lo que sí NO puede salir del riel es la **clasificación fiscal** de la
 * operación: eso lo decide dónde se aprovecha el servicio. Son dos cosas y se
 * mezclaron durante mucho tiempo.
 */
export const RAIL_TIERS = {
  mp: { first: COMMISSION_FIRST, recurring: COMMISSION_RECURRING },
  paypal: { first: COMMISSION_INTERNATIONAL_FIRST, recurring: COMMISSION_INTERNATIONAL_RECURRING },
  usdt: { first: COMMISSION_INTERNATIONAL_FIRST, recurring: COMMISSION_INTERNATIONAL_RECURRING },
} as const;

export type CommissionRail = keyof typeof RAIL_TIERS;

/** Una reserva, vista desde el contador de sesiones del par. */
export type BookingForCount = {
  status: string;
  /** Marcador de que arrancó un checkout de Mercado Pago. */
  preference_id: string | null;
  /** Marcador de que arrancó un cobro en USDT. Mismo rol que `preference_id`. */
  usdt_amount?: number | string | null;
  payment_status: string;
};

/**
 * ¿Esta reserva cuenta como una sesión cumplida del par?
 *
 * Excluye los **checkouts abandonados** que igual llegaron a `'completada'`: se
 * arrancó un cobro y `payment_status` nunca salió de `'pendiente'` (nadie pagó
 * nada). Hubo 27 así en producción, 16 de ellas ya completadas — empujaban al
 * par al tramo del 15% sin que hubiera pasado una sola sesión paga.
 *
 * "Arrancó un cobro" se reconoce por el marcador de CUALQUIERA de los dos
 * rieles: `preference_id` (Mercado Pago) o `usdt_amount` (internacional). Mirar
 * solo el de MP dejaría entrar el abandono del otro riel — el mismo bug por la
 * otra puerta, que es exactamente lo que pasó con `expire_unpaid_checkouts()`.
 *
 * Una sesión legítimamente sin cobro (coach sin MP conectada) no tiene ninguno
 * de los dos, así que este filtro no la toca: esa sí cuenta.
 */
export function countsAsCompletedSession(b: BookingForCount): boolean {
  if (b.status !== 'completada') return false;
  const checkoutStarted = !!b.preference_id || b.usdt_amount != null;
  const abandonedCheckout = checkoutStarted && b.payment_status === 'pendiente';
  return !abandonedCheckout;
}

/**
 * `countsAsCompletedSession` escrito como predicado de PostgREST, para el
 * `.or(...)` de la consulta que cuenta las sesiones del par.
 *
 * ⚠️ Es la MISMA regla que la función de arriba, en otro lenguaje. Vivía
 * copiada dentro de `mp-create-payment`, y cuando apareció el segundo riel la
 * copia quedó desactualizada sin que nada avisara. Está acá para que las dos
 * versiones se lean juntas: si se toca una, se toca la otra. La de JS es la que
 * tiene tests.
 *
 * Se lee: NO (arrancó un cobro Y sigue en pendiente).
 */
export const PAIR_SESSION_FILTER =
  'and(preference_id.is.null,usdt_amount.is.null),payment_status.neq.pendiente';

/**
 * Porcentaje de comisión para una reserva nueva del par.
 *
 * @param completedPairSessions cuántas sesiones del par ya cuentan (contadas con
 *   `countsAsCompletedSession`)
 * @param now milisegundos — se pasa en vez de leer el reloj adentro, para que el
 *   comportamiento en el borde de la promo sea testeable
 * @param founderPromoUntil fecha ISO, o null/undefined si no hay promo. ⚠️ Si no
 *   está definida NO hay promo: el default silencioso es cobrar el 20%.
 * @param rail por qué riel se está cobrando. Default `mp` para no romper llamadas
 *   viejas, pero conviene pasarlo siempre explícito.
 */
export function commissionPctFor(
  completedPairSessions: number,
  now: number,
  founderPromoUntil?: string | null,
  rail: CommissionRail = 'mp',
): number {
  if (founderPromoUntil) {
    const until = Date.parse(founderPromoUntil);
    // Una fecha inválida no puede activar la promo: `NaN` en cualquier
    // comparación da false, pero se chequea explícito para que se lea.
    if (!Number.isNaN(until) && now < until) return COMMISSION_PROMO;
  }
  // 🔴 El contador del par es UNO SOLO y cuenta todas las sesiones cumplidas, sin
  // mirar el riel. Cada riel lee su tarifa en la posición que le toca. Por eso el
  // caso "pagó una vez por PayPal y después por Mercado Pago" se resuelve solo: la
  // segunda es recurrente y se cobra 15% porque ocurrió por el riel local.
  const tier = RAIL_TIERS[rail];
  return completedPairSessions < 1 ? tier.first : tier.recurring;
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
