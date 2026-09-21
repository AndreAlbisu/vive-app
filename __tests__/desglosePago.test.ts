import { desglose, comisionPct } from '../lib/desglosePago';

describe('comisionPct', () => {
  it('local baja de la primera a la recurrente', () => {
    expect(comisionPct('mp', 'primera')).toBe(20);
    expect(comisionPct('mp', 'recurrente')).toBe(15);
  });

  it('internacional es 5 puntos más alta, en los dos tramos', () => {
    expect(comisionPct('paypal', 'primera')).toBe(25);
    expect(comisionPct('paypal', 'recurrente')).toBe(20);
    expect(comisionPct('usdt', 'primera')).toBe(25);
  });
});

describe('desglose', () => {
  it('en Mercado Pago la tarifa del procesador la paga el coach', () => {
    const d = desglose(100, 'mp', 'primera');
    expect(d.vive).toBe(20);
    expect(d.procesador).toEqual({ monto: 4.3, loPaga: 'coach' });
    expect(d.coach).toBe(75.7);
    expect(d.coachPct).toBe(76);
  });

  // Los tres pagos de $4.500 del 19 y 20/08 (payments 174555144528, 174554303062
  // y 173787714415) dan exactamente esto en la API de MP. Es el pago de precio
  // real que faltaba: el de $1 redondeaba la tarifa a 0,04 y tapaba el 4,3%.
  it('reproduce los pagos reales del 19/08 sobre $4.500', () => {
    const d = desglose(4500, 'mp', 'recurrente');
    expect(d.vive).toBe(675);              // application_fee
    expect(d.procesador?.monto).toBe(193.5); // mercadopago_fee real: 193,63
    expect(d.coach).toBe(3631.5);          // net_received_amount real: 3.631,37
  });

  it('reproduce el pago real del 09/08 sobre $1', () => {
    const d = desglose(1, 'mp', 'primera');
    expect(d.vive).toBe(0.2);
    expect(d.procesador?.monto).toBe(0.04);
    expect(d.coach).toBe(0.76);   // net_received_amount medido contra la API de MP
  });

  it('en PayPal el costo lo absorbe VIVE y al coach le llega limpio', () => {
    const d = desglose(100, 'paypal', 'primera');
    expect(d.coach).toBe(75);
    expect(d.procesador?.loPaga).toBe('vive');
  });

  it('en USDT no hay procesador que cobrar', () => {
    expect(desglose(100, 'usdt', 'primera').procesador).toBeNull();
    expect(desglose(100, 'usdt', 'primera').coach).toBe(75);
  });

  // 🔴 La propiedad que conviene no romper sin darse cuenta: los 5 puntos extra
  // del riel internacional compensan casi exactamente el ~4% que en el local
  // paga el coach, así que hoy cobra casi lo mismo venga de donde venga.
  it('el coach cobra casi lo mismo en los tres rieles', () => {
    const local = desglose(100, 'mp', 'primera').coachPct;
    const intl = desglose(100, 'paypal', 'primera').coachPct;
    expect(Math.abs(local - intl)).toBeLessThanOrEqual(1);
  });
});
