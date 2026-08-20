import {
  comisionDe,
  agruparComisiones,
  totalPorMoneda,
  type BookingForBilling,
} from '@/lib/billing';

const reserva = (over: Partial<BookingForBilling> = {}): BookingForBilling => ({
  scheduled_date: '2026-08-19',
  coach_id: 'coach-1',
  coach_name: 'Coach Uno',
  amount: 4500,
  platform_fee_pct: 15,
  currency: 'ARS',
  payment_provider: 'mp',
  payment_status: 'aprobado',
  ...over,
});

describe('comisionDe', () => {
  it('calcula el porcentaje sobre el monto', () => {
    expect(comisionDe(reserva())).toBe(675);
    expect(comisionDe(reserva({ platform_fee_pct: 20 }))).toBe(900);
    expect(comisionDe(reserva({ amount: 60, platform_fee_pct: 25, currency: 'USD' }))).toBe(15);
  });

  // PostgREST devuelve numeric como string. Un `Number()` mal puesto acá
  // convertiría toda la comisión de un mes en NaN.
  it('acepta los números como string, que es como llegan de la base', () => {
    expect(comisionDe(reserva({ amount: '4500', platform_fee_pct: '15' }))).toBe(675);
  });

  it('devuelve 0 con datos ilegibles en vez de NaN', () => {
    expect(comisionDe(reserva({ amount: null }))).toBe(0);
    expect(comisionDe(reserva({ platform_fee_pct: null }))).toBe(0);
  });
});

describe('agruparComisiones', () => {
  it('agrupa por mes y profesional', () => {
    const g = agruparComisiones([reserva(), reserva(), reserva({ scheduled_date: '2026-07-10' })]);
    expect(g).toHaveLength(2);
    const agosto = g.find(x => x.mes === '2026-08')!;
    expect(agosto.sesiones).toBe(2);
    expect(agosto.comision).toBe(1350);
  });

  // 🔴 Lo que más importa de esta función: pesos y dólares NO se suman.
  it('separa las monedas en filas distintas', () => {
    const g = agruparComisiones([
      reserva(),
      reserva({ amount: 60, platform_fee_pct: 25, currency: 'USD', payment_provider: 'paypal' }),
    ]);
    expect(g).toHaveLength(2);
    expect(g.map(x => x.moneda).sort()).toEqual(['ARS', 'USD']);
  });

  it('separa los rieles: Mercado Pago retuvo la comisión, en el internacional la retuvo VIVE', () => {
    const g = agruparComisiones([
      reserva(),
      reserva({ payment_provider: 'usdt', currency: 'USD', amount: 60, platform_fee_pct: 25 }),
      reserva({ payment_provider: 'paypal', currency: 'USD', amount: 60, platform_fee_pct: 25 }),
    ]);
    // usdt y paypal caen los dos en 'internacional', misma fila.
    const intl = g.filter(x => x.riel === 'internacional');
    expect(intl).toHaveLength(1);
    expect(intl[0].sesiones).toBe(2);
    expect(g.filter(x => x.riel === 'mp')).toHaveLength(1);
  });

  it('ignora reservas sin fecha legible en vez de agruparlas bajo una clave rara', () => {
    expect(agruparComisiones([reserva({ scheduled_date: '' })])).toHaveLength(0);
  });

  it('ordena por mes descendente', () => {
    const g = agruparComisiones([
      reserva({ scheduled_date: '2026-06-01' }),
      reserva({ scheduled_date: '2026-08-01' }),
      reserva({ scheduled_date: '2026-07-01' }),
    ]);
    expect(g.map(x => x.mes)).toEqual(['2026-08', '2026-07', '2026-06']);
  });
});

describe('totalPorMoneda', () => {
  // Devuelve un mapa y no un número justamente para que sumar pesos con dólares
  // sea imposible por accidente.
  it('totaliza por separado y nunca mezcla', () => {
    const g = agruparComisiones([
      reserva(),
      reserva({ amount: 60, platform_fee_pct: 25, currency: 'USD', payment_provider: 'paypal' }),
    ]);
    expect(totalPorMoneda(g)).toEqual({ ARS: 675, USD: 15 });
  });

  it('sin datos devuelve un mapa vacío', () => {
    expect(totalPorMoneda([])).toEqual({});
  });
});
