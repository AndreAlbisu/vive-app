// L58: la sesión pasa al mockLlavero del sistema. Lo que se prueba acá es lo único
// que puede dejar a alguien sin poder entrar: el ida y vuelta del partido en
// pedazos, que no queden restos de una sesión más larga, y que la sesión que ya
// estaba en AsyncStorage se mude en vez de perderse.
//
// `expo-secure-store` y AsyncStorage se reemplazan por dos mapas en memoria: lo
// que importa es la lógica, no el llavero real (que no existe en Jest).

const mockLlavero = new Map<string, string>();
const mockAsyncStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after_first_unlock_this_device_only',
  getItemAsync: jest.fn(async (k: string) => (mockLlavero.has(k) ? mockLlavero.get(k)! : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockLlavero.set(k, v); }),
  deleteItemAsync: jest.fn(async (k: string) => { mockLlavero.delete(k); }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (mockAsyncStore.has(k) ? mockAsyncStore.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mockAsyncStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockAsyncStore.delete(k); }),
  },
}));

import { secureSessionStorage, _internals } from '@/lib/secureSessionStorage';

const CLAVE = 'sb-proyecto-auth-token';
/** Una sesión de Supabase real pasa los 2 KB: con eso se prueba el partido. */
const sesionLarga = JSON.stringify({ access_token: 'a'.repeat(2600), refresh_token: 'r'.repeat(900) });

beforeEach(() => {
  mockLlavero.clear();
  mockAsyncStore.clear();
  jest.clearAllMocks();
});

describe('secureSessionStorage', () => {
  it('guarda y devuelve lo mismo, aunque no entre en un solo pedazo', async () => {
    await secureSessionStorage.setItem(CLAVE, sesionLarga);
    expect(await secureSessionStorage.getItem(CLAVE)).toBe(sesionLarga);
  });

  it('parte en más de un pedazo y ninguno supera el tope', async () => {
    await secureSessionStorage.setItem(CLAVE, sesionLarga);
    const pedazos = [...mockLlavero.entries()].filter(([k]) => !k.endsWith('.n'));
    expect(pedazos.length).toBeGreaterThan(1);
    for (const [, v] of pedazos) expect(v.length).toBeLessThanOrEqual(_internals.TAMANO_PEDAZO);
  });

  it('🔴 una sesión más corta no deja restos de la anterior', async () => {
    await secureSessionStorage.setItem(CLAVE, sesionLarga);
    const corta = JSON.stringify({ access_token: 'z' });
    await secureSessionStorage.setItem(CLAVE, corta);
    // Sin borrar los sobrantes, la lectura uniría pedazos de las dos.
    expect(await secureSessionStorage.getItem(CLAVE)).toBe(corta);
    expect([...mockLlavero.keys()].filter(k => !k.endsWith('.n'))).toHaveLength(1);
  });

  it('cerrar sesión no deja nada, ni en el mockLlavero ni en el lugar viejo', async () => {
    await secureSessionStorage.setItem(CLAVE, sesionLarga);
    mockAsyncStore.set(CLAVE, 'resto viejo');
    await secureSessionStorage.removeItem(CLAVE);
    expect(mockLlavero.size).toBe(0);
    expect(mockAsyncStore.size).toBe(0);
    expect(await secureSessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('🔴 la sesión que estaba en AsyncStorage se muda al mockLlavero y se borra de allá', async () => {
    mockAsyncStore.set(CLAVE, sesionLarga);
    expect(await secureSessionStorage.getItem(CLAVE)).toBe(sesionLarga);
    expect(mockAsyncStore.has(CLAVE)).toBe(false);
    // Y en la siguiente lectura ya sale del mockLlavero.
    expect(await secureSessionStorage.getItem(CLAVE)).toBe(sesionLarga);
  });

  it('sin nada guardado devuelve null', async () => {
    expect(await secureSessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('si falta un pedazo devuelve null en vez de una sesión rota', async () => {
    await secureSessionStorage.setItem(CLAVE, sesionLarga);
    mockLlavero.delete(_internals.clavePedazo(CLAVE, 1));
    expect(await secureSessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('si el llavero falla al leer, cae a AsyncStorage en vez de desloguear', async () => {
    const secure = require('expo-secure-store');
    secure.getItemAsync.mockRejectedValueOnce(new Error('keychain caído'));
    mockAsyncStore.set(CLAVE, sesionLarga);
    expect(await secureSessionStorage.getItem(CLAVE)).toBe(sesionLarga);
  });
});

// 🔴 El caso que rompió la app el 23/09: `expo-secure-store` trae código nativo
// y este proyecto usa un cliente de desarrollo propio, así que en un build que
// no lo tenga compilado el módulo NO EXISTE. Antes se importaba arriba de todo
// y tiraba "Cannot find native module 'ExpoSecureStore'" al cargar, lo que
// volteaba cada pantalla (lib/supabase.ts lo arrastra). Ahora se carga tarde y
// si no está, la sesión sigue en AsyncStorage.
describe('cuando el llavero no existe en este build', () => {
  it('no explota y usa AsyncStorage', async () => {
    jest.resetModules();
    jest.doMock('expo-secure-store', () => { throw new Error("Cannot find native module 'ExpoSecureStore'"); });
    const { secureSessionStorage: almacen } = require('@/lib/secureSessionStorage');

    await expect(almacen.setItem(CLAVE, 'sesión')).resolves.toBeUndefined();
    expect(mockAsyncStore.get(CLAVE)).toBe('sesión');
    expect(await almacen.getItem(CLAVE)).toBe('sesión');
    await almacen.removeItem(CLAVE);
    expect(mockAsyncStore.has(CLAVE)).toBe(false);
    // Y nada quedó en el llavero, porque no hay llavero.
    expect(mockLlavero.size).toBe(0);
  });
});
