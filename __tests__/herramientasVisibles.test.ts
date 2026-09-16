import { TOOLS, TOOL_MAP, VISIBLE_TOOL_IDS, DEFAULT_HABIT_TOOL_IDS, TOOL_GROUPS } from '@/constants/tools';
import { VITA_TOOLS } from '@/constants/vitaTools';
import { MOOD_RESOURCES } from '@/constants/moodResources';

// `design/recursos-v2-definiciones.md` decidió que las herramientas de Vita son
// cuatro y que el resto "se retira de la vista, sin borrar su código". El recorte
// se ejecutó en la grilla (TOOL_GROUPS) pero el flag no existía, así que cada
// pantalla que leía el catálogo crudo volvía a ofrecer las diez por omisión:
// el picker de hábitos de Progreso las ofrecía todas, y el motor de
// recomendación devolvía `meditacion` para el eje "alma". Ninguno de los dos
// fallaba ruidosamente — el resultado era un push diario o una tarjeta hacia una
// pantalla que el equipo ya había decidido no sostener.
//
// Estos tests son el ruido que faltaba: si mañana alguien cambia `visible`,
// agrega una herramienta o toca la grilla, las tres fuentes tienen que seguir
// diciendo lo mismo.

const ESPERADAS = ['diario', 'gratitud', 'respiracion', 'ruido'];

describe('herramientas visibles — el catálogo manda', () => {
  it('son exactamente las cuatro de la decisión de producto', () => {
    expect([...VISIBLE_TOOL_IDS].sort()).toEqual([...ESPERADAS].sort());
  });

  it('la grilla de Recursos muestra las visibles y solo las visibles', () => {
    const enGrilla = TOOL_GROUPS.flatMap(g => g.toolIds);
    expect(new Set(enGrilla)).toEqual(new Set(VISIBLE_TOOL_IDS));
    expect(enGrilla.length).toBe(new Set(enGrilla).size); // sin repetidos
  });

  it('cada id de la grilla existe en el catálogo', () => {
    for (const id of TOOL_GROUPS.flatMap(g => g.toolIds)) {
      expect(TOOL_MAP[id]).toBeDefined();
    }
  });

  it('la rutina sembrada por defecto solo usa herramientas visibles', () => {
    for (const id of DEFAULT_HABIT_TOOL_IDS) {
      expect(TOOL_MAP[id]?.visible).toBe(true);
    }
  });

  it('el mapeo de ánimo nunca sugiere una herramienta retirada', () => {
    for (const [moodId, cfg] of Object.entries(MOOD_RESOURCES)) {
      expect(TOOL_MAP[cfg.primary]?.visible).toBe(true);
      expect(TOOL_MAP[cfg.secondary]?.visible).toBe(true);
      expect(moodId).toBeTruthy();
    }
  });
});

describe('herramientas retiradas — se esconden, no se borran', () => {
  it('siguen en el catálogo con su label y su ruta', () => {
    const retiradas = TOOLS.filter(t => !t.visible);
    expect(retiradas.length).toBeGreaterThan(0);
    for (const t of retiradas) {
      expect(t.label).toBeTruthy();
      expect(t.route).toBeTruthy(); // un hábito o pin viejo tiene que resolver
    }
  });
});

describe('las dos copias del catálogo dicen lo mismo', () => {
  // constants/vitaTools.ts duplica el catálogo para los íconos del inicio y de
  // guardados. Resuelve ids ya guardados, así que tiene que tener las diez —
  // pero no puede tener otras ni faltarle ninguna.
  it('vitaTools cubre exactamente los mismos ids que tools', () => {
    expect(VITA_TOOLS.map(t => t.id).sort()).toEqual(TOOLS.map(t => t.id).sort());
  });

  it('los labels coinciden entre las dos copias', () => {
    for (const vt of VITA_TOOLS) {
      expect(vt.label).toBe(TOOL_MAP[vt.id].label);
    }
  });
});
