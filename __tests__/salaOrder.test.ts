import { ordenarSalas } from '@/lib/salaOrder';

const sala = (id: string, createdAt: string | null) => ({ id, createdAt });

const ids = (filas: { id: string }[]) => filas.map(f => f.id);

describe('ordenarSalas', () => {
  it('pone la sala más VIEJA arriba (posición fija por antigüedad del vínculo)', () => {
    const r = ordenarSalas([
      sala('agosto', '2026-08-01T00:00:00Z'),
      sala('marzo', '2026-03-01T00:00:00Z'),
      sala('mayo', '2026-05-01T00:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['marzo', 'mayo', 'agosto']);
  });

  it('🔴 un profesional nuevo se agrega AL FINAL y no mueve a los que ya estaban', () => {
    // Es el invariante entero de esta función: si esto se rompe, el orden dejó
    // de ser una posición fija y volvimos al problema que veníamos a arreglar.
    const antes = [
      sala('maria', '2026-03-01T00:00:00Z'),
      sala('juan', '2026-05-01T00:00:00Z'),
    ];
    const despues = [...antes, sala('nuevo', '2026-09-07T00:00:00Z')];

    expect(ids(ordenarSalas(antes))).toEqual(['maria', 'juan']);
    expect(ids(ordenarSalas(despues))).toEqual(['maria', 'juan', 'nuevo']);
  });

  it('🔴 un mensaje nuevo NO reordena: la fila de cada profesional no se mueve', () => {
    // Con recencia, quien hablara último saltaba al primer lugar. Acá el orden
    // no depende de la conversación en absoluto — por eso la función ni mira
    // los mensajes.
    const filas = [
      sala('maria', '2026-03-01T00:00:00Z'),
      sala('juan', '2026-05-01T00:00:00Z'),
      sala('sofia', '2026-07-01T00:00:00Z'),
    ];
    const esperado = ['maria', 'juan', 'sofia'];

    // Mismo resultado sin importar en qué orden lleguen de la consulta.
    expect(ids(ordenarSalas(filas))).toEqual(esperado);
    expect(ids(ordenarSalas([...filas].reverse()))).toEqual(esperado);
  });

  it('la sala recién creada y sin mensajes cae al final sola, sin regla propia', () => {
    const r = ordenarSalas([
      sala('recien-reservada', '2026-09-06T00:00:00Z'),
      sala('vieja-con-historia', '2026-02-01T00:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['vieja-con-historia', 'recien-reservada']);
  });

  it('una sala sin createdAt cae al fondo en vez de romper el orden', () => {
    const r = ordenarSalas([
      sala('sin-fecha', null),
      sala('con-fecha', '2026-05-01T00:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['con-fecha', 'sin-fecha']);
  });

  it('no muta el array que recibe', () => {
    const entrada = [sala('b', '2026-08-01T00:00:00Z'), sala('a', '2026-07-01T00:00:00Z')];
    ordenarSalas(entrada);
    expect(ids(entrada)).toEqual(['b', 'a']);
  });

  it('aguanta la lista vacía y la de un solo elemento', () => {
    expect(ordenarSalas([])).toEqual([]);
    expect(ids(ordenarSalas([sala('sola', null)]))).toEqual(['sola']);
  });
});
