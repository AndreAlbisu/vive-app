import { isSignalWorthMoment, shouldShowMoment, type LastShown } from '@/lib/sobreVosMomento';

describe('isSignalWorthMoment', () => {
  it('level y empty no valen un momento — son el fallback sin comparación y la invitación vacía', () => {
    expect(isSignalWorthMoment('level')).toBe(false);
    expect(isSignalWorthMoment('empty')).toBe(false);
  });

  it('el resto de las señales sí — todas tienen una noticia real detrás', () => {
    for (const signal of ['sharp-drop', 'sustained-low', 'trend-up', 'trend-down', 'sessions', 'streak', 'practices']) {
      expect(isSignalWorthMoment(signal)).toBe(true);
    }
  });
});

describe('shouldShowMoment', () => {
  it('no dispara si la preferencia está apagada, aunque la señal valga la pena', () => {
    expect(shouldShowMoment({ signal: 'streak', prefEnabled: false, lastShown: null })).toBe(false);
  });

  it('no dispara si la señal es level o empty, aunque la preferencia esté prendida', () => {
    expect(shouldShowMoment({ signal: 'level', prefEnabled: true, lastShown: null })).toBe(false);
    expect(shouldShowMoment({ signal: 'empty', prefEnabled: true, lastShown: null })).toBe(false);
  });

  it('dispara la primera vez que aparece una señal que vale la pena', () => {
    expect(shouldShowMoment({ signal: 'streak', prefEnabled: true, lastShown: null })).toBe(true);
  });

  it('no repite la misma señal que ya se mostró — una racha que sigue no es noticia nueva', () => {
    const lastShown: LastShown = { date: '2026-08-14', signal: 'streak' };
    expect(shouldShowMoment({ signal: 'streak', prefEnabled: true, lastShown })).toBe(false);
  });

  it('sí dispara si la señal cambió respecto de la última vez, aunque haya sido ayer', () => {
    const lastShown: LastShown = { date: '2026-08-14', signal: 'streak' };
    expect(shouldShowMoment({ signal: 'sessions', prefEnabled: true, lastShown })).toBe(true);
  });

  it('sharp-drop dispara igual que cualquier otra señal que valga la pena — decisión consciente, no se excluye', () => {
    expect(shouldShowMoment({ signal: 'sharp-drop', prefEnabled: true, lastShown: null })).toBe(true);
  });
});
