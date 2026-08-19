import {
  priceUsdError,
  paypalGrossUp,
  netAfterPaypal,
  MIN_PRICE_USD,
  MAX_PRICE_USD,
} from '@/lib/pricing';

describe('priceUsdError', () => {
  it('acepta un precio dentro del rango', () => {
    expect(priceUsdError(60)).toBeNull();
    expect(priceUsdError('60')).toBeNull();
    expect(priceUsdError(MIN_PRICE_USD)).toBeNull();
    expect(priceUsdError(MAX_PRICE_USD)).toBeNull();
  });

  it('rechaza por debajo del mínimo y lo dice con el número', () => {
    expect(priceUsdError(19)).toContain('20');
    expect(priceUsdError(6)).not.toBeNull();   // el precio de prueba viejo
    expect(priceUsdError(1)).not.toBeNull();
  });

  it('rechaza vacío, cero y basura', () => {
    expect(priceUsdError('')).not.toBeNull();
    expect(priceUsdError(0)).not.toBeNull();
    expect(priceUsdError('gratis')).not.toBeNull();
  });

  it('rechaza por encima del máximo', () => {
    expect(priceUsdError(MAX_PRICE_USD + 1)).not.toBeNull();
  });

  it('limpia el formato antes de leer el número', () => {
    expect(priceUsdError('USD 60')).toBeNull();
    expect(priceUsdError('$60')).toBeNull();
  });
});

describe('paypalGrossUp', () => {
  // La cuenta que decide el precio: 5,40% + USD 0,30 sobre lo cobrado.
  it('calcula el total a cobrar para netear el precio del coach', () => {
    expect(paypalGrossUp(60)).toBeCloseTo(63.75, 2);   // 63,7420… redondeado al centavo de arriba
    expect(paypalGrossUp(100)).toBeCloseTo(106.03, 2);
    expect(paypalGrossUp(20)).toBeCloseTo(21.46, 2);
  });

  // 🔴 Lo que invalidó la propuesta de "+7% flat": el recargo real depende del
  // precio porque la comisión fija no escala.
  it('el recargo NO es un porcentaje constante', () => {
    const pct = (p: number) => (paypalGrossUp(p) / p - 1) * 100;
    expect(pct(100)).toBeLessThan(pct(20));
    expect(pct(100)).toBeCloseTo(6.0, 1);
    expect(pct(20)).toBeCloseTo(7.3, 1);
  });

  // La razón de ser de MIN_PRICE_USD: abajo del piso el fijo se vuelve absurdo.
  it('en precios chicos el fijo domina, que es por lo que existe el mínimo', () => {
    const pct = (p: number) => (paypalGrossUp(p) / p - 1) * 100;
    expect(pct(1)).toBeGreaterThan(35);
    expect(pct(6)).toBeGreaterThan(10);
  });

  it('devuelve NaN con entradas inválidas en vez de un precio inventado', () => {
    expect(paypalGrossUp(0)).toBeNaN();
    expect(paypalGrossUp(-5)).toBeNaN();
    expect(paypalGrossUp(NaN)).toBeNaN();
  });
});

describe('el gross-up alcanza de verdad', () => {
  // 🔴 El test que importa: después de que PayPal cobre lo suyo sobre el monto
  // cobrado, tiene que quedar AL MENOS el precio del coach. Si quedara menos,
  // la diferencia la estaría poniendo VIVE en cada sesión, en silencio.
  it('lo que queda cubre el precio del profesional, en todo el rango', () => {
    for (const precio of [20, 35, 50, 60, 99, 150, 500, 1000, 10000]) {
      expect(netAfterPaypal(paypalGrossUp(precio))).toBeGreaterThanOrEqual(precio);
    }
  });

  it('y no se pasa de más de un centavo — no es una excusa para recargar', () => {
    for (const precio of [20, 60, 100, 1000]) {
      expect(netAfterPaypal(paypalGrossUp(precio)) - precio).toBeLessThanOrEqual(0.01);
    }
  });
});
