import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSemanasActivas } from '@/lib/stats';
import { TOPIC_TO_AREA } from '@/constants/searchData';

// Extraído de progreso.tsx (rediseño sesión 75) — los mismos 3 números, misma
// query, sin duplicar la lógica.

export interface ProgressStats {
  semanasActivas: number;
  areasCount: number | null;
  sessionCount: number | null;
  loading: boolean;
}

export function useProgressStats(userId: string | undefined): ProgressStats {
  const [semanasActivas, setSemanasActivas] = useState(0);
  const [areasCount, setAreasCount] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSemanasActivas(0);
      setAreasCount(null);
      setSessionCount(null);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    getSemanasActivas(userId).then(setSemanasActivas);

    async function fetchData() {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, coach_id, scheduled_date, scheduled_time')
        .eq('user_id', userId)
        .or(`status.eq.completada,and(status.eq.confirmada,scheduled_date.lt.${today})`)
        .order('scheduled_date', { ascending: false })
        .limit(10);

      if (!bookings || bookings.length === 0) {
        setSessionCount(0);
        setLoading(false);
        return;
      }

      setSessionCount(bookings.length);

      const coachInternalIds = [...new Set(bookings.map(b => b.coach_id as string))];
      const { data: topicRows } = await supabase
        .from('coach_topics')
        .select('topic')
        .in('coach_id', coachInternalIds);

      const uniqueAreas = new Set<string>();
      topicRows?.forEach(t => {
        const area = TOPIC_TO_AREA[t.topic as string];
        if (area) uniqueAreas.add(area);
      });
      setAreasCount(uniqueAreas.size || null);
      setLoading(false);
    }

    fetchData();
  }, [userId]);

  return { semanasActivas, areasCount, sessionCount, loading };
}
