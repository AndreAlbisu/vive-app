import { semanaDeEscritura } from '@/lib/semanaDiario';

// Viernes 4 de septiembre de 2026, 18:30 hora local.
const VIERNES = new Date(2026, 8, 4, 18, 30);

describe('semanaDeEscritura', () => {
  it('devuelve la semana de lunes a domingo', () => {
    const semana = semanaDeEscritura([], VIERNES);
    expect(semana).toHaveLength(7);
    expect(semana.map(d => d.label)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(semana[0].key).toBe('2026-08-31');  // lunes
    expect(semana[6].key).toBe('2026-09-06');  // domingo
  });

  it('marca hoy una sola vez, y en el día que corresponde', () => {
    const semana = semanaDeEscritura([], VIERNES);
    expect(semana.filter(d => d.esHoy)).toHaveLength(1);
    expect(semana.find(d => d.esHoy)?.key).toBe('2026-09-04');
  });

  it('marca como escritos los días con al menos una entrada', () => {
    const semana = semanaDeEscritura(
      [
        new Date(2026, 8, 1, 22, 17).toISOString(),  // martes
        new Date(2026, 8, 3, 10, 12).toISOString(),  // jueves
        new Date(2026, 8, 3, 21, 40).toISOString(),  // jueves de nuevo
      ],
      VIERNES,
    );
    expect(semana.filter(d => d.escrito).map(d => d.key)).toEqual(['2026-09-01', '2026-09-03']);
  });

  // 🔴 El bug que ya tuvo esta pantalla: `toISOString()` da la fecha UTC, así
  // que en Argentina (UTC-3) una entrada de las 23:30 caía en el día siguiente.
  it('cuenta una entrada de la noche en el día local, no en el UTC', () => {
    const nocheDelViernes = new Date(2026, 8, 4, 23, 30);
    const semana = semanaDeEscritura(
      [nocheDelViernes.toISOString()],
      new Date(2026, 8, 4, 23, 45),
    );
    const viernes = semana.find(d => d.key === '2026-09-04');
    const sabado = semana.find(d => d.key === '2026-09-05');
    expect(viernes?.escrito).toBe(true);
    expect(sabado?.escrito).toBe(false);
  });

  it('ignora entradas de otras semanas', () => {
    const semana = semanaDeEscritura(
      [new Date(2026, 7, 25, 12, 0).toISOString()],
      VIERNES,
    );
    expect(semana.some(d => d.escrito)).toBe(false);
  });

  // La semana en curso incluye días que todavía no pasaron: van vacíos, no
  // marcados como fallados.
  it('deja los días futuros de la semana sin marcar', () => {
    const semana = semanaDeEscritura([], VIERNES);
    expect(semana.find(d => d.key === '2026-09-06')?.escrito).toBe(false);
  });
});
