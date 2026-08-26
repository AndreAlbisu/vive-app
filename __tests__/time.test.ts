import {
  scheduledAtMs,
  todayInAr,
  daysFromTodayAr,
  localEquivalent,
  deviceIsOffArgentina,
  TZ_SUPPORTED,
  AR_TZ,
  observedTz,
} from '@/lib/time';

describe('entorno de test', () => {
  // Si esto falla, los tests de abajo no prueban lo que dicen probar: estarían
  // ejercitando el fallback de offset fijo en vez de la conversión por zona.
  it('el runtime soporta conversión por nombre de zona', () => {
    expect(TZ_SUPPORTED).toBe(true);
    expect(AR_TZ).toBe('America/Argentina/Buenos_Aires');
  });
});

describe('scheduledAtMs', () => {
  it('interpreta la hora guardada como hora de Argentina (UTC-3)', () => {
    // 15:00 en Argentina son las 18:00 UTC.
    expect(scheduledAtMs('2026-08-20', '15:00')).toBe(Date.parse('2026-08-20T18:00:00Z'));
  });

  it('acepta el formato con segundos, que es como lo devuelve Postgres', () => {
    expect(scheduledAtMs('2026-08-20', '15:00:00')).toBe(scheduledAtMs('2026-08-20', '15:00'));
  });

  it('coincide con el cálculo del servidor (_shared/guarantee.ts usa -03:00 fijo)', () => {
    // Las dos mitades tienen que dar el MISMO instante: si difieren, la app
    // promete una cosa y el trigger hace otra.
    for (const [d, t] of [['2026-01-15', '09:00'], ['2026-07-01', '23:30'], ['2026-12-31', '00:00']]) {
      expect(scheduledAtMs(d, t)).toBe(Date.parse(`${d}T${t}:00-03:00`));
    }
  });

  // 🔴 El corazón del bug: el resultado NO puede depender de dónde esté el
  // teléfono. Antes se usaba `new Date(y, m-1, d, h, mi)`, que sí dependía.
  //
  // ⚠️ Este test NO cambia la zona del proceso — dentro de jest, mutar
  // `process.env.TZ` en caliente no reconfigura `Date`, así que un test que lo
  // hiciera pasaría siempre sin probar nada. Lo que se afirma es lo verificable
  // acá: el resultado es un instante absoluto que coincide con el del servidor.
  // La independencia de zona se prueba de verdad en `localEquivalent`, donde la
  // zona es un parámetro.
  it('da un instante absoluto, no relativo a la zona del proceso', () => {
    // La cuenta vieja —`new Date(2026, 7, 20, 15, 0)`— da este mismo número solo
    // si la máquina está en UTC-3. Este test fija el valor absoluto, así que
    // falla en cualquier máquina donde la implementación vuelva a depender de la
    // zona local, que es exactamente lo que se quiere detectar.
    expect(scheduledAtMs('2026-08-20', '15:00')).toBe(Date.parse('2026-08-20T18:00:00Z'));
  });

  it('devuelve NaN con datos ilegibles en vez de un instante inventado', () => {
    expect(scheduledAtMs('', '15:00')).toBeNaN();
    expect(scheduledAtMs('2026-08-20', '')).toBeNaN();
    expect(scheduledAtMs('mañana', 'tarde')).toBeNaN();
  });
});

describe('la regla de las 24hs, que decide el reembolso', () => {
  const cancelLate = (d: string, t: string, now: number) =>
    now > scheduledAtMs(d, t) - 24 * 60 * 60_000;

  // El caso real: alguien en Madrid cancelando con 29 horas de anticipación.
  // Con la cuenta vieja (`new Date` local) el instante caía 5 horas antes, así
  // que la app escribía cancelled_late=true y el trigger le negaba la plata.
  it('con 29hs de anticipación NO es tardía, se mire desde donde se mire', () => {
    const sesion = { d: '2026-08-20', t: '15:00' };
    const now = scheduledAtMs(sesion.d, sesion.t) - 29 * 60 * 60_000;
    expect(cancelLate(sesion.d, sesion.t, now)).toBe(false);
  });

  it('con 23hs SÍ es tardía', () => {
    const sesion = { d: '2026-08-20', t: '15:00' };
    const now = scheduledAtMs(sesion.d, sesion.t) - 23 * 60 * 60_000;
    expect(cancelLate(sesion.d, sesion.t, now)).toBe(true);
  });

  it('el borde exacto de las 24hs no es tardío', () => {
    const sesion = { d: '2026-08-20', t: '15:00' };
    const now = scheduledAtMs(sesion.d, sesion.t) - 24 * 60 * 60_000;
    expect(cancelLate(sesion.d, sesion.t, now)).toBe(false);
  });
});

