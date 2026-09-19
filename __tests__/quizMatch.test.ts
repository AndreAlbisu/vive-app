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
