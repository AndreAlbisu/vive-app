import { recomendarDesdeQuiz, type RespuestasQuiz } from '../lib/quizMatch';
import { tipoProfesional } from '../lib/tipoProfesional';
import type { CachedCoach } from '../lib/coachesCache';

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

const PIDE: RespuestasQuiz = { tema: 'emocion', tipo: 'psicologo', presupuesto: 'low' };

describe('tipoProfesional', () => {
  it('sin matrícula verificada es Coach aunque la presentación diga psicología', () => {
    expect(tipoProfesional({ specialty: 'Psicología positiva', hasMatricula: false })).toBe('Coach');
  });
  it('con matrícula y "psicóloga" (con tilde) es Psicólogo', () => {
    expect(tipoProfesional({ specialty: 'Psicóloga clínica', hasMatricula: true })).toBe('Psicólogo');
  });
});

describe('recomendarDesdeQuiz', () => {
  it('pone primero a quien cumple las tres respuestas y lo marca como exacto', () => {
    const exacto = coach({ specialty: 'Psicóloga', hasMatricula: true });
    const caro = coach({ specialty: 'Psicóloga', hasMatricula: true, priceFrom: 20000, avgRating: 5 });
    const r = recomendarDesdeQuiz([caro, exacto], PIDE);
    expect(r.hayCoincidenciaExacta).toBe(true);
    expect(r.recomendaciones[0].coach.id).toBe(exacto.id);
    expect(r.recomendaciones[0].diferencias).toEqual([]);
  });

  it('🔴 no presenta como psicólogo a quien solo lo escribe en su texto libre', () => {
    const sinMatricula = coach({ specialty: 'Psicología positiva', hasMatricula: false });
    const r = recomendarDesdeQuiz([sinMatricula], PIDE);
    expect(r.hayCoincidenciaExacta).toBe(false);
    const rec = r.recomendaciones[0];
    expect(rec.razones).not.toContain('Tiene matrícula verificada por Vita');
    expect(rec.diferencias).toContain('No figura como psicólogo/a con matrícula verificada');
  });

  it('🔴 cuando afloja el presupuesto, lo dice en vez de callarlo', () => {
    const caro = coach({ specialty: 'Psicólogo', hasMatricula: true, priceFrom: 9000 });
    const r = recomendarDesdeQuiz([caro], PIDE);
    expect(r.hayCoincidenciaExacta).toBe(false);
    expect(r.recomendaciones[0].diferencias).toEqual(['Su sesión cuesta más de lo que marcaste']);
  });

  it('no recomienda a quien no trabaja el tema elegido', () => {
    const otroTema = coach({ topics: ['Productividad'], specialty: 'Psicóloga', hasMatricula: true });
    expect(recomendarDesdeQuiz([otroTema], PIDE).recomendaciones).toEqual([]);
  });

  it('nombra hasta dos temas en común', () => {
    const c = coach({ topics: ['Ansiedad', 'Autoestima', 'Culpa'] });
    const r = recomendarDesdeQuiz([c], { tema: 'emocion', tipo: 'any', presupuesto: 'flex' });
    expect(r.recomendaciones[0].razones[0]).toBe('Trabaja ansiedad y culpa, que es lo que querés trabajar');
  });

  it('solo menciona horarios libres cuando los tiene', () => {
    const con = coach({ hasSlotThisWeek: true });
    const sin = coach({ hasSlotThisWeek: false });
    const r = recomendarDesdeQuiz([con, sin], { tema: 'emocion', tipo: 'any', presupuesto: 'flex' });
    const porId = Object.fromEntries(r.recomendaciones.map(x => [x.coach.id, x.razones]));
    expect(porId[con.id]).toContain('Tiene horarios libres esta semana');
    expect(porId[sin.id]).not.toContain('Tiene horarios libres esta semana');
  });

  it('dentro del mismo nivel ordena por calificación', () => {
    const a = coach({ avgRating: 4.2 });
    const b = coach({ avgRating: 4.9 });
    const r = recomendarDesdeQuiz([a, b], { tema: 'emocion', tipo: 'any', presupuesto: 'flex' });
    expect(r.recomendaciones.map(x => x.coach.id)).toEqual([b.id, a.id]);
  });
});

describe('recomendarDesdeQuiz — M14 ampliado (21/09/2026)', () => {
  const BASE: RespuestasQuiz = { tema: 'emocion', tipo: 'any', presupuesto: 'flex' };

  it('ordena coincide > no contestó > no coincide en cómo trabaja', () => {
    const coincide = coach({ guia: 'guia' });
    const nada = coach({});
    const otro = coach({ guia: 'acompana' });
    const r = recomendarDesdeQuiz([otro, nada, coincide], { ...BASE, guia: 'guia' });
    expect(r.recomendaciones.map(x => x.coach.id)).toEqual([coincide.id, nada.id, otro.id]);
  });

  it('el género pesa más que los tres ejes juntos', () => {
    const mujerSinEjes = coach({ gender: 'Femenino' });
    const varonConTodo = coach({ gender: 'Masculino', estilo: 'escucha', guia: 'acompana', focos: ['historia'] });
    const r = recomendarDesdeQuiz([varonConTodo, mujerSinEjes], {
      ...BASE, genero: 'mujer', estilo: 'escucha', guia: 'acompana', foco: 'historia',
    });
    expect(r.recomendaciones[0].coach.id).toBe(mujerSinEjes.id);
  });

  it('🔴 nunca filtra: quien no coincide en género sigue en la lista, con la diferencia marcada', () => {
    const varon = coach({ gender: 'Masculino' });
    const r = recomendarDesdeQuiz([varon], { ...BASE, genero: 'mujer' });
    expect(r.recomendaciones).toHaveLength(1);
    expect(r.recomendaciones[0].diferencias).toContain('No coincide con el género que preferiste');
    expect(r.hayCoincidenciaExacta).toBe(false);
  });

  it('una diferencia de foco apaga la coincidencia exacta', () => {
    const r = recomendarDesdeQuiz([coach({ focos: ['presente'] })], { ...BASE, foco: 'historia' });
    expect(r.hayCoincidenciaExacta).toBe(false);
  });
});

