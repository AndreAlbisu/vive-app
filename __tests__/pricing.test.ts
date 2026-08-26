import {
  COMMISSION_INTERNATIONAL_FIRST,
  COMMISSION_INTERNATIONAL_RECURRING,
  COMMISSION_FIRST,
  COMMISSION_RECURRING,
} from '../supabase/functions/_shared/commission';
import {
  COMMISSION_LOCAL_FIRST,
  COMMISSION_LOCAL_RECURRING,
  COMMISSION_INTL_FIRST,
  COMMISSION_INTL_RECURRING,
  priceUsdError,
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

// 📝 Los tests de `paypalGrossUp` se eliminaron el 20/08/2026 junto con la
// función: al pasar el riel internacional a una comisión plana del 25%, el
// cliente paga el precio del coach y no hay recargo que calcular.

describe('netAfterPaypal', () => {
  it('descuenta 5,40% + USD 0,30', () => {
    expect(netAfterPaypal(60)).toBeCloseTo(56.46, 2);
    expect(netAfterPaypal(100)).toBeCloseTo(94.30, 2);
  });

  // 🔴 Lo que hace viable la tarifa plana: sobre el precio mínimo, la comisión
  // del 25% tiene que cubrir lo que se lleva PayPal y dejar margen. Si este test
  // falla, el mínimo quedó bajo para la comisión vigente.
  it('sobre el precio mínimo, la comisión del 25% cubre PayPal y sobra', () => {
    const precio = MIN_PRICE_USD;
    const comision = precio * 0.25;
    const costoPaypal = precio - netAfterPaypal(precio);
    expect(costoPaypal).toBeLessThan(comision);
    // Y con holgura suficiente para absorber el cambio de moneda, que todavía
    // no está medido pero se estima en 2-4%.
    expect(comision - costoPaypal).toBeGreaterThan(precio * 0.04);
  });

  it('la holgura crece con el precio, porque el fijo no escala', () => {
    const margen = (p: number) => p * 0.25 - (p - netAfterPaypal(p));
    expect(margen(100) / 100).toBeGreaterThan(margen(20) / 20);
  });
});

describe('cliente y servidor coinciden', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const server = require('../supabase/functions/_shared/pricing');

  it('las constantes de comisión no se desincronizaron', () => {
    expect(server.PAYPAL_PCT).toBe(0.054);
    expect(server.PAYPAL_FIXED_USD).toBe(0.30);
    expect(server.MIN_PRICE_USD).toBe(MIN_PRICE_USD);
  });
});

// 🔴 La escalera que se le MUESTRA al coach tiene que ser la que se le APLICA.
// `lib/pricing.ts` la duplica porque el módulo que la aplica corre en Deno; este
// test es lo único que impide que se separen. Si alguien cambia la del servidor
// y no la del cliente, la pantalla de cobro le promete al coach un neto que no
// va a recibir — y nadie se entera hasta que reclame.
describe('la comisión internacional que se muestra es la que se aplica', () => {
  it('coincide con `_shared/commission.ts`', () => {
    expect(COMMISSION_INTL_FIRST).toBe(COMMISSION_INTERNATIONAL_FIRST);
    expect(COMMISSION_INTL_RECURRING).toBe(COMMISSION_INTERNATIONAL_RECURRING);
  });

  it('la del riel local también', () => {
    expect(COMMISSION_LOCAL_FIRST).toBe(COMMISSION_FIRST);
    expect(COMMISSION_LOCAL_RECURRING).toBe(COMMISSION_RECURRING);
  });
});
