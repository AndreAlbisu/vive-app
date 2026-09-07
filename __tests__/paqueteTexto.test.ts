import {
  componerTextoPaquete, fechaLegiblePaquete, largoPeorCasoPaquete,
  TOPE_DIAS, TOPE_NOTA, type DiaDelPaquete,
} from '@/lib/paquete';
import { MAX_LARGO_MENSAJE } from '@/constants/chat';

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

describe('el mensaje entra en el chat', () => {
  // 🔴 Este test existe por un bug real: el input del chat tenía `maxLength=500`
  // y el paquete pasa por ahí como borrador. Con notas al tope se truncaba a los
  // DOS días; sin ninguna nota, a los 18. Y truncar por el final se come los
  // días más recientes, que son los que la persona más quiere mostrar.
  //
  // Ata `TOPE_DIAS` + `TOPE_NOTA` con `MAX_LARGO_MENSAJE`: subir cualquiera de
  // los dos primeros sin subir el tercero rompe acá y no en el teléfono de
  // alguien.
  it('el peor caso posible entra en el límite del chat', () => {
    expect(largoPeorCasoPaquete()).toBeLessThanOrEqual(MAX_LARGO_MENSAJE);
  });

  it('el peor caso calculado no se queda corto contra el compositor real', () => {
    const dias: DiaDelPaquete[] = Array.from({ length: TOPE_DIAS }, (_, i) => ({
      // Día 10 en adelante: fechas de dos dígitos, que son las más largas.
      dayKey: `2026-09-${String(10 + (i % 20)).padStart(2, '0')}`,
      moodId: 5,
      moodLabel: 'Brillando', // la etiqueta más larga de `ViveMoods`
      nota: 'x'.repeat(TOPE_NOTA),
    }));
    expect(componerTextoPaquete(dias).length).toBeLessThanOrEqual(largoPeorCasoPaquete());
  });
});
