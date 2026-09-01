const filas: Record<string, unknown>[] = [];
const eventos: { nombre: string; props: Record<string, unknown> }[] = [];

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => store[k] ?? null,
      setItem: async (k: string, v: string) => { store[k] = v; },
    },
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: async (fila: Record<string, unknown>) => { filas.push(fila); return { error: null }; } }) },
  registrarEvento: async (nombre: string, props: Record<string, unknown>) => { eventos.push({ nombre, props }); },
}));

import { recordCompletion } from '@/lib/resourceCompletions';

const dejarCorrer = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => { filas.length = 0; eventos.length = 0; });

describe('recordCompletion', () => {
  it('🔴 emite `recurso_completado`: es el cuello por el que pasan las once pantallas', async () => {
    // Antes el evento estaba suelto en cuatro de las once, así que siete
    // recursos se completaban sin dejar rastro y no había forma de notarlo
    // salvo leyendo las once pantallas.
    await recordCompletion('u1', 'meditacion', 300);
    await dejarCorrer();

    const ev = eventos.find(e => e.nombre === 'recurso_completado');
    expect(ev).toBeTruthy();
    expect(ev!.props.resource_id).toBe('meditacion');
    expect(ev!.props.duration_seconds).toBe(300);
  });

  it('sigue escribiendo la fila en resource_completions', async () => {
    await recordCompletion('u1', 'meditacion', 300);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: 'u1', resource_id: 'meditacion', duration_seconds: 300 });
  });

  it('un recurso libre (sin duración) también se anota, con duración nula', async () => {
    await recordCompletion('u1', 'diario');
    await dejarCorrer();

    expect(filas[0]).toMatchObject({ resource_id: 'diario', duration_seconds: null });
    const ev = eventos.find(e => e.nombre === 'recurso_completado');
    expect(ev!.props.duration_seconds).toBeNull();
  });

  it('🔴 sin cuenta anota el evento igual, pero NO escribe la fila', async () => {
    // `resource_completions.user_id` es FK a `auth.users`, así que sin cuenta no
    // hay fila posible. Pero el evento tiene que salir: es a donde el onboarding
    // manda a quien dice "solo estoy mirando", y sin esto sus aperturas se
    // leerían todas como abandono.
    await recordCompletion(null, 'respiracion', 300);
    await dejarCorrer();

    expect(filas).toHaveLength(0);
    const ev = eventos.find(e => e.nombre === 'recurso_completado');
    expect(ev).toBeTruthy();
    expect(ev!.props.con_cuenta).toBe(false);
  });

  it('con cuenta, el evento lo dice', async () => {
    await recordCompletion('u1', 'respiracion', 300);
    await dejarCorrer();
    expect(eventos[0].props.con_cuenta).toBe(true);
  });

  it('el evento lleva la sesión del dispositivo, como el resto de la analítica', async () => {
    await recordCompletion('u1', 'diario');
    await dejarCorrer();
    expect(eventos[0].props.sesion).toBeTruthy();
  });
});
