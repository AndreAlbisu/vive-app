const mockStore: Record<string, string> = {};
const mockUpsert = jest.fn(async (..._a: unknown[]) => ({ error: null as { message: string } | null }));
// La cuenta conectada en el teléfono. null = todavía sin cuenta (onboarding).
let mockUid: string | null = null;
let mockFilaBase: Record<string, unknown> | null = null;
let mockConsiente = true;

jest.mock('@/lib/consent', () => ({ puedeTratarBienestar: async (uid?: string | null) => !!uid && mockConsiente }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => { mockStore[k] = v; },
    removeItem: async (k: string) => { delete mockStore[k]; },
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: mockUid ? { user: { id: mockUid } } : null } }) },
    from: () => ({
      upsert: (...a: unknown[]) => mockUpsert(...a),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockFilaBase, error: null }) }) }),
    }),
  },
}));

import { borrarPendienteLocal, guardarPendiente, leerPendiente, leerRespuestasGuardadas, volcarPendiente } from '@/lib/quizPendiente';

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockUid = null;
  mockFilaBase = null;
  mockConsiente = true;
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

describe('🔴 dos cuentas en el mismo teléfono (auditoría 26/09, C1)', () => {
  it('B no lee las respuestas que dejó A', async () => {
    mockUid = 'A';
    await guardarPendiente({ topic: 'emocion', subtemas: ['ansiedad'] });
    mockUid = 'B';
    await expect(leerRespuestasGuardadas()).resolves.toBeNull();
  });

  it('A sí vuelve a encontrar las suyas', async () => {
    mockUid = 'A';
    await guardarPendiente({ topic: 'emocion' });
    await expect(leerRespuestasGuardadas()).resolves.toMatchObject({ topic: 'emocion' });
  });

  it('un guardado parcial de B no arrastra los temas de A', async () => {
    mockUid = 'A';
    await guardarPendiente({ topic: 'emocion', subtemas: ['ansiedad'] });
    mockUid = 'B';
    await guardarPendiente({ budget: 'low' });
    const p = await leerPendiente();
    expect(p).toMatchObject({ budget: 'low', dueño: 'B' });
    expect(p).not.toHaveProperty('subtemas');
    expect(p).not.toHaveProperty('topic');
  });

  it('lo pendiente de A no se escribe bajo la cuenta de B', async () => {
    mockUid = 'A';
    await guardarPendiente({ topic: 'emocion' });
    await volcarPendiente('B');
    expect(mockUpsert).not.toHaveBeenCalled();
    await expect(leerPendiente()).resolves.toBeNull();
  });

  it('lo contestado sin cuenta lo adopta quien se registra', async () => {
    await guardarPendiente({ topic: 'emocion' });
    mockUid = 'A';
    await expect(leerRespuestasGuardadas()).resolves.toMatchObject({ topic: 'emocion' });
    await volcarPendiente('A');
    expect(filaEscrita()).toMatchObject({ user_id: 'A', topic: 'emocion' });
    await expect(leerPendiente()).resolves.toMatchObject({ dueño: 'A', volcado: true });
  });

  it('lo viejo sin dueño y ya volcado se ignora y se lee de la base', async () => {
    mockStore['vita_quiz_pendiente'] = JSON.stringify({ topic: 'emocion', volcado: true });
    mockUid = 'B';
    mockFilaBase = { topic: 'trabajo' };
    await expect(leerRespuestasGuardadas()).resolves.toMatchObject({ topic: 'trabajo' });
  });

  it('borrarPendienteLocal deja el teléfono limpio', async () => {
    mockUid = 'A';
    await guardarPendiente({ topic: 'emocion' });
    await borrarPendienteLocal();
    await expect(leerPendiente()).resolves.toBeNull();
  });
});

describe('🔴 consentimiento (auditoría 26/09, C2)', () => {
  it('sin consentimiento los temas no suben a la cuenta y quedan pendientes', async () => {
    mockUid = 'A';
    mockConsiente = false;
    await guardarPendiente({ topic: 'emocion', subtemas: ['ansiedad'] });
    await volcarPendiente('A');
    expect(mockUpsert).not.toHaveBeenCalled();
    await expect(leerPendiente()).resolves.toMatchObject({ volcado: false });
  });

  it('cuando lo da después, lo pendiente sube', async () => {
    mockUid = 'A';
    mockConsiente = false;
    await guardarPendiente({ topic: 'emocion' });
    await volcarPendiente('A');
    mockConsiente = true;
    await volcarPendiente('A');
    expect(filaEscrita()).toMatchObject({ user_id: 'A', topic: 'emocion' });
  });

  it('revocado, lo guardado en la cuenta no se usa para personalizar', async () => {
    mockUid = 'A';
    mockConsiente = false;
    mockFilaBase = { topic: 'trabajo' };
    await expect(leerRespuestasGuardadas()).resolves.toBeNull();
  });

  it('lo del propio teléfono se sigue usando: no sale del dispositivo', async () => {
    mockUid = 'A';
    mockConsiente = false;
    await guardarPendiente({ topic: 'emocion' });
    await expect(leerRespuestasGuardadas()).resolves.toMatchObject({ topic: 'emocion' });
  });
});
