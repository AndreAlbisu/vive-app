import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useFavoriteCoaches(userId: string | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) { setFavoriteIds(new Set()); setLoaded(true); return; }
    supabase
      .from('favorite_coaches')
      .select('coach_profile_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        setFavoriteIds(new Set((data ?? []).map(r => r.coach_profile_id as string)));
        setLoaded(true);
      });
  }, [userId]);

  const toggleFavorite = useCallback(async (coachProfileId: string) => {
    if (!userId) return;
    const isFav = favoriteIds.has(coachProfileId);

    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(coachProfileId); else next.add(coachProfileId);
      return next;
    });

    if (isFav) {
      await supabase
        .from('favorite_coaches')
        .delete()
        .eq('user_id', userId)
        .eq('coach_profile_id', coachProfileId);
    } else {
      await supabase
        .from('favorite_coaches')
        .insert({ user_id: userId, coach_profile_id: coachProfileId });
    }
  }, [userId, favoriteIds]);

  return { favoriteIds, loaded, toggleFavorite };
}
