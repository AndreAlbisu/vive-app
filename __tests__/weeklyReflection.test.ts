import { buildReflection, rejectCopy, type ReflectionInput } from '@/lib/weeklyReflection';
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
    // Con un bajón fuerte hoy, esta tarjeta no puede pedir una acción ni
    // levantar el ánimo a la fuerza — es la única reacción a esa señal.
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

describe('buildReflection — primeros días (el bug de sobreafirmar con un registro)', () => {
  // 🔴 Antes de la sesión 159, UN solo check-in devolvía "Tu semana viene pareja":
  // `empty` solo cubría cero registros, las dos ramas que comparan exigen
  // MIN_SAMPLE, y el fallback `level` afirmaba sobre LA SEMANA a partir de un día.
  it('con un solo registro no afirma nada sobre la semana', () => {
    const r = buildReflection(on({ recentMoods: [3], historicMoods: [] }));
    expect(r.signal).toBe('early');
    const texto = `${r.before}${r.bold}${r.after}`.toLowerCase();
    expect(texto).not.toContain('semana');
  });

  it('con dos registros tampoco — el umbral es MIN_SAMPLE', () => {
    expect(buildReflection(on({ recentMoods: [3, 4], historicMoods: [] })).signal).toBe('early');
  });

  it('con tres ya puede hablar del nivel', () => {
    expect(buildReflection(on({ recentMoods: [3, 3, 3], historicMoods: [] })).signal).toBe('level');
  });

  it('sin ningún registro sigue siendo empty, no early', () => {
    expect(buildReflection(on({ recentMoods: [], historicMoods: [] })).signal).toBe('empty');
  });

  // `early` va DESPUÉS de sesiones/racha/prácticas a propósito: esas no dependen
  // de cuántos moods haya. Una sesión de esta semana es cierta con un check-in.
  // La primera versión de este arreglo tenía una regresión: alguien que registra
  // UN día y ese día es un bajón recibía la invitación neutra a seguir
  // registrando. Se acusa recibo del DÍA, sin hablar de la semana.
  it('con un único registro bajo acusa recibo en vez de invitar', () => {
    const r = buildReflection(on({ recentMoods: [1], historicMoods: [] }));
    expect(r.signal).toBe('early');
    expect(r.tone).toBe('gentle');
    expect(`${r.before}${r.bold}${r.after}`.toLowerCase()).not.toContain('semana');
  });

  it('con un único registro alto no baja el tono sin motivo', () => {
    expect(buildReflection(on({ recentMoods: [4], historicMoods: [] })).tone).toBe('neutral');
  });

  it('no le gana a una sesión, que es cierta con un solo check-in', () => {
    const r = buildReflection(on({ recentMoods: [3], sessionsThisWeek: 1 }));
    expect(r.signal).toBe('sessions');
  });

  it('no le gana a las prácticas', () => {
    const r = buildReflection(on({ recentMoods: [3], resourcesThisWeek: 2 }));
    expect(r.signal).toBe('practices');
  });

  // Y sí le cede a las dos señales que importan de verdad.
  it('cede ante un bajón fuerte, que con dos registros ya es real', () => {
    const r = buildReflection(on({ recentMoods: [1, 4], sharpDrop: true }));
    expect(r.signal).toBe('sharp-drop');
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

  it('TODAS las señales rotan, incluidas las dos que más se ven', () => {
    // `level` (ánimo parejo) y `empty` (usuario nuevo) tenían UNA sola frase,
    // así que la app decía literalmente lo mismo cada mañana — y son justo las
    // dos ramas en las que cae alguien que recién empieza. Este test es el
    // guardarraíl: si una señal vuelve a quedarse con una variante, falla.
    const dias = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const casos: [string, Partial<ReflectionInput>][] = [
      ['empty',         {}],
      ['level',         { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3] }],
      ['sharp-drop',    { sharpDrop: true }],
      ['sustained-low', { recentMoods: [2, 2, 1], historicMoods: [1, 1, 1] }],
      ['trend-up',      { recentMoods: [4, 4, 5], historicMoods: [3, 3, 2] }],
      ['trend-down',    { recentMoods: [2, 3, 2], historicMoods: [4, 4, 3] }],
      ['sessions',      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], sessionsThisWeek: 1 }],
      ['streak',        { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], streak: 6 }],
      ['practices',     { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], resourcesThisWeek: 3 }],
    ];

    for (const [signal, caso] of casos) {
      const frases = new Set(dias.map(dayKey => text(on({ ...caso, dayKey }))));
      expect(buildReflection(on({ ...caso, dayKey: dias[0] })).signal).toBe(signal);
      expect(frases.size).toBeGreaterThan(1);
    }
  });

  it('ninguna devolución es un dato pelado', () => {
    // El pedido que motivó el reescrito: "Esta semana hiciste 3 prácticas" es
    // un informe, no una devolución. Toda frase tiene que tener un segundo
    // tiempo — lo que se nota Y qué se dice de eso.
    const dias = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const casos: Partial<ReflectionInput>[] = [
      {}, { sharpDrop: true },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3] },
      { recentMoods: [2, 2, 1], historicMoods: [1, 1, 1] },
      { recentMoods: [4, 4, 5], historicMoods: [3, 3, 2] },
      { recentMoods: [2, 3, 2], historicMoods: [4, 4, 3] },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], sessionsThisWeek: 2 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], streak: 6 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], resourcesThisWeek: 3 },
    ];
    for (const dayKey of dias) {
      for (const c of casos) {
        const t = text(on({ ...c, dayKey }));
        // Dos oraciones (o una con guion largo), y no menos de diez palabras:
        // una frase de seis palabras terminada en punto es un rótulo.
        expect(t.split(/\s+/).length).toBeGreaterThanOrEqual(10);
        expect(t).toMatch(/[.—]\s|—/);
      }
    }
  });

  it('nunca le asigna un género a la persona', () => {
    // La app no sabe el género de quien lee, así que ninguna frase puede
    // adjetivarlo. El riesgo concreto: las etiquetas de nivel (`cansada`,
    // `pareja`) concuerdan con "semana" y son correctas en "tu semana viene
    // cansada", pero misgenerizan apenas el sujeto pasa a ser la persona
    // ("venís cansada"). Este test vigila ese salto de marco.
    const generizado = /\bven[íi]s\s+(?!a |m[áa]s |un |bien|mejor|peor|para |sosteni|atravesando|levantando)\w+(ada|ado|osa|oso|ida|ido)\b/i;
    const dias = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const casos: Partial<ReflectionInput>[] = [
      {}, { sharpDrop: true },
      { recentMoods: [1, 1, 1], historicMoods: [1, 1, 1] },
      { recentMoods: [2, 2, 2], historicMoods: [2, 2, 2] },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3] },
      { recentMoods: [4, 4, 4], historicMoods: [4, 4, 4] },
      { recentMoods: [5, 5, 5], historicMoods: [5, 5, 5] },
      { recentMoods: [2, 2, 1], historicMoods: [1, 1, 1] },
      { recentMoods: [4, 4, 5], historicMoods: [3, 3, 2] },
      { recentMoods: [2, 3, 2], historicMoods: [4, 4, 3] },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], sessionsThisWeek: 2 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], streak: 6 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], resourcesThisWeek: 3 },
    ];
    for (const dayKey of dias) {
      for (const c of casos) {
        expect(text(on({ ...c, dayKey }))).not.toMatch(generizado);
      }
    }
  });

  it('las etiquetas de nivel solo aparecen concordando con "semana"', () => {
    // El marco tiene que ser "(Tu|La) semana viene ___".
    // ⚠️ Cambió en la sesión 159: los niveles 1 y 2 ya NO llegan a esta rama.
    // Con muestra completa caen en `sustained-low`, y con una o dos entradas
    // caen en `early` — antes caían acá y la card afirmaba sobre "la semana" con
    // un solo registro. Quedan los tres niveles que sí pueden llegar.
    const casos: number[][] = [[3, 3, 3], [4, 4, 4], [5, 5, 5]];
    for (const moods of casos) {
      for (const dayKey of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
        const r = buildReflection(on({ recentMoods: moods, historicMoods: moods, dayKey }));
        expect(r.signal).toBe('level');
        expect(`${r.before}${r.bold}`).toMatch(/^(Tu|La) semana viene .+/);
      }
    }
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

describe('rejectCopy — el guardarraíl sobre lo que escribe un modelo', () => {
  // Las reglas garantizan su salida con los tests de arriba. Un modelo no:
  // hay que revisar cada frase ANTES de mostrarla. Esto es lo que decide caer
  // al texto determinístico.

  it('deja pasar una devolución bien escrita', () => {
    expect(rejectCopy('Algo se acomodó esta semana. Vale la pena registrar qué hiciste distinto.', 'warm')).toBeNull();
    expect(rejectCopy('Tu semana viene pareja. No todo tiene que ser un antes y un después.', 'neutral')).toBeNull();
    expect(rejectCopy('Un día flojo no borra la semana. Mañana es otro día y no le debés nada a nadie.', 'gentle')).toBeNull();
  });

  it('acepta las nueve frases que producen las reglas', () => {
    // El guardarraíl no puede ser más estricto que el piso al que cae: si
    // rechazara el texto determinístico, encender la IA dejaría la tarjeta
    // oscilando entre dos cosas que el propio código considera inaceptables.
    const casos: Partial<ReflectionInput>[] = [
      {}, { sharpDrop: true },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3] },
      { recentMoods: [2, 2, 1], historicMoods: [1, 1, 1] },
      { recentMoods: [4, 4, 5], historicMoods: [3, 3, 2] },
      { recentMoods: [2, 3, 2], historicMoods: [4, 4, 3] },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], sessionsThisWeek: 2 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], streak: 6 },
      { recentMoods: [3, 3, 3], historicMoods: [3, 3, 3], resourcesThisWeek: 3 },
    ];
    for (const dayKey of ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']) {
      for (const c of casos) {
        const r = buildReflection(on({ ...c, dayKey }));
        expect(rejectCopy(`${r.before}${r.bold}${r.after}`, r.tone)).toBeNull();
      }
    }
  });

  it('rechaza lo que le asigna un género a quien lee', () => {
    expect(rejectCopy('Venís cansada esta semana, pero seguís apareciendo igual.', 'neutral')).toBe('genera a la persona');
    expect(rejectCopy('Venís sostenido en días difíciles y eso dice bastante de vos.', 'gentle')).toBe('genera a la persona');
  });

  it('rechaza el vocabulario clínico', () => {
    expect(rejectCopy('Puede que estés atravesando un episodio de ansiedad generalizada esta semana.', 'gentle')).toBe('lenguaje clínico');
    expect(rejectCopy('Estos síntomas suelen aparecer cuando la semana viene cargada de más.', 'neutral')).toBe('lenguaje clínico');
  });

  it('rechaza el tono de gurú que el brief prohíbe', () => {
    expect(rejectCopy('Vas a lograr todo lo que te propongas si sostenés esta constancia.', 'warm')).toBe('tono gurú');
    expect(rejectCopy('El universo te devuelve la energía que ponés en tus prácticas.', 'warm')).toBe('tono gurú');
  });

  it('en tono suave no deja animar ni pedir nada', () => {
    // El día que alguien cayó fuerte, esta tarjeta es la única reacción que hay
    // — no puede celebrarlo ni sumarle una tarea encima.
    expect(rejectCopy('Buenísimo que lo hayas registrado igual, seguí así toda la semana.', 'gentle')).toBe('anima en tono suave');
    expect(rejectCopy('Hoy venís más abajo. Probá alguna de tus herramientas esta semana.', 'gentle')).toBe('pide una acción en tono suave');
    // Las mismas frases en tono cálido no son un problema.
    expect(rejectCopy('Buenísimo que lo hayas registrado igual, seguí así toda la semana.', 'warm')).toBeNull();
    expect(rejectCopy('Volviste a tus herramientas. Probá sostenerlo una semana más y mirá qué pasa.', 'warm')).toBeNull();
  });

  // ── §3.4 — pedir una reserva, en cualquier tono ──────────────────────────
  it('nunca deja pedir una reserva, ni siquiera en tono cálido', () => {
    // El bug que esto arregla: `reservá` vivía en el bloque `gentle`, así que
    // en `warm` —el tono de las señales buenas, que es justo cuando un vendedor
    // aprovecharía— no lo frenaba nadie.
    expect(rejectCopy('Van 6 días seguidos de check-in. Reservá una sesión para no perder el envión.', 'warm')).toBe('pide una reserva');
    expect(rejectCopy('Tu semana viene pareja. Agendá algo con tu profesional para la que viene.', 'neutral')).toBe('pide una reserva');
    expect(rejectCopy('Hoy venís más abajo. Sacá un turno con alguien que te pueda escuchar.', 'gentle')).toBe('pide una reserva');
  });

  it('pero deja NOMBRAR al profesional — reconocer un límite no es vender', () => {
    // Corrección del 28/08 en `docs/la-voz-de-sofia.md` §3.4: un amigo que dice
    // "eso decíselo el sábado" hace lo contrario de un vendedor.
    expect(rejectCopy('Eso que estás notando, guardalo para contárselo el sábado en tu sesión.', 'neutral')).toBeNull();
    expect(rejectCopy('Hay cosas que no se resuelven solas. Hablalo con tu profesional cuando lo veas.', 'gentle')).toBeNull();
  });

  // ── §3.5 — la app no finge sentir ────────────────────────────────────────
  it('no deja que la app se atribuya un sentimiento', () => {
    expect(rejectCopy('Van 6 días seguidos sin saltearte el check-in y me alegro un montón por vos.', 'warm')).toBe('finge sentir');
    expect(rejectCopy('Te entiendo, hay semanas que vienen más pesadas que otras y no pasa nada.', 'gentle')).toBe('finge sentir');
    expect(rejectCopy('Siento que esta semana te costó más de lo habitual sostener el ritmo.', 'neutral')).toBe('finge sentir');
    expect(rejectCopy('Volviste tres veces a tus herramientas esta semana y me pone contento verlo.', 'warm')).toBe('finge sentir');
  });

  it('pero sí deja hablar de lo que siente quien lee — la prohibición es de primera persona', () => {
    expect(rejectCopy('Lo que sentís esta semana no tiene que tener una explicación prolija.', 'gentle')).toBeNull();
    expect(rejectCopy('Registrás cómo te sentís hace 6 días seguidos. Eso después se nota.', 'warm')).toBeNull();
  });

  it('rechaza formato que delata que el modelo contestó otra cosa', () => {
    expect(rejectCopy('**Tu semana viene pareja.** No todo tiene que ser un antes y un después.', 'neutral')).toBe('markdown o comillas');
    expect(rejectCopy('"Tu semana viene pareja." No todo tiene que ser un antes y un después.', 'neutral')).toBe('markdown o comillas');
    expect(rejectCopy('Tu semana viene pareja y eso está muy bien, seguí registrando así!', 'neutral')).toBe('signos de exclamación');
  });

  it('rechaza por largo, en los dos extremos', () => {
    expect(rejectCopy('', 'neutral')).toBe('vacío');
    expect(rejectCopy('   ', 'neutral')).toBe('vacío');
    expect(rejectCopy('Tu semana viene pareja.', 'neutral')).toBe('muy corto');
    expect(rejectCopy(Array(50).fill('palabra').join(' '), 'neutral')).toBe('muy largo');
  });
});

