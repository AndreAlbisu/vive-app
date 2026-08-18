import {
  USDT_TRC20_CONTRACT, fromRaw, uniqueAmount, nonceOf, findPayment, type TronTransfer,
} from '../supabase/functions/_shared/usdt';

const VIVE = 'TXYZmiDireccionDeCobroDeVive000000';

function transfer(over: Partial<TronTransfer> = {}): TronTransfer {
  return {
    transaction_id: 'hash-' + Math.random().toString(36).slice(2),
    from: 'TKiwjCAx6b6gVKgJ1GMMNNHpU8p3Zrg2u9',
    to: VIVE,
    value: '50370000',                   // 50.37 USDT
    type: 'Transfer',
    block_timestamp: 1787065764000,
    token_info: { symbol: 'USDT', decimals: 6, address: USDT_TRC20_CONTRACT },
    ...over,
  };
}

describe('conversión y montos', () => {
  it('convierte el value crudo a USDT', () => {
    expect(fromRaw('50003700')).toBeCloseTo(50.0037, 6);
    expect(fromRaw('1000000')).toBe(1);
  });

  it('arma el monto único con el nonce en los decimales', () => {
    expect(uniqueAmount(50, 37)).toBeCloseTo(50.37, 6);
    expect(uniqueAmount(50, 0)).toBe(50);
    expect(uniqueAmount(120, 99)).toBeCloseTo(120.99, 6);
  });

  it('rechaza nonces fuera de rango', () => {
    expect(() => uniqueAmount(50, 100)).toThrow();
    expect(() => uniqueAmount(50, -1)).toThrow();
  });

  // El identificador vive en los decimales: un precio con decimales se le suma
  // y lo corrompe (120,5 + 0,9999 = 121,4999 → nonce 4999, no 9999).
  it('RECHAZA un precio con decimales, que corrompería el identificador', () => {
    expect(() => uniqueAmount(120.5, 9999)).toThrow(/entero/);
  });

  it('extrae el nonce de un monto', () => {
    expect(nonceOf(50.37)).toBe(37);
    expect(nonceOf(49.37)).toBe(37);   // sobrevive a una comisión entera
  });

  // 🔴 La restricción que manda: las billeteras solo dejan tipear 2 decimales
  // (verificado en Belo). Un monto con más decimales sería inescribible para el
  // usuario y el pago nunca se podría reconocer.
  it('el monto siempre se puede escribir con 2 decimales', () => {
    for (const n of [0, 1, 37, 99]) {
      const m = uniqueAmount(6, n);
      expect(Number(m.toFixed(2))).toBe(m);
    }
  });
});

describe('findPayment', () => {
  it('encuentra el pago exacto', () => {
    const t = transfer();
    const r = findPayment([t], { direccion: VIVE, monto: 50.37 });
    expect(r.kind).toBe('match');
  });

  // 🔴 El test que más importa: cualquiera puede desplegar un token llamado
  // USDT. Aceptarlo por símbolo permitiría pagar con algo que no vale nada.
  it('RECHAZA un token falso con símbolo USDT pero otro contrato', () => {
    const falso = transfer({
      token_info: { symbol: 'USDT', decimals: 6, address: 'TFakeContract0000000000000000000000' },
    });
    expect(findPayment([falso], { direccion: VIVE, monto: 50.37 }).kind).toBe('sin_match');
  });

  it('rechaza un transfer a otra dirección', () => {
    const otro = transfer({ to: 'TOtraDireccionCualquiera0000000000' });
    expect(findPayment([otro], { direccion: VIVE, monto: 50.37 }).kind).toBe('sin_match');
  });

  it('ignora los hashes ya usados por otra reserva', () => {
    const t = transfer();
    const r = findPayment([t], {
      direccion: VIVE, monto: 50.37, hashesUsados: new Set([t.transaction_id]),
    });
    expect(r.kind).toBe('sin_match');
  });

  it('no confunde dos reservas con montos distintos', () => {
    const t = transfer();                       // 50.0037
    expect(findPayment([t], { direccion: VIVE, monto: 50.38 }).kind).not.toBe('match');
  });

  it('reporta monto_menor cuando el exchange descontó su comisión', () => {
    const t = transfer({ value: '49370000' }); // 49.37: misma fracción, 1 USDT menos
    const r = findPayment([t], { direccion: VIVE, monto: 50.37 });
    expect(r.kind).toBe('monto_menor');
    if (r.kind === 'monto_menor') {
      expect(r.recibido).toBeCloseTo(49.37, 6);
      expect(r.esperado).toBeCloseTo(50.37, 6);
    }
  });

  it('prefiere el pago exacto sobre el parcial', () => {
    const parcial = transfer({ value: '49370000' });
    const exacto = transfer();
    expect(findPayment([parcial, exacto], { direccion: VIVE, monto: 50.37 }).kind).toBe('match');
  });

  it('ignora entradas que no son Transfer', () => {
    const approve = transfer({ type: 'Approval' });
    expect(findPayment([approve], { direccion: VIVE, monto: 50.37 }).kind).toBe('sin_match');
  });

  it('sin transferencias, no hay match', () => {
    expect(findPayment([], { direccion: VIVE, monto: 50 }).kind).toBe('sin_match');
  });
});
