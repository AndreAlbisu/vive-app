// usdt — verificación de cobros en USDT sobre la red Tron (TRC20).
//
// Puro y sin imports, para que lo carguen tanto Deno (las edge functions) como
// Jest (los tests). Misma convención que `guarantee.ts` y `commission.ts`.
//
// EL PROBLEMA QUE RESUELVE: en una transferencia de cripto no hay "referencia
// externa" como el `external_reference` de Mercado Pago. Llega plata a una
// dirección y hay que decidir a qué reserva corresponde. Si eso se resuelve mal
// se le acredita el pago a la persona equivocada, o se pierde.
//
// LA SOLUCIÓN: a cada reserva se le asigna un MONTO ÚNICO — el precio más una
// fracción irrepetible entre las reservas pendientes. La transferencia se
// reconoce por ese monto.
//
// Propiedad deliberada de la fracción: los exchanges suelen cobrar la comisión
// de retiro en unidades enteras (Binance, 1 USDT), así que si el usuario manda
// 50,0037 y le descuentan 1, llegan 49,0037 — **la fracción sobrevive**. Por eso
// el identificador va en los decimales y no en el entero.

/** Contrato oficial de USDT en Tron. */
export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
/** USDT usa 6 decimales en Tron. */
export const USDT_DECIMALS = 6;
/**
 * El identificador son los CENTAVOS: 2 decimales, 100 combinaciones.
 *
 * 🔴 No es una elección de diseño sino una restricción del mundo real. USDT
 * admite 6 decimales, pero **las billeteras no dejan escribirlos**: Belo, por
 * ejemplo, solo acepta 2 al ingresar el monto a enviar. Un identificador en el
 * decimal 5 sería imposible de tipear para el usuario, y el pago nunca se
 * podría reconocer. 2 decimales es el mínimo común denominador.
 *
 * El costo es el techo: 100 reservas esperando pago **al mismo tiempo** agotan
 * las combinaciones. El índice único de la base rechaza el choque y
 * `usdt-create-payment` reintenta, así que el modo de falla es "probá de
 * nuevo" y no un cobro mal asignado. Si alguna vez se acerca a ese número, la
 * salida es una dirección de depósito por reserva, no más decimales.
 */
export const NONCE_DIGITS = 2;
export const NONCE_SCALE = 100;

export type TronTransfer = {
  transaction_id: string;
  from: string;
  to: string;
  value: string;              // entero, en unidades de 10^-6
  type: string;
  block_timestamp: number;
  token_info?: { symbol?: string; decimals?: number; address?: string };
};

/** `value` crudo de TronGrid → USDT. */
export function fromRaw(value: string): number {
  return Number(value) / 10 ** USDT_DECIMALS;
}

/**
 * Monto único de una reserva: el precio MENOS el nonce en los últimos decimales.
 * `uniqueAmount(50, 37)` → 49.63
 *
 * 🔴 **RESTA, y hasta el 08/09/2026 sumaba.** El identificador tiene que vivir
 * en los decimales para poder reconocer la transferencia, pero eso no obliga a
 * cobrarlos: sumando, el cliente pagaba SIEMPRE un poco más que el precio (entre
 * +0,00 y +0,99) y esa diferencia se la quedaba VIVE. **Era un margen que nadie
 * decidió cobrar** — salió como subproducto del mecanismo de identificación— y
 * como el sobrante es fijo en dólares, pesaba más cuanto más barata la sesión:
 * ~5% en el peor caso sobre el piso de USD 20, contra el ~0,8% que figuraba en
 * `SCHEMA.md`, calculado sobre un precio alto.
 *
 * Decisión de Andre, 08/09/2026: **lo paga VIVE**. El cliente nunca paga más que
 * el precio del profesional, y el coach sigue cobrando sobre el precio entero
 * (`bookings.amount`), así que el hueco sale de la comisión del 25%.
 *
 * 🟢 No hizo falta tocar `nonceOf` ni `findPayment`: el identificador se deriva
 * del MONTO ESPERADO (`nonceOf(esperado.monto)`), no del nonce original, así que
 * 49.63 se reconoce por su 63 igual que antes 50.37 se reconocía por su 37. Y
 * las reservas viejas siguen andando: el matcheo usa el `usdt_amount` guardado.
 *
 * 🔴 EL PRECIO TIENE QUE SER ENTERO, y no es una comodidad: el identificador
 * vive en los decimales, así que cualquier decimal del precio se mezcla con él y
 * lo corrompe. `uniqueAmount(120.5, 99)` dejaría los decimales del precio dentro
 * del identificador y la transferencia sería irreconocible: el pago quedaría sin
 * acreditar. Encontrado por los tests al escribirlos.
 *
 * Es una restricción barata: las sesiones internacionales se cotizan en dólares
 * redondos (USD 50, no USD 50,50), y el piso es USD 20, así que restar hasta
 * 0,99 nunca puede dar un monto negativo ni cero.
 */
