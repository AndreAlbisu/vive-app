import { etiquetaHueco, mensajeDePropuesta } from '../lib/coachPropose';

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
