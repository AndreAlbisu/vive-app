import type { CachedCoach } from './coachesCache';

// Deck de Conexiones — criterio v3: SLOTS COMO CATEGORÍA, NO COMO PODIO.
//
// v2 etiquetaba los slots como categorías pero los implementaba como rankings:
// cada uno hacía `sort(...)[0]`, o sea el máximo. Eso tenía tres consecuencias
// malas, todas del mismo error:
//
//   1. El mismo coach ocupaba "Recomendado por Vita" durante semanas, porque el
//      criterio era determinístico y no rotaba nunca. El deck dejaba de repartir
//      exposición y pasaba a ser una tabla de posiciones.
//   2. Pagaba muchísimo hacer trampa: subir de 4.7 a 4.9 te daba el monopolio de
//      la puerta. Con una barra, cruzarla una vez no te compra nada más.
//   3. Duplicaba el trabajo de la búsqueda (app/search3.tsx), que ya es la lista
//      completa, filtrable y comparable. Conexiones recomienda UNA opción; la
//      búsqueda te deja comparar las 100.
//
// v3: cada slot es un FILTRO que define un pool de aptos, y el coach que se
// muestra sale sorteado de ese pool. El sorteo ya existía — el shuffle sembrado
// por `${día}:${userId}` — solo que antes lo pisaba el sort. Ahora es el
// mecanismo principal: dos personas distintas ven coaches distintos el mismo día,
// y la misma persona ve otros al día siguiente.
//
// Las barras son PISOS, no podios. "Recomendado" significa "cumple lo que Vita
// recomienda", que es lo que la etiqueta siempre prometió.
//
// `eligible` ya viene gateado por disponibilidad: coachesCache filtra verified +
// availability_status='activo', así que acá no se re-gatea.

// ─── Umbrales ────────────────────────────────────────────────────────────────
export const NEW_MAX_REVIEWS      = 5;   // "nuevo" mientras tenga menos de 5 reseñas…
export const NEW_MAX_AGE_DAYS     = 28;  // …Y menos de 4 semanas. Es un AND, ver isNewCoach.
export const MIN_REBOOKING_SAMPLE = 5;   // piso de muestra para que rebooking_rate cuente

// Barra de "Recomendado por Vita".
export const MIN_RECOMMEND_RATING    = 4.5;
export const MIN_RECOMMEND_REVIEWS   = 3;
export const MIN_RECOMMEND_REBOOKING = 0.3;  // 30% de los clientes vuelve a reservar

// Barra de "En tendencia".
export const MIN_TRENDING_BOOKERS = 3;

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

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Criterios de cada slot ──────────────────────────────────────────────────

/**
 * "Nuevo": pocas reseñas **Y** poco tiempo desde que se registró.
 *
 * Era un OR hasta v3, y ese OR no drenaba: un coach que nunca llegaba a 5
 * reseñas quedaba "nuevo" para siempre. El carril terminaba acumulando justo a
 * los que no convirtieron, que diluían la rotación de los que recién llegaban
 * — con 60 acumulados, el recién llegado se lleva 1/60 de la exposición y la
 * garantía de arranque desaparece cuando más se necesita.
 *
 * Sin `createdAt` falla cerrado (no es nuevo): dejarlo pasar reabriría la fuga.
 */
export function isNewCoach(c: CachedCoach, now: Date = new Date()): boolean {
  if ((c.reviewCount ?? 0) >= NEW_MAX_REVIEWS) return false;
  if (!c.createdAt) return false;
  const ageDays = (now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000;
  return ageDays < NEW_MAX_AGE_DAYS;
}

/**
 * Barra de calidad de "Recomendado por Vita".
 *
 * Con muestra suficiente de sesiones completadas, el REAGENDAMIENTO es la señal
 * que manda: una cuenta falsa puede dejar 5★, pero no puede volver a reservar y
 * pagar sin poner la plata. Las estrellas quedan como piso en los dos tramos,
 * nunca como criterio único cuando hay algo mejor disponible.
 */
export function passesQualityBar(c: CachedCoach): boolean {
  const rating = c.avgRating ?? 0;
  if (rating < MIN_RECOMMEND_RATING) return false;

  if ((c.completadasCount ?? 0) >= MIN_REBOOKING_SAMPLE) {
    return (c.rebookingRate ?? 0) >= MIN_RECOMMEND_REBOOKING;
  }
  return (c.reviewCount ?? 0) >= MIN_RECOMMEND_REVIEWS;
}

/** Mediana de precio de la puerta — la barra de "Opción económica". */
export function medianPrice(coaches: CachedCoach[]): number {
  const prices = coaches
    .map(c => c.priceFrom)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p))
    .sort((a, b) => a - b);

  if (prices.length === 0) return Infinity;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

// ─── Slots ───────────────────────────────────────────────────────────────────
export type DeckSlotKey = 'recomendado' | 'tendencia' | 'nuevo' | 'economico';

/** Chips de relleno — ver FALLBACK_SLOTS. No son mérito, son disponibilidad. */
export type FallbackKey = 'disponible_semana' | 'responde_24h';

export type DeckSlot = {
  key: DeckSlotKey | FallbackKey;
  label: string;     // chip que ve el usuario
  sublabel: string;  // explicación corta del criterio
  icon: string;      // nombre de Feather icon
};

