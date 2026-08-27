import { supabase } from '@/lib/supabase';
import { loadCoaches, type CachedCoach } from '@/lib/coachesCache';
import type { VisibilitySelf } from '@/lib/coachVisibility';

// Arma el `VisibilitySelf` real de un coach — el retrato completo que necesitan
// `analyzeDoors` y `buildChecklist` para decidir en qué lugares entra.
//
// 🔴 Vive acá y no adentro de una pantalla porque lo usan DOS: el panel
// (`CoachVisibilityScreen`) y la tarjeta de la Home. Mientras estuvo inline en el
// panel, la Home no tenía forma de pedirlo sin copiar siete consultas, y por eso
// se conformaba con `visibilityTeaser` — que da un conteo de puertas en vez del
// lugar que ocupa. Duplicarlo habría dejado dos retratos del mismo coach que
// pueden divergir en silencio: la Home diciendo una cosa y el panel otra, a un
// tap de distancia.
//
// ⚠️ Es caro a propósito (7 consultas + el catálogo). El catálogo sale de
// `loadCoaches`, que cachea en memoria y se puede calentar antes con
// `prefetchCoaches()`.
export type VisibilityData = { self: VisibilitySelf; pool: CachedCoach[]; coachId: string };

export async function loadVisibilitySelf(userId: string): Promise<VisibilityData | null> {
  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id, created_at, specialty, bio, price_per_session, nationality, verified, availability_status, video_url, instant_booking')
    .eq('profile_id', userId)
    .maybeSingle();

  if (!coachRow) return null;

  const coachId = coachRow.id as string;

  const [{ data: profile }, { data: topicRows }, { data: reviewRows }, { data: trendRows }, { data: rebookRow }, { data: availRows }, pool] =
    await Promise.all([
      supabase.from('profiles').select('name, avatar_url, gender').eq('id', userId).maybeSingle(),
      supabase.from('coach_topics').select('topic').eq('coach_id', coachId),
      supabase.from('reviews').select('rating').eq('reviewed_id', userId).eq('is_private', false),
      supabase.from('coach_trending_stats').select('recent_bookers').eq('coach_id', coachId).maybeSingle(),
      supabase.from('coach_rebooking_stats').select('rebooking_rate, completadas_count').eq('coach_id', coachId).maybeSingle(),
      supabase.from('coach_availability_status').select('status').eq('coach_id', coachId).maybeSingle(),
      loadCoaches(),
    ]);

  const ratings = (reviewRows ?? []).map((r: any) => r.rating as number);
  const reviewCount = ratings.length;

  const self: VisibilitySelf = {
    id: userId,
    coachId,
    createdAt: (coachRow.created_at ?? null) as string | null,
    name: (profile?.name as string) ?? '',
    specialty: (coachRow.specialty as string) ?? '',
    priceFrom: (coachRow.price_per_session ?? 0) as number,
    nationality: (coachRow.nationality ?? '') as string,
    gender: (profile?.gender ?? '') as string,
    avatarUrl: (profile?.avatar_url ?? null) as string | null,
    bio: (coachRow.bio ?? null) as string | null,
    topics: (topicRows ?? []).map((t: any) => t.topic as string),
    verified: !!coachRow.verified,
    avgRating: reviewCount > 0 ? ratings.reduce((a, b) => a + b, 0) / reviewCount : null,
    reviewCount,
    rebookingRate: (rebookRow?.rebooking_rate ?? null) as number | null,
    completadasCount: (rebookRow?.completadas_count ?? 0) as number,
    recentBookers: (trendRows?.recent_bookers ?? 0) as number,
    availabilityStatus: (coachRow.availability_status ?? 'activo') as 'activo' | 'en_pausa',
    hasSlotThisWeek: availRows?.status === 'this_week',
    hasVideo: !!coachRow.video_url,
    instantBooking: !!coachRow.instant_booking,
  };

  return { self, pool: pool as CachedCoach[], coachId };
}
