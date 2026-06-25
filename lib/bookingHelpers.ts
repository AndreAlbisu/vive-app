export function isCancelLate(scheduledDate: string, scheduledTime: string): boolean {
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [h, m] = scheduledTime.split(':').map(Number);
  const sessionMs = new Date(year, month - 1, day, h, m, 0).getTime();
  return Date.now() > sessionMs - 24 * 60 * 60 * 1000;
}
