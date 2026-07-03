import { supabase } from '@/lib/supabase';

/**
 * Registra que el usuario completó (o usó) un recurso.
 * Para recursos libres (Diario, Ruido blanco): omitir durationSeconds.
 * Para recursos con duración fija: pasar durationSeconds; progress se guarda igual (= completado).
 */
export async function recordCompletion(
  userId: string,
  resourceId: string,
  durationSeconds?: number,
): Promise<void> {
  await supabase.from('resource_completions').insert({
    user_id: userId,
    resource_id: resourceId,
    duration_seconds: durationSeconds ?? null,
    progress_seconds: durationSeconds ?? null,
  });
}
