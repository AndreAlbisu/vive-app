import type { MoodEntry } from '@/hooks/useMoodHistory';

// ── Variantes de copy ──────────────────────────────────────────────────────────
// Ajustar aquí sin tocar getSobreTiInsight()

export const MOOD_COPY = {
  noData: [
    'Registrá cómo te sentís cada día para conocerte mejor. Cada momento de autoconciencia suma.',
    'Empezá tu primer check-in de hoy. Conocerte es el primer paso hacia el bienestar.',
  ],
  streakHigh: [
    (n: number) =>
      `Llevas ${n} días seguidos registrando tu estado — eso muestra compromiso con vos. Vas por buen camino.`,
    (n: number) =>
      `${n} días de check-in seguidos. La constancia, aunque sea pequeña, construye más balance en tu vida.`,
  ],
  improving: [
    'Tu energía subió en los últimos días. Seguir presente con cómo te sentís es un hábito poderoso.',
    'Vas bien. Los días difíciles quedan atrás — seguí construyendo desde este momento.',
  ],
  declining: [
    'Los días difíciles también forman parte del camino. Reconocerlos es el primer paso para transitarlos.',
    'Está bien no estar bien. Registrar cómo te sentís es una forma de cuidarte, incluso en los momentos más cargados.',
  ],
  stableHigh: [
    'Te estás manteniendo en un buen lugar. La constancia, aunque sea pequeña, también es un logro.',
    'Vas por buen camino tomando acciones que te hacen cada vez más efectivo. Los retos y la constancia construyen más balance en tu vida.',
  ],
  stableLow: [
    'Días mezclados. Reconocer cómo estás sin juzgarte es más valioso de lo que parece.',
    'La semana tuvo sus subidas y bajadas. Estar presente con eso ya es una forma de cuidarte.',
  ],
};

// ── Lógica de insight ──────────────────────────────────────────────────────────

export function getSobreTiInsight(entries: MoodEntry[]): string {
  if (entries.length < 3) return MOOD_COPY.noData[0];

  const avg = entries.reduce((sum, e) => sum + e.mood_id, 0) / entries.length;

  // Streak: días consecutivos hasta hoy
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  let expected = today;
  for (const e of sorted) {
    if (e.entry_date === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }

  // Tendencia: primera mitad (reciente) vs segunda mitad (anterior)
  const half = Math.floor(entries.length / 2);
  const recentAvg = entries.slice(0, half).reduce((s, e) => s + e.mood_id, 0) / half;
  const olderAvg  = entries.slice(half).reduce((s, e) => s + e.mood_id, 0) / (entries.length - half);
  const delta = recentAvg - olderAvg;

  if (streak >= 5) return MOOD_COPY.streakHigh[streak % 2](streak);
  if (delta >=  0.75) return MOOD_COPY.improving[0];
  if (delta <= -0.75) return avg < 2.5 ? MOOD_COPY.declining[1] : MOOD_COPY.declining[0];
  if (avg >= 3.5) return MOOD_COPY.stableHigh[0];
  return MOOD_COPY.stableLow[0];
}
