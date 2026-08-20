import { cbuError, walletError, normalizarCbu, coachNetFor, payoutAfterDeliveryCost, USDT_NETWORK_FEE_USD } from '@/lib/payout';

// Direcciones reales de contratos conocidos: sirven como muestras de formato
// válido sin exponer la wallet de nadie.
const TRON_OK = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM_OK = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('cbuError', () => {
  it('acepta 22 dígitos', () => {
    expect(cbuError('2850590940090418135201')).toBeNull();
  });

  it('ignora espacios y guiones al contar', () => {
    expect(cbuError('2850-5909-4009-0418-1352-01')).toBeNull();
  });

  it('rechaza si faltan dígitos y dice cuántos van', () => {
    expect(cbuError('285059094009041813520')).toContain('21');
  });

  it('rechaza letras', () => {
    expect(cbuError('28505909400904181352a1')).not.toBeNull();
  });

  it('pide el dato si está vacío', () => {
    expect(cbuError('')).toBe('Ingresá tu CBU');
  });
});

describe('walletError', () => {
  it('acepta una dirección de Tron en TRC20', () => {
    expect(walletError(TRON_OK, 'TRC20')).toBeNull();
  });

  it('acepta una dirección EVM en ERC20 y en POLYGON', () => {
    expect(walletError(EVM_OK, 'ERC20')).toBeNull();
    expect(walletError(EVM_OK, 'POLYGON')).toBeNull();
  });

  // 🔴 EL test que justifica todo el módulo. Las dos direcciones son válidas
  // en su propia red; cruzarlas es lo que pierde los fondos para siempre.
  it('rechaza una dirección EVM declarada como TRC20', () => {
    expect(walletError(EVM_OK, 'TRC20')).not.toBeNull();
  });

  it('rechaza una dirección de Tron declarada como ERC20', () => {
    expect(walletError(TRON_OK, 'ERC20')).not.toBeNull();
  });

  it('rechaza base58 inválido (Tron no usa 0, O, I ni l)', () => {
    expect(walletError('T0' + TRON_OK.slice(2), 'TRC20')).not.toBeNull();
  });

  it('rechaza una dirección EVM sin el 0x', () => {
    expect(walletError(EVM_OK.slice(2), 'ERC20')).not.toBeNull();
  });

  it('rechaza por largo aunque el prefijo esté bien', () => {
    expect(walletError(EVM_OK + 'ab', 'ERC20')).not.toBeNull();
    expect(walletError(TRON_OK.slice(0, -1), 'TRC20')).not.toBeNull();
  });

  it('tolera espacios pegados al copiar y pegar', () => {
    expect(walletError(`  ${EVM_OK}  `, 'ERC20')).toBeNull();
  });

  it('pide el dato si está vacío', () => {
    expect(walletError('   ', 'TRC20')).toBe('Ingresá tu dirección');
  });
});

describe('normalizarCbu', () => {
  it('deja solo los dígitos', () => {
    expect(normalizarCbu('2850-5909 4009.0418/1352 01')).toBe('2850590940090418135201');
  });
});

describe('coachNetFor', () => {
  it('descuenta el 20% y el 15%', () => {
    expect(coachNetFor(100, 20)).toBe(80);
    expect(coachNetFor(100, 15)).toBe(85);
  });

  // Durante la promo fundador el coach se lleva todo. Es el caso que hoy queda
  // MAL si `usdt-create-payment` no escribe el porcentaje: la columna se queda
  // en su default de 20 y el coach cobraría 80 cuando le corresponde 100.
  it('con promo del 0% se lleva el total', () => {
    expect(coachNetFor(100, 0)).toBe(100);
  });

  it('cierra exacto contra la comisión: neto + fee === bruto', () => {
    for (const [monto, pct] of [[60, 20], [60, 15], [45, 15], [6, 20], [1, 20]] as const) {
      const fee = Math.round(monto * pct) / 100;
      expect(coachNetFor(monto, pct) + fee).toBeCloseTo(monto, 6);
    }
  });

  // El precio internacional es un entero por diseño (los centavos son el
  // identificador del pago), pero el neto no tiene por qué serlo.
  it('devuelve centavos cuando el reparto no da redondo', () => {
    expect(coachNetFor(45, 15)).toBe(38.25);
  });
});

describe('payoutAfterDeliveryCost', () => {
  it('la transferencia bancaria no tiene costo de entrega', () => {
    expect(payoutAfterDeliveryCost(150, 'transferencia')).toBe(150);
  });

  it('USDT descuenta la comisión de red una sola vez', () => {
    expect(payoutAfterDeliveryCost(150, 'usdt')).toBe(150 - USDT_NETWORK_FEE_USD);
  });

  // 🔴 La propiedad que justifica el descuento: el costo NO depende del monto,
  // así que pesa muchísimo más sobre un pago chico que sobre uno grande. Al
  // profesional de una sesión semanal le baja el cobro ~3 puntos; al de cuatro,
  // menos de uno.
  it('pesa según el volumen del profesional, no según el precio', () => {
    const unaSesion = payoutAfterDeliveryCost(37.5, 'usdt') / 37.5;
    const cuatroSesiones = payoutAfterDeliveryCost(150, 'usdt') / 150;
    expect(1 - unaSesion).toBeCloseTo(0.04, 2);
    expect(1 - cuatroSesiones).toBeCloseTo(0.01, 2);
    expect(cuatroSesiones).toBeGreaterThan(unaSesion);
  });

  // Sin mínimo de acumulación (decisión de Andre), así que esto puede pasar.
  // Lo importante es que dé negativo y se vea, en vez de que el panel muestre
  // cero y alguien crea que ya está saldado.
  it('devuelve negativo si el costo se come el pago, en vez de esconderlo', () => {
    expect(payoutAfterDeliveryCost(1, 'usdt')).toBeLessThan(0);
  });
});
