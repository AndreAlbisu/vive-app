// payout — validación de los datos de cobro del coach, pura y sin imports.
//
// Vive acá y no dentro de la pantalla por el mismo criterio que
// `supabase/functions/_shared/guarantee.ts`: sin dependencias de React Native,
// así la puede cargar Jest y se testea de verdad.
//
// ⚠️ Estas reglas están DUPLICADAS como CHECK en la base
// (`scripts/add-coach-international.sql`). La duplicación es deliberada: acá
// para que la persona vea el error mientras escribe, allá porque la pantalla
// nunca es la frontera de seguridad. Si cambia una, cambia la otra.

export type PayoutMethod = 'transferencia' | 'usdt' | 'paypal';
export type PayoutNetwork = 'TRC20' | 'ERC20' | 'POLYGON';

/** CBU: 22 dígitos exactos. */
export const CBU_RE = /^[0-9]{22}$/;
/** Tron: empieza con T, 34 caracteres base58 (sin 0, O, I ni l). */
export const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Ethereum y Polygon comparten formato: 0x + 40 hexadecimales. */
export const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
/** Mail de PayPal. Deliberadamente laxo: la validación de verdad la hace PayPal
 *  al enviar (un mail sin cuenta asociada rebota y la plata vuelve). Acá solo se
 *  atajan los errores de tipeo evidentes — un regex estricto rechazaría mails
 *  válidos y raros, que es peor que dejar pasar uno que PayPal va a rebotar. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** `null` si está bien; si no, el motivo en criollo para mostrar debajo del campo. */
export function cbuError(cbu: string): string | null {
  const limpio = cbu.replace(/\D/g, '');
  if (!limpio) return 'Ingresá tu CBU';
  if (!CBU_RE.test(limpio)) return `El CBU tiene 22 dígitos (llevás ${limpio.length})`;
  return null;
}

/**
 * Valida la dirección CONTRA LA RED ELEGIDA, que es el punto entero: una
 * dirección de Ethereum es perfectamente válida como dirección, y enviarle
 * USDT por la red Tron pierde los fondos para siempre. No rebota como un CBU
 * mal cargado, no se rastrea, y no hay a quién reclamarle.
 */
export function walletError(wallet: string, network: PayoutNetwork): string | null {
  const w = wallet.trim();
  if (!w) return 'Ingresá tu dirección';
  if (network === 'TRC20' && !TRON_RE.test(w)) {
    return 'No parece una dirección de TRC20 (empieza con T y tiene 34 caracteres)';
  }
  if ((network === 'ERC20' || network === 'POLYGON') && !EVM_RE.test(w)) {
    return `No parece una dirección de ${network} (empieza con 0x y tiene 42 caracteres)`;
  }
  return null;
}

/**
 * Valida el mail de PayPal al que se le van a mandar los dólares.
 *
 * ⚠️ A diferencia del CBU y de la wallet, un error acá **no pierde los fondos**:
 * PayPal rebota el payout si el mail no tiene una cuenta que pueda recibir, y la
 * plata vuelve al saldo de VIVE. Por eso la validación es de tipeo y no de
 * seguridad. La wallet es el caso opuesto y por eso su chequeo es estricto.
 */
export function paypalEmailError(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Ingresá el mail de tu cuenta de PayPal';
  if (!EMAIL_RE.test(e)) return 'No parece un mail válido';
  return null;
}

/** Solo los dígitos — lo que se guarda en la base. */
export function normalizarCbu(cbu: string): string {
  return cbu.replace(/\D/g, '');
}

// ─── Cuánto se le debe al coach ──────────────────────────────────────────────

/**
 * Lo que le corresponde al coach por una sesión del riel internacional:
 * el precio menos la comisión que se snapshoteó en `bookings.platform_fee_pct`.
 *
 * Solo aplica a los rieles donde cobra VIVE. Con Mercado Pago el split ya le
 * pagó en el momento del cobro y no hay nada que transferir.
 *
 * ⚠️ El monto base es `bookings.amount` (el precio), NO `usdt_amount`: ese
 * último trae el identificador del pago en los centavos, y pagárselo al coach
 * sería regalarle hasta 0,99 USD por sesión de una plata que existe solo para
 * reconocer la transferencia.
 *
 * ⚠️ El redondeo replica el de `marketplaceFeeFor` en
 * `supabase/functions/_shared/commission.ts` —multiplicar antes de dividir— para
 * que las dos mitades del reparto cierren contra el mismo número. Está duplicado
 * porque `supabase/functions` está fuera del tsconfig de la app y no se puede
 * importar desde acá; si cambia el redondeo allá, cambia acá.
 */
