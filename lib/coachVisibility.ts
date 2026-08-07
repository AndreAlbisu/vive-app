import { DOORS, coachesForDoor, type Door } from '@/constants/conexionesDoors';
import {
  DECK_SLOTS,
  SLOT_ORDER,
  buildSlotContext,
  isEligibleForSlot,
  fallbackSlotFor,
  MIN_DECK_SIZE,
  isNewCoach,
  NEW_MAX_REVIEWS,
  NEW_MAX_AGE_DAYS,
  MIN_REBOOKING_SAMPLE,
  MIN_RECOMMEND_RATING,
  MIN_RECOMMEND_REVIEWS,
  MIN_RECOMMEND_REBOOKING,
  MIN_TRENDING_BOOKERS,
  type DeckSlot,
  type DeckSlotKey,
  type SlotContext,
} from './coachDeckRanking';
import type { CachedCoach } from './coachesCache';

// Visibilidad del coach — el espejo de `coachDeckRanking` desde el otro lado.
//
// El deck decide QUÉ coach ocupa cada slot de una puerta. Acá respondemos la
// pregunta inversa, que es la que se hace el coach recién llegado: "de los 4
// lugares de esta puerta, ¿en cuál entro hoy y qué me falta para el siguiente?".
// Sin esto el coach nuevo ve la app vacía y concluye que lo único a su alcance
// es traer clientes de afuera — cuando en realidad dos de los cuatro lugares
// (`nuevo` y `economico`) son alcanzables el día 1 sin tráfico propio.
//
// Los criterios NO se reimplementan acá: se llama a `isEligibleForSlot` del deck,
// así el panel no puede prometer algo que el deck después no cumple. Lo único
// propio de este archivo son los textos que explican la brecha.

export type StandingStatus =
  | 'ganado'     // estás en el pool y sos el único: el lugar es tuyo
  | 'rotando'    // estás en el pool y se sortea entre varios
  | 'bloqueado'; // no llegás a la barra

export type SlotStanding = {
  slot: DeckSlot;
  status: StandingStatus;
  detail: string;
  /** Cuántos coaches de la puerta están en el pool (te incluye si estás). */
  contenders: number;
};

export type DoorStanding = {
  door: Door;
  /** Coaches visibles en la puerta, incluyéndote. */
  total: number;
  slots: SlotStanding[];
  /** Primer slot en orden de prioridad que podés ocupar hoy. */
  best: SlotStanding | null;
  /**
   * El chip de disponibilidad con el que aparecés cuando no ocupás ningún slot
   * de mérito. Siempre hay uno — nadie queda afuera de la puerta.
   */
  fallback: DeckSlot;
};

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  /** `true` = mientras esté sin resolver no aparecés en Conexiones, punto. */
  blocking: boolean;
  hint: string;
  route?: string;
};

export type VisibilitySelf = CachedCoach & {
  availabilityStatus: 'activo' | 'en_pausa';
  hasSlotThisWeek: boolean;
  hasVideo: boolean;
  instantBooking: boolean;
};

function money(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function ageDays(c: CachedCoach, now: Date): number | null {
  if (!c.createdAt) return null;
  return Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000);
}

// ─── Textos ──────────────────────────────────────────────────────────────────
// Qué le falta al coach para cruzar cada barra. La regla de escritura: siempre
// un número concreto y alcanzable, nunca una posición relativa. "Te faltan 2
// reseñas" es accionable; "vas #3 de 7" es una carrera contra gente que él no
// controla, que es justo lo que v3 dejó de ser.

function gapRecomendado(self: VisibilitySelf): string {
  const rating = self.avgRating ?? 0;
  const reviews = self.reviewCount ?? 0;
  const completadas = self.completadasCount ?? 0;

  if (reviews === 0) {
    return `La barra es ${MIN_RECOMMEND_REVIEWS} reseñas con ${MIN_RECOMMEND_RATING}★ o más. Todavía no tenés ninguna.`;
  }
  if (rating < MIN_RECOMMEND_RATING) {
    return `Tenés ${rating.toFixed(1)}★ y la barra está en ${MIN_RECOMMEND_RATING}★.`;
  }
  if (completadas >= MIN_REBOOKING_SAMPLE) {
    return `Con ${completadas} sesiones completadas la barra pasa a ser el reagendamiento: hace falta ${pct(MIN_RECOMMEND_REBOOKING)} y tenés ${pct(self.rebookingRate ?? 0)}.`;
  }
  const faltan = MIN_RECOMMEND_REVIEWS - reviews;
  return `Vas bien de puntaje (${rating.toFixed(1)}★). Te ${faltan === 1 ? 'falta' : 'faltan'} ${plural(faltan, 'reseña', 'reseñas')} para cruzar la barra.`;
}

