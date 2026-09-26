import { supabase } from './supabase';
import { etiquetaProfesionalPublica } from './tipoProfesional';

export type CachedCoach = {
  id: string;           // profiles.id (= coaches.profile_id)
  name: string;
  specialty: string;
  priceFrom: number;
  nationality: string;
  gender: string;
  avatarUrl: string | null;
  bio: string | null;   // presentación breve del coach (coaches.bio)
  topics: string[];
  // Extended fields — present when loaded via prefetchCoaches, optional for
  // screens that build CachedCoach inline (e.g. search3 fallback query)
  verified?: boolean;
  /** Tiene una matrícula VERIFICADA por Vita (`coaches.has_matricula`, derivada
   *  por trigger de `coach_credentials`). NO dice de qué profesión: el título es
   *  texto libre y una matrícula puede ser de psicología, nutrición u otra cosa.
   *  Solo dice que hay una y que Vita la chequeó. */
  hasMatricula?: boolean;
  /** De qué profesión es la matrícula verificada (`coaches.profesion`, derivada
   *  por la base). Lo único que decide "Psicólogo"/"Nutricionista". */
  profesion?: 'psicologia' | 'nutricion' | null;
  avgRating?: number | null;
  reviewCount?: number;
  // Ranking del deck de Conexiones (criterio v1)
  coachId?: string;             // coaches.id — clave para joins (coach_rebooking_stats)
  createdAt?: string | null;    // coaches.created_at — para "nuevo" por antigüedad
  rebookingRate?: number | null; // coach_rebooking_stats.rebooking_rate (null si <5 completadas)
  completadasCount?: number;     // coach_rebooking_stats.completadas_count
  recentBookers?: number;        // coach_trending_stats.recent_bookers (usuarios distintos, 30d)
  hasSlotThisWeek?: boolean;     // coach_availability_status.status = 'this_week' — criterio del slot de relleno
  /** Atiende a gente de fuera de Argentina, cobrando en dólares. **No cambia
   *  sus horarios** (atiende en las mismas franjas; el que se acomoda es el
   *  usuario), cambia el cobro. Ya NO implica USDT: desde D4 el riel puede ser
   *  PayPal, USDT o los dos — mirá `acceptsPaypal` / `acceptsUsdt`. */
  acceptsInternational?: boolean;
  /** 🔴 Los rieles por los que el coach acepta COBRAR. Con la regla espejo (D4)
   *  a quien reserva se le ofrecen solo estos, así que el catálogo tiene que
   *  conocerlos: sin ellos alguien del exterior que solo puede pagar con PayPal
   *  llega hasta la pantalla de confirmar para enterarse de que ese coach solo
   *  toma USDT. `acceptsMp` es el riel en pesos (`coaches.mp_connected`). */
  acceptsMp?: boolean;
  acceptsPaypal?: boolean;
  acceptsUsdt?: boolean;
  /** Precio de la sesión internacional, en USD enteros. Lo fija el coach y NO
   *  se deriva de una cotización. */
  priceUsd?: number | null;
  /** M14: cómo acompaña, en palabras de la persona (`coaches.estilo`). El quiz
   *  lo usa para ordenar y explicar, nunca para filtrar. Null = no contestó. */
  estilo?: string | null;
  /** M14: las escuelas, con su nombre técnico (`coaches.enfoques`). A la
   *  persona no se le pregunta por esto. Desde el 21/09 el quiz usa la
   *  tendencia de la escuela cuando el profesional no contestó estilo, guía o
   *  foco (`lib/enfoque.ts`). */
  enfoques?: string[];
  /** M14: cuánto conduce el proceso (`coaches.guia`). Null = no contestó. */
  guia?: string | null;
  /** M14: hacia dónde mira el trabajo (`coaches.focos`). */
  focos?: string[];
};

let cache: CachedCoach[] | null = null;
let inflight: Promise<void> | null = null;
/** Cuándo falló la última carga (ms), o null si no falló. 🔴 Antes un error
 *  guardaba `cache = []` y eso quedaba para siempre en el proceso: la persona
 *  veía "no hay profesionales" hasta reiniciar la app, cuando el problema era
 *  la conexión (auditoría del 26/09/2026, C6). Ahora un error deja el cache en
 *  null, se puede distinguir de un catálogo vacío y se reintenta. */
let lastFailAt: number | null = null;
/** Entre reintentos automáticos. Un reintento pedido por la persona no espera. */
const REINTENTO_MS = 5_000;

