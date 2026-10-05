import { supabase } from './supabase';

/**
 * Profesionales que hoy no reciben reservas (suspendidos o dados de baja).
 *
 * 🔴 Reemplaza a leer `coaches.suspendido_hasta` (04/10/2026): esa columna
 * dejaba ver por la API hasta cuándo estaba suspendido cada profesional. La
 * base contesta solo quiénes están suspendidos AHORA, sin fechas.
 *
 * Es la UX, no la defensa: la reserva la rebota
 * `trg_block_bookings_coach_suspendido`. Por eso un error devuelve vacío.
 * Las claves son `coaches.id`.
 */
export async function idsSuspendidos(): Promise<Set<string>> {
  let data: unknown;
  try {
    const res = await supabase.rpc('profesionales_suspendidos');
    if (res.error) {
      console.warn('[suspendidos] no se pudo consultar:', res.error.message);
      return new Set();
    }
    data = res.data;
  } catch (e) {
    // Sin red tampoco se cae el catálogo por esto.
    console.warn('[suspendidos] no se pudo consultar:', e);
    return new Set();
  }
  return new Set(
    ((data ?? []) as unknown[])
      .map(r => (typeof r === 'string' ? r : (r as { profesionales_suspendidos?: string })?.profesionales_suspendidos))
      .filter((id): id is string => !!id),
  );
}
