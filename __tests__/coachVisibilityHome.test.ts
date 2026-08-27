import { homeStanding, tituloVisibilidad, bajadaVisibilidad, type DoorStanding, type SlotStanding } from '@/lib/coachVisibility';
import { DECK_SLOTS } from '@/lib/coachDeckRanking';
import { DOORS } from '@/constants/conexionesDoors';

const puerta = (i: number) => DOORS[i];

const slot = (
  key: 'recomendado' | 'tendencia' | 'nuevo' | 'economico',
  status: SlotStanding['status'],
  contenders = 1,
  detail = '',
): SlotStanding => ({ slot: DECK_SLOTS[key], status, contenders, detail });

const door = (i: number, slots: SlotStanding[]): DoorStanding => ({
  door: puerta(i),
  total: slots.length,
  slots,
  best: slots.find(s => s.status !== 'bloqueado') ?? null,
});

describe('homeStanding', () => {
  it('sin puertas no hay titular', () => {
    expect(homeStanding([])).toBeNull();
  });

  it('un lugar ganado se anuncia como ganado, con la puerta y el slot', () => {
    const r = homeStanding([door(0, [slot('nuevo', 'ganado')])]);
    expect(r).toMatchObject({ kind: 'ganado', doorLabel: DOORS[0].label, slotLabel: DECK_SLOTS.nuevo.label });
  });

  it('un lugar ganado le gana a uno rotando aunque el slot sea de menor prioridad', () => {
    const r = homeStanding([
      door(0, [slot('recomendado', 'rotando', 5)]),
      door(1, [slot('economico', 'ganado')]),
    ]);
    // `recomendado` está más arriba en SLOT_ORDER, pero "es tuyo" vale más que
    // "entrás al sorteo": es el único que garantiza que te vean.
    expect(r).toMatchObject({ kind: 'ganado', doorLabel: DOORS[1].label });
  });

  it('entre dos ganados gana el slot más arriba en SLOT_ORDER', () => {
    const r = homeStanding([
      door(0, [slot('economico', 'ganado')]),
      door(1, [slot('tendencia', 'ganado')]),
    ]);
    expect(r).toMatchObject({ kind: 'ganado', slotLabel: DECK_SLOTS.tendencia.label });
  });

  it('cuenta las OTRAS puertas donde también tiene lugar, sin contarse a sí misma', () => {
    const r = homeStanding([
      door(0, [slot('nuevo', 'ganado')]),
      door(1, [slot('economico', 'rotando', 3)]),
      door(2, [slot('recomendado', 'bloqueado', 0, 'te faltan reseñas')]),
    ]);
    expect(r).toMatchObject({ kind: 'ganado', otherDoors: 1 });
  });

  it('rotando informa contra cuántos compite', () => {
    const r = homeStanding([door(0, [slot('economico', 'rotando', 6)])]);
    expect(r).toMatchObject({ kind: 'rotando', contenders: 6 });
  });

  it('sin ningún lugar, informa la brecha del slot MÁS alcanzable, no la del más prestigioso', () => {
    const r = homeStanding([
      door(0, [
        slot('recomendado', 'bloqueado', 0, 'te faltan 12 reseñas'),
        slot('economico', 'bloqueado', 0, 'bajá $500 para entrar'),
      ]),
    ]);
    // Decirle "te faltan 12 reseñas" a quien no entra en ningún lado es cierto
    // e inútil: lo accionable hoy es el precio.
    expect(r).toMatchObject({ kind: 'sin_lugar', detail: 'bajá $500 para entrar' });
  });

  it('sin lugar y sin brecha legible no rompe: devuelve texto vacío', () => {
    const r = homeStanding([door(0, [slot('nuevo', 'bloqueado', 0, '')])]);
    expect(r).toMatchObject({ kind: 'sin_lugar', detail: '', totalDoors: 1 });
  });
});

describe('copy de la tarjeta', () => {
  it('sin cálculo todavía NO inventa un número: invita', () => {
    expect(tituloVisibilidad(null)).toBe('Tu lugar en Conexiones');
    expect(bajadaVisibilidad(null)).toMatch(/en qué lugar entrás/);
  });

  it('un lugar ganado se dice como propio', () => {
    const st = homeStanding([door(0, [slot('nuevo', 'ganado')])]);
    expect(tituloVisibilidad(st)).toBe(`«${DECK_SLOTS.nuevo.label}» es tuyo en ${DOORS[0].label}`);
    expect(bajadaVisibilidad(st)).toBe('Mirá qué te falta para el siguiente lugar.');
  });

  it('rotando dice contra cuántos compite, no cuántas puertas tiene', () => {
    const st = homeStanding([door(0, [slot('economico', 'rotando', 6)])]);
    expect(tituloVisibilidad(st)).toMatch(/^Entrás al sorteo/);
    expect(bajadaVisibilidad(st)).toBe('Sos uno de 6. Mirá qué te falta para que el lugar sea tuyo.');
  });

  it('las otras puertas se pluralizan bien', () => {
    const una = homeStanding([door(0, [slot('nuevo', 'ganado')]), door(1, [slot('nuevo', 'ganado')])]);
    expect(bajadaVisibilidad(una)).toContain('1 puerta más');
    const dos = homeStanding([
      door(0, [slot('nuevo', 'ganado')]), door(1, [slot('nuevo', 'ganado')]), door(2, [slot('nuevo', 'ganado')]),
    ]);
    expect(bajadaVisibilidad(dos)).toContain('2 puertas más');
  });

  it('sin lugar muestra la brecha concreta, y si no hay usa un texto que igual sirve', () => {
    const con = homeStanding([door(0, [slot('economico', 'bloqueado', 0, 'bajá $500')])]);
    expect(tituloVisibilidad(con)).toBe('Todavía no entrás en ningún lugar');
    expect(bajadaVisibilidad(con)).toBe('bajá $500');

    const sin = homeStanding([door(0, [slot('economico', 'bloqueado', 0, '')])]);
    expect(bajadaVisibilidad(sin)).toBe('Mirá qué te falta en tu puerta.');

    const varias = homeStanding([
      door(0, [slot('economico', 'bloqueado', 0, '')]),
      door(1, [slot('economico', 'bloqueado', 0, '')]),
    ]);
    expect(bajadaVisibilidad(varias)).toBe('Mirá qué te falta en tus 2 puertas.');
  });
});
