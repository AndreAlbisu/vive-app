import { ordenarSalas } from '@/lib/salaOrder';

const sala = (id: string, lastMessageRaw: string | null, createdAt: string | null = '2026-01-01T00:00:00Z') =>
  ({ id, lastMessageRaw, createdAt });

const ids = (filas: { id: string }[]) => filas.map(f => f.id);

describe('ordenarSalas', () => {
  it('pone el mensaje más reciente arriba', () => {
    const r = ordenarSalas([
      sala('vieja', '2026-07-01T10:00:00Z'),
      sala('nueva', '2026-08-28T10:00:00Z'),
      sala('media', '2026-08-01T10:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['nueva', 'media', 'vieja']);
  });

  it('manda las salas sin mensajes al final, aunque sean más nuevas', () => {
    // El caso de la captura de Andre: tres salas vacías repartidas entre medio
    // y el chat más reciente tercero.
    const r = ordenarSalas([
      sala('vacia-a', null, '2026-08-30T00:00:00Z'),
      sala('vacia-b', null, '2026-08-29T00:00:00Z'),
      sala('reciente', '2026-08-28T10:00:00Z'),
      sala('vacia-c', null, '2026-08-31T00:00:00Z'),
      sala('vieja', '2026-07-01T10:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['reciente', 'vieja', 'vacia-c', 'vacia-a', 'vacia-b']);
  });

  it('entre las vacías gana la sala más nueva', () => {
    const r = ordenarSalas([
      sala('marzo', null, '2026-03-01T00:00:00Z'),
      sala('agosto', null, '2026-08-01T00:00:00Z'),
      sala('mayo', null, '2026-05-01T00:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['agosto', 'mayo', 'marzo']);
  });

  it('una vacía sin createdAt cae al fondo en vez de romper el orden', () => {
    const r = ordenarSalas([
      sala('sin-fecha', null, null),
      sala('con-fecha', null, '2026-05-01T00:00:00Z'),
    ]);
    expect(ids(r)).toEqual(['con-fecha', 'sin-fecha']);
  });

  it('no muta el array que recibe', () => {
    const entrada = [sala('a', '2026-07-01T10:00:00Z'), sala('b', '2026-08-01T10:00:00Z')];
    ordenarSalas(entrada);
    expect(ids(entrada)).toEqual(['a', 'b']);
  });

  it('aguanta la lista vacía y la de un solo elemento', () => {
    expect(ordenarSalas([])).toEqual([]);
    expect(ids(ordenarSalas([sala('sola', null)]))).toEqual(['sola']);
  });
});
