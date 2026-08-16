import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { localDayKey, localDayKeyMinus } from '@/lib/dates';

// Lo que la persona hizo en los últimos 7 días, más allá del ánimo.
//
// La card "Tu semana" miraba SOLO `mood_entries`, así que la devolución podía
// decir "tu semana viene pareja" en una semana donde hubo una sesión y tres
// prácticas. Estos son los datos que faltaban.
//
// Los tres conteos son `head: true` + `count: 'exact'`: no se bajan las filas,
// solo el número. Son tres requests chicos en la pantalla más abierta de la
// app, así que no traer payload importa.

export type WeeklySignals = {
  resourcesThisWeek: number;
  sessionsThisWeek: number;
  writingThisWeek: number;
  loading: boolean;
};

const EMPTY: WeeklySignals = {
  resourcesThisWeek: 0, sessionsThisWeek: 0, writingThisWeek: 0, loading: false,
};

export function useWeeklySignals(userId: string | undefined): WeeklySignals {
  const [signals, setSignals] = useState<WeeklySignals>({ ...EMPTY, loading: true });

  useEffect(() => {
    if (!userId) { setSignals(EMPTY); return; }

    let cancelled = false;

    (async () => {
      // Ventana de 7 días en fecha LOCAL. `completed_at` y `created_at` son
      // timestamptz, así que el borde se compara contra el arranque del día
      // local de hace una semana; `scheduled_date` ya es un date.
      const weekAgoDay = localDayKeyMinus(7);
      const weekAgoTs = `${weekAgoDay}T00:00:00`;
      const today = localDayKey();

      const [resources, sessions, journal, gratitude] = await Promise.all([
        // ⚠️ Se cuentan FILAS, no "recursos terminados". `resource_completions`
        // tiene `progress_seconds` para distinguir a medias de completo, pero
        // `duration_seconds` es NULL en los recursos libres (Diario, Ruido
        // blanco), así que no hay una regla de "terminado" que valga para
        // todos. Una fila es una vez que la persona usó la herramienta, y para
        // esta devolución eso es lo que importa.
        supabase.from('resource_completions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('completed_at', weekAgoTs),

        // Solo sesiones que ya ocurrieron. Una reserva futura no es algo que
        // hiciste esta semana, y contarla haría que la frase mienta.
        supabase.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completada')
          .gte('scheduled_date', weekAgoDay)
          .lte('scheduled_date', today),

        supabase.from('journal_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', weekAgoTs),

        supabase.from('gratitude_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', weekAgoTs),
      ]);

      if (cancelled) return;

      // Un conteo que falla vale 0, no rompe la tarjeta: la devolución tiene
      // que salir igual con la señal que sí llegó. Se avisa por consola porque
      // fallar en silencio acá se vería como "esta semana no hiciste nada".
      const count = (res: { count: number | null; error: any }, label: string) => {
        if (res.error) console.warn(`[weeklySignals] ${label}:`, res.error.message);
        return res.count ?? 0;
      };

      setSignals({
        resourcesThisWeek: count(resources, 'recursos'),
        sessionsThisWeek: count(sessions, 'sesiones'),
        writingThisWeek: count(journal, 'diario') + count(gratitude, 'gratitud'),
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return signals;
}
