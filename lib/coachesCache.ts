import { supabase } from './supabase';

export type CachedCoach = {
  id: string;           // profiles.id (= coaches.profile_id)
  name: string;
  specialty: string;
  priceFrom: number;
  nationality: string;
  gender: string;
  avatarUrl: string | null;
  topics: string[];
  // Extended fields — present when loaded via prefetchCoaches, optional for
  // screens that build CachedCoach inline (e.g. search3 fallback query)
  verified?: boolean;
  avgRating?: number | null;
  reviewCount?: number;
};

let cache: CachedCoach[] | null = null;
let inflight: Promise<void> | null = null;

async function _doFetch(): Promise<void> {
  const { data, error } = await supabase
    .from('coaches')
    .select('id, specialty, price_per_session, nationality, verified, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
    .eq('verified', true)
    .eq('availability_status', 'activo')
    .limit(50);

  if (error) { console.error('[coachesCache] fetch:', error.message); cache = []; return; }

  const initial: CachedCoach[] = (data ?? []).map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id:          profile?.id as string,
      name:        profile?.name as string,
      specialty:   c.specialty as string,
      priceFrom:   c.price_per_session as number,
      nationality: (c.nationality ?? '') as string,
      gender:      (profile?.gender ?? '') as string,
      avatarUrl:   (profile?.avatar_url ?? null) as string | null,
      topics:      (c.coach_topics ?? []).map((t: any) => t.topic as string),
      verified:    !!(c.verified),
      avgRating:   null,
      reviewCount: 0,
    };
  });

  // Batch fetch review aggregates (1 extra query for all coaches)
  const profileIds = initial.map(c => c.id).filter(Boolean);
  if (profileIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('reviewed_id, rating')
      .in('reviewed_id', profileIds)
      .eq('is_private', false);

    const ratingsByCoach: Record<string, number[]> = {};
    (reviewRows ?? []).forEach(r => {
      const key = r.reviewed_id as string;
      if (!ratingsByCoach[key]) ratingsByCoach[key] = [];
      ratingsByCoach[key].push(r.rating as number);
    });

    cache = initial.map(c => {
      const ratings = ratingsByCoach[c.id] ?? [];
      const reviewCount = ratings.length;
      const avgRating = reviewCount > 0
        ? ratings.reduce((a, b) => a + b, 0) / reviewCount
        : null;
      return { ...c, avgRating, reviewCount };
    });
  } else {
    cache = initial;
  }
}

export function prefetchCoaches(): void {
  if (cache || inflight) return;
  inflight = _doFetch().finally(() => { inflight = null; });
}

export function getCoachesCache(): CachedCoach[] | null {
  return cache;
}

export function invalidateCoachesCache(): void {
  cache = null;
  inflight = null;
}
