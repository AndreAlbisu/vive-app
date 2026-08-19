import {
  countsAsCompletedSession,
  commissionPctFor,
  marketplaceFeeFor,
  PAIR_SESSION_FILTER,
  COMMISSION_FIRST,
  COMMISSION_RECURRING,
  COMMISSION_PROMO,
  type BookingForCount,
} from '../supabase/functions/_shared/commission';

// Atajo para no repetir la forma entera en cada caso.
const booking = (over: Partial<BookingForCount> = {}): BookingForCount => ({
  status: 'completada',
  preference_id: null,
  usdt_amount: null,
  payment_status: 'aprobado',
  ...over,
});

describe('countsAsCompletedSession', () => {
  it('cuenta una sesión completada y pagada', () => {
    expect(countsAsCompletedSession(booking({ preference_id: 'pref_1' }))).toBe(true);
  });

  it('no cuenta lo que todavía no se completó', () => {
    for (const status of ['pendiente', 'confirmada', 'cancelada']) {
      expect(countsAsCompletedSession(booking({ status }))).toBe(false);
    }
  });

  // El caso que causó el bug real: 27 reservas así en producción, 16 ya
  // completadas, empujando pares al tramo del 15% sin un peso cobrado.
  it('NO cuenta un checkout abandonado que igual llegó a completada', () => {
    expect(countsAsCompletedSession(
      booking({ preference_id: 'pref_abandonado', payment_status: 'pendiente' }),
    )).toBe(false);
  });

  // La contracara: si el coach no tiene MP conectada nunca hay preference_id,
  // así que esa sesión es legítima aunque no se haya cobrado nada.
  it('SÍ cuenta una sesión sin cobro por diseño (coach sin MP, sin preference_id)', () => {
    expect(countsAsCompletedSession(
      booking({ preference_id: null, payment_status: 'pendiente' }),
    )).toBe(true);
  });

  it('cuenta una reembolsada: la sesión ocurrió', () => {
    expect(countsAsCompletedSession(
      booking({ preference_id: 'pref_1', payment_status: 'reembolsado' }),
    )).toBe(true);
  });

  // El riel internacional: `usdt_amount` es el marcador de que arrancó un cobro,
  // igual que `preference_id` para Mercado Pago. Mirar solo el de MP dejaba
  // entrar el abandono del otro riel — el mismo bug por la otra puerta.
  it('NO cuenta un cobro de USDT abandonado que igual llegó a completada', () => {
    expect(countsAsCompletedSession(
      booking({ usdt_amount: 6.28, payment_status: 'pendiente' }),
    )).toBe(false);
  });

  it('SÍ cuenta una sesión pagada en USDT', () => {
    expect(countsAsCompletedSession(
      booking({ usdt_amount: 6.28, payment_status: 'aprobado' }),
    )).toBe(true);
  });

  // `usdt_amount` es numeric en la base, y PostgREST puede devolverlo como
  // string. Un `!!'0'` sería true y un `Number('0')` false: se compara contra
  // null a propósito para que el tipo no cambie la respuesta.
  it('trata el monto como marcador aunque venga como string', () => {
    expect(countsAsCompletedSession(
      booking({ usdt_amount: '6.28', payment_status: 'pendiente' }),
    )).toBe(false);
  });

  it('no rompe si `usdt_amount` no viene en la fila (filas viejas)', () => {
    const sinCampo = { status: 'completada', preference_id: null, payment_status: 'aprobado' };
    expect(countsAsCompletedSession(sinCampo)).toBe(true);
  });
});

