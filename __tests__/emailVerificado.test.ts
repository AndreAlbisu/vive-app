let mockFila: { email_verified_at: string | null } | null = null;
let mockError: { message: string; code?: string } | null = null;
// Lo que contesta `marcar_mail_verificado()`: `true` si la sesión se abrió con
// algo mandado al mail (código, link de recuperación), `false` con contraseña.
let mockMarca: { data: boolean | null; error: { message: string } | null } = { data: false, error: null };
let mockLlamadasRpc = 0;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async () => { mockLlamadasRpc++; return mockMarca; },
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

beforeEach(() => {
  mockFila = { email_verified_at: null };
  mockError = null;
  mockMarca = { data: false, error: null };   // por defecto, sesión de contraseña
  mockLlamadasRpc = 0;
});

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

  it('con constancia, no — y ni se le pregunta al servidor', async () => {
    mockFila = { email_verified_at: '2026-08-31T12:00:00Z' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
    expect(mockLlamadasRpc).toBe(0);
  });

  it('🔴 sin constancia, pero la sesión YA prueba la casilla: no', async () => {
    // El caso del 10/09: entró por el link de recuperación de contraseña
    // (`amr = recovery`). Antes se lo mandaba al muro a pedir OTRO código.
    mockMarca = { data: true, error: null };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
    expect(mockLlamadasRpc).toBe(1);
  });

  it('si el servidor no puede contestar, sigue pendiente', async () => {
    // La lectura ya dijo que no hay constancia: un error no la vuelve buena.
    mockMarca = { data: null, error: { message: 'red caída' } };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(true);
  });

  it('a quien entró con Google no se le pide, ni se consulta la base', async () => {
    mockFila = { email_verified_at: null };
    await expect(necesitaVerificarMail(usuario({ provider: 'google' }))).resolves.toBe(false);
    expect(mockLlamadasRpc).toBe(0);
  });

  it('sin usuario, no', async () => {
    await expect(necesitaVerificarMail(null)).resolves.toBe(false);
  });

  it('🔴 falla ABIERTO solo ante error de ESQUEMA (columna inexistente), por mensaje', async () => {
    // El caso que justificaba el fail-open: la columna no existe (rollback).
    mockError = { message: 'column profiles.email_verified_at does not exist' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
  });

  it('🔴 falla ABIERTO ante error de esquema por CÓDIGO (42703 / PGRST204)', async () => {
    mockError = { code: '42703', message: 'undefined column' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
    mockError = { code: 'PGRST204', message: 'column not found in schema cache' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(false);
  });

  it('🔒 falla CERRADO ante un error que NO es de esquema (transitorio, permisos)', async () => {
    // Antes esto dejaba pasar; ahora que la columna existe, un error de lectura
    // no es permiso para saltear la verificación.
    mockError = { code: 'PGRST301', message: 'JWT expired' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(true);
    mockError = { message: 'TypeError: Network request failed' };
    await expect(necesitaVerificarMail(usuario({ provider: 'email' }))).resolves.toBe(true);
  });
});
