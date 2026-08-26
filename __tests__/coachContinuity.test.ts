import {
  personasQueSeCaen,
  haceCuanto,
  DIAS_TECHO,
  type SesionCumplida,
} from '../lib/coachContinuity';

// Reloj fijo: 2026-08-26, mediodía de Argentina. El ISO va con -03:00 explícito
// por el mismo motivo que en `pureLogic.test.ts` — sin la zona, `new Date()` lo
// interpreta en la de la máquina y este sandbox no corre en Argentina.
const HOY = new Date('2026-08-26T12:00:00-03:00').getTime();
const sinProxima = new Set<string>();

/** Fecha a N días antes de HOY, en YYYY-MM-DD. */
function haceDias(n: number): string {
  const d = new Date(HOY - n * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const ses = (userId: string, dias: number): SesionCumplida => ({ userId, fecha: haceDias(dias) });

describe('personasQueSeCaen', () => {
  it('no marca a quien tiene una sesión futura, por más que haga mucho', () => {
    const r = personasQueSeCaen([ses('ana', 90)], new Set(['ana']), HOY);
    expect(r).toHaveLength(0);
  });

  // El caso que motivó la función: alguien que venía todas las semanas y hace
  // un mes que no aparece. Con un umbral fijo de 21 días se detecta tarde.
  it('detecta a quien rompió SU ritmo, no un plazo fijo', () => {
    const semanal = [0, 7, 14, 21].map(d => ses('ana', d + 30)); // semanal, hasta hace 30 días
    const r = personasQueSeCaen(semanal, sinProxima, HOY);
    expect(r).toHaveLength(1);
    expect(r[0].cadenciaDias).toBe(7);
    expect(r[0].sesiones).toBe(4);
  });

  it('no marca a quien viene mensual y hace 20 días que no viene', () => {
    const mensual = [20, 50, 80, 110].map(d => ses('marcos', d));
    expect(personasQueSeCaen(mensual, sinProxima, HOY)).toHaveLength(0);
  });

  // El semanal que se salteó DOS semanas sí cuenta: es la señal temprana que
  // justifica la función. Un umbral fijo de 21 días lo detectaría una semana
  // más tarde, que es cuando ya cuesta más recuperarlo.
  it('el semanal que falta dos semanas ya cuenta', () => {
    const semanal = [15, 22, 29, 36].map(d => ses('ana', d));
    expect(personasQueSeCaen(semanal, sinProxima, HOY)).toHaveLength(1);
  });

  // 🔴 Para eso está DIAS_MINIMO, y no para el semanal: el que viene DOS VECES
  // por semana tiene cadencia ~3, así que 2× le daría 6 días. Sin el piso, el
  // coach recibiría un aviso por alguien que faltó a una sola sesión.
  it('el piso protege al de alta frecuencia, no al semanal', () => {
    const dosPorSemana = [10, 13, 17, 20, 24].map(d => ses('leo', d));
    expect(personasQueSeCaen(dosPorSemana, sinProxima, HOY)).toHaveLength(0);
  });

  it('con una sola sesión usa el plazo fijo de 21 días', () => {
    expect(personasQueSeCaen([ses('leo', 20)], sinProxima, HOY)).toHaveLength(0);
    const r = personasQueSeCaen([ses('leo', 22)], sinProxima, HOY);
    expect(r).toHaveLength(1);
    expect(r[0].cadenciaDias).toBeNull();
  });

  // 🔴 El techo. Alguien de hace un año no "se está cayendo": ya se cayó. Sin
  // esto, el bloque se llenaría de gente que se fue hace rato y el coach
  // terminaría escribiéndoles como si fuera algo reciente.
  it('ignora a quien se fue hace demasiado', () => {
    expect(personasQueSeCaen([ses('vieja', DIAS_TECHO + 1)], sinProxima, HOY)).toHaveLength(0);
    expect(personasQueSeCaen([ses('limite', DIAS_TECHO - 1)], sinProxima, HOY)).toHaveLength(1);
  });

  // La mediana ignora el hueco raro; el promedio lo tragaría y volvería
  // "normal" un silencio que no lo es.
  it('unas vacaciones en el medio no vuelven normal el silencio', () => {
    // semanal salvo un hueco de 60 días. Promedio ≈ 21, mediana = 7.
    const con = [ses('ana', 30), ses('ana', 37), ses('ana', 44), ses('ana', 104)];
    const r = personasQueSeCaen(con, sinProxima, HOY);
    expect(r[0].cadenciaDias).toBe(7);
  });

  it('ordena por quien hace más que no viene', () => {
    const r = personasQueSeCaen(
      [ses('cerca', 25), ses('lejos', 80), ses('medio', 50)],
      sinProxima, HOY,
    );
    expect(r.map(p => p.userId)).toEqual(['lejos', 'medio', 'cerca']);
  });
});

describe('haceCuanto', () => {
  it('habla en la unidad en la que se piensa una agenda', () => {
    expect(haceCuanto(5)).toBe('Hace 5 días');
    expect(haceCuanto(21)).toBe('Hace 3 semanas');
    expect(haceCuanto(30)).toBe('Hace 4 semanas');
    expect(haceCuanto(60)).toBe('Hace 2 meses');
    expect(haceCuanto(32)).toBe('Hace 5 semanas');
  });
});
