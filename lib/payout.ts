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

export type PayoutMethod = 'transferencia' | 'usdt';
export type PayoutNetwork = 'TRC20' | 'ERC20' | 'POLYGON';

/** CBU: 22 dígitos exactos. */
export const CBU_RE = /^[0-9]{22}$/;
/** Tron: empieza con T, 34 caracteres base58 (sin 0, O, I ni l). */
export const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Ethereum y Polygon comparten formato: 0x + 40 hexadecimales. */
export const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

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