// El predicado SQL y la función JS son la misma regla en dos lenguajes, y ya
// divergieron una vez (el string seguía mirando solo `preference_id` cuando
// apareció USDT). Este test no puede correr PostgREST, pero sí fija que los dos
// marcadores estén nombrados: si alguien agrega un riel y se olvida del string,
// falla acá.
describe('PAIR_SESSION_FILTER', () => {
  it('nombra los marcadores de los dos rieles', () => {
    expect(PAIR_SESSION_FILTER).toContain('preference_id.is.null');
    expect(PAIR_SESSION_FILTER).toContain('usdt_amount.is.null');
  });

  it('los agrupa con and() — si fueran dos condiciones sueltas del or, una sola alcanzaría para contar', () => {
    expect(PAIR_SESSION_FILTER).toContain('and(preference_id.is.null,usdt_amount.is.null)');
  });

  it('deja entrar todo lo que ya salió de pendiente', () => {
    expect(PAIR_SESSION_FILTER).toContain('payment_status.neq.pendiente');
  });
});

describe('commissionPctFor', () => {
  const now = Date.parse('2026-08-14T12:00:00Z');

  it('cobra 20% en la primera sesión del par', () => {
    expect(commissionPctFor(0, now)).toBe(COMMISSION_FIRST);
  });

  it('cobra 15% de la segunda en adelante', () => {
    expect(commissionPctFor(1, now)).toBe(COMMISSION_RECURRING);
    expect(commissionPctFor(9, now)).toBe(COMMISSION_RECURRING);
  });

  it('el tramo del 15% no se resetea nunca', () => {
    expect(commissionPctFor(50, now)).toBe(COMMISSION_RECURRING);
  });

  describe('promo fundador', () => {
    it('cobra 0% mientras la promo esté vigente', () => {
      expect(commissionPctFor(0, now, '2026-12-31T00:00:00Z')).toBe(COMMISSION_PROMO);
      expect(commissionPctFor(5, now, '2026-12-31T00:00:00Z')).toBe(COMMISSION_PROMO);
    });

    it('vuelve al esquema normal cuando la promo venció', () => {
      expect(commissionPctFor(0, now, '2026-01-01T00:00:00Z')).toBe(COMMISSION_FIRST);
      expect(commissionPctFor(2, now, '2026-01-01T00:00:00Z')).toBe(COMMISSION_RECURRING);
    });

    // El borde exacto: la promo NO incluye su propio instante de vencimiento.
    it('en el instante exacto del vencimiento ya no aplica', () => {
      expect(commissionPctFor(0, now, new Date(now).toISOString())).toBe(COMMISSION_FIRST);
      expect(commissionPctFor(0, now - 1, new Date(now).toISOString())).toBe(COMMISSION_PROMO);
    });

    // Esto es lo que hoy pasa en producción: la variable está TBD.
    it('sin promo definida cobra el esquema normal, no 0%', () => {
      expect(commissionPctFor(0, now, undefined)).toBe(COMMISSION_FIRST);
      expect(commissionPctFor(0, now, null)).toBe(COMMISSION_FIRST);
      expect(commissionPctFor(0, now, '')).toBe(COMMISSION_FIRST);
    });

    it('una fecha inválida no activa la promo', () => {
      expect(commissionPctFor(0, now, 'mañana')).toBe(COMMISSION_FIRST);
    });
  });
});

describe('marketplaceFeeFor', () => {
  it('calcula el 20% y el 15% de montos redondos', () => {
    expect(marketplaceFeeFor(10000, 20)).toBe(2000);
    expect(marketplaceFeeFor(10000, 15)).toBe(1500);
  });

  it('con promo no retiene nada', () => {
    expect(marketplaceFeeFor(10000, 0)).toBe(0);
  });

  it('redondea a dos decimales sin arrastrar error de coma flotante', () => {
    // 0.1 + 0.2 !== 0.3 en punto flotante; acá se multiplica antes de dividir.
    expect(marketplaceFeeFor(1, 20)).toBe(0.2);
    expect(marketplaceFeeFor(3, 15)).toBe(0.45);
  });

  it('reproduce el split real verificado contra MP (pago de $1, 20%)', () => {
    // Sesión del 09/08/2026, pago 172923514332: MP devolvió application_fee 0.2.
    expect(marketplaceFeeFor(1, 20)).toBe(0.2);
  });

  it('maneja montos con centavos', () => {
    expect(marketplaceFeeFor(12345.67, 15)).toBeCloseTo(1851.85, 2);
  });
});
