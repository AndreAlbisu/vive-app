import type { CachedCoach } from './coachesCache';

// Ranking del deck de Conexiones — criterio v1 (sección 4 del spec).
// `eligible` ya viene gateado por disponibilidad: coachesCache filtra
// verified + availability_status='activo', así que acá no se re-gatea.

export const DECK_SIZE            = 5;   // hasta 5 coaches por deck
export const RESERVED_FOR_NEW     = 2;   // slots reservados para coaches "nuevos" (si los hay)
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

// Score del carril establecido.
//
// v1 ordena por RATING, no por reagendamiento — a propósito. Para calcular
// reagendamiento un coach necesita ≥5 sesiones completadas (MIN_REBOOKING_SAMPLE),
// y al lanzar ningún coach va a tener eso por meses. Rankear por un dato que no
// existe es adivinar; normalizar rate (banda ~0.3-0.6) contra rating (banda
// ~4.5-5) además castiga a la señal que más confiamos.
//
// La vista coach_rebooking_stats ya acumula el dato desde el día 1. Cuando haya
// volumen real, esto pasa a ser v2 con reagendamiento primario en 3 BANDAS
// —buen-reagendamiento > sin-dato-por-rating > mal-reagendamiento— con el corte
// buen/mal decidido sobre la distribución real, no inventado ahora. Ese cambio
// es solo esta función (rebookingRate/completadasCount ya están en CachedCoach).
function establishedScore(c: CachedCoach): number {
  return c.avgRating ?? 0;   // v1: rating 1..5 (0 si no tiene reseñas)
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Intercala los coaches "nuevos" hacia el medio del deck (posiciones 2 y 4) para
// darles visibilidad sin ponerlos en la posición 1. ⚑ Posiciones ajustables.
function interleaveNew(established: CachedCoach[], newest: CachedCoach[]): CachedCoach[] {
  if (newest.length === 0) return established;
  const out = [...established];
  const positions = [1, 3];
  newest.forEach((c, i) => {
    const pos = Math.min(positions[i] ?? out.length, out.length);
    out.splice(pos, 0, c);
  });
  return out;
}

/**
 * Devuelve hasta DECK_SIZE coaches para el deck de una puerta.
 * - Parte el pool en "nuevos" vs "establecidos" (partición → sin duplicados).
 * - Establecidos ordenados por reagendamiento/rating (ver establishedScore).
 * - 1-2 slots reservados para nuevos, rotando día a día (semilla `fecha+userId`).
 * - Si no hay nuevos, esos slots vuelven al pool establecido.
 */
export function rankDeck(
  eligible: CachedCoach[],
  userId: string | undefined,
  now: Date = new Date(),
): CachedCoach[] {
  const seed = `${dayKey(now)}:${userId ?? 'anon'}`;

  const newest: CachedCoach[] = [];
  const established: CachedCoach[] = [];
  for (const c of eligible) {
    (isNewCoach(c, now) ? newest : established).push(c);
  }

  const rankedEstablished = [...established].sort((a, b) => {
    const d = establishedScore(b) - establishedScore(a);
    if (d !== 0) return d;
    return (b.avgRating ?? 0) - (a.avgRating ?? 0);   // desempate final: rating
  });

  const rotatedNew = seededShuffle(newest, seed);          // rotación diaria

  // Los slots reservados son un PISO (garantizar nuevos), no un techo: primero
  // aparto hasta RESERVED_FOR_NEW nuevos, lleno con establecidos, y si sobran
  // slots (pocos establecidos) los backfilleo con más nuevos. Sin esto, un tema
  // con todos-nuevos mostraría solo 2 coaches.
  const guaranteedNew = Math.min(RESERVED_FOR_NEW, rotatedNew.length);
  const pickedEstablished = rankedEstablished.slice(0, DECK_SIZE - guaranteedNew);
  const newQuota = DECK_SIZE - pickedEstablished.length;   // piso + backfill
  const pickedNew = rotatedNew.slice(0, newQuota);

  return interleaveNew(pickedEstablished, pickedNew).slice(0, DECK_SIZE);
}
