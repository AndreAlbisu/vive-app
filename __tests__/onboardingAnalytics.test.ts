const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
  },
}));

const eventos: { nombre: string; props: Record<string, unknown> }[] = [];
jest.mock('@/lib/supabase', () => ({
  registrarEvento: async (nombre: string, props: Record<string, unknown>) => {
    eventos.push({ nombre, props });
  },
}));

type Modulo = typeof import('@/lib/onboardingAnalytics');

// ⚠️ Se re-importa en cada test a propósito. El módulo cachea el id en una
// variable de módulo (para no ir a AsyncStorage en cada tap), y esa variable
// sobrevive a limpiar el storage: sin volver a cargarlo, un test arrancaría con
// el id que dejó el anterior y estaríamos verificando el cache en vez del
// comportamiento.
let lib: Modulo;

// `anotar` es fire-and-forget a propósito (no puede frenar un flujo), así que
// para verificarlo hay que dejar correr la microtask que dispara.
const dejarCorrer = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  eventos.length = 0;
  jest.resetModules();
  lib = require('@/lib/onboardingAnalytics');
});

describe('el id de sesión', () => {
  it('es el mismo entre llamadas: si cambiara, cada evento sería una persona distinta', async () => {
    const a = await lib.idDeSesion();
    const b = await lib.idDeSesion();
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });

  it('queda persistido, porque el recorrido sobrevive a cerrar la app', async () => {
    const id = await lib.idDeSesion();
    expect(mockStore['vita_onboarding_sesion']).toBe(id);
  });

  it('lo ya guardado gana: reabrir la app no arranca un recorrido nuevo', async () => {
    mockStore['vita_onboarding_sesion'] = 'de-antes';
    await expect(lib.idDeSesion()).resolves.toBe('de-antes');
  });
});

describe('anotar', () => {
  it('🔴 mete la sesión en cada evento: sin eso los eventos son indistinguibles entre sí', async () => {
    lib.anotar('onboarding_pantalla_vista', { pantalla: 'que_te_trae' });
    await dejarCorrer();

    expect(eventos).toHaveLength(1);
    expect(eventos[0].nombre).toBe('onboarding_pantalla_vista');
    expect(eventos[0].props.pantalla).toBe('que_te_trae');
    expect(eventos[0].props.sesion).toBeTruthy();
  });

  it('todos los eventos de un recorrido comparten la misma sesión', async () => {
    lib.anotar('a'); lib.anotar('b'); lib.anotar('c');
    await dejarCorrer();

    const sesiones = new Set(eventos.map(e => e.props.sesion));
    expect(eventos).toHaveLength(3);
    expect(sesiones.size).toBe(1);
  });
});

describe('enlazarConCuenta', () => {
  it('🔴 no emite nada si el dispositivo nunca pasó por el onboarding', async () => {
    // Inventar un recorrido acá ensuciaría la métrica con todos los que ya
    // venían instalados de antes.
    await lib.enlazarConCuenta();
    expect(eventos).toHaveLength(0);
  });

  it('🔴 emite una sola vez, aunque onAuthStateChange dispare en cada arranque', async () => {
    const id = await lib.idDeSesion();

    await lib.enlazarConCuenta();
    await lib.enlazarConCuenta();
    await lib.enlazarConCuenta();

    const registros = eventos.filter(e => e.nombre === 'onboarding_registro');
    expect(registros).toHaveLength(1);
    expect(registros[0].props.sesion).toBe(id);
  });
});

describe('cronometro', () => {
  it('devuelve segundos, no milisegundos', async () => {
    const medir = lib.cronometro();
    await new Promise(r => setTimeout(r, 120));
    const s = medir();
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(5);
  });
});
