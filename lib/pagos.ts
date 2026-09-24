// pagos — "¿qué pasó con mi plata?", visto por quien reservó.
//
// Punto 3 de docs/investigacion-producto-2026-09-23.md. El circuito de cobros y
// devoluciones ya existía y funcionaba, pero la persona no tenía dónde verlo: una
// cancelación decía "te devolvemos todo" y después no había ningún lugar donde
// seguir esa devolución. Ahora `/mis-pagos` lista cada reserva con un intento de
// cobro y dice en qué está, siempre con lo que dice la base.
//
// 📌 Tres reglas de redacción que no son obvias:
//  1. Una devolución "confirmada" es la que el PROVEEDOR confirmó
//     (`payment_status = 'reembolsado'`). Eso no es lo mismo que "ya la tenés en
//     tu cuenta": el banco puede tardar días, y se dice.
//  2. Nada de esto es una factura. La sesión la factura el profesional
//     (docs/mapa-del-dinero.md); esto es un estado.
//  3. Nunca se promete un plazo que no controlamos.

import { supabase } from '@/lib/supabase';

export type Proveedor = 'mp' | 'paypal' | 'usdt';

export type PagoRow = {
  id: string;
  sala_id: string | null;
  coach_name: string | null;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  amount: number | null;
  charged_amount: number | null;
  /** Mercado Pago guarda el precio en `amount` y el descuento de referido acá. */
  referral_discount: number | null;
  currency: string | null;
  usdt_amount: number | null;
  payment_provider: Proveedor | null;
  payment_status: string;
  paid_at: string | null;
  refunded_at: string | null;
  refund_attempts: number | null;
  refund_address: string | null;
  refund_tx_id: string | null;
  cancelled_late: boolean | null;
};

export type Tono = 'ok' | 'proceso' | 'neutro' | 'atencion';

export type EstadoPago = {
  /** Lo principal, en pocas palabras. */
  titulo: string;
  /** Qué significa y qué sigue. */
  detalle: string;
  tono: Tono;
  /** Hace falta que la persona haga algo (hoy: pasar su dirección de USDT). */
  accion?: 'direccion_usdt';
};

export function nombreProveedor(p: Proveedor | null): string {
  if (p === 'paypal') return 'PayPal';
  if (p === 'usdt') return 'USDT';
  return 'Mercado Pago';
}

/** "$ 11.000", "USD 30", "6 USDT". Lo cobrado de verdad si difiere del precio. */
export function montoLegible(r: Pick<PagoRow, 'amount' | 'charged_amount' | 'referral_discount' | 'currency' | 'usdt_amount' | 'payment_provider'>): string {
  if (r.payment_provider === 'usdt' && r.usdt_amount != null) {
    return `${Number(r.usdt_amount).toLocaleString('es-AR', { maximumFractionDigits: 6 })} USDT`;
  }
  const valor = r.charged_amount
    ?? (r.amount != null ? Number(r.amount) - Number(r.referral_discount ?? 0) : null);
  if (valor == null) return 'Monto no disponible';
  const n = Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return r.currency === 'USD' ? `USD ${n}` : `$ ${n}`;
}

function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

/** El estado del dinero de una reserva, dicho para quien pagó. */
export function estadoDelPago(r: PagoRow): EstadoPago {
  const prov = nombreProveedor(r.payment_provider);

  switch (r.payment_status) {
    case 'reembolsado': {
      const cuando = fechaCorta(r.refunded_at);
      return {
        titulo: 'Te devolvimos el dinero',
        detalle: r.payment_provider === 'usdt'
          ? `Te lo enviamos a tu dirección${cuando ? ` el ${cuando}` : ''}.${r.refund_tx_id ? ` Transacción: ${r.refund_tx_id.slice(0, 10)}…` : ''}`
          : `${prov} confirmó la devolución${cuando ? ` el ${cuando}` : ''}. Puede tardar unos días en verse en tu resumen, según tu banco o tarjeta.`,
        tono: 'ok',
      };
    }

    case 'reembolso_pendiente': {
      if (r.payment_provider === 'usdt' && !r.refund_address) {
        return {
          titulo: 'Falta un dato para devolverte',
          detalle: 'Necesitamos la dirección de tu billetera para enviarte la devolución.',
          tono: 'atencion',
          accion: 'direccion_usdt',
        };
      }
      // `mp-process-refunds` deja de reintentar a los 6 fallos (dead-letter).
      // Ahí ya no es "en proceso": una persona lo tiene que resolver.
      if ((r.refund_attempts ?? 0) >= 6) {
        return {
          titulo: 'Devolución demorada',
          detalle: `${prov} no aceptó la devolución automática. La estamos resolviendo a mano; si querés saber más, escribinos desde acá.`,
          tono: 'atencion',
        };
      }
      return {
        titulo: 'Devolución en proceso',
        detalle: r.payment_provider === 'usdt'
          ? 'Te la enviamos nosotros a la dirección que nos pasaste. Te avisamos cuando salga.'
          : `Ya la estamos pidiendo a ${prov}. Te avisamos cuando la confirme.`,
        tono: 'proceso',
      };
    }

    case 'contracargo':
      return {
        titulo: 'Reclamo ante tu banco',
        detalle: 'Hiciste un reclamo por este cobro ante tu banco o tarjeta. Lo resuelven ellos.',
        tono: 'neutro',
      };

    case 'rechazado':
      return {
        titulo: 'El pago no se aprobó',
        detalle: 'No se te cobró nada por esta reserva.',
        tono: 'neutro',
      };

    case 'pendiente':
      if (r.status === 'cancelada') {
        return {
          titulo: 'El pago no se completó',
          detalle: 'La reserva se canceló sin que entrara el pago. Si ves un cobro en tu resumen, avisanos.',
          tono: 'neutro',
        };
      }
      return {
        titulo: 'Esperando la confirmación del pago',
        detalle: `Todavía no nos llegó la confirmación de ${prov}. Si ya pagaste, suele tardar unos minutos.`,
        tono: 'proceso',
      };

    case 'aprobado': {
      const cuando = fechaCorta(r.paid_at);
      if (r.status === 'cancelada') {
        return {
          titulo: 'Pagado, sin devolución',
          detalle: r.cancelled_late
            ? 'La sesión se canceló con menos de 24 horas de anticipación, y en ese caso no hay devolución. Si creés que es un error, escribinos desde acá.'
            : 'Esta cancelación no generó devolución. Si creés que es un error, escribinos desde acá.',
          tono: 'atencion',
        };
      }
      return {
        titulo: 'Pagado',
        detalle: `Con ${prov}${cuando ? ` el ${cuando}` : ''}.`,
        tono: 'ok',
      };
    }

    default:
      return { titulo: 'Sin pago', detalle: '', tono: 'neutro' };
  }
}

/** Las reservas de quien está logueado que tuvieron un intento de cobro. */
export async function listMisPagos(userId: string): Promise<PagoRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, sala_id, coach_name, scheduled_date, scheduled_time, status, amount, charged_amount, referral_discount, currency, usdt_amount, payment_provider, payment_status, paid_at, refunded_at, refund_attempts, refund_address, refund_tx_id, cancelled_late')
    .eq('user_id', userId)
    .neq('payment_status', 'no_iniciado')
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(100);
  if (error) {
    console.warn('[pagos] no se pudieron leer:', error.message);
    return [];
  }
  return (data ?? []) as PagoRow[];
}
