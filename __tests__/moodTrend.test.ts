import { leerAnimo, textoAnimo, MINIMO_REGISTROS, type MoodEntry } from '../lib/moodTrend';

const e = (fecha: string, moodId: number): MoodEntry => ({ fecha, moodId });

describe('leerAnimo', () => {
  // 🔴 La distinción que más importa: SIN LECTURA no es lo mismo que MAL.
  // Devolver un cero o un promedio bajo cuando no hay datos le diría a alguien
  // que viene pésimo cuando en realidad no registró nada.
  it('sin registros suficientes devuelve null, no un cero', () => {
    expect(leerAnimo([])).toBeNull();
    expect(leerAnimo([e('2026-08-20', 1), e('2026-08-21', 1)])).toBeNull();
    expect(leerAnimo([e('2026-08-20', 1), e('2026-08-21', 1), e('2026-08-22', 1)])).not.toBeNull();
  });

  it('el piso es de 3 y está exportado para que la función SQL lo espeje', () => {
    expect(MINIMO_REGISTROS).toBe(3);
  });

  it('no depende del orden en que vengan', () => {
    const desordenado = [e('2026-08-22', 4), e('2026-08-20', 2), e('2026-08-21', 3)];
    expect(leerAnimo(desordenado)!.ultimo).toBe(4);
    expect(leerAnimo(desordenado)!.promedio).toBe(3);
  });

  it('detecta que viene mejorando', () => {
    const l = leerAnimo([e('2026-08-18', 1), e('2026-08-19', 2), e('2026-08-20', 4), e('2026-08-21', 5)])!;
    expect(l.direccion).toBe('sube');
  });

  it('detecta que viene cayendo', () => {
    const l = leerAnimo([e('2026-08-18', 5), e('2026-08-19', 4), e('2026-08-20', 2), e('2026-08-21', 1)])!;
    expect(l.direccion).toBe('baja');
  });

  // Sin el umbral, cualquier oscilación diaria se leería como una tendencia — y
  // "venís cayendo" es una frase pesada para decírsela a alguien por ruido.
  it('una oscilación chica no es una tendencia', () => {
    const l = leerAnimo([e('2026-08-18', 3), e('2026-08-19', 3), e('2026-08-20', 3), e('2026-08-21', 4)])!;
    expect(l.direccion).toBe('igual');
  });
});

describe('textoAnimo', () => {
  const con = (promedio: number, direccion: 'sube' | 'baja' | 'igual') =>
    textoAnimo({ registros: 6, promedio, direccion, ultimo: 3 });

  it('habla en palabras y no en números', () => {
    expect(con(2.0, 'igual')).toBe('Venís con el ánimo bajo');
    expect(con(3.0, 'sube')).toBe('Venís con el ánimo parejo, y mejorando');
    expect(con(4.2, 'baja')).toBe('Venís con buen ánimo, y cayendo');
  });

  // La misma lectura se usa para uno mismo y —si algún día se comparte— para
  // hablar de otro. Que sea el mismo texto evita que la persona y su coach
  // discutan sobre dos frases distintas del mismo dato.
  it('sirve en tercera persona sin cambiar el criterio', () => {
    expect(textoAnimo({ registros: 6, promedio: 2.0, direccion: 'igual', ultimo: 2 }, 'tercero'))
      .toBe('Viene con el ánimo bajo');
  });
});