function gapTendencia(self: VisibilitySelf): string {
  const mine = self.recentBookers ?? 0;
  return mine === 0
    ? `Hace falta que ${MIN_TRENDING_BOOKERS} personas distintas te reserven en 30 días. Hoy tenés 0.`
    : `Vas ${mine} de ${MIN_TRENDING_BOOKERS} personas distintas en los últimos 30 días.`;
}

function gapNuevo(self: VisibilitySelf, now: Date): string {
  const reviews = self.reviewCount ?? 0;
  const days = ageDays(self, now);

  if (reviews >= NEW_MAX_REVIEWS) {
    return `Dejaste de contar como nuevo al llegar a ${NEW_MAX_REVIEWS} reseñas. Ya te toca pelear arriba.`;
  }
  if (days != null && days >= NEW_MAX_AGE_DAYS) {
    return `La ventana de recién llegado dura ${NEW_MAX_AGE_DAYS} días y ya llevás ${days}.`;
  }
  return 'No podemos calcular tu antigüedad, así que este lugar queda cerrado. Avisanos si te pasa.';
}

function gapEconomico(self: VisibilitySelf, ctx: SlotContext): string {
  const mine = self.priceFrom ?? 0;
  const diff = mine - ctx.medianPrice;
  return `La mediana de la puerta está en ${money(ctx.medianPrice)} y cobrás ${money(mine)}. Entrás bajando ${money(diff)}.`;
}

function gapFor(key: DeckSlotKey, self: VisibilitySelf, ctx: SlotContext): string {
  switch (key) {
    case 'recomendado': return gapRecomendado(self);
    case 'tendencia':   return gapTendencia(self);
    case 'nuevo':       return gapNuevo(self, ctx.now);
    case 'economico':   return gapEconomico(self, ctx);
  }
}

function inPoolDetail(key: DeckSlotKey, self: VisibilitySelf, rivals: number, ctx: SlotContext): string {
  const share = rivals === 0
    ? 'Sos el único que califica: el lugar es tuyo.'
    : `Se sortea entre ${rivals + 1}: te ve ≈1 de cada ${rivals + 1} personas que abren la puerta.`;

  switch (key) {
    case 'recomendado':
      return `Cumplís la barra de calidad. ${share}`;
    case 'tendencia':
      return `${plural(self.recentBookers ?? 0, 'persona distinta te reservó', 'personas distintas te reservaron')} en 30 días. ${share}`;
    case 'nuevo': {
      const days = ageDays(self, ctx.now);
      const left = days == null ? null : NEW_MAX_AGE_DAYS - days;
      const window = left != null && left > 0 ? ` Te ${left === 1 ? 'queda' : 'quedan'} ${plural(left, 'día', 'días')} de ventana.` : '';
      return `${share}${window}`;
    }
    case 'economico':
      return `${money(self.priceFrom)} queda por debajo de la mediana de la puerta (${money(ctx.medianPrice)}). ${share}`;
  }
}

// ─── Análisis ────────────────────────────────────────────────────────────────

/**
 * Standing del coach en cada puerta donde sus temas lo meten.
 * `pool` es el catálogo visible (verified + activo) — puede o no incluirlo a él.
 */
export function analyzeDoors(
  self: VisibilitySelf,
  pool: CachedCoach[],
  now: Date = new Date(),
): DoorStanding[] {
  const others = pool.filter(c => c.id !== self.id);

  return DOORS
    .filter(door => door.subtemas.some(t => self.topics.includes(t)))
    .map(door => {
      const rivals = coachesForDoor(door, others);
      // El contexto se arma con la puerta completa incluyéndolo a él, igual que
      // en rankDeck — si no, la mediana que ve el coach no es la que se aplica.
      const ctx = buildSlotContext([self as CachedCoach, ...rivals], now);

      const slots = SLOT_ORDER.map<SlotStanding>(key => {
        const inPool = isEligibleForSlot(key, self as CachedCoach, ctx);
        const rivalsInPool = rivals.filter(c => isEligibleForSlot(key, c, ctx)).length;

        if (!inPool) {
          return { slot: DECK_SLOTS[key], status: 'bloqueado', contenders: rivalsInPool, detail: gapFor(key, self, ctx) };
        }
        return {
          slot: DECK_SLOTS[key],
          status: rivalsInPool === 0 ? 'ganado' : 'rotando',
          contenders: rivalsInPool + 1,
          detail: inPoolDetail(key, self, rivalsInPool, ctx),
        };
      });

      const best = slots.find(s => s.status !== 'bloqueado') ?? null;
      return { door, total: rivals.length + 1, slots, best, fallback: fallbackSlotFor(self as CachedCoach) };
    });
}