export function coachNetFor(amount: number, feePct: number): number {
  const fee = Math.round(amount * feePct) / 100;
  return Math.round((amount - fee) * 100) / 100;
}

/**
 * Lo que cuesta mandar un pago en USDT por la red Tron. **Por ENVÍO, no por
 * sesión**: un pago semanal cubre todas las sesiones de esa semana.
 *
 * 🔴 Esa propiedad es la que importa. Como no escala con el monto, sobre una
 * sesión de USD 50 el costo es del 3% si el profesional hizo una sola esa semana
 * y del 0,3% si hizo diez. No lo determina el precio, lo determina su volumen.
 *
 * Por eso se lo descuenta **a quien lo elige**: pidió que le manden dólares por
 * blockchain, controla la causa y paga el costo — mismo criterio que en Mercado
 * Pago, donde la comisión del procesador sale de la parte del profesional. Y cae
 * solo donde corresponde: al de una sesión semanal le baja el cobro de 75% a
 * 72%, y al de cuatro le descuenta un 1% que no nota.
 *
 * Sin este descuento, el mínimo de USD 20 no llegaría al 10% de margen en el
 * peor caso (6,2%); con él da 13,7% en todos.
 *
 * ⚠️ Valor de Andre, 20/08/2026. Si cambia el precio de TRX o se stakea TRX para
 * energía, este número cambia — y no hay nada que lo detecte solo.
 */
export const USDT_NETWORK_FEE_USD = 1.5;

/**
 * Lo que cobra PayPal por mandar un payout: 2% del monto, sin parte fija.
 * Verificado el 24/08/2026 en la página de comisiones de PayPal Argentina
 * ("2% del importe total de la transacción", igual para nacional e
 * internacional). Hay un tope máximo por envío, pero recién mordería arriba de
 * ~USD 1.000 y los pagos semanales de una sesión están un orden de magnitud
 * abajo, así que no se modela.
 *
 * 🔴 **Lo paga VIVE, no el coach** — por eso NO aparece en
 * `deliveryCostFor`. La regla, decidida el 24/08/2026, es: **costo fijo se
 * descuenta, costo proporcional se absorbe.** El de USDT se descuenta porque no
 * escala y por lo tanto castiga al de poco volumen (ver arriba); un 2% pesa
 * igual para el que hace una sesión que para el que hace veinte, así que ese
 * argumento no se traslada. Y elegir PayPal nos AHORRA el tramo de sacar los
 * dólares a Argentina, que en el camino de la transferencia ya pagamos
 * nosotros: cobrárselo encima sería cobrar dos veces el mismo tramo.
 *
 * ⚠️ Lo que esto asume y todavía no está medido: que sacar los dólares a
 * Argentina cuesta MÁS que 2%. Si costara menos, pagar por PayPal nos saldría
 * más caro que la transferencia. Lo dice la medición de USD 50 que sigue
 * pendiente, no este código.
 */
export const PAYPAL_PAYOUT_FEE_PCT = 2;

/** Lo que le cuesta a VIVE mandar un payout de PayPal. No se le descuenta al
 *  coach; existe para que el panel pueda mostrar el costo real de cada método
 *  en vez de dejarlo invisible. */
export function paypalPayoutCost(neto: number): number {
  return Math.round(neto * PAYPAL_PAYOUT_FEE_PCT) / 100;
}

/**
 * El costo de entrega que se le DESCUENTA AL COACH, según el método que eligió.
 *
 * Vive en su propia función porque el panel lo necesita por separado (para
 * mostrar "te corresponden X − Y de red") y `payoutAfterDeliveryCost` para
 * restarlo. Estaba duplicado en `lib/admin.ts` y las dos copias tenían que
 * acordarse de cambiar juntas.
 *
 * · `transferencia` → 0. El archivo de lote del banco cuesta lo mismo con una
 *   fila que con doscientas.
 * · `usdt`          → USD 1,50 fijos, por envío.
 * · `paypal`        → 0 para el coach; el 2% lo absorbe VIVE (ver arriba).
 */
export function deliveryCostFor(neto: number, method: PayoutMethod): number {
  void neto;
  return method === 'usdt' ? USDT_NETWORK_FEE_USD : 0;
}

/** Lo que hay que transferirle realmente a un profesional, descontado el costo
 *  de entrega del método que eligió. */
export function payoutAfterDeliveryCost(neto: number, method: PayoutMethod): number {
  return Math.round((neto - deliveryCostFor(neto, method)) * 100) / 100;
}
