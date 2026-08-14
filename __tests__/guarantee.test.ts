import {
  guaranteeFailures,
  countPreviousOfPair,
  scheduledAtMs,
  WINDOW_HOURS,
  type PairBooking,
} from '../supabase/functions/_shared/guarantee';

// La sesión de referencia: 10 de agosto a las 15:00 hora argentina.
const SESSION = { id: 'b1', scheduled_date: '2026-08-10', scheduled_time: '15:00' };
const SESSION_MS = scheduledAtMs(SESSION.scheduled_date, SESSION.scheduled_time);

const hours = (n: number) => n * 3_600_000;

function input(over: Partial<Parameters<typeof guaranteeFailures>[0]> = {}) {
  return {
    booking: { ...SESSION, payment_status: 'aprobado', payment_id: 'pay_1' },
    pairBookings: [{ ...SESSION, preference_id: 'pref_1', payment_status: 'aprobado' }] as PairBooking[],
    approvedClaimsByUser: 0,
    now: SESSION_MS + hours(2),
    ...over,
  };
}

describe('guaranteeFailures — el caso que califica', () => {
  it('no devuelve motivos cuando se cumplen las cuatro condiciones', () => {
    expect(guaranteeFailures(input())).toEqual([]);
  });
});

describe('condición: pago real', () => {
  it('rechaza si el pago no está aprobado', () => {
    const f = guaranteeFailures(input({
      booking: { ...SESSION, payment_status: 'pendiente', payment_id: 'pay_1' },
    }));
    expect(f.join(' ')).toContain('no hay nada que reintegrar');
  });

  it('rechaza si nunca hubo cobro por MP', () => {
    const f = guaranteeFailures(input({
      booking: { ...SESSION, payment_status: 'aprobado', payment_id: null },
    }));
    expect(f.join(' ')).toContain('nunca se cobró');
  });
});

describe('condición: ventana de 48hs', () => {
  it('acepta justo dentro de la ventana', () => {
    expect(guaranteeFailures(input({ now: SESSION_MS + hours(WINDOW_HOURS) }))).toEqual([]);
  });

  it('rechaza pasada la ventana', () => {
    const f = guaranteeFailures(input({ now: SESSION_MS + hours(WINDOW_HOURS) + 1000 }));
    expect(f.join(' ')).toContain('ventana de §9.3');
  });

  // Que no se pueda pedir la garantía de algo que todavía no pasó importa:
  // para eso está la cancelación de §9.1, que tiene otra política.
  it('rechaza si la sesión todavía no ocurrió', () => {
    const f = guaranteeFailures(input({ now: SESSION_MS - hours(1) }));
    expect(f.join(' ')).toContain('todavía no ocurrió');
  });

  it('rechaza si la fecha agendada no se puede interpretar', () => {
    const f = guaranteeFailures(input({
      booking: { id: 'b1', scheduled_date: 'no-es-fecha', scheduled_time: 'ni-hora', payment_status: 'aprobado', payment_id: 'pay_1' },
      pairBookings: [],
    }));
    expect(f.join(' ')).toContain('no se pudo interpretar');
  });
});

describe('condición: primera sesión del vínculo', () => {
  it('rechaza si hubo una sesión anterior con ese profesional', () => {
    const f = guaranteeFailures(input({
      pairBookings: [
        { ...SESSION, preference_id: 'pref_1', payment_status: 'aprobado' },
        { id: 'b0', scheduled_date: '2026-07-01', scheduled_time: '10:00', preference_id: 'pref_0', payment_status: 'aprobado' },
      ],
    }));
    expect(f.join(' ')).toContain('solo a la primera del vínculo');
  });

  it('no cuenta las posteriores: reclamar la primera sigue valiendo', () => {
    expect(guaranteeFailures(input({
      pairBookings: [
        { ...SESSION, preference_id: 'pref_1', payment_status: 'aprobado' },
        { id: 'b2', scheduled_date: '2026-08-20', scheduled_time: '10:00', preference_id: 'pref_2', payment_status: 'aprobado' },
      ],
    }))).toEqual([]);
  });

  // El bug que encontré releyendo: comparar solo por scheduled_date dejaba
  // pasar dos sesiones el MISMO día, y la segunda calificaba como primera.
  it('distingue dos sesiones del mismo día por hora', () => {
    const manana: PairBooking = { id: 'b0', scheduled_date: '2026-08-10', scheduled_time: '10:00', preference_id: 'pref_0', payment_status: 'aprobado' };
    expect(countPreviousOfPair(SESSION, [manana])).toBe(1);

    const tarde: PairBooking = { id: 'b2', scheduled_date: '2026-08-10', scheduled_time: '18:00', preference_id: 'pref_2', payment_status: 'aprobado' };
    expect(countPreviousOfPair(SESSION, [tarde])).toBe(0);
  });

  // Sin este filtro, una reserva basura vieja del par haría que la primera
  // sesión REAL no calificara.
  it('ignora un checkout abandonado anterior', () => {
    const basura: PairBooking = { id: 'b0', scheduled_date: '2026-07-01', scheduled_time: '10:00', preference_id: 'pref_abandonado', payment_status: 'pendiente' };
    expect(countPreviousOfPair(SESSION, [basura])).toBe(0);
  });

  it('no se cuenta a sí misma', () => {
    expect(countPreviousOfPair(SESSION, [{ ...SESSION, preference_id: 'pref_1', payment_status: 'aprobado' }])).toBe(0);
  });
});

describe('condición: una sola vez por Cliente', () => {
  it('rechaza si el cliente ya usó la garantía', () => {
    const f = guaranteeFailures(input({ approvedClaimsByUser: 1 }));
    expect(f.join(' ')).toContain('una sola vez en toda la Plataforma');
  });
});

describe('acumulación de motivos', () => {
  // Quien contesta el mail necesita ver todo lo que falla de una vez.
  it('devuelve todos los motivos, no solo el primero', () => {
    const f = guaranteeFailures(input({
      booking: { ...SESSION, payment_status: 'pendiente', payment_id: null },
      now: SESSION_MS + hours(200),
      approvedClaimsByUser: 1,
    }));
    expect(f.length).toBeGreaterThanOrEqual(4);
  });
});

describe('scheduledAtMs', () => {
  it('interpreta la hora como Argentina (UTC-3)', () => {
    expect(scheduledAtMs('2026-08-10', '15:00')).toBe(Date.parse('2026-08-10T18:00:00Z'));
  });

  it('tolera segundos en scheduled_time', () => {
    expect(scheduledAtMs('2026-08-10', '15:00:00')).toBe(scheduledAtMs('2026-08-10', '15:00'));
  });
});
