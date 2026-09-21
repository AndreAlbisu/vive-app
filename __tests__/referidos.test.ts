import {
  descuentoAplicable, cuentaConReferido, normalizarCodigo,
  tieneFormaDeCodigo, generarCodigo, DESCUENTO_REFERIDO_PCT,
} from '../lib/referidos';

describe('la cuenta del referido', () => {
  // El ejemplo que Andre vio al decidir.
  it('sobre una sesión de $7.000 con comisión del 20%', () => {
    expect(cuentaConReferido(7000, 20)).toEqual({ cliente: 6300, descuento: 700, vive: 700 });
  });

  it('el descuento es el 10% de la sesión', () => {
    expect(descuentoAplicable(10000, 20)).toBe(1000);
    expect(DESCUENTO_REFERIDO_PCT).toBe(10);
  });

  // 🔴 Lo que nunca puede pasar: que Vita ponga plata de su bolsillo.
  it('Vita nunca queda en negativo, ni con la comisión más baja', () => {
    for (const comision of [25, 20, 15, 10, 5, 0]) {
      for (const precio of [2000, 4500, 7000, 50000]) {
        const c = cuentaConReferido(precio, comision);
        expect(c.vive).toBeGreaterThanOrEqual(0);
        expect(c.cliente).toBeLessThanOrEqual(precio);
      }
    }
  });

  it('con una comisión igual al descuento, Vita regala toda su comisión y no más', () => {
    expect(cuentaConReferido(5000, 10)).toEqual({ cliente: 4500, descuento: 500, vive: 0 });
  });

  it('con una comisión menor al descuento, el descuento se recorta a la comisión', () => {
    expect(cuentaConReferido(5000, 4)).toEqual({ cliente: 4800, descuento: 200, vive: 0 });
  });

  it('un precio inválido no descuenta nada', () => {
    expect(descuentoAplicable(0, 20)).toBe(0);
    expect(descuentoAplicable(-100, 20)).toBe(0);
  });
});

describe('los códigos', () => {
  it('normaliza lo que la gente pega de un WhatsApp', () => {
    expect(normalizarCodigo('  ab2 c4d ')).toBe('AB2C4D');
  });

  it('acepta un código bien formado y rechaza lo que no lo es', () => {
    expect(tieneFormaDeCodigo('ab2c4d')).toBe(true);
    expect(tieneFormaDeCodigo('')).toBe(false);
    expect(tieneFormaDeCodigo('AB2C4')).toBe(false);      // corto
    expect(tieneFormaDeCodigo('AB2C4DE')).toBe(false);    // largo
    expect(tieneFormaDeCodigo('AB2C4-')).toBe(false);     // símbolo
  });

  // 🔴 Los cuatro que se confunden leyendo el código en la pantalla de otro.
  it('el alfabeto no tiene I, O, 1 ni 0', () => {
    for (const malo of ['IBCDEF', 'OBCDEF', '1BCDEF', '0BCDEF']) {
      expect(tieneFormaDeCodigo(malo)).toBe(false);
    }
    // Y tampoco los genera: 200 tiradas con un random que barre todo el rango.
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo(() => i / 200);
      expect(c).not.toMatch(/[IO10]/);
      expect(tieneFormaDeCodigo(c)).toBe(true);
    }
  });
});
