// billing — qué comisión ganó VIVE y de quién, agrupada para facturar.
//
// 🔴 Esto NO emite facturas ni decide qué es facturable. Es material en bruto
// para llevarle al contador y, cuando él defina el criterio, para emitir con la
// frecuencia y el formato que diga. Ver `docs/fiscal-instrucciones.md` §2.1 —
// las tres preguntas abiertas son justamente qué facturar, a quién y cada
// cuánto, y ninguna se puede responder desde acá.
//
// Por eso la función **no filtra por un criterio de facturabilidad**: devuelve
// las cobradas y las reembolsadas por separado, con el riel a la vista, y deja
// que la decisión la tome quien puede tomarla. Elegir acá un criterio sería
// hornear una respuesta que todavía no existe.

/** Una reserva, vista desde la comisión que dejó. */
export type BookingForBilling = {
  scheduled_date: string;
  coach_id: string;
  coach_name: string | null;
  amount: number | string | null;
  platform_fee_pct: number | string | null;
  currency: string | null;
  payment_provider: string | null;
  payment_status: string;
};

export type CommissionGroup = {
  /** 'YYYY-MM' */
  mes: string;
  coachId: string;
  coachName: string | null;
  /** 🔴 Nunca se suman monedas distintas: cada una es su propia fila. */
  moneda: string;
  /** `mp` = la comisión la retuvo Mercado Pago al cobrar. `internacional` = la
   *  plata entró entera a VIVE y la comisión se descontó al pagarle al coach. */
  riel: 'mp' | 'internacional';
  sesiones: number;
  bruto: number;
  comision: number;
};

/** La comisión de una reserva. Redondea al centavo multiplicando antes de
 *  dividir, igual que `marketplaceFeeFor` del servidor. */
export function comisionDe(b: BookingForBilling): number {
  const amount = Number(b.amount ?? NaN);
  const pct = Number(b.platform_fee_pct ?? NaN);
  if (!Number.isFinite(amount) || !Number.isFinite(pct)) return 0;
  return Math.round(amount * pct) / 100;
}

/**
 * Agrupa por mes, profesional, moneda y riel.
 *
 * ⚠️ La moneda es parte de la clave y no un adorno: `bookings` tiene reservas en
 * ARS y en USD, y sumarlas daría un número que no significa nada. Si algún día
 * hace falta un total único, la conversión es una decisión de negocio con una
 * cotización y una fecha — no algo que esta función pueda inventar.
 *
 * El mes sale de `scheduled_date`, que es la fecha de la SESIÓN. Podría querer
 * usarse la del cobro (`paid_at`) según lo que diga el contador; se deja
 * anotado porque es exactamente el tipo de detalle que cambia un período fiscal.
 */
export function agruparComisiones(bookings: BookingForBilling[]): CommissionGroup[] {
  const mapa = new Map<string, CommissionGroup>();

  for (const b of bookings) {
    const mes = (b.scheduled_date ?? '').slice(0, 7);
    if (mes.length !== 7) continue;

    const moneda = b.currency ?? 'ARS';
    const riel: 'mp' | 'internacional' = b.payment_provider === 'mp' ? 'mp' : 'internacional';
    const clave = `${mes}|${b.coach_id}|${moneda}|${riel}`;

    let g = mapa.get(clave);
    if (!g) {
      g = {
        mes, coachId: b.coach_id, coachName: b.coach_name ?? null,
        moneda, riel, sesiones: 0, bruto: 0, comision: 0,
      };
      mapa.set(clave, g);
    }
    g.sesiones += 1;
    g.bruto += Number(b.amount ?? 0);
    g.comision += comisionDe(b);
  }

  // El redondeo va al final: sumar montos ya redondeados arrastra centavos, y
  // acá el total es la base de un comprobante.
  return [...mapa.values()]
    .map(g => ({
      ...g,
      bruto: Math.round(g.bruto * 100) / 100,
      comision: Math.round(g.comision * 100) / 100,
    }))
    .sort((a, b) => b.mes.localeCompare(a.mes) || b.comision - a.comision);
}

/** Total de comisión de un conjunto, POR MONEDA. Devuelve un mapa y no un
 *  número justamente para que no se pueda sumar pesos con dólares sin darse
 *  cuenta. */
export function totalPorMoneda(grupos: CommissionGroup[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of grupos) {
    out[g.moneda] = Math.round(((out[g.moneda] ?? 0) + g.comision) * 100) / 100;
  }
  return out;
}
