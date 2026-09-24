const mockEventos: { nombre: string; props: Record<string, unknown> }[] = [];

jest.mock('@/lib/supabase', () => ({
  registrarEvento: jest.fn(async (nombre: string, props: Record<string, unknown>) => {
    mockEventos.push({ nombre, props });
  }),
}));

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

import { limpiar, logError } from '@/lib/logging';

beforeEach(() => {
  mockEventos.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('limpiar', () => {
  it('saca mails, tokens, números largos y querystrings', () => {
    const t = limpiar(
      'Key (email)=(ana.perez@gmail.com) dup; jwt eyJhbGciOi.eyJzdWIiOi.abc123; tel 1155667788; https://x.com/pago?token=secreto',
    );
    expect(t).not.toMatch(/ana\.perez|eyJ|1155667788|secreto/);
    expect(t).toContain('[mail]');
    expect(t).toContain('[token]');
    expect(t).toContain('[número]');
    expect(t).toContain('https://x.com/pago?[…]');
  });

  it('recorta al máximo', () => {
    expect(limpiar('a'.repeat(1000)).length).toBe(300);
  });
});

describe('logError', () => {
  it('manda error_app con código y mensaje limpio', async () => {
    await logError('Sala: prueba A', { code: '42501', message: 'denied for x@y.com' });
    expect(mockEventos).toHaveLength(1);
    expect(mockEventos[0].nombre).toBe('error_app');
    expect(mockEventos[0].props).toMatchObject({
      contexto: 'Sala: prueba A', codigo: '42501', mensaje: 'denied for [mail]', fatal: false, version_app: '1.0.0',
    });
  });

  it('no repite el mismo error dentro del minuto', async () => {
    await logError('Sala: prueba B', new Error('boom'));
    await logError('Sala: prueba B', new Error('boom'));
    expect(mockEventos).toHaveLength(1);
  });
});
