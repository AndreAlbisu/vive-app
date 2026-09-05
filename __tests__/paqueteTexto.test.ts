import { componerTextoPaquete, fechaLegiblePaquete, type DiaDelPaquete } from '@/lib/paquete';

// El texto que la persona manda al chat. El invariante que importa es el §3 del
// doc: MATERIAL, NO CONCLUSIÓN — el mensaje lleva solo el registro crudo, nunca
// una lectura de la app.

describe('componerTextoPaquete', () => {
  it('arma una línea por día con fecha, ánimo y nota', () => {
    const dias: DiaDelPaquete[] = [
      { dayKey: '2026-09-01', moodId: 2, moodLabel: 'Cansado', nota: 'semana dura' },
      { dayKey: '2026-09-03', moodId: 4, moodLabel: 'Bien', nota: null },
    ];
    const t = componerTextoPaquete(dias);
    expect(t).toContain('Cansado: semana dura');
    // Sin nota, no queda un ": " colgando.
    expect(t).toContain('— Bien');
    expect(t).not.toContain('Bien:');
    // Una línea por día.
    expect(t.split('\n').filter(l => l.startsWith('•'))).toHaveLength(2);
  });

  it('la nota se recorta de espacios en los bordes', () => {
    const t = componerTextoPaquete([{ dayKey: '2026-09-01', moodId: 3, moodLabel: 'Normal', nota: '  algo  ' }]);
    expect(t).toContain('Normal: algo');
    expect(t).not.toContain('algo  ');
  });

  it('🔴 material, no conclusión: no mete promedios, tendencias ni lecturas de la app', () => {
    // Con la nota vacía, todo lo que hay en el texto lo puso la función — nada de
    // lo que escribió la persona. Si alguien alguna vez agrega una línea de
    // resumen ("tu ánimo sube…", "vas mejorando…"), este test se rompe.
    const dias: DiaDelPaquete[] = [
      { dayKey: '2026-09-01', moodId: 1, moodLabel: 'Bajón', nota: null },
      { dayKey: '2026-09-02', moodId: 5, moodLabel: 'Brillando', nota: null },
    ];
    const t = componerTextoPaquete(dias);
    expect(t).not.toMatch(/promedio|tendencia|mejor que|peor que|sube|baja|racha|constancia|rutina/i);
  });
});

describe('fechaLegiblePaquete', () => {
  it('usa la fecha local, sin saltar de día', () => {
    // 2026-09-05 es sábado.
    expect(fechaLegiblePaquete('2026-09-05')).toBe('sáb 5 sep');
  });
});
