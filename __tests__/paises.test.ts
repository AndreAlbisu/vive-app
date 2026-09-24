import { PAISES, PAISES_FRECUENTES, buscarPaises, normalizarPais } from '@/constants/paises';
import { NATIONALITIES } from '@/constants/searchData';

describe('paises', () => {
  it('no tiene repetidos', () => {
    const dup = PAISES.filter((p, i) => PAISES.indexOf(p) !== i);
    expect(dup).toEqual([]);
  });

  it('🔴 incluye las cinco nacionalidades que el buscador filtra', () => {
    // Si el selector no ofreciera alguna, ese filtro quedaría sin poder llenarse.
    expect(NATIONALITIES.filter(n => !PAISES.includes(n))).toEqual([]);
  });

  it('busca sin tildes y sin mayúsculas', () => {
    expect(buscarPaises('peru').frecuentes).toContain('Perú');
    expect(buscarPaises('MEXICO').frecuentes).toContain('México');
    expect(buscarPaises('  espa ').frecuentes).toContain('España');
  });

  it('busca también en la lista larga', () => {
    expect(buscarPaises('canada').resto).toContain('Canadá');
    expect(buscarPaises('republica dominicana').resto).toContain('República Dominicana');
  });

  it('sin texto devuelve las dos listas enteras', () => {
    const { frecuentes, resto } = buscarPaises('');
    expect(frecuentes).toEqual(PAISES_FRECUENTES);
    expect(resto.length).toBeGreaterThan(100);
  });

  it('un país que no existe no devuelve nada', () => {
    const { frecuentes, resto } = buscarPaises('narnia');
    expect(frecuentes).toEqual([]);
    expect(resto).toEqual([]);
  });

  it('normalizarPais saca tildes', () => {
    expect(normalizarPais('Perú')).toBe('peru');
  });
});
