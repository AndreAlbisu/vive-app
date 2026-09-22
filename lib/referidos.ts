import { COMMISSION_LOCAL_FIRST } from '@/lib/pricing';

/**
 * M7: el descuento del que llega invitado.
 *
 * ── La regla, decidida por Andre el 21/09/2026 ───────────────────────────────
 *
 *   · **Descuento para el INVITADO, nada para el que invita.** Baja la barrera
 *     justo donde está el miedo a probar, y cuesta la mitad por alta que premiar
 *     a los dos (que es lo que hace Selia).
 *   · **10% de la sesión**, una sola vez, en su primera sesión pagada.
 *
 * 🔴 **Sale de la comisión de Vita, NUNCA del bolsillo del profesional.** Él
 * cobra lo mismo que cobraría sin el descuento; de hecho cobra unos pesos más,
 * porque la tarifa de Mercado Pago se calcula sobre un monto menor. Si esto se
 * implementara bajándole el precio al coach, sería pedirle a él que pague
 * nuestro marketing.
 *
 * 📌 **Por qué 10 y no 20.** La comisión de la primera sesión es 20%, así que
 * 10 deja a Vita con la mitad. Con 20 Vita trabajaría gratis esa sesión, y con
 * cero usuarios eso es regalar el único ingreso que existe.
 */

/** Cuánto se le descuenta al invitado, en porcentaje de la sesión. */
export const DESCUENTO_REFERIDO_PCT = 10;

/**
 * 🔴 El tope que hace que esto no pueda costarle plata a Vita.
 *
 * El descuento se paga con la comisión, así que **nunca puede ser mayor que la
 * comisión de esa reserva**. Hoy la más baja es 15% (tramo recurrente) y el
 * descuento es 10, así que no se alcanza nunca; existe igual porque el día que
 * alguien baje una comisión o suba el descuento, esto tiene que fallar del lado
 * seguro y no emitir un cobro donde Vita ponga plata.
 */
export function descuentoAplicable(precio: number, comisionPct: number): number {
  if (!(precio > 0)) return 0;
  const pctReal = Math.min(DESCUENTO_REFERIDO_PCT, comisionPct);
  if (!(pctReal > 0)) return 0;
  return Math.round((precio * pctReal) / 100 * 100) / 100;
}

/** Lo que cada uno pone y se lleva, con el descuento aplicado. */
export type CuentaReferido = {
  /** Lo que paga la persona. */
  cliente: number;
  /** Lo que se descontó. */
  descuento: number;
  /** La comisión que Vita cobra igual, ya sin el descuento adentro. */
  vive: number;
};

/**
 * ⚠️ `vive` puede dar 0 y eso es válido: significa que Vita regaló toda su
 * comisión en esa sesión. Lo que NO puede dar es negativo, que sería Vita
 * poniendo plata. Hay un test parado en ese borde.
 */
export function cuentaConReferido(precio: number, comisionPct: number): CuentaReferido {
  const descuento = descuentoAplicable(precio, comisionPct);
  const comision = Math.round((precio * comisionPct) / 100 * 100) / 100;
  return {
    cliente: Math.round((precio - descuento) * 100) / 100,
    descuento,
    vive: Math.round((comision - descuento) * 100) / 100,
  };
}

/**
 * Normaliza un código tipeado a mano.
 *
 * 📌 Mayúsculas y sin espacios porque la gente lo va a copiar de un WhatsApp,
 * con el espacio de más que mete el autocorrector adelante.
 */
export function normalizarCodigo(input: string): string {
  return (input ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * ¿Tiene forma de código? 6 caracteres, letras y números.
 *
 * ⚠️ Esto NO dice que el código exista: eso solo lo sabe la base. Sirve para no
 * mandar una consulta por cada tecla y para no aceptar un campo vacío.
 *
 * 🔴 Sin I, O, 1 ni 0 a propósito: son los cuatro que se confunden al leer un
 * código en la pantalla de otro, que es exactamente como va a viajar este.
 */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function tieneFormaDeCodigo(input: string): boolean {
  const c = normalizarCodigo(input);
  if (c.length !== 6) return false;
  return [...c].every(ch => ALFABETO_CODIGO.includes(ch));
}

/** Genera uno. Se usa del lado de la base; acá vive para poder probarlo. */
export function generarCodigo(rnd: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALFABETO_CODIGO[Math.floor(rnd() * ALFABETO_CODIGO.length)];
  }
  return out;
}

/** El descuento que se muestra en pantalla, sin prometer más de lo que es. */
export function textoDescuento(): string {
  return `${DESCUENTO_REFERIDO_PCT}% en tu primera sesión`;
}

/** Comisión de la primera sesión, para no repetir el número en las pantallas. */
export const COMISION_PRIMERA = COMMISSION_LOCAL_FIRST;
