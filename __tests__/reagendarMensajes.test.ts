import { mensajeDeError } from '../lib/reagendar';

describe('mensajeDeError', () => {
  // Cada motivo que puede levantar `pedir_reagendado` tiene que tener su frase.
  const motivos = [
    'ya_la_movio', 'ocupado', 'sin_agenda', 'destino_en_el_pasado',
    'mismo_horario', 'ya_empezo', 'no_confirmada',
    'no es tu reserva', 'no es tu sesion', 'sin sesion', 'solicitud_no_pendiente',
    'sin_propuestas', 'demasiadas_opciones', 'sin_opciones',
  ];

  it('traduce todos los motivos del servidor', () => {
    const genérico = mensajeDeError('cualquier cosa rara');
    for (const m of motivos) {
      // Llega como viene de Postgres, con ruido alrededor.
      const traducido = mensajeDeError(`ERROR: ${m} (SQLSTATE P0001)`);
      expect(traducido).not.toBe(genérico);
      expect(traducido).not.toContain('P0001');
      expect(traducido).not.toContain('_');
    }
  });

  it('un motivo desconocido cae en una frase genérica y no filtra el error crudo', () => {
    const t = mensajeDeError('relation "bookings" does not exist');
    expect(t).not.toContain('bookings');
    expect(t).toBe(mensajeDeError(null));
  });

  it('ninguna frase usa rayas', () => {
    for (const m of [...motivos, null, 'raro']) {
      expect(mensajeDeError(m)).not.toContain('—');
    }
  });
});

describe('contrapropuesta (M16 bis, 23/09/2026)', () => {
  it('explica qué pasó si la propuesta se resolvió mientras elegía', () => {
    const m = mensajeDeError('P0001: sin_propuesta');
    expect(m).toMatch(/ya no tiene horarios propuestos/i);
    // Nada de códigos ni inglés en pantalla.
    expect(m).not.toMatch(/P0001|sin_propuesta/);
  });
});
