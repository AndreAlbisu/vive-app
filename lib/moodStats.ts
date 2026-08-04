import type { MoodEntry } from '@/hooks/useMoodHistory';

// Helpers puros sobre MoodEntry[] — sin red, sin estado. Compartidos entre la
// card "Sobre vos" (Inicio) y "Tu progreso", que necesitan la misma racha de
// check-ins consecutivos y (Inicio) el titular dinámico reciente-vs-histórico.

const MOOD_LABEL: Record<number, string> = {
  1: 'bajón', 2: 'cansado', 3: 'normal', 4: 'bien', 5: 'brillando',
};

// Días consecutivos hacia atrás desde hoy con check-in — mismo cálculo que ya
// vivía inline en progreso.tsx ("Racha actual" de Estado de ánimo), ahora
// también usado por la card de Inicio.
export function computeMoodStreak(entries: MoodEntry[]): number {
  const today = new Date().toISOString().split('T')[0];
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  let streak = 0;
  let expected = today;
  for (const e of sorted) {
    if (e.entry_date === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().split('T')[0];
    } else break;
  }
  return streak;
}

export type WeeklyHeadline = { before: string; bold: string; after: string };

// Compara el promedio de `recent` (últimos 7 días) contra `historic` (los 30
// anteriores a esos 7) y arma el titular de la card "Sobre vos". Simple a
// propósito — sin ML, solo comparar dos promedios, per lo pedido.
export function buildWeeklyHeadline(recent: MoodEntry[], historic: MoodEntry[]): WeeklyHeadline {
  if (recent.length === 0) {
    return { before: 'Así viene siendo tu semana', bold: '', after: '' };
  }

  // Poco histórico (usuario nuevo) → mensaje genérico, no forzar comparación.
  if (historic.length < 3) {
    return { before: 'Así viene siendo tu semana', bold: '', after: '' };
  }

  const avgRecent = recent.reduce((s, e) => s + e.mood_id, 0) / recent.length;
  const avgHistoric = historic.reduce((s, e) => s + e.mood_id, 0) / historic.length;
  const label = MOOD_LABEL[Math.round(avgRecent)];

  if (avgRecent < avgHistoric) {
    return { before: 'Veniste más ', bold: label, after: ' que de costumbre esta semana' };
  }
  return { before: 'Veniste más ', bold: label, after: ' que de costumbre — se nota' };
}

// Umbral de "baja fuerte": 2 niveles o más respecto al check-in anterior
// (ej. Bien→Cansado, Brillando→Bajón). No es lo mismo que `isIntense` de
// RecommendedCard (mood_id≤2 sin importar tendencia, sugiere herramientas) —
// esto mira la caída relativa al registro previo y sugiere hablar con una
// persona. `entries` debe venir ordenado por entry_date descendente (mismo
// contrato que useMoodHistory).
export function detectMoodDrop(entries: MoodEntry[]): { today: MoodEntry; previous: MoodEntry } | null {
  if (entries.length < 2) return null;
  const todayStr = new Date().toISOString().split('T')[0];
  const [today, previous] = entries;
  if (today.entry_date !== todayStr) return null;
  if (previous.mood_id - today.mood_id >= 2) return { today, previous };
  return null;
}
