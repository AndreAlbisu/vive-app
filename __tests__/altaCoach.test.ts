let mockSession: { user: { id: string } } | null;
let mockSelect: { data: { coach_alta_paso: unknown } | null; error: { code?: string; message?: string } | null };
let mockUpdateError: { code?: string; message?: string } | null;
let mockStore: Record<string, string>;
let lastUpdate: Record<string, unknown> | null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: mockSession } }) },
    from: () => ({
      update: (vals: Record<string, unknown>) => { lastUpdate = vals; return { eq: async () => ({ error: mockUpdateError }) }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => mockSelect }) }),
    }),
  },
}));

import { marcarAlta, pasoDelAlta, limpiarAlta } from '@/lib/altaCoach';

const KEY = 'vita_alta_coach';

beforeEach(() => {
  mockSession = { user: { id: 'u1' } };
  mockSelect = { data: { coach_alta_paso: null }, error: null };
  mockUpdateError = null;
  mockStore = {};
  lastUpdate = null;
});

describe('marcarAlta', () => {
  it('escribe el espejo local Y el servidor', async () => {
    await marcarAlta('verificar');
    expect(mockStore[KEY]).toBe('verificar');
    expect(lastUpdate).toEqual({ coach_alta_paso: 'verificar' });
  });

  it('sin sesión, igual deja el espejo local', async () => {
    mockSession = null;
    await marcarAlta('postular');
    expect(mockStore[KEY]).toBe('postular');
    expect(lastUpdate).toBeNull();
  });
});

describe('pasoDelAlta — el servidor manda', () => {
  it('devuelve el paso del servidor aunque el local diga otra cosa', async () => {
    mockStore[KEY] = 'verificar';
    mockSelect = { data: { coach_alta_paso: 'postular' }, error: null };
    await expect(pasoDelAlta()).resolves.toBe('postular');
  });

  it('🔴 el fix: local borrado (datos de la app) pero el servidor tiene el paso', async () => {
    // mockStore vacío = alguien borró los datos de la app.
    mockSelect = { data: { coach_alta_paso: 'postular' }, error: null };
    await expect(pasoDelAlta()).resolves.toBe('postular');
  });
});

describe('pasoDelAlta — fallback tolerante al espejo local', () => {
  it('servidor en null NO pisa un pendiente local (lado seguro)', async () => {
    mockStore[KEY] = 'verificar';
    mockSelect = { data: { coach_alta_paso: null }, error: null };
    await expect(pasoDelAlta()).resolves.toBe('verificar');
  });

  it('columna sin migrar → cae al espejo local, como hoy', async () => {
    mockStore[KEY] = 'postular';
    mockSelect = { data: null, error: { code: '42703', message: 'column profiles.coach_alta_paso does not exist' } };
    await expect(pasoDelAlta()).resolves.toBe('postular');
  });

  it('error de red → cae al espejo local', async () => {
    mockStore[KEY] = 'verificar';
    mockSelect = { data: null, error: { message: 'Network request failed' } };
    await expect(pasoDelAlta()).resolves.toBe('verificar');
  });

  it('nada en ningún lado → null', async () => {
    mockSelect = { data: { coach_alta_paso: null }, error: null };
    await expect(pasoDelAlta()).resolves.toBeNull();
  });

  it('sin sesión, lee solo el espejo local', async () => {
    mockSession = null;
    mockStore[KEY] = 'postular';
    await expect(pasoDelAlta()).resolves.toBe('postular');
  });
});

describe('limpiarAlta', () => {
  it('borra el espejo local y pone null en el servidor', async () => {
    mockStore[KEY] = 'postular';
    await limpiarAlta();
    expect(KEY in mockStore).toBe(false);
    expect(lastUpdate).toEqual({ coach_alta_paso: null });
  });
});