describe('recomendarDesdeQuiz — tema en dos niveles (21/09/2026)', () => {
  const BASE: RespuestasQuiz = { tema: null, tipo: 'any', presupuesto: 'flex' };

  it('🔴 quien trabaja solo duelo aparece al elegir Emociones (antes quedaba afuera)', () => {
    const c = coach({ topics: ['Duelo'] });
    expect(recomendarDesdeQuiz([c], { ...BASE, areas: ['emocion'] }).recomendaciones).toHaveLength(1);
  });

  it('con dos áreas entra quien trabaja cualquiera de las dos', () => {
    const a = coach({ topics: ['Ansiedad'] });
    const b = coach({ topics: ['Burnout (estrés laboral)'] });
    const r = recomendarDesdeQuiz([a, b], { ...BASE, areas: ['emocion', 'trabajo'] });
    expect(r.recomendaciones).toHaveLength(2);
  });

  it('el tema concreto ordena pero no filtra', () => {
    const conDuelo = coach({ topics: ['Duelo'] });
    const sinDuelo = coach({ topics: ['Ansiedad'], avgRating: 5 });
    const r = recomendarDesdeQuiz([sinDuelo, conDuelo], { ...BASE, areas: ['emocion'], subtemas: ['Duelo'] });
    expect(r.recomendaciones.map(x => x.coach.id)).toEqual([conDuelo.id, sinDuelo.id]);
    expect(r.recomendaciones[0].razones[0]).toBe('Trabaja duelo, que es lo que querés trabajar');
    expect(r.recomendaciones[1].diferencias).toContain('No marca duelo entre sus temas');
  });

  it('con nutricionista ignora las preguntas de cómo trabaja', () => {
    const c = coach({ specialty: 'Nutricionista', hasMatricula: true, topics: ['Nutrición'], guia: 'acompana' });
    const r = recomendarDesdeQuiz([c], { ...BASE, areas: ['salud'], tipo: 'nutricionista', guia: 'guia' });
    expect(r.recomendaciones[0].diferencias).toEqual([]);
  });
});

describe('recomendarDesdeQuiz — presupuesto con barra (21/09/2026)', () => {
  const BASE: RespuestasQuiz = { tema: 'emocion', tipo: 'any', presupuesto: null };

  it('el tope de la barra deja primero a quien entra', () => {
    const barato = coach({ priceFrom: 5000 });
    const caro = coach({ priceFrom: 9000, avgRating: 5 });
    const r = recomendarDesdeQuiz([caro, barato], { ...BASE, presupuestoMax: 6000 });
    expect(r.recomendaciones[0].coach.id).toBe(barato.id);
    expect(r.recomendaciones[1].diferencias).toContain('Su sesión cuesta más de lo que marcaste');
  });

  it('el extremo de la barra es sin límite', () => {
    const caro = coach({ priceFrom: 40000 });
    const r = recomendarDesdeQuiz([caro], { ...BASE, presupuestoMax: 1_000_000 });
    expect(r.recomendaciones[0].diferencias).toEqual([]);
  });

  it('una respuesta vieja por rango sigue funcionando', () => {
    const caro = coach({ priceFrom: 9000 });
    const r = recomendarDesdeQuiz([caro], { ...BASE, presupuesto: 'low' });
    expect(r.recomendaciones[0].diferencias).toContain('Su sesión cuesta más de lo que marcaste');
  });
});

describe('recomendarDesdeQuiz — la opción del medio no conviene (21/09/2026)', () => {
  const BASE: RespuestasQuiz = { tema: 'emocion', tipo: 'any', presupuesto: 'flex' };

  it('exacto > "las dos cosas" > no contestó', () => {
    const exacto = coach({ estilo: 'herramientas', guia: 'guia' });
    const medio = coach({ estilo: 'ambos', guia: 'ambos' });
    const nada = coach({});
    const r = recomendarDesdeQuiz([nada, medio, exacto], { ...BASE, estilo: 'herramientas', guia: 'guia' });
    expect(r.recomendaciones.map(x => x.coach.id)).toEqual([exacto.id, medio.id, nada.id]);
  });

  it('"las dos cosas" no dice "como pediste"', () => {
    const r = recomendarDesdeQuiz([coach({ estilo: 'ambos' })], { ...BASE, estilo: 'herramientas' });
    expect(r.recomendaciones[0].razones.join(' ')).toMatch(/También trabaja con ejercicios/);
    expect(r.recomendaciones[0].razones.join(' ')).not.toMatch(/como pediste/);
  });
});

describe('escala de la barra (21/09/2026)', () => {
  it('el extremo de la barra y el valor guardado de "sin límite" no limitan; $100.000 sí', () => {
    const { PRESUPUESTO_TOPE, PRESUPUESTO_SIN_LIMITE } = require('../lib/quizMatch');
    const caro = coach({ priceFrom: 150000 });
    const pide = (m: number) => recomendarDesdeQuiz([caro], { tema: 'emocion', tipo: 'any', presupuesto: null, presupuestoMax: m });
    expect(pide(PRESUPUESTO_TOPE).recomendaciones[0].diferencias).toEqual([]);
    expect(pide(PRESUPUESTO_SIN_LIMITE).recomendaciones[0].diferencias).toEqual([]);
    expect(pide(100000).recomendaciones[0].diferencias).toContain('Su sesión cuesta más de lo que marcaste');
  });
});
