import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface InProgressResource {
  resourceId: string;
  progressSeconds: number;
  durationSeconds: number;
}

export interface ResourceProgress {
  streak: number;
  weekActivity: boolean[]; // 7 elements: index 0 = 6 days ago, index 6 = today
  lastInProgress: InProgressResource | null;
  completedInLast7Days: Set<string>; // resource_ids completados en los últimos 7 días
  loading: boolean;
}

export function useResourceProgress(userId: string | undefined): ResourceProgress {
  const [progress, setProgress] = useState<ResourceProgress>({
    streak: 0,
    weekActivity: Array(7).fill(false),
    lastInProgress: null,
    completedInLast7Days: new Set(),
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setProgress({
        streak: 0,
        weekActivity: Array(7).fill(false),
        lastInProgress: null,
        completedInLast7Days: new Set(),
        loading: false,
      });
      return;
    }

    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString();

    supabase
      .from('resource_completions')
      .select('resource_id, completed_at, duration_seconds, progress_seconds')
      .eq('user_id', userId)
      .gte('completed_at', fromStr)
      .order('completed_at', { ascending: false })
      .then(({ data }) => {
        const rows = data ?? [];

        // ── Fechas únicas con al menos una completación ────────────────────
        const completionDates = new Set(
          rows.map(r => (r.completed_at as string).split('T')[0])
        );

        // ── Racha (días consecutivos hacia atrás desde hoy) ───────────────
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          if (completionDates.has(dateStr)) {
            streak++;
          } else {
            break;
          }
        }

        // ── Actividad últimos 7 días (para los 7 puntos del chip) ─────────
        const weekActivity = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (6 - i));
          return completionDates.has(d.toISOString().split('T')[0]);
        });

        // ── Recurso a medias (el más reciente con progreso parcial) ───────
        const inProgress = rows.find(
          r =>
            r.progress_seconds != null &&
            r.duration_seconds != null &&
            (r.progress_seconds as number) > 0 &&
            (r.progress_seconds as number) < (r.duration_seconds as number)
        );
        const lastInProgress: InProgressResource | null = inProgress
          ? {
              resourceId: inProgress.resource_id as string,
              progressSeconds: inProgress.progress_seconds as number,
              durationSeconds: inProgress.duration_seconds as number,
            }
          : null;

        // ── Completados en los últimos 7 días ─────────────────────────────
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString();
        const completedInLast7Days = new Set(
          rows
            .filter(r => (r.completed_at as string) >= cutoffStr)
            .map(r => r.resource_id as string)
        );

        setProgress({
          streak,
          weekActivity,
          lastInProgress,
          completedInLast7Days,
          loading: false,
        });
      });
  }, [userId]);

  return progress;
}
