// Cualquier cadena de consulta (`.select().eq().or()...`) termina en lo que
// diga `mockRespuesta`, y cuenta cuántas veces se consultó `coaches`.
let mockRespuesta: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let mockConsultas = 0;

jest.mock('@/lib/supabase', () => {
  const cadena = (): unknown => new Proxy({}, {
    get: (_t, prop) => prop === 'then'
      ? (ok: (v: unknown) => void) => ok(mockRespuesta)
      : () => cadena(),
  });
  return { supabase: { from: (tabla: string) => { if (tabla === 'coaches') mockConsultas++; return cadena(); } } };
});

import { getCoachesCache, getCoachesStatus, invalidateCoachesCache, loadCoaches, prefetchCoaches } from '@/lib/coachesCache';

beforeEach(() => {
  invalidateCoachesCache();
  mockConsultas = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('coachesCache ante un error de red', () => {
  it('🔴 una falla no queda guardada como catálogo vacío', async () => {
    mockRespuesta = { data: null, error: { message: 'network' } };
    await expect(loadCoaches()).resolves.toEqual([]);
    expect(getCoachesCache()).toBeNull();
    expect(getCoachesStatus()).toBe('error');
  });

  it('🔴 después de una falla, la próxima carga vuelve a consultar', async () => {
    mockRespuesta = { data: null, error: { message: 'network' } };
    await loadCoaches();
    mockRespuesta = { data: [], error: null };
    await loadCoaches();
    expect(mockConsultas).toBe(2);
    expect(getCoachesStatus()).toBe('ok');
  });

  it('el reintento automático espera; el pedido por la persona no', async () => {
    mockRespuesta = { data: null, error: { message: 'network' } };
    await loadCoaches();
    prefetchCoaches();
    expect(mockConsultas).toBe(1);
    prefetchCoaches(true);
    expect(mockConsultas).toBe(2);
  });

  it('un catálogo vacío de verdad es "ok", no error', async () => {
    mockRespuesta = { data: [], error: null };
    await loadCoaches();
    expect(getCoachesStatus()).toBe('ok');
    expect(getCoachesCache()).toEqual([]);
  });
});
