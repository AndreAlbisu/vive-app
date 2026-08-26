import { cbuError, walletError, normalizarCbu, coachNetFor, paypalEmailError, paypalPayoutCost, platformDeliveryCost, faltaParaInternacional, rielesTexto, USDT_NETWORK_FEE_USD, PAYPAL_PAYOUT_FEE_PCT } from '@/lib/payout';

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

describe('paypalEmailError', () => {
  it('acepta un mail normal', () => {
    expect(paypalEmailError('coach@ejemplo.com')).toBeNull();
  });

  it('ignora espacios alrededor', () => {
    expect(paypalEmailError('  coach@ejemplo.com  ')).toBeNull();
  });

  it('pide el dato cuando está vacío', () => {
    expect(paypalEmailError('')).toContain('Ingresá');
  });

  it('rechaza lo que claramente no es un mail', () => {
    for (const malo of ['coach', 'coach@', '@ejemplo.com', 'coach ejemplo.com', 'coach@ejemplo']) {
      expect(paypalEmailError(malo)).not.toBeNull();
    }
  });

  // 🔴 La diferencia con `walletError`, y es deliberada: un mail equivocado NO
  // pierde la plata (PayPal rebota el payout y vuelve al saldo), así que el
  // chequeo es de tipeo. Un regex estricto rechazaría mails válidos y raros,
  // que acá es el error más caro de los dos.
  it('no rechaza mails válidos poco comunes', () => {
    for (const raro of ['a+b@ejemplo.com.ar', "o'brien@ejemplo.io", 'x@sub.dominio.co']) {
      expect(paypalEmailError(raro)).toBeNull();
    }
  });
});

describe('costo de entrega', () => {
  // 🔴 D5 (25/08/2026): al coach NO se le descuenta nada, ni fijo ni proporcional.
  // Antes se le descontaba el costo de red de USDT; la regla espejo le sacó el piso
  // a ese argumento, porque elegir un riel dejó de ser una preferencia libre —
  // define qué clientes pueden pagarle.
  it('lo paga VIVE, y depende del riel', () => {
    expect(platformDeliveryCost(45, 'usdt')).toBe(USDT_NETWORK_FEE_USD);
    expect(platformDeliveryCost(45, 'paypal')).toBe(0.9);
  });

  // La propiedad que vuelve a USDT el riesgo a vigilar: su costo NO escala con el
  // monto, así que escala con la cantidad de coaches y no con la facturación.
  it('el de PayPal es proporcional y el de USDT no', () => {
    expect(platformDeliveryCost(20, 'paypal') / 20).toBeCloseTo(0.02, 6);
    expect(platformDeliveryCost(200, 'paypal') / 200).toBeCloseTo(0.02, 6);
    expect(platformDeliveryCost(20, 'usdt') / 20).toBeCloseTo(0.075, 6);
    expect(platformDeliveryCost(200, 'usdt') / 200).toBeCloseTo(0.0075, 6);
  });

  it('el cruce entre los dos costos cae en USD 75 por envío', () => {
    expect(paypalPayoutCost(75)).toBe(USDT_NETWORK_FEE_USD);
    expect(PAYPAL_PAYOUT_FEE_PCT).toBe(2);
  });
});

// 🔴 Espeja al trigger `sync_accepts_international` (`add-payout-rails.sql`).
// `accepts_international` es DERIVADA: la pantalla no puede prenderla, solo
// puede decir qué falta. Si estas condiciones se separan de las del trigger, el
// coach lee "ya está" y el catálogo sigue sin mostrarlo — o al revés.
describe('qué falta para las sesiones del exterior', () => {
  it('con precio y al menos un riel no falta nada', () => {
    expect(faltaParaInternacional(50, true, false)).toBeNull();
    expect(faltaParaInternacional(50, false, true)).toBeNull();
    expect(faltaParaInternacional(50, true, true)).toBeNull();
  });

  it('sin precio lo pide, aunque tenga riel', () => {
    const msg = faltaParaInternacional(null, true, false);
    expect(msg).toContain('precio en dólares');
    expect(msg).not.toContain('cómo querés que te paguemos');
  });

  it('sin riel lo pide, aunque tenga precio', () => {
    const msg = faltaParaInternacional(50, false, false);
    expect(msg).toContain('PayPal o USDT');
    expect(msg).not.toContain('precio en dólares');
  });

  it('sin nada los nombra a los dos', () => {
    const msg = faltaParaInternacional(null, false, false);
    expect(msg).toContain('precio en dólares');
    expect(msg).toContain('cómo querés que te paguemos');
  });

  // El 0 es un precio INVÁLIDO pero no es "sin precio": lo rechazan el CHECK de
  // `price_usd` (1..10000) y el mínimo de `lib/pricing`. Confundirlos mandaría
  // al coach a cargar un precio que ya cargó.
  it('distingue "sin precio" de "precio inválido"', () => {
    expect(faltaParaInternacional(0, true, false)).toBeNull();
  });
});

describe('rieles en criollo', () => {
  it('nombra los que acepta', () => {
    expect(rielesTexto(true, true)).toBe('A tu PayPal o en USDT');
    expect(rielesTexto(true, false)).toBe('A tu cuenta de PayPal');
    expect(rielesTexto(false, true)).toBe('En USDT');
  });

  // Sin rieles NO nombra ninguno: la tarjeta del perfil muestra esto como
  // destino del pago, y nombrar uno que no está elegido se lee como que sí.
  it('sin ninguno lo dice explícito', () => {
    expect(rielesTexto(false, false)).toBe('Todavía no elegiste ninguno');
  });
});
