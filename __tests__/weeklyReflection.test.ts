import { buildReflection, type ReflectionInput } from '@/lib/weeklyReflection';
import { localDayKey, localDayKeyMinus } from '@/lib/dates';

// Base neutra: sin actividad, sin racha, sin histórico. Cada test enciende
// solo la señal que le interesa.
const base: ReflectionInput = {
  recentMoods: [],
  historicMoods: [],
  streak: 0,
  resourcesThisWeek: 0,
  sessionsThisWeek: 0,
  writingThisWeek: 0,
  sharpDrop: false,
  dayKey: '2026-08-15',
};

const on = (over: Partial<ReflectionInput>): ReflectionInput => ({ ...base, ...over });

/** El texto completo, como lo lee una persona. */
const text = (i: ReflectionInput) => {
  const r = buildReflection(i);
  return `${r.before}${r.bold}${r.after}`;
};

describe('buildReflection — el bug que reemplaza', () => {
  // La versión anterior armaba "Veniste más {nivel absoluto} que de costumbre",
  // donde la frase afirma una comparación pero la etiqueta describe el nivel.
  // Estos dos casos son exactamente donde se contradecían.

  it('alguien que viene BIEN pero peor que su histórico no recibe un elogio', () => {
    // avgRecent 4,0 contra histórico 4,6 → empeoró.
    // El texto viejo decía "Veniste más bien que de costumbre".
    const r = buildReflection(on({
      recentMoods: [4, 4, 4, 4],
      historicMoods: [5, 5, 4, 5, 4, 5],
    }));
    expect(r.signal).toBe('trend-down');
    expect(`${r.before}${r.bold}${r.after}`).not.toMatch(/bien/i);
  });

  it('alguien que viene CANSADO pero mejor que su histórico no recibe un reproche', () => {
    // avgRecent 2,25 contra histórico 1,33 → mejoró, está saliendo de un pozo.
    // El texto viejo decía "Veniste más cansado que de costumbre — se nota".
    const r = buildReflection(on({
      recentMoods: [2, 2, 3, 2],
      historicMoods: [1, 1, 2, 1, 1, 2],
    }));
    expect(r.signal).toBe('trend-up');
    expect(r.tone).toBe('warm');
    expect(`${r.before}${r.bold}${r.after}`).not.toMatch(/cansad/i);
  });

  it('ninguna frase de tendencia nombra un nivel absoluto', () => {
    // La invariante que hace imposible que el bug vuelva: si una frase compara,
    // no puede además etiquetar cómo venís.
    const niveles = /para abajo|cansada|pareja|muy bien|\bbien\b/i;
    const dias = ['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'];

    for (const dayKey of dias) {
      const sube = buildReflection(on({ dayKey, recentMoods: [4, 4, 5], historicMoods: [3, 3, 2] }));
      const baja = buildReflection(on({ dayKey, recentMoods: [3, 3, 3], historicMoods: [4, 5, 4] }));
      expect(`${sube.before}${sube.bold}${sube.after}`).not.toMatch(niveles);
      expect(`${baja.before}${baja.bold}${baja.after}`).not.toMatch(niveles);
    }
  });

  it('la frase de nivel no compara con nada', () => {
    // El caso inverso: cuando SÍ se nombra el nivel, no puede haber gramática
    // de comparación. "que de costumbre" es justo lo que sobraba.
    const r = buildReflection(on({ recentMoods: [3, 3, 3], historicMoods: [3, 3, 3] }));
    expect(r.signal).toBe('level');
    expect(`${r.before}${r.bold}${r.after}`).not.toMatch(/costumbre|que las anteriores|más que|mejor|peor/i);
  });
});

describe('buildReflection — prioridad de señales', () => {
  it('la caída fuerte de hoy gana sobre todo lo demás', () => {
    const r = buildReflection(on({
      sharpDrop: true,
      recentMoods: [5, 5, 5],
      historicMoods: [2, 2, 2],   // tendencia buenísima
      streak: 30,
      sessionsThisWeek: 2,
      resourcesThisWeek: 5,
    }));
    expect(r.signal).toBe('sharp-drop');
    expect(r.tone).toBe('gentle');
  });

  it('con caída fuerte no se felicita ni se pide nada', () => {
    // CoachSuggestionCard ya está arriba sugiriendo hablar con alguien. Esta
    // tarjeta no puede sumar una segunda acción ni levantar el ánimo a la fuerza.
    for (const dayKey of ['2026-08-15', '2026-08-16', '2026-08-17']) {
      const t = text(on({ sharpDrop: true, dayKey }));
      expect(t).not.toMatch(/reservá|probá|hacé|buenísimo|felicit/i);
    }
  });

  it('un nivel bajo sostenido gana sobre una tendencia de mejora', () => {
    // Viene en 2 hace una semana; el mes anterior fue peor. Técnicamente
    // "mejoró", pero decírselo a alguien que la está pasando mal es sordo.
    const r = buildReflection(on({
      recentMoods: [2, 2, 1, 2],
      historicMoods: [1, 1, 1, 1],
    }));
    expect(r.signal).toBe('sustained-low');
    expect(r.tone).toBe('gentle');
  });

  it('una sesión gana sobre la racha', () => {
    const r = buildReflection(on({
      recentMoods: [3, 3, 3],
      historicMoods: [3, 3, 3],
      streak: 12,
      sessionsThisWeek: 1,
    }));
    expect(r.signal).toBe('sessions');
  });

  it('la racha gana sobre las prácticas', () => {
    const r = buildReflection(on({
      recentMoods: [3, 3, 3],
      historicMoods: [3, 3, 3],
      streak: 5,
      resourcesThisWeek: 4,
    }));
    expect(r.signal).toBe('streak');
  });
});

