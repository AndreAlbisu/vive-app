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
  userId: string | null,
  resourceId: string,
  durationSeconds?: number,
): Promise<void> {
  // 🔴 El evento va SIEMPRE, tenga cuenta o no. Antes las ocho pantallas de
  // herramientas hacían `if (userIdRef.current)` alrededor de esta llamada, así
  // que quien completaba un recurso sin cuenta no dejaba rastro en ningún lado
  // — y es exactamente a donde el onboarding nuevo manda a quien dice "solo
  // estoy mirando". Sin esto tendríamos `recurso_iniciado` sin su par y las
  // aperturas anónimas se leerían todas como abandono.
  anotar('recurso_completado', {
    resource_id: resourceId,
    duration_seconds: durationSeconds ?? null,
    user_id: userId,
    con_cuenta: !!userId,
  });

  // La FILA sí necesita cuenta: `user_id` es FK a `auth.users`. Es progreso
  // personal — sin cuenta no tiene a quién pertenecer.
  if (!userId) return;

  await supabase.from('resource_completions').insert({
    user_id: userId,
    resource_id: resourceId,
    duration_seconds: durationSeconds ?? null,
    progress_seconds: durationSeconds ?? null,
  });
}
