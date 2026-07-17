import { supabase } from './supabase';

// "Con lugar esta semana" — indicador liviano para el deck de Conexiones.
//
// Devuelve el set de `coaches.id` (NO profile_id) con estado 'this_week' en la
// vista server-side `coach_availability_status` (ver scripts/add-coach-availability-view.sql):
// tienen ≥1 slot LIBRE (no bloqueado y sin reserva) en los próximos 7 días.
//
// v2 (16/07): pasó de calcular en cliente (que no cruzaba contra `bookings` y
// podía marcar "con lugar" un slot ya reservado) a leer la vista, que corre como
// owner y sí cruza reservas. La vista también expone 'responds_24h' (activo pero
// sin hueco) — todavía no se muestra en el deck.
export async function coachesWithSlotThisWeek(coachIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (coachIds.length === 0) return result;

  const { data, error } = await supabase
    .from('coach_availability_status')
    .select('coach_id, status')
    .in('coach_id', coachIds)
    .eq('status', 'this_week');

  if (error) {
    console.error('[coachAvailability] view:', error.message);
    return result;
  }

  (data ?? []).forEach((row: any) => result.add(row.coach_id as string));
  return result;
}