describe('buildReflection — umbrales', () => {
  it('no llama cambio a un movimiento menor al umbral', () => {
    // 3,33 contra 3,0 → 0,33, por debajo de 0,4. Es ruido, no una semana mejor.
    const r = buildReflection(on({
      recentMoods: [3, 3, 4],
      historicMoods: [3, 3, 3],
    }));
    expect(r.signal).not.toBe('trend-up');
  });

  it('sí lo llama cambio cuando cruza el umbral', () => {
    const r = buildReflection(on({
      recentMoods: [4, 4, 4],
      historicMoods: [3, 3, 3],
    }));
    expect(r.signal).toBe('trend-up');
  });

  it('no compara con muestras chicas', () => {
    // Dos registros no alcanzan para afirmar que la semana cambió.
    const r = buildReflection(on({
      recentMoods: [5, 5],
      historicMoods: [1, 1],
    }));
    expect(r.signal).not.toBe('trend-up');
  });

  it('dos días de check-in no son una racha', () => {
    const r = buildReflection(on({
      recentMoods: [3, 3, 3],
      historicMoods: [3, 3, 3],
      streak: 2,
    }));
    expect(r.signal).toBe('level');
  });
});

describe('buildReflection — la variante del día', () => {
  it('es la misma dentro del mismo día', () => {
    // La tarjeta se re-monta cada vez que volvés a Inicio. Si la frase cambiara
    // en cada montaje, se rompe la ilusión que la feature persigue.
    const input = on({ recentMoods: [4, 4, 5], historicMoods: [3, 3, 3] });
    const veces = Array.from({ length: 20 }, () => text(input));
    expect(new Set(veces).size).toBe(1);
  });

  it('cambia a lo largo de los días', () => {
    const dias = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const frases = dias.map(dayKey => text(on({ dayKey, recentMoods: [4, 4, 5], historicMoods: [3, 3, 3] })));
    expect(new Set(frases).size).toBeGreaterThan(1);
  });

  it('no depende de la hora ni de nada externo', () => {
    // Nada de Date.now() adentro: mismo input, mismo output, siempre.
    const input = on({ recentMoods: [2, 2, 2], historicMoods: [4, 4, 4] });
    expect(buildReflection(input)).toEqual(buildReflection(input));
  });
});

describe('buildReflection — bordes', () => {
  it('sin ningún check-in invita en vez de inventar', () => {
    const r = buildReflection(base);
    expect(r.signal).toBe('empty');
  });

  it('siempre devuelve texto no vacío', () => {
    const casos: Partial<ReflectionInput>[] = [
      {}, { recentMoods: [1] }, { recentMoods: [5] }, { sharpDrop: true },
      { recentMoods: [3, 3, 3], streak: 100 },
      { recentMoods: [3, 3, 3], sessionsThisWeek: 9 },
      { recentMoods: [1, 1, 1], historicMoods: [5, 5, 5] },
      { recentMoods: [5, 5, 5], historicMoods: [1, 1, 1] },
    ];
    for (const c of casos) {
      const t = text(on(c));
      expect(t.trim().length).toBeGreaterThan(0);
    }
  });

  it('singulariza bien una sola sesión', () => {
    const una = text(on({ recentMoods: [3, 3, 3], sessionsThisWeek: 1, dayKey: '2026-08-15' }));
    expect(una).not.toMatch(/1 sesiones/);
  });

  it('nunca produce doble espacio ni puntuación colgando', () => {
    const dias = Array.from({ length: 10 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const casos: Partial<ReflectionInput>[] = [
      { sharpDrop: true }, { recentMoods: [1, 1, 1] }, { recentMoods: [4, 4, 4], historicMoods: [3, 3, 3] },
      { recentMoods: [3, 3, 3], streak: 7 }, { recentMoods: [3, 3, 3], resourcesThisWeek: 3 },
    ];
    for (const dayKey of dias) {
      for (const c of casos) {
        const t = text(on({ ...c, dayKey }));
        expect(t).not.toMatch(/ {2}/);
        expect(t).not.toMatch(/\s[.,]/);
      }
    }
  });
});

describe('localDayKey — la fecha del usuario, no la de UTC', () => {
  it('usa la fecha local aunque UTC ya esté en el día siguiente', () => {
    // 22:00 del 15/08 en Argentina (UTC-3) es 01:00 del 16/08 en UTC.
    // `toISOString()` diría 16; la persona está viviendo el 15.
    const nocheEnArgentina = new Date(2026, 7, 15, 22, 0, 0);
    expect(localDayKey(nocheEnArgentina)).toBe('2026-08-15');
  });

  it('dos momentos del mismo día local dan la misma clave', () => {
    // Este es el caso que rompía el UNIQUE(user_id, entry_date): con
    // toISOString() las 20:00 y las 22:00 del mismo lunes caían en fechas
    // distintas y se guardaban dos check-ins para un solo día.
    const temprano = new Date(2026, 7, 15, 20, 0, 0);
    const tarde = new Date(2026, 7, 15, 22, 0, 0);
    expect(localDayKey(temprano)).toBe(localDayKey(tarde));
  });

  it('rellena mes y día con cero', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('retrocede días cruzando el borde de mes', () => {
    expect(localDayKeyMinus(1, new Date(2026, 8, 1, 12, 0, 0))).toBe('2026-08-31');
    expect(localDayKeyMinus(7, new Date(2026, 7, 15, 12, 0, 0))).toBe('2026-08-08');
  });
});
