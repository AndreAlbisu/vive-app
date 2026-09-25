import {
  ENFOQUES,
  ESTILO_OPCIONES_COACH,
  ESTILO_OPCIONES_PERSONA,
  MAX_ENFOQUES,
  esEnfoque,
  esEstiloCoach,
  etiquetaEstilo,
  etiquetasEnfoques,
  evaluarEstilo,
  enfoquesAGuardar,
  opcionesEnfoque,
  opcionesGuardadas,
  METODOS_COACHING,
  ENFOQUES_NUTRICION,
} from '../lib/enfoque';
import { recomendarDesdeQuiz } from '../lib/quizMatch';
import type { CachedCoach } from '../lib/coachesCache';

// Tienen que coincidir con los CHECK de scripts/add-coach-enfoque.sql. Si
// alguien agrega una opción acá sin tocar la base, el guardado falla en
// producción y la pantalla no lo avisa.
const CHECK_ESTILO = ['escucha', 'herramientas', 'ambos'];
const CHECK_ENFOQUES = [
  'psicoanalitico', 'cognitivo_conductual', 'sistemico',
  'gestaltico', 'humanistico', 'integrativo',
];
// scripts/add-metodologias-coaching-nutricion.sql (25/09/2026).
const CHECK_COACHING = [
  'coach_ontologico', 'coach_sistemico', 'coach_cognitivo_conductual',
  'coach_salud_habitos', 'coach_mindfulness', 'coach_integrativo',
];
const CHECK_NUTRICION = [
  'nutri_sin_dietas', 'nutri_plan', 'nutri_deportiva',
  'nutri_plantas', 'nutri_condiciones',
];

describe('opciones', () => {
  it('el estilo del profesional coincide con el CHECK', () => {
    expect(ESTILO_OPCIONES_COACH.map(o => o.id).sort()).toEqual([...CHECK_ESTILO].sort());
  });

  it('los enfoques coinciden con el CHECK', () => {
    expect(ENFOQUES.map(e => e.id).sort()).toEqual([...CHECK_ENFOQUES].sort());
    expect(METODOS_COACHING.map(e => e.id).sort()).toEqual([...CHECK_COACHING].sort());
    expect(ENFOQUES_NUTRICION.map(e => e.id).sort()).toEqual([...CHECK_NUTRICION].sort());
  });

  it('ninguna opción se repite entre listas', () => {
    const ids = [...CHECK_ENFOQUES, ...CHECK_COACHING, ...CHECK_NUTRICION];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a la persona no se le ofrece "ambos": se le ofrece no saber', () => {
    expect(ESTILO_OPCIONES_PERSONA.map(o => o.id)).toEqual(['escucha', 'herramientas', 'any']);
  });

  it('el tope de enfoques es el mismo que el de la base', () => {
    expect(MAX_ENFOQUES).toBe(3);
  });

  it('los guardas rechazan lo que no está en la lista', () => {
    expect(esEstiloCoach('ambos')).toBe(true);
    expect(esEstiloCoach('any')).toBe(false);      // 'any' es de la persona, no del coach
    expect(esEnfoque('astrologia')).toBe(false);
    expect(esEnfoque('sistemico')).toBe(true);
  });
});

describe('evaluarEstilo', () => {
  it('coincide y lo dice', () => {
    const r = evaluarEstilo('escucha', 'escucha');
    expect(r.coincide).toBe(true);
    expect(r.razon).toContain('escuchar');
    expect(r.diferencia).toBeNull();
  });

  it('"las dos cosas" coincide con cualquiera de los dos pedidos', () => {
    expect(evaluarEstilo('ambos', 'escucha').coincide).toBe(true);
    expect(evaluarEstilo('ambos', 'herramientas').coincide).toBe(true);
    expect(evaluarEstilo('ambos', 'escucha').diferencia).toBeNull();
  });

  it('no coincide y lo avisa, sin inventar una razón', () => {
    const r = evaluarEstilo('herramientas', 'escucha');
    expect(r.coincide).toBe(false);
    expect(r.razon).toBeNull();
    expect(r.diferencia).toBe('Trabaja más con ejercicios que escuchando');
  });

  it('el profesional que no contestó no gana ni pierde nada', () => {
    const r = evaluarEstilo(null, 'escucha');
    expect(r).toEqual({ razon: null, diferencia: null, coincide: true });
  });

  it('la persona que no sabe qué contestar tampoco cambia nada', () => {
    expect(evaluarEstilo('herramientas', 'any')).toEqual({ razon: null, diferencia: null, coincide: true });
    expect(evaluarEstilo('herramientas', null)).toEqual({ razon: null, diferencia: null, coincide: true });
  });

  it('un valor viejo o roto en la base no rompe nada', () => {
    expect(evaluarEstilo('lo_que_sea', 'escucha').coincide).toBe(true);
  });
});

