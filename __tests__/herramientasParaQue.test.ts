import { PARA_QUE, HERRAMIENTAS_BAJADA } from '@/constants/herramientasParaQue';
import { VISIBLE_TOOL_IDS } from '@/constants/tools';

// 25/09/2026. Cada herramienta que se ofrece dice para qué sirve: si se suma una
// quinta sin su texto, el bloque no aparece y nadie se da cuenta.
describe('para qué sirve cada herramienta', () => {
  it('toda herramienta visible tiene su texto', () => {
    for (const id of VISIBLE_TOOL_IDS) {
      expect(PARA_QUE[id]).toBeDefined();
    }
  });

  // T&C §5: se dice para qué sirve, nunca un efecto de salud
  // (docs/encuadre-salud-y-responsabilidad.md). Y sin rayas en el copy.
  it('no promete efectos de salud ni usa rayas', () => {
    const textos = [HERRAMIENTAS_BAJADA, ...Object.values(PARA_QUE).flatMap(p => [p.para, p.cuando, p.saber])];
    for (const t of textos) {
      expect(t).not.toMatch(/sistema nervioso|ansiedad|estr[eé]s|cura|sana|tratamiento|reduce|disminuye/i);
      expect(t).not.toContain('—');
    }
  });
});
