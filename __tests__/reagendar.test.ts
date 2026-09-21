import { puedeReagendar, destinoValido, textoReagendar } from '../lib/reagendar';
import { scheduledAtMs } from '../lib/time';

// Una sesión concreta para no depender de la fecha en que corran los tests.
const FECHA = '2026-10-15';
const HORA = '15:00';
const INICIO = scheduledAtMs(FECHA, HORA);
const HORA_MS = 60 * 60 * 1000;

const reserva = (extra: Partial<Parameters<typeof puedeReagendar>[0]> = {}) => ({
  status: 'confirmada',
  scheduled_date: FECHA,
  scheduled_time: HORA,
  ...extra,
});

describe('puedeReagendar', () => {
  it('con más de 24hs se mueve libremente', () => {
    expect(puedeReagendar(reserva(), INICIO - 48 * HORA_MS)).toEqual({ puede: 'libre' });
  });

  // El borde exacto: a las 24hs clavadas todavía es libre, igual que en
  // isCancelLate. Las dos reglas comparten VENTANA_24H_MS justamente para que
  // este minuto no se separe.
  it('a las 24hs justas todavía es libre', () => {
    expect(puedeReagendar(reserva(), INICIO - 24 * HORA_MS)).toEqual({ puede: 'libre' });
  });

  it('un minuto más tarde ya necesita permiso del profesional', () => {
    expect(puedeReagendar(reserva(), INICIO - 24 * HORA_MS + 60_000))
      .toEqual({ puede: 'pide_permiso' });
  });

  it('dentro de las 24hs, tres horas antes, se puede pedir', () => {
    expect(puedeReagendar(reserva(), INICIO - 3 * HORA_MS)).toEqual({ puede: 'pide_permiso' });
  });

  // 🔴 La regla de Andre: una vez POR RESERVA, no por persona.
  it('dentro de las 24hs y ya movida, no se puede de nuevo', () => {
    expect(puedeReagendar(reserva({ movida_tarde: true }), INICIO - 3 * HORA_MS))
      .toEqual({ puede: 'no', motivo: 'ya_la_movio' });
  });

  // Haberla movido con tiempo no gasta la ficha del último momento.
  it('ya movida pero todavía con más de 24hs, sigue siendo libre', () => {
    expect(puedeReagendar(reserva({ movida_tarde: true }), INICIO - 48 * HORA_MS))
      .toEqual({ puede: 'libre' });
  });

  it('una sesión que ya empezó no se mueve', () => {
    expect(puedeReagendar(reserva(), INICIO)).toEqual({ puede: 'no', motivo: 'ya_empezo' });
    expect(puedeReagendar(reserva(), INICIO + HORA_MS)).toEqual({ puede: 'no', motivo: 'ya_empezo' });
  });

  it('solo se mueven las confirmadas', () => {
    for (const status of ['pendiente', 'cancelada', 'completada']) {
      expect(puedeReagendar(reserva({ status }), INICIO - 48 * HORA_MS))
        .toEqual({ puede: 'no', motivo: 'no_confirmada' });
    }
  });

  // Ante una fecha ilegible se pide permiso, que es lo conservador ACÁ: mover es
  // un favor. (En isCancelLate lo conservador es lo contrario, porque cancelar
  // es un derecho.)
  it('con una fecha ilegible se pide permiso, no se mueve solo', () => {
    expect(puedeReagendar(reserva({ scheduled_date: 'cualquier cosa' })))
      .toEqual({ puede: 'pide_permiso' });
  });
});

describe('destinoValido', () => {
  const origen = { scheduled_date: FECHA, scheduled_time: HORA };

  it('acepta un horario futuro', () => {
    expect(destinoValido('2026-10-16', '10:00', origen, INICIO - 48 * HORA_MS)).toBe(true);
  });

  it('rechaza un horario que ya pasó', () => {
    expect(destinoValido('2026-10-01', '10:00', origen, INICIO - 48 * HORA_MS)).toBe(false);
  });

  it('rechaza el mismo horario que ya tiene', () => {
    expect(destinoValido(FECHA, HORA, origen, INICIO - 48 * HORA_MS)).toBe(false);
    // Tolera los segundos que a veces trae la hora guardada.
    expect(destinoValido(FECHA, '15:00:00', origen, INICIO - 48 * HORA_MS)).toBe(false);
  });

  // ⚠️ La ventana mide qué tan cerca está la sesión que se MUEVE, no adónde va.
  it('deja mover a un horario que cae dentro de las próximas 24hs', () => {
    expect(destinoValido('2026-10-14', '20:00', origen, INICIO - 48 * HORA_MS)).toBe(true);
  });

  it('rechaza una fecha ilegible', () => {
    expect(destinoValido('', '10:00', origen, INICIO - 48 * HORA_MS)).toBe(false);
  });
});

describe('textoReagendar', () => {
  it('cubre todos los casos y ninguno usa rayas', () => {
    const casos = [
      puedeReagendar(reserva(), INICIO - 48 * HORA_MS),
      puedeReagendar(reserva(), INICIO - 3 * HORA_MS),
      puedeReagendar(reserva({ movida_tarde: true }), INICIO - 3 * HORA_MS),
      puedeReagendar(reserva(), INICIO + HORA_MS),
      puedeReagendar(reserva({ status: 'pendiente' }), INICIO - 48 * HORA_MS),
    ];
    for (const c of casos) {
      const t = textoReagendar(c);
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toContain('—');
    }
  });
});