describe('cada profesión ve su lista', () => {
  it('la lista sale de la profesión verificada; sin ella, coaching', () => {
    expect(opcionesEnfoque('psicologia')).toBe(ENFOQUES);
    expect(opcionesEnfoque('nutricion')).toBe(ENFOQUES_NUTRICION);
    expect(opcionesEnfoque(null)).toBe(METODOS_COACHING);
    expect(opcionesEnfoque(undefined)).toBe(METODOS_COACHING);
  });

  it('un coach no guarda escuelas de psicología ni enfoques de nutrición', () => {
    expect(enfoquesAGuardar(null, ['psicoanalitico', 'nutri_condiciones', 'coach_ontologico']))
      .toEqual(['coach_ontologico']);
  });

  it('una nutricionista no guarda escuelas de psicología', () => {
    expect(enfoquesAGuardar('nutricion', ['sistemico', 'nutri_plantas'])).toEqual(['nutri_plantas']);
  });

  it('un psicólogo guarda sus escuelas tal cual', () => {
    expect(enfoquesAGuardar('psicologia', ['psicoanalitico', 'sistemico']))
      .toEqual(['psicoanalitico', 'sistemico']);
    expect(enfoquesAGuardar('psicologia', ['coach_sistemico'])).toEqual([]);
  });

  it('las metodologías de coaching no heredan la tendencia de las escuelas', () => {
    // "Cognitivo conductual" de coaching no es la escuela de psicología: si lo
    // fuera, el quiz diría "su enfoque suele guiar" de un coach.
    expect(esEnfoque('coach_cognitivo_conductual')).toBe(false);
  });

  it('el estilo no depende de la matrícula: lo contesta cualquiera', () => {
    // Si esto se rompe, un coach sin matrícula dejaría de aparecer con su
    // estilo en el quiz, que es lo único que el quiz mira.
    const r = evaluarEstilo('escucha', 'escucha');
    expect(r.coincide).toBe(true);
    expect(r.razon).not.toBeNull();
  });
});

describe('etiquetas', () => {
  it('descarta lo que no conoce en vez de imprimir el valor crudo', () => {
    expect(etiquetasEnfoques(['sistemico', 'astrologia'])).toEqual(['Sistémico']);
    expect(etiquetasEnfoques(null)).toEqual([]);
    expect(etiquetasEnfoques(['nutri_plan', 'coach_ontologico'])).toEqual(['Con plan alimentario', 'Ontológico']);
    expect(opcionesGuardadas(['astrologia', 'nutri_deportiva']).map(o => o.id)).toEqual(['nutri_deportiva']);
    expect(etiquetaEstilo('lo_que_sea')).toBeNull();
    expect(etiquetaEstilo('ambos')).toBe('Las dos cosas');
  });

  it('ningún texto visible usa la raya', () => {
    const todos = [
      ...ENFOQUES.flatMap(e => [e.label, e.desc]),
      ...METODOS_COACHING.flatMap(e => [e.label, e.desc]),
      ...ENFOQUES_NUTRICION.flatMap(e => [e.label, e.desc]),
      ...ESTILO_OPCIONES_COACH.flatMap(o => [o.label, o.desc]),
      ...ESTILO_OPCIONES_PERSONA.flatMap(o => [o.label, o.desc]),
      evaluarEstilo('escucha', 'escucha').razon ?? '',
      evaluarEstilo('herramientas', 'escucha').diferencia ?? '',
    ];
    todos.forEach(t => expect(t).not.toContain('—'));
  });
});

// ─── El estilo dentro del quiz ───────────────────────────────────────────────

let seq = 0;
function coach(over: Partial<CachedCoach> = {}): CachedCoach {
  seq += 1;
  return {
    id: `c${seq}`,
    name: `Coach ${seq}`,
    specialty: 'Coach',
    priceFrom: 4000,
    nationality: 'Argentina',
    gender: '',
    avatarUrl: null,
    bio: null,
    topics: ['Ansiedad'],
    ...over,
  };
}

const PIDE = { tema: 'emocion', tipo: 'any', presupuesto: 'flex' as const };

