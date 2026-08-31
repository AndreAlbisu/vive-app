const mockStore: Record<string, string> = {};
const mockUpsert = jest.fn(async () => ({ error: null as { message: string } | null }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...(a as [])) }) },
}));

import {
  CATEGORIA_A_TOPIC, topicDeCategoria, guardarRespuestas, leerRespuestas, volcarRespuestas,
} from '@/lib/onboardingRespuestas';

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockUpsert.mockClear();
  mockUpsert.mockResolvedValue({ error: null });
});

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

describe('volcarRespuestas', () => {
  const respuestas = { universo: 'mente', categoria: 'sentirme', temas: ['ansiedad'] };

  it('escribe el topic mapeado', async () => {
    await guardarRespuestas(respuestas);
    await volcarRespuestas('user-1');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: 'user-1', topic: 'emocion' });
  });

  it('🔴 vuelca UNA sola vez: si no, cada login pisaría el quiz hecho después', async () => {
    await guardarRespuestas(respuestas);
    await volcarRespuestas('user-1');
    await volcarRespuestas('user-1');
    await volcarRespuestas('user-1');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('si la escritura falla NO se marca, así se reintenta en el próximo login', async () => {
    await guardarRespuestas(respuestas);
    mockUpsert.mockResolvedValueOnce({ error: { message: 'red caída' } });
    await volcarRespuestas('user-1');
    expect((await leerRespuestas())?.volcado).toBeFalsy();

    await volcarRespuestas('user-1');
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect((await leerRespuestas())?.volcado).toBe(true);
  });

  it('sin respuestas guardadas no escribe nada', async () => {
    await volcarRespuestas('user-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('con una categoría que no mapea no escribe basura', async () => {
    await guardarRespuestas({ universo: 'mente', categoria: 'no_existe', temas: [] });
    await volcarRespuestas('user-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('storage corrupto no rompe el arranque', async () => {
    mockStore['vita_onboarding_respuestas'] = '{ esto no es json';
    await expect(leerRespuestas()).resolves.toBeNull();
    await expect(volcarRespuestas('user-1')).resolves.toBeUndefined();
  });
});
