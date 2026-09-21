import { supabase } from '@/lib/supabase';
import { mensajeDeError } from '@/lib/reagendar';

/**
 * M15, el lado de la app: pedirle al servidor que mueva una sesión.
 *
 * ⚠️ **La regla no vive acá.** `lib/reagendar.ts` decide qué OFRECER y
 * `pedir_reagendado()` en la base decide qué PASA, revalidando todo. Esto es
 * solo el cable entre los dos, más la traducción de los errores del servidor a
 * algo que una persona pueda leer.
 *
 * 📌 La traducción de los errores vive en `lib/reagendar.ts`, con las reglas
 * puras, para poder probarla sin levantar Supabase.
 */
export { mensajeDeError };

export type ResultadoReagendar =
  | { ok: true; resultado: 'movida'; fecha: string; hora: string }
  | { ok: true; resultado: 'pedida' }
  | { ok: false; mensaje: string };

export async function pedirReagendado(
  bookingId: string,
  fecha: string,
  hora: string,
): Promise<ResultadoReagendar> {
  const { data, error } = await supabase.rpc('pedir_reagendado', {
    p_booking: bookingId,
    p_fecha: fecha,
    p_hora: hora.slice(0, 5),
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error.message) };

  const r = data as { resultado?: string; fecha?: string; hora?: string } | null;
  if (r?.resultado === 'movida') {
    return { ok: true, resultado: 'movida', fecha: r.fecha ?? fecha, hora: r.hora ?? hora };
  }
  if (r?.resultado === 'pedida') return { ok: true, resultado: 'pedida' };
  return { ok: false, mensaje: mensajeDeError(null) };
}

/** El profesional acepta o rechaza. Devuelve `null` si salió bien. */
export async function responderReagendado(
  solicitudId: string,
  acepta: boolean,
): Promise<string | null> {
  const { error } = await supabase.rpc('responder_reagendado', {
    p_solicitud: solicitudId,
    p_acepta: acepta,
  });
  return error ? mensajeDeError(error.message) : null;
}