export function uniqueAmount(precio: number, nonce: number): number {
  if (!Number.isInteger(precio)) {
    throw new Error(`el precio en USDT debe ser entero (llegó ${precio}): los decimales son el identificador`);
  }
  if (!Number.isInteger(nonce) || nonce < 0 || nonce >= 10 ** NONCE_DIGITS) {
    throw new Error(`nonce fuera de rango: ${nonce}`);
  }
  return Math.round(precio * NONCE_SCALE - nonce) / NONCE_SCALE;
}

/** El identificador de un monto. `49.63` → 63.
 *
 * 📌 No devuelve el nonce con el que se creó el monto (ese era 37, no 63) y no
 * hace falta que lo haga: lo único que se compara es la fracción del monto
 * esperado contra la del recibido. Ver la nota en `uniqueAmount`. */
export function nonceOf(monto: number): number {
  return Math.round(monto * NONCE_SCALE) % 10 ** NONCE_DIGITS;
}

export type MatchResult =
  | { kind: 'match'; transfer: TronTransfer }
  | { kind: 'monto_menor'; transfer: TronTransfer; recibido: number; esperado: number }
  | { kind: 'sin_match' };

/**
 * ¿Alguna de estas transferencias paga esta reserva?
 *
 * 🔴 Se valida el CONTRATO, no el símbolo. Cualquiera puede desplegar un token
 * llamado "USDT" en Tron y transferirlo gratis: si se aceptara por símbolo, se
 * podría pagar una sesión con un token que no vale nada. El símbolo es una
 * etiqueta que elige quien crea el token; la dirección del contrato no.
 *
 * Devuelve `monto_menor` en vez de ignorar, cuando la fracción coincide pero el
 * monto no llega: es casi seguro una comisión de retiro del exchange, y hay que
 * poder resolverlo a mano en vez de que el pago desaparezca en silencio.
 */
export function findPayment(
  transfers: TronTransfer[],
  esperado: { direccion: string; monto: number; hashesUsados?: Set<string> },
): MatchResult {
  const usados = esperado.hashesUsados ?? new Set<string>();
  const nonceEsperado = nonceOf(esperado.monto);
  let parcial: MatchResult | null = null;

  for (const t of transfers) {
    if (t.type !== 'Transfer') continue;
    if (usados.has(t.transaction_id)) continue;
    // Contrato, NO símbolo.
    if ((t.token_info?.address ?? '') !== USDT_TRC20_CONTRACT) continue;
    if (t.to !== esperado.direccion) continue;

    const recibido = fromRaw(t.value);
    if (Math.abs(recibido - esperado.monto) < 1e-6) {
      return { kind: 'match', transfer: t };
    }
    // Misma fracción identificadora, monto distinto → sospecha de comisión.
    if (nonceOf(recibido) === nonceEsperado && recibido < esperado.monto && !parcial) {
      parcial = { kind: 'monto_menor', transfer: t, recibido, esperado: esperado.monto };
    }
  }
  return parcial ?? { kind: 'sin_match' };
}
