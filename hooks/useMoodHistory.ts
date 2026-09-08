import { useState, useEffect, useCallback } from 'react';
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

  // `refetch` se expone para que Inicio (que es una tab y no se re-monta) pueda
  // re-leer al volver a foco: un check-in creado en OTRA pantalla —el Diario lo
  // crea al guardar— no se veía marcado hasta un remonte. Ver el `useFocusEffect`
  // en `app/(tabs)/index.tsx`.
  const refetch = useCallback(() => {
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

  useEffect(() => { refetch(); }, [refetch]);

  return { entries, loading, refetch };
}
