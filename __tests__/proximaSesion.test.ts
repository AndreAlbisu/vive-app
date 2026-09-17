import {
  OPCIONES_PROXIMA_SESION,
  esCuandoVolver,
  fechaSugerida,
  textoSugerencia,
  textoSugerenciaCoach,
  type CuandoVolver,
} from '../lib/proximaSesion';

// Las cinco opciones tienen que ser exactamente las del CHECK de
// `next_session_suggestions` (scripts/add-next-session-suggestion.sql). Si
// alguien agrega una acá sin tocar la base, el insert falla en producción.
const CHECK_EN_LA_BASE = ['1_semana', '2_semanas', '3_semanas', '1_mes', 'cuando_lo_necesite'];

describe('opciones', () => {
  it('coinciden con el CHECK de la tabla', () => {
    expect(OPCIONES_PROXIMA_SESION.map(o => o.valor)).toEqual(CHECK_EN_LA_BASE);
  });

  it('esCuandoVolver rechaza lo que no está en la lista', () => {
    expect(esCuandoVolver('1_semana')).toBe(true);
    expect(esCuandoVolver('2_meses')).toBe(false);
    expect(esCuandoVolver(null)).toBe(false);
  });
});

describe('fechaSugerida', () => {
  it('cuenta desde el día de la sesión', () => {
    expect(fechaSugerida('1_semana', '2026-09-17', '2026-09-17')).toBe('2026-09-24');
    expect(fechaSugerida('2_semanas', '2026-09-17', '2026-09-17')).toBe('2026-10-01');
    expect(fechaSugerida('3_semanas', '2026-09-17', '2026-09-17')).toBe('2026-10-08');
    expect(fechaSugerida('1_mes', '2026-09-17', '2026-09-17')).toBe('2026-10-17');
  });

  it('cruza fin de mes y fin de año', () => {
    expect(fechaSugerida('1_semana', '2026-12-28', '2026-12-28')).toBe('2027-01-04');
    expect(fechaSugerida('1_mes', '2026-01-31', '2026-01-31')).toBe('2026-03-02');
  });

  it('"cuando lo necesite" no propone fecha', () => {
    expect(fechaSugerida('cuando_lo_necesite', '2026-09-17', '2026-09-17')).toBeNull();
  });

  it('si la fecha ya pasó devuelve hoy, no un día muerto del calendario', () => {
    expect(fechaSugerida('1_semana', '2026-01-05', '2026-09-17')).toBe('2026-09-17');
  });

  it('el día de hoy exacto no se corre', () => {
    expect(fechaSugerida('1_semana', '2026-09-10', '2026-09-17')).toBe('2026-09-17');
  });

  it('una fecha rota no rompe la pantalla', () => {
    expect(fechaSugerida('1_semana', '', '2026-09-17')).toBeNull();
  });

  it('no se mueve por el horario de verano del dispositivo', () => {
    // Argentina no lo usa, pero el riel internacional sí tiene usuarios que sí.
    const casos: [CuandoVolver, string, string][] = [
      ['1_semana', '2026-03-05', '2026-03-12'],
      ['1_semana', '2026-10-29', '2026-11-05'],
    ];
    casos.forEach(([c, desde, esperado]) => {
      expect(fechaSugerida(c, desde, '2026-01-01')).toBe(esperado);
    });
  });
});

describe('textos', () => {
  it('le habla al cliente usando el primer nombre', () => {
    expect(textoSugerencia('1_semana', 'Ana María Pérez')).toBe('Ana sugiere volver a verse en una semana.');
    expect(textoSugerencia('1_mes', '  ')).toBe('Tu profesional sugiere volver a verse en un mes.');
  });

  it('"cuando lo necesite" no suena a cita pendiente', () => {
    expect(textoSugerencia('cuando_lo_necesite', 'Ana')).toBe(
      'Ana te dejó abierta la próxima sesión: cuando lo necesites.'
    );
  });

  it('al profesional le confirma lo que eligió', () => {
    expect(textoSugerenciaCoach('2_semanas')).toBe('Le sugeriste volver en 2 semanas.');
    expect(textoSugerenciaCoach('cuando_lo_necesite')).toBe('Le dijiste que vuelva cuando lo necesite.');
  });

  it('ningún texto visible usa la raya', () => {
    const todos = OPCIONES_PROXIMA_SESION.flatMap(o => [
      o.label,
      textoSugerencia(o.valor, 'Ana'),
      textoSugerenciaCoach(o.valor),
    ]);
    todos.forEach(t => expect(t).not.toContain('—'));
  });
});
