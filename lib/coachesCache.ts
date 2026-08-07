import { supabase } from './supabase';

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
  avgRating?: number | null;
  reviewCount?: number;
  // Ranking del deck de Conexiones (criterio v1)
  coachId?: string;             // coaches.id — clave para joins (coach_rebooking_stats)
  createdAt?: string | null;    // coaches.created_at — para "nuevo" por antigüedad
  rebookingRate?: number | null; // coach_rebooking_stats.rebooking_rate (null si <5 completadas)
  completadasCount?: number;     // coach_rebooking_stats.completadas_count
  recentBookers?: number;        // coach_trending_stats.recent_bookers (usuarios distintos, 30d)
};

let cache: CachedCoach[] | null = null;
let inflight: Promise<void> | null = null;

async function _doFetch(): Promise<void> {
  const { data, error } = await supabase
    .from('coaches')
    .select('id, created_at, specialty, bio, price_per_session, nationality, verified, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
    .eq('verified', true)
    .eq('availability_status', 'activo')
    .limit(50);

  if (error) { console.error('[coachesCache] fetch:', error.message); cache = []; return; }

  const initial: CachedCoach[] = (data ?? []).map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id:          profile?.id as string,
      coachId:     c.id as string,               // coaches.id (clave del rate de reagendamiento)
      createdAt:   (c.created_at ?? null) as string | null,
      name:        profile?.name as string,
      specialty:   c.specialty as string,
      priceFrom:   c.price_per_session as number,
      nationality: (c.nationality ?? '') as string,
      gender:      (profile?.gender ?? '') as string,
      avatarUrl:   (profile?.avatar_url ?? null) as string | null,
      bio:         (c.bio ?? null) as string | null,
      topics:      (c.coach_topics ?? []).map((t: any) => t.topic as string),
      verified:    !!(c.verified),
      avgRating:   null,
      reviewCount: 0,
      rebookingRate:    null,
      completadasCount: 0,
      recentBookers:    0,
    };
  });

  const profileIds = initial.map(c => c.id).filter(Boolean);
  const coachIds   = initial.map(c => c.coachId).filter(Boolean) as string[];

  // Agregados en paralelo: rating (reviews públicas) + reagendamiento + tendencia (vistas server-side).
  const [reviewsRes, rebookRes, trendRes] = await Promise.all([
    profileIds.length
      ? supabase.from('reviews').select('reviewed_id, rating').in('reviewed_id', profileIds).eq('is_private', false)
      : Promise.resolve({ data: [] as any[] }),
    coachIds.length
      ? supabase.from('coach_rebooking_stats').select('coach_id, rebooking_rate, completadas_count').in('coach_id', coachIds)
      : Promise.resolve({ data: [] as any[] }),
    coachIds.length
      ? supabase.from('coach_trending_stats').select('coach_id, recent_bookers').in('coach_id', coachIds)
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
    };
  });
}

export function prefetchCoaches(): void {
  if (cache || inflight) return;
  inflight = _doFetch().finally(() => { inflight = null; });
}

export function getCoachesCache(): CachedCoach[] | null {
  return cache;
}

/** Igual que prefetch pero esperable — evita el poll con setInterval del lado del consumidor. */
export async function loadCoaches(): Promise<CachedCoach[]> {
  if (cache) return cache;
  const p = inflight ?? (inflight = _doFetch().finally(() => { inflight = null; }));
  await p;
  return cache ?? [];
}

export function invalidateCoachesCache(): void {
  cache = null;
  inflight = null;
}
