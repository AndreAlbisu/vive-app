import { supabase } from './supabase';

export type CachedCoach = {
  id: string;
  name: string;
  specialty: string;
  priceFrom: number;
  nationality: string;
  gender: string;
  avatarUrl: string | null;
  topics: string[];
};

let cache: CachedCoach[] | null = null;
let inflight: PromiseLike<void> | null = null;

export function prefetchCoaches(): void {
  if (cache || inflight) return;
  inflight = supabase
    .from('coaches')
    .select('id, specialty, price_per_session, nationality, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
    .eq('verified', true)
    .limit(50)
    .then(({ data }) => {
      cache = (data ?? []).map((c: any) => {
        const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: profile?.id as string,
          name: profile?.name as string,
          specialty: c.specialty as string,
          priceFrom: c.price_per_session as number,
          nationality: (c.nationality ?? '') as string,
          gender: (profile?.gender ?? '') as string,
          avatarUrl: (profile?.avatar_url ?? null) as string | null,
          topics: (c.coach_topics ?? []).map((t: any) => t.topic as string),
        };
      });
      inflight = null;
    });
}

export function getCoachesCache(): CachedCoach[] | null {
  return cache;
}

export function invalidateCoachesCache(): void {
  cache = null;
  inflight = null;
}
