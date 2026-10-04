jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

import { identidadCompleta, type FotoIdentidad } from '@/lib/identidad';

const fotos = (...ids: FotoIdentidad[]) => new Set<FotoIdentidad>(ids);

describe('identidadCompleta', () => {
  it('con las tres fotos, sí', () => {
    expect(identidadCompleta('sin_cargar', fotos('dni-frente', 'dni-dorso', 'selfie'))).toBe(true);
  });
  it('🔴 sin la selfie, no: el DNI solo no prueba que sea la persona', () => {
    expect(identidadCompleta('sin_cargar', fotos('dni-frente', 'dni-dorso'))).toBe(false);
  });
  it('ya verificada: no pide fotos (se borraron al verificar)', () => {
    expect(identidadCompleta('verificada', fotos())).toBe(true);
  });
  it('pendiente sin las fotos en el servidor: hay que volver a subirlas', () => {
    expect(identidadCompleta('pendiente', fotos('selfie'))).toBe(false);
  });
});
