import { DOORS, coachesForDoor, type Door } from '@/constants/conexionesDoors';
import {
  DECK_SLOTS,
  SLOT_ORDER,
  isNewCoach,
  NEW_MAX_REVIEWS,
  NEW_MAX_AGE_DAYS,
  type DeckSlot,
  type DeckSlotKey,
} from './coachDeckRanking';
import type { CachedCoach } from './coachesCache';

// Visibilidad del coach — el espejo de `coachDeckRanking` desde el otro lado.
//
// El deck decide QUÉ coach ocupa cada slot de una puerta. Acá respondemos la
// pregunta inversa, que es la que se hace el coach recién llegado: "de los 4
// slots de esta puerta, ¿en cuál puedo entrar hoy y qué me falta para el
// siguiente?". Sin esto el coach nuevo ve la app vacía y concluye que lo único
// que puede hacer es traer clientes de afuera — cuando en realidad dos de los
// cuatro slots (`nuevo` y `economico`) son ganables el día 1 sin tráfico propio.
//
// Aproximación conocida: el ranking de cada slot se calcula sobre TODA la puerta,
// pero `rankDeck` consume coaches en orden de prioridad (quien gana `recomendado`
// ya no compite por `economico`). O sea que la posición real del coach en los
// slots bajos es igual o MEJOR que la que mostramos. Preferimos subestimar antes
// que prometer un slot que después no aparece.

export type StandingStatus =
  | 'ganado'     // sos el pick determinístico de ese slot
  | 'rotando'    // elegible y empatado: la rotación diaria reparte el slot
  | 'compite'    // elegible pero hay alguien adelante
  | 'bloqueado'; // no cumplís el requisito del slot

export type SlotStanding = {
  slot: DeckSlot;
  status: StandingStatus;
  detail: string;
  /** Cuántos coaches de la puerta califican para el slot (te incluye si calificás). */
  contenders: number;
};

export type DoorStanding = {
  door: Door;
  /** Coaches visibles en la puerta, incluyéndote. */
  total: number;
  slots: SlotStanding[];
  /** Primer slot en orden de prioridad que podés ocupar hoy (`ganado` o `rotando`). */
  best: SlotStanding | null;
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
  return n == null ? '—' : `$${n.toLocaleString('es-AR')}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ─── Standing por slot ───────────────────────────────────────────────────────

function standRecomendado(self: VisibilitySelf, others: CachedCoach[]): SlotStanding {
  const slot = DECK_SLOTS.recomendado;
  const mine = self.reviewCount ?? 0;
  const rivals = others.filter(c => (c.reviewCount ?? 0) >= 1);

  if (mine < 1) {
    return {
      slot,
      status: 'bloqueado',
      contenders: rivals.length,
      detail: rivals.length === 0
        ? 'Nadie en esta puerta tiene reseñas todavía: el slot está vacío y lo abre tu primera reseña.'
        : `Necesitás tu primera reseña pública. Hoy compiten ${plural(rivals.length, 'coach', 'coaches')}.`,
    };
  }

  const ranked = [self as CachedCoach, ...rivals].sort((a, b) =>
    ((b.avgRating ?? 0) - (a.avgRating ?? 0)) ||
    ((b.reviewCount ?? 0) - (a.reviewCount ?? 0)),
  );
  const pos = ranked.findIndex(c => c.id === self.id) + 1;
  const mineRating = (self.avgRating ?? 0).toFixed(1);

  if (pos === 1) {
    return {
      slot,
      status: 'ganado',
      contenders: ranked.length,
      detail: `Sos el mejor puntuado de la puerta: ${mineRating} ★ sobre ${plural(mine, 'reseña', 'reseñas')}.`,
    };
  }
  const top = ranked[0];
  return {
    slot,
    status: 'compite',
    contenders: ranked.length,
    detail: `Vas #${pos} de ${ranked.length} con ${mineRating} ★. El primero está en ${(top.avgRating ?? 0).toFixed(1)} ★.`,
  };
}

function standTendencia(self: VisibilitySelf, others: CachedCoach[]): SlotStanding {
  const slot = DECK_SLOTS.tendencia;
  const mine = self.recentBookers ?? 0;
  const rivals = others.filter(c => (c.recentBookers ?? 0) > 0);

  if (mine < 1) {
    return {
      slot,
      status: 'bloqueado',
      contenders: rivals.length,
      detail: 'Cuenta la gente distinta que te reservó en los últimos 30 días. Hoy tenés 0.',
    };
  }

  const ranked = [self as CachedCoach, ...rivals].sort((a, b) =>
    ((b.recentBookers ?? 0) - (a.recentBookers ?? 0)) ||
    ((b.avgRating ?? 0) - (a.avgRating ?? 0)),
  );
  const pos = ranked.findIndex(c => c.id === self.id) + 1;

  if (pos === 1) {
    return {
      slot,
      status: 'ganado',
      contenders: ranked.length,
      detail: `${plural(mine, 'persona distinta te reservó', 'personas distintas te reservaron')} en 30 días — el máximo de la puerta.`,
    };
  }
  return {
    slot,
    status: 'compite',
    contenders: ranked.length,
    detail: `Vas #${pos} de ${ranked.length} con ${plural(mine, 'reserva', 'reservas')} de gente distinta. El primero tiene ${ranked[0].recentBookers ?? 0}.`,
  };
}

