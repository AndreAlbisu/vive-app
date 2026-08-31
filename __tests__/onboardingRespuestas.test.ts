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
  CATEGORIA_A_TOPIC, topicDeCategoria, guardarRespuestas, leerRespuestas,
} from '@/lib/onboardingRespuestas';
import { leerPendiente } from '@/lib/quizPendiente';

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
});

describe('guardarRespuestas', () => {
  it('encola el topic mapeado y guarda aparte lo que no tiene columna', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'sentirme', temas: ['ansiedad'] });

    await expect(leerPendiente()).resolves.toMatchObject({ topic: 'emocion' });
    // universo y temas no van a la base: se conservan local.
    await expect(leerRespuestas()).resolves.toMatchObject({ universo: 'mente', temas: ['ansiedad'] });
  });

  it('una categoría que no mapea no encola basura', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'no_existe', temas: [] });
    await expect(leerPendiente()).resolves.toBeNull();
  });

  it('storage corrupto no rompe el arranque', async () => {
    mockStore['vita_onboarding_respuestas'] = '{ esto no es json';
    await expect(leerRespuestas()).resolves.toBeNull();
  });
});
