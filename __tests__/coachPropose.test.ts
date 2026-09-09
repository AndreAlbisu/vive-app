import { etiquetaHueco, mensajeDePropuesta, horaComparable } from '../lib/coachPropose';

// 🔴 La comparación que decide si un horario está libre. Las dos tablas guardan
// la hora como texto y con formatos distintos; si esto falla, se le ofrece a
// alguien un turno ya ocupado.
describe('horaComparable', () => {
  it('le pone el cero inicial a la hora sin padding', () => {
    expect(horaComparable('9:00')).toBe('09:00');
  });

  it('deja igual la que ya lo tiene', () => {
    expect(horaComparable('09:00')).toBe('09:00');
  });

  it('descarta los segundos que agrega Postgres', () => {
    expect(horaComparable('09:00:00')).toBe('09:00');
    expect(horaComparable('9:30:00')).toBe('09:30');
  });

  it('🔴 el caso que motivó todo: los dos formatos dan lo MISMO', () => {
    expect(horaComparable('9:00')).toBe(horaComparable('09:00:00'));
    expect(horaComparable('15:00')).toBe(horaComparable('15:00:00'));
  });

  it('no confunde horas distintas', () => {
    expect(horaComparable('9:00')).not.toBe(horaComparable('19:00'));
  });
});


describe('etiquetaHueco', () => {
  it('arma día, número, mes y hora', () => {
    // 2026-09-11 fue un viernes.
    expect(etiquetaHueco({ date: '2026-09-11', time: '15:00' })).toBe('Vie 11 sep · 15:00');
  });

  it('recorta el padding de segundos que devuelve Postgres', () => {
    expect(etiquetaHueco({ date: '2026-09-11', time: '15:00:00' })).toBe('Vie 11 sep · 15:00');
  });
});

describe('mensajeDePropuesta', () => {
  it('usa solo el primer nombre', () => {
    const msg = mensajeDePropuesta('Ana María Pérez', []);
    expect(msg).toContain('Hola Ana');
    expect(msg).not.toContain('María');
  });

  it('sin huecos abre el chat con el saludo y nada más — no inventa horarios', () => {
    const msg = mensajeDePropuesta('Marcos', []);
    expect(msg.trim()).toBe('Hola Marcos, ¿cómo venís?');
  });

  it('lista los huecos, uno por línea', () => {
    const msg = mensajeDePropuesta('Ana', [
      { date: '2026-09-11', time: '15:00' },
      { date: '2026-09-14', time: '10:00' },
    ]);
    expect(msg).toContain('estos horarios libres');
    expect(msg).toContain('· Vie 11 sep · 15:00');
    expect(msg).toContain('· Lun 14 sep · 10:00');
  });

  it('con un solo hueco habla en singular', () => {
    const msg = mensajeDePropuesta('Ana', [{ date: '2026-09-11', time: '15:00' }]);
    expect(msg).toContain('este horario libre');
    expect(msg).not.toContain('estos horarios');
  });

  it('un nombre vacío no rompe el saludo', () => {
    expect(mensajeDePropuesta('  ', []).trim()).toBe('Hola, ¿cómo venís?');
  });
});
