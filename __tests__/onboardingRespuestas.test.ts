const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
  },
}));

// `quizPendiente` importa el cliente real, que tira si no hay env vars.
// Este test no escribe en la base: solo mira el vocabulario y la cola local.
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ upsert: async () => ({ error: null }) }) } }));

import {
  CATEGORIA_A_TOPIC, CATEGORIA_A_PUERTA, topicDeCategoria, puertaDeCategoria,
  esEje, guardarRespuestas, leerRespuestas,
} from '@/lib/onboardingRespuestas';
import { leerPendiente } from '@/lib/quizPendiente';
import { DOORS } from '@/constants/conexionesDoors';

beforeEach(() => { for (const k of Object.keys(mockStore)) delete mockStore[k]; });

describe('CATEGORIA_A_TOPIC', () => {
  // Las 9 categorías de OnboardingScreen4, los 5 topic de user_quiz_answers.
  const CATEGORIAS = ['energia', 'alimentacion', 'sexualidad', 'sentirme', 'entender', 'vinculos', 'rumbo', 'crecer', 'trabajo'];
  const TOPICS = ['emocion', 'relaciones', 'trabajo', 'salud', 'proposito'];

  it('cubre las nueve categorías del onboarding', () => {
    expect(Object.keys(CATEGORIA_A_TOPIC).sort()).toEqual([...CATEGORIAS].sort());
  });

  it('no inventa topics fuera del vocabulario de la tabla', () => {
    for (const t of Object.values(CATEGORIA_A_TOPIC)) expect(TOPICS).toContain(t);
  });

  it('una categoría desconocida no rompe, devuelve null', () => {
    expect(topicDeCategoria('no_existe')).toBeNull();
  });

  it('esEje acepta los tres del CHECK y nada más', () => {
    for (const e of ['cuerpo', 'mente', 'alma']) expect(esEje(e)).toBe(true);
    for (const e of ['espiritu', '', undefined, null]) expect(esEje(e)).toBe(false);
  });
});

describe('CATEGORIA_A_PUERTA', () => {
  // Las 9 categorías de OnboardingScreen4 → puertas de Profesionales.
  const CATEGORIAS = ['energia', 'alimentacion', 'sexualidad', 'sentirme', 'entender', 'vinculos', 'rumbo', 'crecer', 'trabajo'];

  it('cubre las nueve categorías del onboarding', () => {
    expect(Object.keys(CATEGORIA_A_PUERTA).sort()).toEqual([...CATEGORIAS].sort());
  });

  it('🔴 todas las puertas existen: un id inventado abriría el menú y se leería como que la respuesta se perdió', () => {
    const ids = new Set(DOORS.map(d => d.id));
    for (const puerta of Object.values(CATEGORIA_A_PUERTA)) expect(ids).toContain(puerta);
  });

  it('no manda dos categorías a la misma puerta: sería no haber preguntado', () => {
    const puertas = Object.values(CATEGORIA_A_PUERTA);
    expect(new Set(puertas).size).toBe(puertas.length);
  });

  it('una categoría desconocida no rompe, devuelve null y se entra por el menú', () => {
    expect(puertaDeCategoria('no_existe')).toBeNull();
  });
});

describe('guardarRespuestas', () => {
  it('encola el topic Y el eje declarado: son las dos mitades de la decisión', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'sentirme' });

    // El eje decide QUÉ recomendar, el topic CÓMO nombrarlo.
    await expect(leerPendiente()).resolves.toMatchObject({ topic: 'emocion', axis: 'mente' });
  });

  it('sigue aceptando temas: el paso 3 salió del flujo, pero lo ya guardado se tiene que poder leer', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'sentirme', temas: ['ansiedad'] });
    await expect(leerRespuestas()).resolves.toMatchObject({ temas: ['ansiedad'] });
  });

  it('con una categoría que no mapea igual conserva el eje, que sí es una respuesta', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'no_existe' });
    const p = await leerPendiente();
    expect(p?.axis).toBe('mente');
    expect(p?.topic).toBeUndefined();
  });

  it('🔴 un universo inválido NO se encola: el CHECK lo rechazaría y el volcado reintentaría para siempre', async () => {
    await guardarRespuestas({ universo: 'espiritu', categoria: 'sentirme' });
    const p = await leerPendiente();
    expect(p?.axis).toBeUndefined();
    expect(p?.topic).toBe('emocion');
  });

  it('storage corrupto no rompe el arranque', async () => {
    mockStore['vita_onboarding_respuestas'] = '{ esto no es json';
    await expect(leerRespuestas()).resolves.toBeNull();
  });
});
