import { FRASE_BORRAR, coincideBorrado } from '@/lib/confirmarBorrado';

describe('coincideBorrado', () => {
  it('acepta la frase exacta', () => {
    expect(coincideBorrado(FRASE_BORRAR)).toBe(true);
  });

  it('perdona mayúsculas y espacios: la fricción es escribirla, no acertarle al teclado', () => {
    expect(coincideBorrado('borrar cuenta')).toBe(true);
    expect(coincideBorrado('Borrar Cuenta')).toBe(true);
    expect(coincideBorrado('  BORRAR   CUENTA  ')).toBe(true);
  });

  it('no acepta algo parecido', () => {
    expect(coincideBorrado('BORRAR')).toBe(false);
    expect(coincideBorrado('CUENTA')).toBe(false);
    expect(coincideBorrado('BORRAR MI CUENTA')).toBe(false);
    expect(coincideBorrado('BORRARCUENTA')).toBe(false);
    expect(coincideBorrado('')).toBe(false);
  });
});
