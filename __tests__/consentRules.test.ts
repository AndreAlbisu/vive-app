import { necesitaPedir, puedeTratar, LO_QUE_CUBRE, type ConsentState } from '@/lib/consentRules';

const otorgado: ConsentState = { granted: true, grantedAt: '2026-09-03T10:00:00Z', policyVersion: '1aa3c074e84d' };
const revocado: ConsentState = { granted: false, grantedAt: '2026-09-03T10:00:00Z', policyVersion: '1aa3c074e84d' };

describe('necesitaPedir', () => {
  it('sin registro se pide — nadie consintió nada todavía', () => {
    expect(necesitaPedir(null)).toBe(true);
  });

  it('con el consentimiento otorgado no se vuelve a pedir', () => {
    expect(necesitaPedir(otorgado)).toBe(false);
  });

  // Revocar no es "nunca más preguntes": es retirar el permiso para el
  // tratamiento en curso. La persona puede volver a darlo cuando quiera.
  it('revocado vuelve a pedirse', () => {
    expect(necesitaPedir(revocado)).toBe(true);
  });

  // ⚠️ Deliberado: NO se re-pide cuando cambia la versión de la Política.
  // LEGAL_VERSION es un hash del texto entero, así que se mueve con una
  // corrección de tipeo — re-pedir por eso convierte el consentimiento en ruido.
  it('no se re-pide por un cambio de versión del texto', () => {
    const otraVersion: ConsentState = { ...otorgado, policyVersion: 'ffffffffffff' };
    expect(necesitaPedir(otraVersion)).toBe(false);
  });
});

describe('puedeTratar', () => {
  it('solo con el consentimiento otorgado', () => {
    expect(puedeTratar(otorgado)).toBe(true);
  });

  // Fail-closed. `null` llega tanto cuando nunca se preguntó como cuando la
  // consulta falló — en los dos casos la respuesta tiene que ser no.
  it('sin registro no se puede, y sin poder leerlo tampoco', () => {
    expect(puedeTratar(null)).toBe(false);
    expect(puedeTratar(revocado)).toBe(false);
  });
});

describe('LO_QUE_CUBRE', () => {
  // El comportamiento entró el 03/09/2026 por el fallo C-184/20 del TJUE: los
  // datos que por deducción revelan información sensible SON categoría especial.
  // Si esta línea desaparece, la pantalla deja de informar algo que sí se trata.
  it('incluye el uso de recursos, no solo lo que la persona escribe', () => {
    expect(LO_QUE_CUBRE.some(l => /recursos/i.test(l))).toBe(true);
  });

  it('nombra las tres categorías sin tecnicismos de tabla', () => {
    expect(LO_QUE_CUBRE).toHaveLength(3);
    for (const linea of LO_QUE_CUBRE) {
      expect(linea).not.toMatch(/mood_entries|resource_events|journal/);
    }
  });
});
