import { supabase } from '@/lib/supabase';
import { anotar } from '@/lib/analytics';

/**
 * Registra que el usuario completó (o usó) un recurso.
 * Para recursos libres (Diario, Ruido blanco): omitir durationSeconds.
 * Para recursos con duración fija: pasar durationSeconds; progress se guarda igual (= completado).
 *
 * 🔴 El evento `recurso_completado` se emite ACÁ y no en cada pantalla. Estaba
 * suelto en cuatro (Respiración, Ruido, Diario, Gratitud) de las once que
 * llaman a esta función, así que **siete recursos se completaban sin dejar
 * rastro** — y no había forma de notarlo salvo leyendo las once. Este es el
 * cuello por el que pasan todas: acá no se puede olvidar ninguna.
 */
export async function recordCompletion(
  userId: string,
  resourceId: string,
  durationSeconds?: number,
): Promise<void> {
  anotar('recurso_completado', {
    resource_id: resourceId,
    duration_seconds: durationSeconds ?? null,
    user_id: userId,
  });

  await supabase.from('resource_completions').insert({
    user_id: userId,
    resource_id: resourceId,
    duration_seconds: durationSeconds ?? null,
    progress_seconds: durationSeconds ?? null,
  });
}
