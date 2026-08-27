import { altoDeEje, anchoDeColumna, EJE_ALTO_MAX, EJE_ALTO_MIN, EJE_RATIO } from '@/lib/ejesLayout';

describe('altoDeEje', () => {
  it('mantiene la proporción aprobada en la pantalla con la que se diseñó', () => {
    // 390 → columna de 110 → 354, que es el número que se aprobó a mano.
    expect(anchoDeColumna(390)).toBeCloseTo(110, 5);
    expect(altoDeEje(390)).toBe(354);
  });

  it('se achica en un teléfono angosto en vez de quedar estirado', () => {
    // Con el alto fijo, un SE daba 4,08:1. Ahora tiene que dar la proporción.
    const alto = altoDeEje(320);
    expect(alto).toBeLessThan(354);
    expect(alto / anchoDeColumna(320)).toBeCloseTo(EJE_RATIO, 1);
  });

  it('crece en un teléfono ancho en vez de quedar chato', () => {
    const alto = altoDeEje(430);
    expect(alto).toBeGreaterThan(354);
    expect(alto / anchoDeColumna(430)).toBeCloseTo(EJE_RATIO, 1);
  });

  it('ningún teléfono real toca los límites: la proporción vale para todos', () => {
    for (const ancho of [320, 360, 375, 390, 414, 430]) {
      const alto = altoDeEje(ancho);
      expect(alto).toBeGreaterThan(EJE_ALTO_MIN);
      expect(alto).toBeLessThan(EJE_ALTO_MAX);
    }
  });

  it('en una tablet corta el techo en vez de dar tres bloques gigantes', () => {
    // Sin techo, 744 daría más de 700pt de alto.
    expect(anchoDeColumna(744) * EJE_RATIO).toBeGreaterThan(700);
    expect(altoDeEje(744)).toBe(EJE_ALTO_MAX);
  });

  it('un ancho absurdamente chico se apoya en el piso y no colapsa', () => {
    expect(altoDeEje(200)).toBe(EJE_ALTO_MIN);
  });
});
