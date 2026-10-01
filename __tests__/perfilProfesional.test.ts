import { firmaDeResena, motivoSinPerfil, duracionUnica, etiquetaProximoLugar } from '@/lib/perfilProfesional';

describe('firmaDeResena', () => {
  it('nombre e inicial del apellido, nunca el nombre completo', () => {
    expect(firmaDeResena('Martina González')).toBe('Martina G.');
    expect(firmaDeResena('  juan   carlos pérez ')).toBe('Juan C.');
    expect(firmaDeResena('Lucía')).toBe('Lucía');
  });

  it('sin nombre usable firma genérico', () => {
    expect(firmaDeResena(null)).toBe('Alguien de Vita');
    expect(firmaDeResena('   ')).toBe('Alguien de Vita');
    expect(firmaDeResena('Usuario eliminado')).toBe('Alguien de Vita');
  });
});

describe('motivoSinPerfil', () => {
  it('sin filas es que no existe; cualquier otro error es la red', () => {
    expect(motivoSinPerfil({ code: 'PGRST116' })).toBe('no_existe');
    expect(motivoSinPerfil(null)).toBe('no_existe');
    expect(motivoSinPerfil({ code: '' })).toBe('error_red');
    expect(motivoSinPerfil({})).toBe('error_red');
  });
});

describe('duracionUnica', () => {
  it('solo dice un número cuando hay uno', () => {
    expect(duracionUnica([50, 50, null])).toBe(50);
    expect(duracionUnica([45, 60])).toBeNull();
    expect(duracionUnica([])).toBeNull();
  });
});

describe('etiquetaProximoLugar', () => {
  // 01/10/2026 10:00 en Argentina (UTC-3).
  const ahora = Date.UTC(2026, 9, 1, 13, 0);
  const AR = 'America/Argentina/Buenos_Aires';

  it('hoy, mañana, día de la semana y fecha completa', () => {
    expect(etiquetaProximoLugar('2026-10-01', '18:00', ahora, AR)).toBe('Hoy a las 18:00');
    expect(etiquetaProximoLugar('2026-10-02', '9:00', ahora, AR)).toBe('Mañana a las 09:00');
    expect(etiquetaProximoLugar('2026-10-05', '18:30', ahora, AR)).toBe('El lunes a las 18:30');
    expect(etiquetaProximoLugar('2026-10-09', '18:00', ahora, AR)).toBe('El viernes 9 de octubre a las 18:00');
  });

  it('desde otra zona muestra la hora y el día de quien lee', () => {
    // Las 21:00 de Argentina son las 07:00 del día siguiente en Bangkok.
    expect(etiquetaProximoLugar('2026-10-01', '21:00', ahora, 'Asia/Bangkok')).toBe('Mañana a las 07:00');
    // A las 02:00 de Madrid del 02/10 en Argentina todavía es el 01/10.
    const madrugadaMadrid = Date.UTC(2026, 9, 2, 0, 0);
    expect(etiquetaProximoLugar('2026-10-02', '10:00', madrugadaMadrid, 'Europe/Madrid')).toBe('Hoy a las 15:00');
  });
});