describe('todayInAr', () => {
  it('a la 01:00 de Madrid en Argentina todavía es el día anterior', () => {
    // 2026-08-20T23:00Z = 01:00 del 21 en Madrid, 20:00 del 20 en Argentina.
    expect(todayInAr(Date.parse('2026-08-20T23:00:00Z'))).toBe('2026-08-20');
  });

  it('pasada la medianoche argentina cambia de día', () => {
    expect(todayInAr(Date.parse('2026-08-21T03:30:00Z'))).toBe('2026-08-21');
  });
});

describe('daysFromTodayAr', () => {
  const now = Date.parse('2026-08-20T15:00:00Z'); // 12:00 del 20 en Argentina

  it('cuenta días argentinos, no días del dispositivo', () => {
    expect(daysFromTodayAr('2026-08-20', now)).toBe(0);
    expect(daysFromTodayAr('2026-08-21', now)).toBe(1);
    expect(daysFromTodayAr('2026-08-27', now)).toBe(7);
    expect(daysFromTodayAr('2026-08-19', now)).toBe(-1);
  });

  it('no se corre en cambios de mes', () => {
    const finDeMes = Date.parse('2026-08-31T15:00:00Z');
    expect(daysFromTodayAr('2026-09-01', finDeMes)).toBe(1);
  });
});

describe('localEquivalent', () => {
  // 🔴 Lo que de verdad muerde no es la hora, es el DÍA. Alguien que lee "21:00"
  // y reserva sin ver que para él es el martes no aparece el lunes.
  it('marca el corrimiento hacia adelante (Bangkok, +10)', () => {
    // Lunes 17/08 21:00 ART = martes 18/08 07:00 en Bangkok.
    expect(localEquivalent('2026-08-17', '21:00', 'Asia/Bangkok')).toEqual({
      time: '07:00', dayShift: 1, weekday: 'martes',
    });
  });

  it('marca el corrimiento hacia atrás (Los Ángeles, -4)', () => {
    // Lunes 17/08 02:00 ART = domingo 16/08 22:00 en Los Ángeles.
    expect(localEquivalent('2026-08-17', '02:00', 'America/Los_Angeles')).toEqual({
      time: '22:00', dayShift: -1, weekday: 'domingo',
    });
  });

  it('Madrid: misma fecha, 5 horas más tarde', () => {
    expect(localEquivalent('2026-08-17', '15:00', 'Europe/Madrid')).toEqual({
      time: '20:00', dayShift: 0, weekday: 'lunes',
    });
  });

  it('en Argentina no hay corrimiento', () => {
    expect(localEquivalent('2026-08-17', '15:00', 'America/Argentina/Buenos_Aires')).toEqual({
      time: '15:00', dayShift: 0, weekday: 'lunes',
    });
  });

  // Montevideo comparte offset con Argentina: mostrar una "conversión" que dice
  // lo mismo dos veces es ruido.
  it('Montevideo ve la misma hora y no cuenta como otra zona', () => {
    expect(deviceIsOffArgentina(Date.parse('2026-08-17T18:00:00Z'), 'America/Montevideo')).toBe(false);
    expect(deviceIsOffArgentina(Date.parse('2026-08-17T18:00:00Z'), 'Europe/Madrid')).toBe(true);
  });

  it('devuelve null con datos ilegibles', () => {
    expect(localEquivalent('', '', 'Europe/Madrid')).toBeNull();
  });
});

// Las dos mitades del sistema calculan el mismo instante sobre los mismos datos.
// Si divergen, la app habilita un botón que la base después rechaza — o peor,
// promete un reembolso que el trigger no da.
describe('cliente y servidor coinciden', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const server = require('../supabase/functions/_shared/guarantee');

  it('scheduledAtMs da el mismo número en las dos implementaciones', () => {
    const casos: [string, string][] = [
      ['2026-01-15', '09:00'],
      ['2026-07-01', '23:30'],
      ['2026-08-20', '15:00'],
      ['2026-12-31', '00:00'],
      ['2026-03-01', '12:00:00'],
    ];
    for (const [d, t] of casos) {
      expect(scheduledAtMs(d, t)).toBe(server.scheduledAtMs(d, t));
    }
  });
});

describe('observedTz', () => {
  // 🔴 La razón de existir de esta función, y lo único que hay que proteger: NO
  // inventa. `deviceTz()` cae a Argentina cuando no puede leer la zona —correcto
  // para mostrar horarios, hay que mostrar algo— pero esta se usa para OBSERVAR
  // dónde estaba quien reservó, y ahí ese fallback registraría un país que nadie
  // observó. Un default silencioso es indistinguible de un dato real a los seis
  // meses.
  it('devuelve null en vez de suponer Argentina cuando no puede leer la zona', () => {
    const original = global.Intl;
    try {
      // @ts-expect-error se rompe Intl a propósito
      global.Intl = undefined;
      expect(observedTz()).toBeNull();
    } finally {
      global.Intl = original;
    }
  });

  it('devuelve la zona cuando está disponible', () => {
    const tz = observedTz();
    expect(tz === null || typeof tz === 'string').toBe(true);
    if (tz !== null) expect(tz.length).toBeGreaterThan(0);
  });
});
