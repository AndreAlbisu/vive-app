jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { supabase } from '@/lib/supabase';
import { listMisPagos, estadoDelPago, montoLegible, type PagoRow } from '@/lib/pagos';

function row(over: Partial<PagoRow> = {}): PagoRow {
  return {
    id: 'b1', sala_id: 's1', coach_name: 'Ana', scheduled_date: '2026-10-01', scheduled_time: '10:00',
    status: 'confirmada', amount: 11000, charged_amount: null, referral_discount: 0, currency: 'ARS', usdt_amount: null,
    payment_provider: 'mp', payment_status: 'aprobado', paid_at: '2026-09-20T12:00:00Z',
    refunded_at: null, refund_attempts: 0, refund_address: null, refund_tx_id: null, cancelled_late: false,
    ...over,
  };
}

describe('estadoDelPago', () => {
  it('pagado', () => {
    expect(estadoDelPago(row()).titulo).toBe('Pagado');
  });

  it('🔴 abandonar el checkout no se lee como sesión paga', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'pendiente' }));
    expect(e.titulo).toBe('El pago no se completó');
    expect(e.detalle).toMatch(/sin que entrara el pago/);
  });

  it('devolución en proceso nombra al proveedor y no promete plazo', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'reembolso_pendiente', payment_provider: 'paypal' }));
    expect(e.titulo).toBe('Devolución en proceso');
    expect(e.detalle).toContain('PayPal');
    expect(e.detalle).not.toMatch(/\d+ días hábiles|horas/);
  });

  it('🔴 confirmada por el proveedor no es "ya la tenés": avisa del banco', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'reembolsado', refunded_at: '2026-09-21T12:00:00Z' }));
    expect(e.tono).toBe('ok');
    expect(e.detalle).toMatch(/Mercado Pago confirmó/);
    expect(e.detalle).toMatch(/banco/);
  });

  it('el dead-letter de reembolsos se muestra como demorado, no en proceso', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'reembolso_pendiente', refund_attempts: 6 }));
    expect(e.titulo).toBe('Devolución demorada');
    expect(e.tono).toBe('atencion');
  });

  it('USDT sin dirección pide el dato', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'reembolso_pendiente', payment_provider: 'usdt' }));
    expect(e.accion).toBe('direccion_usdt');
  });

  it('cancelación tardía del usuario: pagado sin devolución, con el motivo', () => {
    const e = estadoDelPago(row({ status: 'cancelada', payment_status: 'aprobado', cancelled_late: true }));
    expect(e.titulo).toBe('Pagado, sin devolución');
    expect(e.detalle).toMatch(/24 horas/);
  });
});

describe('montoLegible', () => {
  it('pesos, dólares y USDT', () => {
    expect(montoLegible(row())).toBe('$ 11.000');
    expect(montoLegible(row({ currency: 'USD', amount: 30, payment_provider: 'paypal' }))).toBe('USD 30');
    expect(montoLegible(row({ payment_provider: 'usdt', usdt_amount: 6.000123, currency: 'USD' }))).toBe('6,000123 USDT');
  });
  it('usa lo cobrado si difiere del precio', () => {
    expect(montoLegible(row({ amount: 30, charged_amount: 27, currency: 'USD', payment_provider: 'paypal' }))).toBe('USD 27');
  });
  it('Mercado Pago: descuenta el referido guardado aparte', () => {
    expect(montoLegible(row({ amount: 11000, referral_discount: 1100 }))).toBe('$ 9.900');
  });
});


describe('listMisPagos', () => {
  function query(result: unknown) {
    const chain: any = {};
    for (const method of ['select', 'eq', 'neq', 'order']) chain[method] = jest.fn(() => chain);
    chain.limit = jest.fn().mockResolvedValue(result);
    (supabase.from as jest.Mock).mockReturnValue(chain);
    return chain;
  }
  it('returns an empty history only after a successful query', async () => {
    const chain = query({ data: [], error: null });
    await expect(listMisPagos('owner')).resolves.toEqual([]);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
  });
  it('propagates a failed query and allows a successful retry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const error = { message: 'network unavailable' };
      query({ data: null, error });
      await expect(listMisPagos('owner')).rejects.toEqual(error);
      const rows = [row()];
      query({ data: rows, error: null });
      await expect(listMisPagos('owner')).resolves.toEqual(rows);
    } finally { warn.mockRestore(); }
  });
});
