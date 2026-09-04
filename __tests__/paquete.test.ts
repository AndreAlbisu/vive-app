import {
  armarPaquete, debeOfrecerse, TOPE_DIAS, OFRECER_DESDE_DIAS,
  type DiaDelPaquete,
} from '@/lib/paquete';

const HOY = '2026-09-20';

const dia = (dayKey: string, moodId = 3, nota?: string): DiaDelPaquete => ({
  dayKey, moodId, moodLabel: 'Normal', nota,
});

describe('armarPaquete — la ventana', () => {
  it('arranca el día DESPUÉS de la última sesión', () => {
    // El día de la sesión no entra: la ventana es lo que pasó después de verse.
    // Incluirlo mezclaría material ya conversado con material nuevo.
    const p = armarPaquete({
      ultimaSesion: '2026-09-10',
      hoy: HOY,
      entries: [dia('2026-09-10'), dia('2026-09-11'), dia('2026-09-15')],
    });
    expect(p.desde).toBe('2026-09-11');
    expect(p.dias.map(d => d.dayKey)).toEqual(['2026-09-11', '2026-09-15']);
    expect(p.ventanaTopeada).toBe(false);
  });

  it('sin sesión anterior se topea, para no mandar un paquete que nadie va a leer', () => {
    const p = armarPaquete({ ultimaSesion: null, hoy: HOY, entries: [] });
    expect(p.ventanaTopeada).toBe(true);
    expect(p.desde).toBe('2026-08-21'); // 30 días antes
  });

  it('una sesión muy vieja también se topea', () => {
    const p = armarPaquete({ ultimaSesion: '2026-05-01', hoy: HOY, entries: [] });
    expect(p.ventanaTopeada).toBe(true);
    expect(p.desde).toBe('2026-08-21');
  });

  it('deja fuera lo anterior a la ventana y lo posterior a hoy', () => {
    const p = armarPaquete({
      ultimaSesion: '2026-09-10',
      hoy: HOY,
      entries: [dia('2026-09-01'), dia('2026-09-12'), dia('2026-09-30')],
    });
    expect(p.dias.map(d => d.dayKey)).toEqual(['2026-09-12']);
  });

  it('ordena del más viejo al más nuevo — es una secuencia de días, no un ranking', () => {
    const p = armarPaquete({
      ultimaSesion: '2026-09-10',
      hoy: HOY,
      entries: [dia('2026-09-18'), dia('2026-09-12'), dia('2026-09-15')],
    });
    expect(p.dias.map(d => d.dayKey)).toEqual(['2026-09-12', '2026-09-15', '2026-09-18']);
  });

  it('conserva la nota de la persona, que es lo que le da sentido al número', () => {
    const p = armarPaquete({
      ultimaSesion: '2026-09-10',
      hoy: HOY,
      entries: [dia('2026-09-12', 1, 'discutí con mi vieja')],
    });
    expect(p.dias[0].nota).toBe('discutí con mi vieja');
  });

  // 🔴 El paquete lleva material, no conclusiones. Este test fija la FORMA: si
  // alguien agrega un promedio, una tendencia o una devolución de "Sobre vos",
  // rompe acá. Ver `docs/paquete-para-la-sesion.md` §3.
  it('no devuelve ninguna lectura de la app — ni promedio, ni tendencia', () => {
    const p = armarPaquete({
      ultimaSesion: '2026-09-10',
      hoy: HOY,
      entries: [dia('2026-09-12', 1), dia('2026-09-13', 5)],
    });
    expect(Object.keys(p).sort()).toEqual(['desde', 'dias', 'hasta', 'ventanaTopeada']);
    for (const d of p.dias) {
      expect(Object.keys(d).sort()).toEqual(['dayKey', 'moodId', 'moodLabel', 'nota']);
    }
  });
});

describe('debeOfrecerse', () => {
  const base = { proximaSesion: '2026-09-22', hoy: HOY, yaSeOfrecio: false, diasConRegistro: 4 };

  it('ofrece cuando la sesión está cerca y hay material', () => {
    expect(debeOfrecerse(base)).toBe(true);
  });

  // "Se ofrece una vez, antes de la sesión, y se puede descartar. Si insiste, la
  // app deja de acompañar y pasa a exigir."
  it('no insiste: una vez ofrecido, no vuelve', () => {
    expect(debeOfrecerse({ ...base, yaSeOfrecio: true })).toBe(false);
  });

  // Proponerle armar algo a quien no registró nada es pedirle trabajo para
  // producir una hoja en blanco.
  it('no ofrece si no hay nada que mandar', () => {
    expect(debeOfrecerse({ ...base, diasConRegistro: 0 })).toBe(false);
  });

  it('no ofrece sin sesión agendada', () => {
    expect(debeOfrecerse({ ...base, proximaSesion: null })).toBe(false);
  });

  it('no ofrece con demasiada anticipación — quedaría viejo', () => {
    expect(debeOfrecerse({ ...base, proximaSesion: '2026-10-15' })).toBe(false);
  });

  it('no ofrece para una sesión que ya pasó', () => {
    expect(debeOfrecerse({ ...base, proximaSesion: '2026-09-19' })).toBe(false);
  });

  it('el mismo día de la sesión todavía se ofrece', () => {
    expect(debeOfrecerse({ ...base, proximaSesion: HOY })).toBe(true);
  });

  it('los umbrales están donde se pueden revisar', () => {
    expect(TOPE_DIAS).toBe(30);
    expect(OFRECER_DESDE_DIAS).toBe(3);
  });
});
