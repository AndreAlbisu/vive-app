jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

import { compararVersiones, debeActualizar } from '@/lib/appVersion';

describe('compararVersiones', () => {
  it('compara por partes numéricas', () => {
    expect(compararVersiones('1.0.0', '1.0.0')).toBe(0);
    expect(compararVersiones('1.0.0', '1.0.1')).toBe(-1);
    expect(compararVersiones('2.0.0', '1.9.9')).toBe(1);
  });

  // 🔴 El error clásico: como TEXTO, '1.2.10' < '1.2.9'. Comparado así, alguien
  // con la versión nueva quedaría bloqueado por "vieja".
  it('1.2.10 es MAYOR que 1.2.9', () => {
    expect(compararVersiones('1.2.10', '1.2.9')).toBe(1);
    expect(compararVersiones('1.10.0', '1.9.0')).toBe(1);
  });

  it('devuelve null si alguna no son tres números', () => {
    expect(compararVersiones('1.0', '1.0.0')).toBeNull();
    expect(compararVersiones('1.0.0-beta', '1.0.0')).toBeNull();
    expect(compararVersiones('', '1.0.0')).toBeNull();
  });
});

describe('debeActualizar', () => {
  it('bloquea solo si la instalada es menor', () => {
    expect(debeActualizar('1.0.0', '1.1.0')).toBe(true);
    expect(debeActualizar('1.1.0', '1.1.0')).toBe(false);
    expect(debeActualizar('1.2.0', '1.1.0')).toBe(false);
  });

  // Falla abierta: un dato roto en la base nunca tiene que dejar a todos afuera.
  it('ante cualquier dato que no se entiende, deja pasar', () => {
    expect(debeActualizar(null, '9.9.9')).toBe(false);
    expect(debeActualizar('1.0.0', null)).toBe(false);
    expect(debeActualizar('1.0.0', '9.9')).toBe(false);
    expect(debeActualizar('algo', '9.9.9')).toBe(false);
  });
});