export type DeckEntry = { coach: CachedCoach; slot: DeckSlot };

export const DECK_SLOTS: Record<DeckSlotKey, DeckSlot> = {
  recomendado: { key: 'recomendado', label: 'Recomendado por Vita', sublabel: 'Cumple la barra de calidad', icon: 'award' },
  tendencia:   { key: 'tendencia',   label: 'En tendencia',         sublabel: 'De los más elegidos este mes', icon: 'trending-up' },
  nuevo:       { key: 'nuevo',       label: 'Nuevo en Vita',        sublabel: 'Recién sumado a la comunidad', icon: 'feather' },
  economico:   { key: 'economico',   label: 'Opción económica',     sublabel: 'De los más accesibles del tema', icon: 'tag' },
};

export const SLOT_ORDER: DeckSlotKey[] = ['recomendado', 'tendencia', 'nuevo', 'economico'];

// ─── Relleno ─────────────────────────────────────────────────────────────────
//
// Los 4 slots de mérito son pools con barra, así que en un mercado flaco quedan
// vacíos y `rankDeck` los omite — correcto (nunca etiquetar mal a nadie) pero el
// resultado era una puerta con 1 solo coach. Medido con datos reales: las 10
// puertas mostraban 1. Eso es peor que v2, donde el argmax siempre producía un
// ganador.
//
// El relleno completa hasta MIN_DECK_SIZE con chips que NO implican mérito, solo
// disponibilidad — y que son verdad por construcción: `coachesCache` ya filtra
// `availability_status = 'activo'`, y la vista `coach_availability_status`
// garantiza que todo coach activo es 'this_week' (tiene hueco en 7 días) o
// 'responds_24h'. O sea que el pool de relleno es el catálogo entero y la puerta
// nunca queda desierta.
export const MIN_DECK_SIZE = 3;

export const FALLBACK_SLOTS: Record<FallbackKey, DeckSlot> = {
  disponible_semana: { key: 'disponible_semana', label: 'Con lugar esta semana', sublabel: 'Tiene horarios libres en los próximos 7 días', icon: 'calendar' },
  responde_24h:      { key: 'responde_24h',      label: 'Responde en 24 h',      sublabel: 'Activo y atendiendo consultas',              icon: 'clock' },
};

/** El chip de disponibilidad que le corresponde a este coach. Siempre hay uno. */
export function fallbackSlotFor(c: CachedCoach): DeckSlot {
  return c.hasSlotThisWeek ? FALLBACK_SLOTS.disponible_semana : FALLBACK_SLOTS.responde_24h;
}

/** Contexto que depende de la puerta entera, no del coach suelto. */
export type SlotContext = { medianPrice: number; now: Date };

export function buildSlotContext(doorCoaches: CachedCoach[], now: Date = new Date()): SlotContext {
  return { medianPrice: medianPrice(doorCoaches), now };
}

/**
 * ¿Este coach entra al pool de este slot? Es la única definición de cada
 * criterio en todo el código — `rankDeck` y el panel del coach
 * (`lib/coachVisibility.ts`) la comparten para que no puedan divergir.
 */
export function isEligibleForSlot(key: DeckSlotKey, c: CachedCoach, ctx: SlotContext): boolean {
  switch (key) {
    case 'recomendado': return passesQualityBar(c);
    case 'tendencia':   return (c.recentBookers ?? 0) >= MIN_TRENDING_BOOKERS;
    case 'nuevo':       return isNewCoach(c, ctx.now);
    case 'economico':   return (c.priceFrom ?? Infinity) <= ctx.medianPrice;
  }
}

/**
 * Devuelve el deck de una puerta como slots etiquetados (≤ SLOT_ORDER.length).
 * Cada coach aparece una sola vez y ocupa el slot de mayor prioridad para el que
 * califica; los slots sin ningún candidato se omiten (nunca se muestra un coach
 * mal etiquetado).
 *
 * La mediana se calcula sobre la puerta COMPLETA, no sobre lo que queda después
 * de que los slots de arriba consumieron coaches — si no, la barra de "económico"
 * se movería sola según quién ya fue elegido.
 */
export function rankDeck(
  eligible: CachedCoach[],
  userId: string | undefined,
  now: Date = new Date(),
): DeckEntry[] {
  const seed = `${dayKey(now)}:${userId ?? 'anon'}`;
  const shuffled = seededShuffle(eligible, seed);
  const ctx = buildSlotContext(eligible, now);

  const picked = new Set<string>();
  const out: DeckEntry[] = [];

  for (const key of SLOT_ORDER) {
    const coach = shuffled.find(c => !picked.has(c.id) && isEligibleForSlot(key, c, ctx));
    if (!coach) continue;
    picked.add(coach.id);
    out.push({ coach, slot: DECK_SLOTS[key] });
  }

  // Relleno: completar hasta MIN_DECK_SIZE con chips de disponibilidad. Respeta
  // el mismo orden barajado, así que también rota por persona y por día.
  for (const coach of shuffled) {
    if (out.length >= MIN_DECK_SIZE) break;
    if (picked.has(coach.id)) continue;
    picked.add(coach.id);
    out.push({ coach, slot: fallbackSlotFor(coach) });
  }

  return out;
}
