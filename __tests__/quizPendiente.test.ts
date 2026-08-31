const mockStore: Record<string, string> = {};
const mockUpsert = jest.fn(async (..._a: unknown[]) => ({ error: null as { message: string } | null }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }) },
}));

import { guardarPendiente, leerPendiente, volcarPendiente } from '@/lib/quizPendiente';

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockUpsert.mockClear();
  mockUpsert.mockResolvedValue({ error: null });
});

const filaEscrita = () => mockUpsert.mock.calls[0][0] as Record<string, unknown>;

describe('guardarPendiente', () => {
  it('mergea en vez de pisar: el onboarding deja topic y el quiz suma el resto', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await guardarPendiente({ professionalType: 'coach', budget: 'mid' });
    await expect(leerPendiente()).resolves.toMatchObject({
      topic: 'emocion', professionalType: 'coach', budget: 'mid',
    });
  });

  it('una respuesta nueva gana sobre la vieja', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await guardarPendiente({ topic: 'salud' });
    await expect(leerPendiente()).resolves.toMatchObject({ topic: 'salud' });
  });

  it('ignora los campos vacíos en vez de borrar lo que había', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await guardarPendiente({ topic: null, budget: 'low' });
    await expect(leerPendiente()).resolves.toMatchObject({ topic: 'emocion', budget: 'low' });
  });

  it('🔴 respuestas nuevas después de un volcado vuelven a quedar pendientes', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await volcarPendiente('u1');
    await guardarPendiente({ topic: 'salud' });
    await volcarPendiente('u1');
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});

describe('volcarPendiente', () => {
  it('escribe solo las columnas que existen', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await volcarPendiente('u1');
    expect(filaEscrita()).toMatchObject({ user_id: 'u1', topic: 'emocion' });
    expect(filaEscrita()).not.toHaveProperty('budget');
  });

  it('escribe las tres cuando el quiz las dio', async () => {
    await guardarPendiente({ topic: 'salud', professionalType: 'nutricionista', budget: 'low' });
    await volcarPendiente('u1');
    expect(filaEscrita()).toMatchObject({
      topic: 'salud', professional_type: 'nutricionista', budget: 'low',
    });
  });

  it('🔴 vuelca UNA sola vez: si no, cada login pisaría un quiz más nuevo', async () => {
    await guardarPendiente({ topic: 'emocion' });
    await volcarPendiente('u1');
    await volcarPendiente('u1');
    await volcarPendiente('u1');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('si la escritura falla NO se marca, así se reintenta al próximo login', async () => {
    await guardarPendiente({ topic: 'emocion' });
    mockUpsert.mockResolvedValueOnce({ error: { message: 'red caída' } });
    await volcarPendiente('u1');
    await expect(leerPendiente()).resolves.toMatchObject({ volcado: false });

    await volcarPendiente('u1');
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    await expect(leerPendiente()).resolves.toMatchObject({ volcado: true });
  });

  it('sin nada pendiente no escribe', async () => {
    await volcarPendiente('u1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('con la cola sin ninguna respuesta real tampoco escribe una fila vacía', async () => {
    await guardarPendiente({ topic: null, professionalType: null, budget: null });
    await volcarPendiente('u1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('storage corrupto no rompe el arranque', async () => {
    mockStore['vita_quiz_pendiente'] = 'no soy json';
    await expect(volcarPendiente('u1')).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
