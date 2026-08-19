export function isCancelLate(scheduledDate: string, scheduledTime: string): boolean {
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [h, m] = scheduledTime.split(':').map(Number);
  const sessionMs = new Date(year, month - 1, day, h, m, 0).getTime();
  return Date.now() > sessionMs - 24 * 60 * 60 * 1000;
}

/** ¿Se puede cancelar una sesión confirmada? Solo con 24hs o más de margen.
 *
 *  Es la contracara de `isCancelLate` y vivía duplicada dentro de SalaScreen.
 *  Se mudó acá al necesitarla también en la lista de próximas sesiones: dos
 *  copias de la regla de las 24hs se desincronizan tarde o temprano, y el día
 *  que pase, una pantalla va a permitir lo que la otra prohíbe.
 */
export function canCancelConfirmed(scheduledDate: string, scheduledTime: string): boolean {
  return !isCancelLate(scheduledDate, scheduledTime);
}
