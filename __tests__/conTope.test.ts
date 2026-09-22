import { conTope, TOPE } from '../lib/conTope';

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('conTope', () => {
  it('deja pasar el valor si la promesa contesta a tiempo', async () => {
    await expect(conTope(Promise.resolve('sesion'), 50)).resolves.toBe('sesion');
  });

  it('devuelve TOPE si la promesa no contesta nunca', async () => {
    const nuncaContesta = new Promise<string>(() => {});
    await expect(conTope(nuncaContesta, 20)).resolves.toBe(TOPE);
  });

  it('devuelve TOPE si la promesa tarda más que el plazo', async () => {
    await expect(conTope(dormir(80).then(() => 'tarde'), 20)).resolves.toBe(TOPE);
  });

  // 🔴 La distinción que justifica el helper: un rechazo NO es un tope. La red
  // que falla ya tenía su rama en AuthContext y tiene que seguir llegando ahí.
  it('un rechazo sigue siendo un rechazo, no un tope', async () => {
    await expect(conTope(Promise.reject(new Error('red caida')), 50)).rejects.toThrow('red caida');
  });

  // Que un `null` legítimo (no hay sesión guardada) no se confunda con el tope.
  it('un valor vacio legitimo no se confunde con TOPE', async () => {
    await expect(conTope(Promise.resolve(null), 50)).resolves.toBeNull();
  });
});
