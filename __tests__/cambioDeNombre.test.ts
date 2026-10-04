import { cambioCuentaParaElLimite, estadoDelNombre, mensajeDeRechazo } from '@/lib/cambioDeNombre';

const ahora = new Date('2026-10-01T15:00:00Z');

describe('estadoDelNombre', () => {
  it('profesional aprobado: no editable, dice a dónde escribir', () => {
    const e = estadoDelNombre({ role: 'coach', name: 'Sofía Herrera', nameChangedAt: null, ahora });
    expect(e.editable).toBe(false);
    expect(e.nota).toContain('vitaappar@gmail.com');
  });

  it('usuario que nunca lo cambió: editable', () => {
    expect(estadoDelNombre({ role: 'user', name: 'Ana', nameChangedAt: null, ahora }).editable).toBe(true);
  });

  it('usuario que lo cambió hace 10 días: bloqueado hasta cumplir 30', () => {
    const e = estadoDelNombre({ role: 'user', name: 'Ana', nameChangedAt: '2026-09-21T15:00:00Z', ahora });
    expect(e.editable).toBe(false);
    expect(e.nota).toContain('21 de octubre');
  });

  it('usuario que lo cambió hace 31 días: editable', () => {
    expect(estadoDelNombre({ role: 'user', name: 'Ana', nameChangedAt: '2026-08-31T15:00:00Z', ahora }).editable).toBe(true);
  });

  it('🔴 el placeholder "Usuario" del alta siempre se puede completar', () => {
    expect(estadoDelNombre({ role: 'user', name: 'Usuario', nameChangedAt: '2026-09-30T15:00:00Z', ahora }).editable).toBe(true);
  });
});

describe('cambioCuentaParaElLimite', () => {
  it('completar el placeholder o un nombre vacío no cuenta', () => {
    expect(cambioCuentaParaElLimite('Usuario')).toBe(false);
    expect(cambioCuentaParaElLimite(null)).toBe(false);
    expect(cambioCuentaParaElLimite('  ')).toBe(false);
  });
  it('cambiar un nombre real sí', () => {
    expect(cambioCuentaParaElLimite('Ana')).toBe(true);
  });
});

describe('mensajeDeRechazo', () => {
  it('traduce el bloqueo de profesional', () => {
    expect(mensajeDeRechazo({ message: 'NOMBRE_BLOQUEADO_PROFESIONAL' })).toContain('profesional');
  });
  it('traduce el bloqueo por identidad enviada', () => {
    expect(mensajeDeRechazo({ message: 'NOMBRE_BLOQUEADO_IDENTIDAD' })).toContain('verificación de identidad');
  });
  it('traduce el límite con la fecha que manda la base', () => {
    expect(mensajeDeRechazo({ message: 'NOMBRE_CAMBIADO_HACE_POCO', details: '2026-10-21' })).toContain('21 de octubre');
  });
  it('otro error: null, para que la pantalla use su mensaje genérico', () => {
    expect(mensajeDeRechazo({ message: 'network error' })).toBeNull();
  });
});
