let mockFila: { email_verified_at: string | null } | null = null;
let mockError: { message: string } | null = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockFila, error: mockError }),
        }),
      }),
    }),
  },
}));

import { mailVieneDeProveedor, necesitaVerificarMail } from '@/lib/emailVerificado';

const usuario = (app_metadata: Record<string, unknown>) =>
  ({ id: 'u1', email: 'a@b.com', app_metadata } as never);

beforeEach(() => { mockFila = { email_verified_at: null }; mockError = null; });

describe('mailVieneDeProveedor', () => {
  it('Google y Apple entregan el mail ya verificado', () => {
    expect(mailVieneDeProveedor(usuario({ provider: 'google' }))).toBe(true);
    expect(mailVieneDeProveedor(usuario({ provider: 'apple' }))).toBe(true);
  });

  it('mira también la lista, no solo el primero', () => {
    expect(mailVieneDeProveedor(usuario({ provider: 'email', providers: ['email', 'google'] }))).toBe(true);
  });

  it('email y password no prueban nada', () => {
    expect(mailVieneDeProveedor(usuario({ provider: 'email' }))).toBe(false);
  });

  it('sin usuario ni metadata no rompe', () => {
    expect(mailVieneDeProveedor(null)).toBe(false);
    expect(mailVieneDeProveedor(usuario({}))).toBe(false);
  });
});

describe('necesitaVerificarMail', () => {
  it('con email/password y sin constancia, sí', async () => {
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(true);
  });

  it('con constancia, no', async () => {
    mockFila = { email_verified_at: '2026-08-31T12:00:00Z' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
  });

  it('a quien entró con Google no se le pide, ni se consulta la base', async () => {
    mockFila = { email_verified_at: null };
    await expect(necesitaVerificarMail(usuario({ provider: 'google' }))).resolves.toBe(false);
  });

  it('sin usuario, no', async () => {
    await expect(necesitaVerificarMail(null)).resolves.toBe(false);
  });

  it('🔴 falla ABIERTO: un error de esquema no puede dejar a todos sin reservar', async () => {
    // El caso real: el script de la columna todavía no se corrió.
    mockError = { message: 'column profiles.email_verified_at does not exist' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
  });
});