function standNuevo(self: VisibilitySelf, others: CachedCoach[], now: Date): SlotStanding {
  const slot = DECK_SLOTS.nuevo;

  if (!isNewCoach(self, now)) {
    return {
      slot,
      status: 'bloqueado',
      contenders: others.filter(c => isNewCoach(c, now)).length,
      detail: `Ya pasaste las ${NEW_MAX_REVIEWS} reseñas y los ${NEW_MAX_AGE_DAYS} días: ahora te toca pelear arriba.`,
    };
  }

  const rivals = others.filter(c => isNewCoach(c, now)).length;
  // El pool ya viene barajado por `${día}:${userId}` en rankDeck, así que entre
  // los nuevos la rotación es por persona-y-día, no por día global.
  if (rivals === 0) {
    return {
      slot,
      status: 'ganado',
      contenders: 1,
      detail: 'Sos el único coach nuevo de esta puerta: el slot es tuyo hasta que llegue otro.',
    };
  }
  return {
    slot,
    status: 'rotando',
    contenders: rivals + 1,
    detail: `Rotás con ${plural(rivals, 'coach nuevo', 'coaches nuevos')}: te ve ≈1 de cada ${rivals + 1} personas que abren la puerta.`,
  };
}

function standEconomico(self: VisibilitySelf, others: CachedCoach[]): SlotStanding {
  const slot = DECK_SLOTS.economico;
  const all = [self as CachedCoach, ...others];

  // Mismo criterio que pickForSlot: precio asc, y el puntaje desempata.
  const ranked = [...all].sort((a, b) =>
    ((a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity)) ||
    ((b.avgRating ?? 0) - (a.avgRating ?? 0)),
  );
  const pos = ranked.findIndex(c => c.id === self.id) + 1;
  const cheapest = ranked[0];

  if (pos === 1) {
    const tied = others.filter(c => c.priceFrom === self.priceFrom).length;
    return {
      slot,
      status: 'ganado',
      contenders: all.length,
      detail: tied === 0
        ? `Sos la opción más accesible de la puerta con ${money(self.priceFrom)}.`
        : `Empatás en ${money(self.priceFrom)} con ${plural(tied, 'coach', 'coaches')} y ganás el desempate por puntaje.`,
    };
  }

  const gap = (self.priceFrom ?? 0) - (cheapest.priceFrom ?? 0);
  return {
    slot,
    status: 'compite',
    contenders: all.length,
    detail: `Vas #${pos} de ${all.length}. El más accesible está en ${money(cheapest.priceFrom)}, ${money(gap)} por debajo tuyo.`,
  };
}

function standingForSlot(
  key: DeckSlotKey,
  self: VisibilitySelf,
  others: CachedCoach[],
  now: Date,
): SlotStanding {
  switch (key) {
    case 'recomendado': return standRecomendado(self, others);
    case 'tendencia':   return standTendencia(self, others);
    case 'nuevo':       return standNuevo(self, others, now);
    case 'economico':   return standEconomico(self, others);
  }
}

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
      const slots = SLOT_ORDER.map(key => standingForSlot(key, self, rivals, now));
      const best = slots.find(s => s.status === 'ganado' || s.status === 'rotando') ?? null;
      return { door, total: rivals.length + 1, slots, best };
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
      hint: 'Además de habilitar la reserva, define si entrás al slot "Opción económica".',
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
      hint: 'No cambia el ranking, cambia la conversión: es lo primero que se lee cuando el deck ya te mostró.',
      route: '/perfil',
    },
    {
      key: 'avatar',
      label: 'Foto de perfil',
      done: !!self.avatarUrl,
      blocking: false,
      hint: 'Un perfil sin foto pierde contra uno con foto en el mismo slot.',
      route: '/perfil',
    },
    {
      key: 'video',
      label: 'Video de presentación',
      done: self.hasVideo,
      blocking: false,
      hint: 'Es lo que más acelera la primera reserva, y la primera reserva es lo que abre los slots de arriba.',
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
