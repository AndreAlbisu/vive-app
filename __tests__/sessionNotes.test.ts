const mockResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: async () => mockResult }) }) },
}));

import { getSessionNotes, notasCambiadas } from '@/lib/sessionNotes';

describe('getSessionNotes', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });

  it('🔴 una lectura fallida no se confunde con "no hay notas"', async () => {
    mockResult.data = null;
    mockResult.error = { message: 'network' };
    await expect(getSessionNotes('b1')).resolves.toBeNull();
  });

  it('sin filas devuelve dos vacíos', async () => {
    mockResult.data = [];
    mockResult.error = null;
    await expect(getSessionNotes('b1')).resolves.toEqual({ privateNote: '', sharedNote: '' });
  });

  it('separa privada y compartida', async () => {
    mockResult.data = [{ content: 'priv', shared: false }, { content: 'comp', shared: true }];
    mockResult.error = null;
    await expect(getSessionNotes('b1')).resolves.toEqual({ privateNote: 'priv', sharedNote: 'comp' });
  });
});

describe('notasCambiadas', () => {
  const original = { privateNote: 'registro', sharedNote: 'tarea' };

  it('sin cambios no escribe nada', () => {
    expect(notasCambiadas(original, { ...original })).toEqual([]);
  });

  it('🔴 editar una nota no reescribe ni borra la otra', () => {
    expect(notasCambiadas(original, { privateNote: 'registro', sharedNote: 'tarea nueva' }))
      .toEqual([{ shared: true, content: 'tarea nueva' }]);
  });

  it('vaciar una nota a propósito sigue siendo un cambio (la borra)', () => {
    expect(notasCambiadas(original, { privateNote: '', sharedNote: 'tarea' }))
      .toEqual([{ shared: false, content: '' }]);
  });

  it('espacios de más no cuentan como cambio', () => {
    expect(notasCambiadas(original, { privateNote: 'registro  ', sharedNote: 'tarea' })).toEqual([]);
  });
});
