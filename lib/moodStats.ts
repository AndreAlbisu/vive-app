import type { MoodEntry } from '@/hooks/useMoodHistory';
import { localDayKey } from '@/lib/dates';

// Helpers puros sobre MoodEntry[] — sin red, sin estado. Compartidos entre la
// card "Tu semana" (Inicio) y "Tu progreso", que necesitan la misma racha de
// check-ins consecutivos.
//
// ⚠️ El titular de la card ya NO vive acá: se movió a `lib/weeklyReflection.ts`,
// que mira además sesiones, prácticas y diario. `buildWeeklyHeadline` se
// eliminó — comparaba el nivel absoluto con gramática de tendencia y decía lo
// contrario de lo que pasaba en la mitad de los casos. El detalle está en el
// encabezado de weeklyReflection.ts.

// Días consecutivos hacia atrás desde hoy con check-in — mismo cálculo que ya
// vivía inline en progreso.tsx ("Racha actual" de Estado de ánimo), ahora
// también usado por la card de Inicio.
//
// ⚠️ El "hoy" sale de `localDayKey`, NO de `toISOString()`. Con UTC, después de
// las 21:00 argentinas el "hoy" del cálculo ya era mañana: no encontraba la
// entrada de esta mañana, cortaba en el primer paso y devolvía 0. La racha se
// caía sola todas las noches.
export function computeMoodStreak(entries: MoodEntry[]): number {
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  let streak = 0;
  const cursor = new Date();
  for (const e of sorted) {
    if (e.entry_date === localDayKey(cursor)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

// Umbral de "baja fuerte": 2 niveles o más respecto al check-in anterior
// (ej. Bien→Cansado, Brillando→Bajón). No es lo mismo que `isIntense` de
// RecommendedCard (mood_id≤2 sin importar tendencia, sugiere herramientas) —
// esto mira la caída relativa al registro previo y sugiere hablar con una
// persona. `entries` debe venir ordenado por entry_date descendente (mismo
// contrato que useMoodHistory).
export function detectMoodDrop(entries: MoodEntry[]): { today: MoodEntry; previous: MoodEntry } | null {
  if (entries.length < 2) return null;
  // Local, no UTC — ver la nota de `computeMoodStreak`. Con `toISOString()`
  // esta comparación fallaba después de las 21:00 y la sugerencia de hablar con
  // alguien dejaba de aparecer justo en la franja en que más se registra un
  // bajón.
  const todayStr = localDayKey();
  const [today, previous] = entries;
  if (today.entry_date !== todayStr) return null;
  if (previous.mood_id - today.mood_id >= 2) return { today, previous };
  return null;
}
