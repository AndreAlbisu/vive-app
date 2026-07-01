import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface MoodEntry {
  id: string;
  mood_id: number;
  mood_label: string;
  entry_date: string;
}

export function useMoodHistory(userId: string | undefined, days = 7) {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setEntries([]); setLoading(false); return; }

    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fromStr = from.toISOString().split('T')[0];

    supabase
      .from('mood_entries')
      .select('id, mood_id, mood_label, entry_date')
      .eq('user_id', userId)
      .gte('entry_date', fromStr)
      .order('entry_date', { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [userId, days]);

  return { entries, loading };
}