describe('rejectCopy — etiquetas internas del modelo', () => {
  // 🔴 Hoy no puede pasar: la función corre en Haiku, que no entra en la rama
  // que apaga el thinking. Pero `REFLECTION_MODEL` es un override por variable
  // de entorno y la configuración se elige por PREFIJO, así que apuntarlo a un
  // modelo Opus le manda `thinking: disabled` — y con el thinking apagado esos
  // modelos pueden derramar `<thinking>` en la respuesta visible.
  //
  // Ninguno de los otros filtros mira `<` ni `>`: markdown, comillas y
  // exclamaciones pasaban de largo. Un cambio de env alcanzaba para publicarle
  // una etiqueta interna a la persona en su pantalla de inicio.

  it('rechaza una etiqueta derramada', () => {
    expect(rejectCopy('<thinking>La señal es streak</thinking> Seis días seguidos. Eso ya es una rutina.', 'warm'))
      .toBe('etiquetas internas');
  });

  it('rechaza aunque la etiqueta venga sola al final', () => {
    expect(rejectCopy('Tu semana viene pareja. No todo tiene que ser un antes y un después. </thinking>', 'neutral'))
      .toBe('etiquetas internas');
  });

  // El chequeo es por PAR de ángulos, no por carácter suelto: una frase que use
  // un "<" o un ">" en prosa —comparando números, por ejemplo— sigue pasando.
  // Rechazar el carácter suelto haría caer frases legítimas a las reglas.
  it('no rechaza un ángulo suelto en prosa', () => {
    expect(rejectCopy('Volviste a tus herramientas más veces que la semana pasada. Eso se nota.', 'warm'))
      .toBeNull();
    expect(rejectCopy('Tu semana viene mejor > que la anterior, y eso alcanza por hoy.', 'warm'))
      .toBeNull();
  });
});

