const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
    multiGet: async (keys: string[]) => keys.map(k => [k, mockStore[k] ?? null]),
  },
}));

import {
  PASOS_GUIA, guiaHabilitada, numeroDePaso, marcarVista, saltearGuia, guardarCamino,
} from '@/lib/guiaContextual';

const SALA = 'vive_tooltip_sala';
const [INICIO, PROFESIONALES, RECURSOS] = PASOS_GUIA;

beforeEach(() => { for (const k of Object.keys(mockStore)) delete mockStore[k]; });

describe('guiaHabilitada', () => {
  it('sin camino guardado se muestra: son las instalaciones viejas', async () => {
    await expect(guiaHabilitada(INICIO)).resolves.toBe(true);
  });

  it('quien eligió explorar la ve', async () => {
    await guardarCamino('explore');
    await expect(guiaHabilitada(INICIO)).resolves.toBe(true);
  });

  // 🔴 Desde el 12/09/2026 el camino elegido NO decide quién ve la guía.
  // Antes se le apagaba a los tres universos ('guide') con el argumento de que
  // "aterriza directo en los profesionales de su tema"; ese argumento dependía
  // del destino, y el destino era el problema. Ver `lib/guiaContextual.ts`.
  it('🔴 al que contó lo que le pasa TAMBIÉN se le explica la app', async () => {
    await guardarCamino('guide');
    await expect(guiaHabilitada(INICIO)).resolves.toBe(true);
    await expect(guiaHabilitada(RECURSOS)).resolves.toBe(true);
  });

  it('lo mismo para el camino viejo de "sé qué necesito"', async () => {
    await guardarCamino('search');
    await expect(guiaHabilitada(INICIO)).resolves.toBe(true);
  });

  it('la card de la Sala se muestra igual', async () => {
    await guardarCamino('guide');
    await expect(guiaHabilitada(SALA)).resolves.toBe(true);
  });

  it('una card ya vista no vuelve', async () => {
    await marcarVista(INICIO);
    await expect(guiaHabilitada(INICIO)).resolves.toBe(false);
  });

  it('saltear apaga TODAS de una, incluida la de la Sala', async () => {
    await saltearGuia();
    for (const k of [...PASOS_GUIA, SALA]) {
      await expect(guiaHabilitada(k)).resolves.toBe(false);
    }
  });
});

describe('numeroDePaso', () => {
  it('cuenta por orden de aparición, no por posición en la lista', async () => {
    // Entrando primero a Recursos, un número fijo diría "3 de 3" de entrada.
    await expect(numeroDePaso(RECURSOS)).resolves.toEqual({ paso: 1, total: 3 });
    await marcarVista(RECURSOS);
    await expect(numeroDePaso(INICIO)).resolves.toEqual({ paso: 2, total: 3 });
    await marcarVista(INICIO);
    await expect(numeroDePaso(PROFESIONALES)).resolves.toEqual({ paso: 3, total: 3 });
  });

  it('no se cuenta a sí misma: la primera card dice 1, no 0', async () => {
    await expect(numeroDePaso(INICIO)).resolves.toMatchObject({ paso: 1 });
  });

  it('la Sala no lleva número', async () => {
    await expect(numeroDePaso(SALA)).resolves.toBeNull();
  });

  it('nunca pasa del total aunque el storage venga raro', async () => {
    for (const k of PASOS_GUIA) await marcarVista(k);
    await expect(numeroDePaso(INICIO)).resolves.toEqual({ paso: 3, total: 3 });
  });
});