describe('el estilo dentro del quiz', () => {
  it('nunca saca a nadie de la lista', () => {
    const r = recomendarDesdeQuiz([coach({ estilo: 'herramientas' })], { ...PIDE, estilo: 'escucha' });
    expect(r.recomendaciones).toHaveLength(1);
  });

  it('el que coincide queda antes que el que no', () => {
    const escucha = coach({ estilo: 'escucha' });
    const herram  = coach({ estilo: 'herramientas' });
    const r = recomendarDesdeQuiz([herram, escucha], { ...PIDE, estilo: 'escucha' });
    expect(r.recomendaciones[0].coach.id).toBe(escucha.id);
  });

  it('el que no coincide lo muestra como diferencia, no lo esconde', () => {
    const r = recomendarDesdeQuiz([coach({ estilo: 'herramientas' })], { ...PIDE, estilo: 'escucha' });
    expect(r.recomendaciones[0].diferencias).toContain('Trabaja más con ejercicios que escuchando');
  });

  it('con una diferencia de estilo no se promete coincidencia exacta (lección de M1)', () => {
    const r = recomendarDesdeQuiz([coach({ estilo: 'herramientas' })], { ...PIDE, estilo: 'escucha' });
    expect(r.hayCoincidenciaExacta).toBe(false);
  });

  it('el profesional que no contestó sigue siendo coincidencia exacta', () => {
    const r = recomendarDesdeQuiz([coach({ estilo: null })], { ...PIDE, estilo: 'escucha' });
    expect(r.hayCoincidenciaExacta).toBe(true);
    expect(r.recomendaciones[0].diferencias).toEqual([]);
  });

  it('el estilo desempata pero no le gana al tema ni al precio', () => {
    // Uno caro que coincide en estilo, uno barato que no. Manda el presupuesto.
    const caro   = coach({ estilo: 'escucha', priceFrom: 20000 });
    const barato = coach({ estilo: 'herramientas', priceFrom: 3000 });
    const r = recomendarDesdeQuiz([caro, barato], { tema: 'emocion', tipo: 'any', presupuesto: 'low', estilo: 'escucha' });
    expect(r.recomendaciones[0].coach.id).toBe(barato.id);
  });

  it('sin preguntar por el estilo, el quiz da el mismo resultado que antes', () => {
    const uno = coach({ estilo: 'herramientas' });
    const sin = recomendarDesdeQuiz([uno], PIDE);
    const con = recomendarDesdeQuiz([uno], { ...PIDE, estilo: 'any' });
    expect(sin).toEqual(con);
    expect(sin.recomendaciones[0].diferencias).toEqual([]);
  });
});

// ─── M14 ampliado (21/09/2026) ──────────────────────────────────────────────
import {
  evaluarGuia,
  evaluarFoco,
  evaluarGenero,
  evaluarEstiloConEscuela,
  etiquetasFocos,
} from '@/lib/enfoque';

describe('evaluarGuia', () => {
  it('sin pedido no dice nada', () => {
    expect(evaluarGuia('guia', [], 'any')).toEqual({ razon: null, diferencia: null, coincide: true });
  });
  it('lo que contestó el profesional le gana a su escuela', () => {
    // Psicoanalítico tiende a "acompaña", pero él dijo que guía.
    const r = evaluarGuia('guia', ['psicoanalitico'], 'guia');
    expect(r.coincide).toBe(true);
    expect(r.razon).not.toMatch(/enfoque/);
  });
  it('sin respuesta propia usa la escuela y lo dice como tendencia', () => {
    const r = evaluarGuia(null, ['cognitivo_conductual'], 'guia');
    expect(r.razon).toMatch(/Su enfoque \(cognitivo conductual\) suele/);
  });
  it('escuelas que no coinciden entre sí: no deduce nada', () => {
    expect(evaluarGuia(null, ['cognitivo_conductual', 'psicoanalitico'], 'guia'))
      .toEqual({ razon: null, diferencia: null, coincide: true });
  });
  it('"ambos" coincide con cualquier pedido', () => {
    expect(evaluarGuia('ambos', [], 'acompana').coincide).toBe(true);
  });
});

describe('evaluarFoco', () => {
  it('coincide si el foco pedido está entre los que marcó', () => {
    expect(evaluarFoco(['presente', 'rumbo'], [], 'rumbo').coincide).toBe(true);
  });
  it('marca la diferencia si no está', () => {
    const r = evaluarFoco(['presente'], [], 'historia');
    expect(r.coincide).toBe(false);
    expect(r.diferencia).toBeTruthy();
  });
  it('ignora valores desconocidos de la base', () => {
    expect(etiquetasFocos(['presente', 'futuro'])).toEqual(['Lo que pasa ahora']);
  });
});

describe('evaluarGenero', () => {
  it('coincide con el valor que guarda la postulación', () => {
    expect(evaluarGenero('Femenino', 'mujer').coincide).toBe(true);
    expect(evaluarGenero('Masculino', 'varon').coincide).toBe(true);
  });
  it('🔴 sin género indicado no cuenta como coincidencia: se dice que no lo indicó', () => {
    const r = evaluarGenero('Prefiero no decir', 'mujer');
    expect(r.coincide).toBe(false);
    expect(r.desconocido).toBe(true);
    expect(r.diferencia).toBe('No indicó su género');
  });
  it('me da igual no cambia nada', () => {
    expect(evaluarGenero('', 'any').coincide).toBe(true);
  });
});

describe('evaluarEstiloConEscuela', () => {
  it('con estilo propio se comporta como evaluarEstilo', () => {
    expect(evaluarEstiloConEscuela('herramientas', ['psicoanalitico'], 'herramientas').coincide).toBe(true);
  });
  it('sin estilo propio, psicoanalítico no coincide con "herramientas"', () => {
    const r = evaluarEstiloConEscuela(null, ['psicoanalitico'], 'herramientas');
    expect(r.coincide).toBe(false);
    expect(r.diferencia).toMatch(/suele/);
  });
});