describe('rejectCopy — el borde de palabra en español', () => {
  // 🔴 Bug propio, encontrado por el test de arriba: `\b` de JavaScript se
  // define sobre [A-Za-z0-9_], así que una vocal acentuada cuenta como
  // "no-palabra". En "reservá" no hay borde después de la `á` —los dos lados
  // son no-word— y `/\breservá\b/` no matchea NUNCA. El guardarraíl dejaba
  // pasar exactamente lo que existe para frenar, y sin avisar.
  // Estos casos son todos los patrones que terminan en carácter acentuado.

  it('frena verbos en imperativo con tilde final', () => {
    // Los dos que piden un booking los agarra `VENDE`, que corre en todos los
    // tonos desde la sesión 153; el resto sigue en `ASKS`, gentle-only. Lo que
    // este test cuida es el borde de palabra, no cuál de los dos patrones lo
    // atrapa: los dos usan el mismo helper `re()` con el lookahead.
    expect(rejectCopy('Hoy venís más abajo. Reservá una sesión con alguien esta misma semana.', 'gentle')).toBe('pide una reserva');
    expect(rejectCopy('Hoy venís más abajo. Agendá algo para vos en los próximos días.', 'gentle')).toBe('pide una reserva');
    expect(rejectCopy('Hoy venís más abajo. Probá una respiración antes de irte a dormir hoy.', 'gentle')).toBe('pide una acción en tono suave');
  });

  it('frena el aliento con tilde final', () => {
    expect(rejectCopy('Registraste un día difícil igual. Seguí así que vas muy bien.', 'gentle'))
      .toBe('anima en tono suave');
  });

  it('frena la promesa con tilde final', () => {
    expect(rejectCopy('Esta constancia transformará tu manera de encarar las semanas difíciles.', 'warm'))
      .toBe('tono gurú');
  });

  it('no frena una palabra que solo empieza igual', () => {
    // El lookahead tiene que cerrar la palabra, no cortarla por la mitad:
    // "reservado" no es "reservá", y "genialidad" no es "genial".
    expect(rejectCopy('Tu semana viene pareja y tenés el horario reservado para vos.', 'gentle')).toBeNull();
    expect(rejectCopy('Tu semana viene pareja, sin la genialidad de otras pero igual de válida.', 'gentle')).toBeNull();
  });
});
