import { supabase } from './supabase';

// "Con lugar esta semana" — indicador liviano para el deck de Conexiones.
//
// Devuelve el set de `coaches.id` (NO profile_id) que tienen al menos un slot
// no bloqueado en los próximos 7 días. Se consulta solo para los coaches del
// deck visible (≤5), no para todo el catálogo.
//
// v1 mira solo `coach_availability` (blocked=false, date en ventana). No cruza
// contra `bookings`, así que puede marcar "con lugar" un slot ya reservado —
// aceptable para un indicador de superficie; el filtro real de turnos libres lo
// hace la pantalla de reserva (booking-calendar).
export async function coachesWithSlotThisWeek(coachIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (coachIds.length === 0) return result;

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86_400_000);
  const fromStr = today.toISOString().split('T')[0];
  const toStr = in7.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('coach_availability')
    .select('coach_id')
    .in('coach_id', coachIds)
    .eq('blocked', false)
    .gte('date', fromStr)
    .lte('date', toStr);

  if (error) {
    console.error('[coachAvailability] fetch:', error.message);
    return result;
  }

  (data ?? []).forEach((row: any) => result.add(row.coach_id as string));
  return result;
}
