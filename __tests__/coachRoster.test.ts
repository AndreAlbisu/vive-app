import { chipProxima, agruparRoster, textoHistoria, diasEntre } from '@/lib/coachRoster';
import { haceCuanto } from '@/lib/coachContinuity';

describe('diasEntre', () => {
  it('cuenta días calendario, no horas', () => {
    expect(diasEntre('2026-08-28', '2026-08-29')).toBe(1);
    expect(diasEntre('2026-08-28', '2026-08-28')).toBe(0);
    expect(diasEntre('2026-08-29', '2026-08-28')).toBe(-1);
  });

  it('cruza fin de mes y de año', () => {
    expect(diasEntre('2026-08-31', '2026-09-01')).toBe(1);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('chipProxima', () => {
  it('hoy y mañana salen como palabra, no como número', () => {
    expect(chipProxima('2026-08-28', '2026-08-28')).toEqual({ tipo: 'pronto', texto: 'hoy' });
    expect(chipProxima('2026-08-29', '2026-08-28')).toEqual({ tipo: 'pronto', texto: 'mañana' });
  });

  it('del tercer día en adelante muestra la fecha', () => {
    expect(chipProxima('2026-08-30', '2026-08-28')).toEqual({ tipo: 'fecha', dia: '30', mes: 'ago' });
    expect(chipProxima('2026-09-04', '2026-08-28')).toEqual({ tipo: 'fecha', dia: '4', mes: 'sep' });
  });

  it('el día va sin cero adelante', () => {
    expect(chipProxima('2026-09-04', '2026-08-28')).toMatchObject({ dia: '4' });
  });

  // Una sesión de hoy más temprano sigue siendo "hoy" mientras la reserva viva:
  // la pantalla filtra por `fecha >= hoy`, así que acá no puede llegar nada
  // anterior — pero si llegara, decir "hoy" es más útil que una fecha pasada.
  it('una fecha ya pasada no rompe: cae en hoy', () => {
    expect(chipProxima('2026-08-27', '2026-08-28')).toEqual({ tipo: 'pronto', texto: 'hoy' });
  });
});

describe('agruparRoster', () => {
  const conProxima = (id: string, proximaIso: string) => ({ id, proximaIso, lastMessageAt: null });
  const sinProxima = (id: string, lastMessageAt: string | null) => ({ id, proximaIso: null, lastMessageAt });

  it('separa por tener próxima sesión o no', () => {
    const { agendadas, sinProxima: resto } = agruparRoster([
      conProxima('a', '2026-09-10'),
      sinProxima('b', '2026-08-28T10:00:00Z'),
    ]);
    expect(agendadas.map(r => r.id)).toEqual(['a']);
    expect(resto.map(r => r.id)).toEqual(['b']);
  });

  it('🔴 las agendadas van de la más próxima a la más lejana', () => {
    const { agendadas } = agruparRoster([
      conProxima('lejos', '2026-12-01'),
      conProxima('cerca', '2026-08-29'),
      conProxima('medio', '2026-09-15'),
    ]);
    expect(agendadas.map(r => r.id)).toEqual(['cerca', 'medio', 'lejos']);
  });

  it('🔴 las sin próxima siguen ordenadas por conversación, al revés que las agendadas', () => {
    const { sinProxima: resto } = agruparRoster([
      sinProxima('vieja', '2026-08-01T10:00:00Z'),
      sinProxima('nueva', '2026-08-27T10:00:00Z'),
    ]);
    expect(resto.map(r => r.id)).toEqual(['nueva', 'vieja']);
  });

  it('quien nunca habló queda al final y no rompe el orden', () => {
    const { sinProxima: resto } = agruparRoster([
      sinProxima('muda', null),
      sinProxima('habló', '2026-08-01T10:00:00Z'),
    ]);
    expect(resto.map(r => r.id)).toEqual(['habló', 'muda']);
  });

  it('el defecto que arregla: sesión mañana gana sobre un mensaje de hoy', () => {
    const { agendadas, sinProxima: resto } = agruparRoster([
      sinProxima('escribió-hoy', '2026-08-28T18:00:00Z'),
      conProxima('sesión-mañana', '2026-08-29'),
    ]);
    // Las agendadas se pintan primero, así que la de mañana queda arriba.
    expect(agendadas.map(r => r.id)).toEqual(['sesión-mañana']);
    expect(resto.map(r => r.id)).toEqual(['escribió-hoy']);
  });

  it('no muta el arreglo que recibe', () => {
    const filas = [conProxima('b', '2026-12-01'), conProxima('a', '2026-08-29')];
    agruparRoster(filas);
    expect(filas.map(r => r.id)).toEqual(['b', 'a']);
  });
});

describe('textoHistoria', () => {
  const hoy = '2026-08-28';

  it('singular y plural de sesiones', () => {
    expect(textoHistoria({ sesiones: 1, ultimaIso: null }, haceCuanto, hoy)).toBe('1 sesión');
    expect(textoHistoria({ sesiones: 29, ultimaIso: null }, haceCuanto, hoy)).toBe('29 sesiones');
  });

  it('suma cuándo fue la última vez', () => {
    expect(textoHistoria({ sesiones: 29, ultimaIso: '2026-08-22' }, haceCuanto, hoy))
      .toBe('29 sesiones · hace 6 días');
  });

  it('🔴 ya no nombra la próxima sesión — eso lo dice la pastilla', () => {
    const txt = textoHistoria({ sesiones: 2, ultimaIso: '2026-07-24' }, haceCuanto, hoy);
    expect(txt).not.toMatch(/próxima/);
    expect(txt).toBe('2 sesiones · hace 5 semanas');
  });

  it('queda vacío cuando todavía no hay historia que contar', () => {
    expect(textoHistoria({ sesiones: 0, ultimaIso: null }, haceCuanto, hoy)).toBe('');
  });
});
