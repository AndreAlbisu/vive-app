import {
  detectarPisoSeguridad, REGISTROS_SEGUIDOS, VENTANA_DIAS, UMBRAL_ANIMO,
  type RegistroAnimo,
} from '@/lib/pisoSeguridad';

const HOY = '2026-09-04';

/** Registros consecutivos hacia atrás desde `desde`, con el mood dado. */
function seguidos(moods: number[], desde = HOY): RegistroAnimo[] {
  const [y, m, d] = desde.split('-').map(Number);
  return moods.map((moodId, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    return { moodId, dayKey: dt.toISOString().slice(0, 10) };
  });
}

describe('detectarPisoSeguridad', () => {
  it('dispara con cinco registros seguidos abajo dentro de la ventana', () => {
    expect(detectarPisoSeguridad(seguidos([1, 2, 1, 2, 2]), HOY)).toBe(true);
  });

  it('no dispara con menos de cinco registros, por bajos que sean', () => {
    expect(detectarPisoSeguridad(seguidos([1, 1, 1, 1]), HOY)).toBe(false);
  });

  it('no dispara si uno de los cinco no está abajo', () => {
    expect(detectarPisoSeguridad(seguidos([1, 2, 3, 1, 2]), HOY)).toBe(false);
  });

  // Mira los ÚLTIMOS cinco. Un tramo malo que ya remontó no dispara: el registro
  // más reciente ya está arriba del umbral.
  it('no dispara si el tramo malo quedó atrás', () => {
    expect(detectarPisoSeguridad(seguidos([4, 1, 1, 1, 1, 1]), HOY)).toBe(false);
  });

  // La ventana existe para esto: cinco días malos repartidos en dos meses no son
  // un tramo sostenido.
  it('no dispara si los cinco registros están demasiado dispersos', () => {
    const dispersos: RegistroAnimo[] = [
      { moodId: 1, dayKey: '2026-09-04' },
      { moodId: 2, dayKey: '2026-08-25' },
      { moodId: 1, dayKey: '2026-08-14' },
      { moodId: 2, dayKey: '2026-08-02' },
      { moodId: 1, dayKey: '2026-07-20' },
    ];
    expect(detectarPisoSeguridad(dispersos, HOY)).toBe(false);
  });

  it('sí dispara con huecos, mientras entren en la ventana', () => {
    // Cinco registros en 12 días: no registró todos los días, pero todos los que
    // registró fueron abajo. Contar días de calendario se lo saltearía.
    const conHuecos: RegistroAnimo[] = [
      { moodId: 1, dayKey: '2026-09-04' },
      { moodId: 2, dayKey: '2026-09-02' },
      { moodId: 1, dayKey: '2026-08-30' },
      { moodId: 1, dayKey: '2026-08-27' },
      { moodId: 2, dayKey: '2026-08-24' },
    ];
    expect(detectarPisoSeguridad(conHuecos, HOY)).toBe(true);
  });

  it('el borde exacto de la ventana entra', () => {
    const enElBorde: RegistroAnimo[] = [
      { moodId: 1, dayKey: '2026-09-04' },
      { moodId: 1, dayKey: '2026-09-01' },
      { moodId: 1, dayKey: '2026-08-29' },
      { moodId: 1, dayKey: '2026-08-25' },
      { moodId: 1, dayKey: '2026-08-21' }, // exactamente 14 días
    ];
    expect(detectarPisoSeguridad(enElBorde, HOY)).toBe(true);
  });

  it('sin registros no dispara', () => {
    expect(detectarPisoSeguridad([], HOY)).toBe(false);
  });

  // Los umbrales son constantes exportadas y no números sueltos: si alguien los
  // mueve, que sea a propósito y en un solo lugar.
  it('los umbrales están donde se pueden revisar', () => {
    expect(REGISTROS_SEGUIDOS).toBe(5);
    expect(VENTANA_DIAS).toBe(14);
    expect(UMBRAL_ANIMO).toBe(2);
  });
});
