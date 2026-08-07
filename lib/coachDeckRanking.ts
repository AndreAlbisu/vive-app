import type { CachedCoach } from './coachesCache';

// Deck de Conexiones — criterio v2: SLOTS ETIQUETADOS.
//
// En vez de "dos carriles" opacos, el deck es una lista ORDENADA de slots, cada
// uno con una categoría VISIBLE para el usuario y un criterio explícito. Esto
// hace transparente por qué se recomienda a cada coach, y le dice al coach cómo
// aparecer en cada slot.
//
// Reglas del ensamblado:
//   - Se recorren los slots en orden de prioridad (SLOT_ORDER).
//   - Cada slot toma el mejor coach AÚN NO ELEGIDO según su criterio.
//   - Cada coach aparece UNA sola vez (gana el slot de mayor prioridad).
//   - Si un slot no tiene candidato (ej. tema sin coaches "nuevos"), se OMITE —
//     nunca se muestra un coach mal-etiquetado.
//
// `eligible` ya viene gateado por disponibilidad: coachesCache filtra verified +
// availability_status='activo', así que acá no se re-gatea.

export const NEW_MAX_REVIEWS      = 5;   // < 5 reseñas ⇒ "nuevo"
export const NEW_MAX_AGE_DAYS     = 28;  // …o < 4 semanas desde que se registró
export const MIN_REBOOKING_SAMPLE = 5;   // piso para que rebooking_rate cuente

// ─── PRNG determinístico sembrado por string (rotación estable por día) ──────
function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const rand = mulberry32(hashStr(seedStr));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "Nuevo": pocas reseñas O poco tiempo desde que se registró (lo que se cumpla primero). */
export function isNewCoach(c: CachedCoach, now: Date = new Date()): boolean {
  const fewReviews = (c.reviewCount ?? 0) < NEW_MAX_REVIEWS;
  let recent = false;
  if (c.createdAt) {
    const ageDays = (now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000;
    recent = ageDays < NEW_MAX_AGE_DAYS;
  }
  return fewReviews || recent;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Slots ───────────────────────────────────────────────────────────────────
export type DeckSlotKey = 'recomendado' | 'tendencia' | 'nuevo' | 'economico';

export type DeckSlot = {
  key: DeckSlotKey;
  label: string;     // chip que ve el usuario
  sublabel: string;  // explicación corta del criterio
  icon: string;      // nombre de Feather icon
};

export type DeckEntry = { coach: CachedCoach; slot: DeckSlot };

export const DECK_SLOTS: Record<DeckSlotKey, DeckSlot> = {
  recomendado: { key: 'recomendado', label: 'Recomendado por Vita', sublabel: 'Por rating y reagendamiento', icon: 'award' },
  tendencia:   { key: 'tendencia',   label: 'En tendencia',         sublabel: 'De los más elegidos este mes', icon: 'trending-up' },
  nuevo:       { key: 'nuevo',       label: 'Nuevo en Vita',        sublabel: 'Recién sumado a la comunidad', icon: 'feather' },
  economico:   { key: 'economico',   label: 'Opción económica',     sublabel: 'El precio más accesible del tema', icon: 'tag' },
};

export const SLOT_ORDER: DeckSlotKey[] = ['recomendado', 'tendencia', 'nuevo', 'economico'];

// v1: el score "recomendado" es solo rating (0 si no tiene reseñas). Cuando haya
// volumen (≥MIN_REBOOKING_SAMPLE completadas) el reagendamiento entra como señal
// primaria — rebookingRate/completadasCount ya viven en CachedCoach.
function recommendScore(c: CachedCoach): number {
  return c.avgRating ?? 0;
}

// Cada picker recibe los candidatos aún no elegidos y devuelve al ganador (o null
// si nadie califica para esa categoría). El orden estable ante empates lo da el
// shuffle sembrado por día → rota la exposición entre coaches equivalentes.
function pickForSlot(
  key: DeckSlotKey,
  pool: CachedCoach[],
  now: Date,
): CachedCoach | null {
  if (pool.length === 0) return null;

  switch (key) {
    case 'recomendado': {
      // Solo coaches con al menos 1 reseña — así el label no miente.
      const eligible = pool.filter(c => (c.reviewCount ?? 0) >= 1);
      if (eligible.length === 0) return null;
      return [...eligible].sort((a, b) =>
        (recommendScore(b) - recommendScore(a)) ||
        ((b.reviewCount ?? 0) - (a.reviewCount ?? 0)),
      )[0];
    }
    case 'tendencia': {
      const eligible = pool.filter(c => (c.recentBookers ?? 0) > 0);
      if (eligible.length === 0) return null;
      return [...eligible].sort((a, b) =>
        ((b.recentBookers ?? 0) - (a.recentBookers ?? 0)) ||
        ((b.avgRating ?? 0) - (a.avgRating ?? 0)),
      )[0];
    }
    case 'nuevo': {
      const eligible = pool.filter(c => isNewCoach(c, now));
      if (eligible.length === 0) return null;
      // Rotación diaria: entre los nuevos, el orden cambia por día.
      return eligible[0]; // pool ya viene barajado por día en rankDeck
    }
    case 'economico': {
      // El más accesible de lo que queda (cualquier coach tiene precio).
      return [...pool].sort((a, b) =>
        ((a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity)) ||
        ((b.avgRating ?? 0) - (a.avgRating ?? 0)),
      )[0];
    }
  }
}

/**
 * Devuelve el deck de una puerta como slots etiquetados (≤ SLOT_ORDER.length).
 * Cada coach aparece una sola vez; slots sin candidato se omiten.
 */
export function rankDeck(
  eligible: CachedCoach[],
  userId: string | undefined,
  now: Date = new Date(),
): DeckEntry[] {
  const seed = `${dayKey(now)}:${userId ?? 'anon'}`;
  // Baraja base por día: da orden estable-por-día para desempates y para el
  // carril "nuevo" (rota qué nuevo se muestra sin enterrar a nadie).
  const shuffled = seededShuffle(eligible, seed);

  const picked = new Set<string>();
  const out: DeckEntry[] = [];

  for (const key of SLOT_ORDER) {
    const pool = shuffled.filter(c => !picked.has(c.id));
    const coach = pickForSlot(key, pool, now);
    if (!coach) continue;
    picked.add(coach.id);
    out.push({ coach, slot: DECK_SLOTS[key] });
  }

  return out;
}
