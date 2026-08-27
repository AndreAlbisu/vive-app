import { paredMasCercana } from '@/components/SofiaAssistant';

// Pantalla de referencia: 390 de ancho, orbe de 54, margen de descanso 18.
const W = 390;
const IZQ = 18;
const DER = 390 - 54 - 18; // 318

describe('paredMasCercana', () => {
  it('desde la mitad izquierda vuelve a la izquierda', () => {
    expect(paredMasCercana(30, W)).toBe(IZQ);
  });

  it('desde la mitad derecha vuelve a la derecha', () => {
    expect(paredMasCercana(300, W)).toBe(DER);
  });

  it('decide por el CENTRO del orbe, no por su borde izquierdo', () => {
    // x=170 pone el borde izquierdo a la izquierda del medio (195) pero el
    // centro (197) a la derecha. Mirando el borde iría a la izquierda, y se ve
    // apenas pasado el medio: tiene que irse a la derecha.
    expect(170 < W / 2).toBe(true);
    expect(paredMasCercana(170, W)).toBe(DER);
  });

  it('justo en el medio se va a la derecha, sin quedar en el limbo', () => {
    expect(paredMasCercana(W / 2 - 27, W)).toBe(DER);
  });

  it('ya pegado a una pared se queda en la misma', () => {
    expect(paredMasCercana(IZQ, W)).toBe(IZQ);
    expect(paredMasCercana(DER, W)).toBe(DER);
  });

  it('en una pantalla más ancha el destino se recalcula, no queda fijo', () => {
    expect(paredMasCercana(700, 820)).toBe(820 - 54 - 18);
    expect(paredMasCercana(10, 820)).toBe(IZQ);
  });
});
