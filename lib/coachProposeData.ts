import { supabase } from './supabase';
import { todayInAr } from './time';
import type { Hueco } from './coachPropose';

/** La mitad con base de `coachPropose.ts`. Va aparte para que la lógica pura se
 *  pueda testear sin arrastrar el cliente de Supabase — mismo corte que
 *  `coachVisibility.ts` / `coachVisibilityData.ts`. */

/**
 * Los próximos huecos libres del coach, de hoy en adelante.
 *
 * Un horario está libre si el coach lo declaró (`coach_availability`, no
 * `blocked`) y **no** hay una reserva viva encima. Mismo criterio que ve el
 * usuario en `BookingScreen_Time`, con una diferencia deliberada: acá cuenta
 * como ocupada **cualquiera** `pendiente` o `confirmada`, de quien sea. Al
 * usuario se le muestran los slots con solicitudes de otros porque puede
 * competir por ellos; ofrecerle a alguien un horario que ya tiene una solicitud
 * ajena sería prometer algo que quizás no se pueda cumplir.
 *
 * Devuelve `[]` ante cualquier error: es una comodidad, y si falla el botón
 * sigue abriendo el chat como antes.
 */
export async function proximosHuecos(coachId: string, cuantos = 3, hoy = todayInAr()): Promise<Hueco[]> {
  try {
    const [{ data: slots }, { data: ocupados }] = await Promise.all([
      supabase
        .from('coach_availability')
        .select('date, time')
        .eq('coach_id', coachId)
        .eq('blocked', false)
        .gte('date', hoy)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(200),
      supabase
        .from('bookings')
        .select('scheduled_date, scheduled_time')
        .eq('coach_id', coachId)
        .gte('scheduled_date', hoy)
        .in('status', ['pendiente', 'confirmada']),
    ]);

    // La hora viene con el padding de Postgres ("15:00:00") en una tabla y
    // puede no venir igual en la otra; se compara siempre por HH:MM. Es el
    // mismo cuidado que ya tiene la vista `coach_availability_status`.
    const tomados = new Set(
      (ocupados ?? []).map(b => `${b.scheduled_date}T${String(b.scheduled_time).slice(0, 5)}`),
    );

    return (slots ?? [])
      .map(s => ({ date: s.date as string, time: String(s.time).slice(0, 5) }))
      .filter(h => !tomados.has(`${h.date}T${h.time}`))
      .slice(0, cuantos);
  } catch {
    return [];
  }
}
