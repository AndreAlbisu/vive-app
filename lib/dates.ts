// Fecha del día en la zona horaria del dispositivo.
//
// ⚠️ Existe porque `new Date().toISOString().split('T')[0]` NO es la fecha de
// hoy: es la fecha UTC. En Argentina (UTC-3) eso hace que el día salte a las
// 21:00, con dos consecuencias que se veían en la app:
//
//   1. `computeMoodStreak` comparaba la última entrada contra un "hoy" que
//      después de las 21:00 ya era mañana, no la encontraba y devolvía 0 — la
//      racha desaparecía sola todas las noches.
//   2. Dos check-ins del mismo lunes (20:00 y 22:00) se guardaban con fechas
//      distintas, así que el `UNIQUE(user_id, entry_date)` de `mood_entries`
//      no los dedupeaba.
//
// Toda fecha que represente "el día del usuario" tiene que salir de acá.
// `toISOString()` sigue siendo correcto para instantes (timestamps), no para
// días de calendario.
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** El día de calendario `n` días antes de `from`, en hora local. */
export function localDayKeyMinus(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return localDayKey(d);
}
