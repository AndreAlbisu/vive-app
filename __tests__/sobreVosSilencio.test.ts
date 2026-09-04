import { shouldStaySilent, previousDayKey, type LastSpoken } from '@/lib/sobreVosSilencio';

describe('previousDayKey — el día anterior sin mirar el reloj', () => {
  it('resta un día dentro del mismo mes', () => {
    expect(previousDayKey('2026-09-15')).toBe('2026-09-14');
  });

  it('cruza el borde de mes', () => {
    expect(previousDayKey('2026-09-01')).toBe('2026-08-31');
  });

  it('cruza el borde de año', () => {
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
  });

  it('resuelve febrero de un año bisiesto', () => {
    expect(previousDayKey('2028-03-01')).toBe('2028-02-29');
  });

  it('es puro: la misma entrada da lo mismo siempre', () => {
    expect(previousDayKey('2026-09-15')).toBe(previousDayKey('2026-09-15'));
  });
});

describe('shouldStaySilent', () => {
  const ayer: LastSpoken = { date: '2026-09-14', signal: 'level' };
  const hoy = '2026-09-15';

  it('se calla cuando la señal es level y ya se dijo level ayer', () => {
    expect(shouldStaySilent({ signal: 'level', lastSpoken: ayer, dayKey: hoy })).toBe(true);
  });

  it('habla la primera vez que aparece level — sin nada guardado no hay repetición', () => {
    expect(shouldStaySilent({ signal: 'level', lastSpoken: null, dayKey: hoy })).toBe(false);
  });

  it('habla si ayer la señal era otra: level recién llegado es novedad', () => {
    expect(shouldStaySilent({
      signal: 'level',
      lastSpoken: { date: '2026-09-14', signal: 'streak' },
      dayKey: hoy,
    })).toBe(false);
  });

  it('habla si lo último que dijo no fue ayer — después de un hueco hay que decir algo', () => {
    expect(shouldStaySilent({
      signal: 'level',
      lastSpoken: { date: '2026-09-08', signal: 'level' },
      dayKey: hoy,
    })).toBe(false);
  });

  // Este es el que sostiene toda la feature: las señales con una noticia real
  // detrás no se callan nunca, por más que se repitan días seguidos.
  it('NUNCA se calla en una señal que no sea level, ni repitiéndose', () => {
    for (const signal of ['sharp-drop', 'sustained-low', 'trend-up', 'trend-down', 'sessions', 'streak', 'practices', 'empty', 'piso-seguridad']) {
      expect(shouldStaySilent({
        signal,
        lastSpoken: { date: '2026-09-14', signal },
        dayKey: hoy,
      })).toBe(false);
    }
  });

  // El silencio no se registra (`markSpoken` solo corre al hablar), así que al
  // día siguiente lo último dicho queda a dos días y vuelve a hablar. Sin esto
  // la tarjeta se apagaría para siempre en cuanto entrara en una racha de level.
  it('nunca se calla dos días seguidos: la racha de level alterna habla/calla', () => {
    let ultimoHabla: LastSpoken = null;
    const dias = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'];
    const resultado = dias.map(dayKey => {
      const callar = shouldStaySilent({ signal: 'level', lastSpoken: ultimoHabla, dayKey });
      if (!callar) ultimoHabla = { date: dayKey, signal: 'level' };
      return callar ? 'calla' : 'habla';
    });
    expect(resultado).toEqual(['habla', 'calla', 'habla', 'calla', 'habla']);
  });
});