async function _doFetch(): Promise<void> {
  const { data, error } = await supabase
    .from('coaches')
    .select('id, created_at, specialty, bio, price_per_session, nationality, verified, has_matricula, profesion, accepts_international, accepts_paypal, accepts_usdt, mp_connected, price_usd, estilo, enfoques, guia, focos, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
    .eq('verified', true)
    .eq('availability_status', 'activo')
    // D6 (docs/decisiones-pagos.md): para aparecer en el catálogo hace falta
    // al menos UN riel de cobro configurado — no exige Mercado Pago puntual,
    // exige un medio, cualquiera. Sin esto un coach recién aprobado y sin
    // conectar nada llegaba hasta acá y solo se notaba en el checkout, cuatro
    // pantallas después. Debe reflejar la MISMA condición que usa
    // `BookingScreen_Confirm` para decidir qué botón de pago dibujar.
    .or('mp_connected.eq.true,accepts_paypal.eq.true,accepts_usdt.eq.true')
    // 🔴 Un coach suspendido no aparece. El filtro va con la hora del CLIENTE
    // porque PostgREST no evalúa `now()` — no es la defensa, es la UX: la
    // defensa real es `trg_block_bookings_coach_suspendido`, que rebota la
    // reserva del lado del servidor aunque alguien llegue por un link guardado
    // o por una consulta hecha a mano.
    .or(`suspendido_hasta.is.null,suspendido_hasta.lt.${new Date().toISOString()}`)
    // El `.limit()` estaba sin `order`: Postgres devolvía N filas ARBITRARIAS, así
    // que pasado el tope algunos coaches simplemente no existían para Conexiones —
    // y cuáles podía cambiar entre consultas. Con el deck v3 (pools + sorteo) eso
    // además sesgaba los pools en silencio. El orden lo vuelve determinístico.
    // Arreglo de fondo pendiente: traer por puerta desde el server en vez de
    // bajarse el catálogo entero al cliente.
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) { console.error('[coachesCache] fetch:', error.message); lastFailAt = Date.now(); return; }
  lastFailAt = null;

  const initial: CachedCoach[] = (data ?? []).map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id:          profile?.id as string,
      coachId:     c.id as string,               // coaches.id (clave del rate de reagendamiento)
      createdAt:   (c.created_at ?? null) as string | null,
      name:        profile?.name as string,
      specialty:   etiquetaProfesionalPublica(c),
      priceFrom:   c.price_per_session as number,
      nationality: (c.nationality ?? '') as string,
      gender:      (profile?.gender ?? '') as string,
      avatarUrl:   (profile?.avatar_url ?? null) as string | null,
      bio:         (c.bio ?? null) as string | null,
      topics:      (c.coach_topics ?? []).map((t: any) => t.topic as string),
      verified:    !!(c.verified),
      hasMatricula: !!(c.has_matricula),
      profesion:   (c.profesion ?? null) as CachedCoach['profesion'],
      // ⚠️ Los dos van juntos y no por separado: `usdt-create-payment` rechaza
      // el cobro si falta el precio en dólares, así que un coach con el flag
      // prendido y sin precio NO puede recibir una reserva del exterior. Es la
      // misma condición que usa `BookingScreen_Confirm` para dibujar el botón
      // de USDT — si el filtro de búsqueda usara otra, prometería en el
      // catálogo algo que la pantalla de pago después no ofrece.
      acceptsInternational: !!(c.accepts_international) && c.price_usd != null,
      acceptsMp: !!(c as any).mp_connected,
      // 🔴 PayPal y USDT van atados a `price_usd`, igual que
      // `acceptsInternational` arriba y que `ProfesionalScreen`: sin precio en
      // dólares `paypal-create-payment`/`usdt-create-payment` rechazan el
      // cobro, así que el cartelito del deck y del buscador estaría anunciando
      // un medio que el checkout no ofrece. Hay coaches hoy con el riel en
      // `true` y `price_usd` en null.
      acceptsPaypal: !!(c as any).accepts_paypal && c.price_usd != null,
      acceptsUsdt: !!(c as any).accepts_usdt && c.price_usd != null,
      priceUsd:    (c.price_usd ?? null) as number | null,
      estilo:      ((c as any).estilo ?? null) as string | null,
      enfoques:    (((c as any).enfoques ?? []) as string[]),
      guia:        ((c as any).guia ?? null) as string | null,
      focos:       (((c as any).focos ?? []) as string[]),
      avgRating:   null,
      reviewCount: 0,
      rebookingRate:    null,
      completadasCount: 0,
      recentBookers:    0,
    };
  });

  const profileIds = initial.map(c => c.id).filter(Boolean);
  const coachIds   = initial.map(c => c.coachId).filter(Boolean) as string[];

  // Agregados en paralelo: rating (reviews públicas) + reagendamiento + tendencia
  // + disponibilidad (vistas server-side).
  const [reviewsRes, rebookRes, trendRes, availRes] = await Promise.all([
    profileIds.length
      ? supabase.from('reviews').select('reviewed_id, rating').in('reviewed_id', profileIds).eq('is_private', false)
      : Promise.resolve({ data: [] as any[] }),
    coachIds.length
      ? supabase.from('coach_rebooking_stats').select('coach_id, rebooking_rate, completadas_count').in('coach_id', coachIds)
      : Promise.resolve({ data: [] as any[] }),
    coachIds.length
      ? supabase.from('coach_trending_stats').select('coach_id, recent_bookers').in('coach_id', coachIds)
      : Promise.resolve({ data: [] as any[] }),
    coachIds.length
      ? supabase.from('coach_availability_status').select('coach_id, status').in('coach_id', coachIds).eq('status', 'this_week')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const ratingsByCoach: Record<string, number[]> = {};
  (reviewsRes.data ?? []).forEach((r: any) => {
    const key = r.reviewed_id as string;
    if (!ratingsByCoach[key]) ratingsByCoach[key] = [];
    ratingsByCoach[key].push(r.rating as number);
  });

  const rebookByCoach: Record<string, { rate: number | null; completed: number }> = {};
  (rebookRes.data ?? []).forEach((r: any) => {
    rebookByCoach[r.coach_id as string] = {
      rate:      (r.rebooking_rate ?? null) as number | null,
      completed: (r.completadas_count ?? 0) as number,
    };
  });

  const trendByCoach: Record<string, number> = {};
  (trendRes.data ?? []).forEach((r: any) => {
    trendByCoach[r.coach_id as string] = (r.recent_bookers ?? 0) as number;
  });

  // La query ya viene filtrada por status='this_week', así que estar en el set alcanza.
  const availableThisWeek = new Set<string>((availRes.data ?? []).map((r: any) => r.coach_id as string));

  cache = initial.map(c => {
    const ratings = ratingsByCoach[c.id] ?? [];
    const reviewCount = ratings.length;
    const avgRating = reviewCount > 0
      ? ratings.reduce((a, b) => a + b, 0) / reviewCount
      : null;
    const rb = c.coachId ? rebookByCoach[c.coachId] : undefined;
    return {
      ...c,
      avgRating,
      reviewCount,
      rebookingRate:    rb?.rate ?? null,
      completadasCount: rb?.completed ?? 0,
      recentBookers:    (c.coachId ? trendByCoach[c.coachId] : 0) ?? 0,
      hasSlotThisWeek:  !!c.coachId && availableThisWeek.has(c.coachId),
    };
  });
}

function arrancar(): Promise<void> {
  return inflight ?? (inflight = _doFetch()
    .catch(e => { console.error('[coachesCache] fetch:', e); lastFailAt = Date.now(); })
    .finally(() => { inflight = null; }));
}

/** Dispara la carga si hace falta. Después de un error espera `REINTENTO_MS`
 *  antes de reintentar solo, así los que llaman en un poll no martillan la red
 *  sin conexión; `force` (el botón "Reintentar") no espera. */
export function prefetchCoaches(force = false): void {
  if (cache || inflight) return;
  if (!force && lastFailAt !== null && Date.now() - lastFailAt < REINTENTO_MS) return;
  void arrancar();
}

/** 'error' = la última carga falló y no hay nada cargado. No es lo mismo que
 *  un catálogo vacío, que es 'ok' con cero profesionales. */
export function getCoachesStatus(): 'ok' | 'cargando' | 'error' {
  if (cache) return 'ok';
  if (!inflight && lastFailAt !== null) return 'error';
  return 'cargando';
}

export function getCoachesCache(): CachedCoach[] | null {
  return cache;
}

/** Igual que prefetch pero esperable — evita el poll con setInterval del lado del consumidor. */
export async function loadCoaches(): Promise<CachedCoach[]> {
  if (cache) return cache;
  await arrancar();
  // Si falló, [] para este llamado, pero no queda cacheado: el próximo reintenta.
  return cache ?? [];
}

export function invalidateCoachesCache(): void {
  cache = null;
  inflight = null;
  lastFailAt = null;
}
