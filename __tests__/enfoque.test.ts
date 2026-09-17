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
  puedeDeclararEnfoque,
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

describe('opciones', () => {
  it('el estilo del profesional coincide con el CHECK', () => {
    expect(ESTILO_OPCIONES_COACH.map(o => o.id).sort()).toEqual([...CHECK_ESTILO].sort());
  });

  it('los enfoques coinciden con el CHECK', () => {
    expect(ENFOQUES.map(e => e.id).sort()).toEqual([...CHECK_ENFOQUES].sort());
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

describe('la escuela pide matrícula verificada', () => {
  it('sin matrícula no se ofrece la pregunta', () => {
    expect(puedeDeclararEnfoque(false)).toBe(false);
    expect(puedeDeclararEnfoque(null)).toBe(false);
    expect(puedeDeclararEnfoque(undefined)).toBe(false);
    expect(puedeDeclararEnfoque(true)).toBe(true);
  });

  it('sin matrícula no se manda a guardar lo elegido', () => {
    expect(enfoquesAGuardar(false, ['psicoanalitico'])).toEqual([]);
  });

  it('con matrícula se guarda tal cual', () => {
    expect(enfoquesAGuardar(true, ['psicoanalitico', 'sistemico']))
      .toEqual(['psicoanalitico', 'sistemico']);
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
    expect(etiquetaEstilo('lo_que_sea')).toBeNull();
    expect(etiquetaEstilo('ambos')).toBe('Las dos cosas');
  });

  it('ningún texto visible usa la raya', () => {
    const todos = [
      ...ENFOQUES.flatMap(e => [e.label, e.desc]),
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