/** Lo que el coach controla sin depender de nadie, ordenado por impacto. */
export function buildChecklist(self: VisibilitySelf): ChecklistItem[] {
  return [
    {
      key: 'verified',
      label: 'Postulación aprobada',
      done: !!self.verified,
      blocking: true,
      hint: 'Está en revisión de nuestro lado. Hasta que se apruebe no aparecés en Conexiones.',
    },
    {
      key: 'activo',
      label: 'Perfil activo',
      done: self.availabilityStatus === 'activo',
      blocking: true,
      hint: 'Estás en pausa: no aparecés en ninguna búsqueda ni puerta.',
      route: '/perfil',
    },
    {
      key: 'topics',
      label: 'Temas que trabajás',
      done: self.topics.length > 0,
      blocking: true,
      hint: 'Sin temas no entrás en ninguna puerta. Es la decisión que más mueve la aguja: elegí donde puedas ser visible, no donde haya más coaches.',
      route: '/coach-topics',
    },
    {
      key: 'price',
      label: 'Precio por sesión',
      done: (self.priceFrom ?? 0) > 0,
      blocking: true,
      hint: 'Además de habilitar la reserva, define si entrás al lugar de "Opción económica".',
      route: '/perfil',
    },
    {
      key: 'availability',
      label: 'Horarios libres esta semana',
      done: self.hasSlotThisWeek,
      blocking: false,
      hint: 'Sin huecos en los próximos 7 días figurás como "responde en 24h" en vez de "con lugar esta semana".',
      route: '/coach-weekly-pattern',
    },
    {
      key: 'bio',
      label: 'Presentación escrita',
      done: !!self.bio && self.bio.trim().length > 0,
      blocking: false,
      hint: 'No cambia el sorteo, cambia la conversión: es lo primero que se lee cuando el deck ya te mostró.',
      route: '/perfil',
    },
    {
      key: 'avatar',
      label: 'Foto de perfil',
      done: !!self.avatarUrl,
      blocking: false,
      hint: 'Un perfil sin foto pierde contra uno con foto en el mismo lugar.',
      route: '/perfil',
    },
    {
      key: 'video',
      label: 'Video de presentación',
      done: self.hasVideo,
      blocking: false,
      hint: 'Es lo que más acelera la primera reserva, y la primera reserva es lo que abre los lugares de arriba.',
      route: '/perfil',
    },
    {
      key: 'instant',
      label: 'Reserva instantánea',
      done: self.instantBooking,
      blocking: false,
      hint: 'Saca el paso de aceptación manual: la persona reserva y queda confirmada.',
      route: '/perfil',
    },
  ];
}

/** Motivo por el que hoy no aparece en ningún lado, o `null` si es visible. */
export function blockingReason(items: ChecklistItem[]): ChecklistItem | null {
  return items.find(i => i.blocking && !i.done) ?? null;
}

export type VisibilityTeaser = { doorCount: number; blocked: ChecklistItem | null };

/**
 * Resumen para la card del home del coach: solo lo que se resuelve con dos
 * queries baratas. Los ítems no bloqueantes se asumen resueltos porque
 * `blockingReason` no los mira — la pantalla completa hace el cálculo real.
 */
export function visibilityTeaser(args: {
  verified: boolean;
  availabilityStatus: 'activo' | 'en_pausa';
  topics: string[];
  price: number | null;
}): VisibilityTeaser {
  const partial = {
    verified: args.verified,
    availabilityStatus: args.availabilityStatus,
    topics: args.topics,
    priceFrom: args.price ?? 0,
    hasSlotThisWeek: true,
    bio: 'x',
    avatarUrl: 'x',
    hasVideo: true,
    instantBooking: true,
  } as VisibilitySelf;

  return {
    doorCount: DOORS.filter(d => d.subtemas.some(t => args.topics.includes(t))).length,
    blocked: blockingReason(buildChecklist(partial)),
  };
}

// Re-export para que la pantalla no tenga que importar del deck directamente.
export { isNewCoach, NEW_MAX_REVIEWS, NEW_MAX_AGE_DAYS, MIN_DECK_SIZE };
