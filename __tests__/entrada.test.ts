const mockAlmacen = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockAlmacen.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockAlmacen.delete(k); }),
  },
}));

// Cada test importa el módulo de cero: `destinoTrasEntrar` memoiza por usuario
// a nivel módulo, y ese memo no puede filtrarse de un caso a otro.
function cargar() {
  let mod: typeof import('@/lib/entrada');
  jest.isolateModules(() => { mod = require('@/lib/entrada'); });
  return mod!;
}

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

beforeEach(() => mockAlmacen.clear());

describe('destinoTrasEntrar', () => {
  it('cuenta nueva que viene del recorrido de entrada → "¿Cómo te gustaría empezar?"', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    expect(await destinoTrasEntrar({ id: 'u1', created_at: hace(2) }, 'user')).toBe('/onboarding2');
  });

  it('quien ya tenía cuenta y entra desde el mismo recorrido → directo a la app', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    expect(await destinoTrasEntrar({ id: 'u1', created_at: hace(60 * 24 * 30) }, 'user')).toBe('/(tabs)');
  });

  it('cuenta nueva pero sin la marca (entró por otro lado) → a la app', async () => {
    const { destinoTrasEntrar } = cargar();
    expect(await destinoTrasEntrar({ id: 'u1', created_at: hace(2) }, 'user')).toBe('/(tabs)');
  });

  it('incluye el rodeo de verificar el mail: 40 minutos después sigue siendo nueva', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    expect(await destinoTrasEntrar({ id: 'u1', created_at: hace(40) }, 'user')).toBe('/onboarding2');
  });

  // 🔴 El bug que el memo evita: `AuthRedirect` corre varias veces seguidas y la
  // marca se consume en la primera lectura. Sin memo, la segunda corrida pisaba
  // `/onboarding2` con `/(tabs)`.
  it('llamado dos veces para la misma persona, devuelve lo mismo', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    const u = { id: 'u1', created_at: hace(2) };
    expect(await destinoTrasEntrar(u, 'user')).toBe('/onboarding2');
    expect(await destinoTrasEntrar(u, 'user')).toBe('/onboarding2');
  });

  it('la marca se consume: otra persona en el mismo teléfono no la hereda', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    await destinoTrasEntrar({ id: 'u1', created_at: hace(2) }, 'user');
    expect(await destinoTrasEntrar({ id: 'u2', created_at: hace(2) }, 'user')).toBe('/(tabs)');
  });

  it('un profesional va a su app, con o sin marca', async () => {
    const { marcarPrimerRecorrido, destinoTrasEntrar } = cargar();
    await marcarPrimerRecorrido();
    expect(await destinoTrasEntrar({ id: 'c1', created_at: hace(2) }, 'coach')).toBe('/(coach)');
  });
});

describe('PANTALLAS_SIN_CUENTA', () => {
  // 🔴 La que no se puede perder nunca: las líneas de crisis sin tener cuenta.
  it('incluye la pantalla de crisis y los Términos', () => {
    const { PANTALLAS_SIN_CUENTA } = cargar();
    expect(PANTALLAS_SIN_CUENTA.has('ayuda')).toBe(true);
    expect(PANTALLAS_SIN_CUENTA.has('legal')).toBe(true);
  });

  it('NO incluye lo que ahora requiere cuenta', () => {
    const { PANTALLAS_SIN_CUENTA } = cargar();
    for (const p of ['(tabs)', 'onboarding2', 'onboarding4', 'profesional', 'diario', 'sala']) {
      expect(PANTALLAS_SIN_CUENTA.has(p)).toBe(false);
    }
  });
});
