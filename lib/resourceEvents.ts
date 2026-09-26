import { supabase } from '@/lib/supabase';
import { puedeTratarBienestar } from '@/lib/consent';
import { anotar } from '@/lib/analytics';

export type ResourceEventType = 'view' | 'play' | 'complete' | 'coach_profile_visit' | 'booking_started';

/**
 * Registra un evento del funnel de recursos (resource_events). Fire-and-forget:
 * nunca bloquea la UI ni interrumpe el flujo si falla.
 */
export function logResourceEvent(userId: string, resourceId: string, event: ResourceEventType): void {
  // 🔴 Qué recursos usa alguien es dato de salud por deducción (Política §3):
  // sin consentimiento no se registra (auditoría 26/09, C2).
  void puedeTratarBienestar(userId).then(puede => {
    if (!puede) return;
    supabase.from('resource_events').insert({ user_id: userId, resource_id: resourceId, event }).then();
  });
}

/** Evento de analítica sobre un recurso. `registrarEvento` le pega el
 *  `user_id` de la sesión, así que con `resource_id` dice qué usó quién. Sin
 *  consentimiento se anota igual que se usó un recurso, pero sin cuál: el
 *  embudo sigue contando y no queda el dato sensible. Sin cuenta no hay
 *  persona a quien atarlo y va completo. */
export function anotarUsoDeRecurso(evento: string, resourceId: string, props: Record<string, unknown> = {}): void {
  void (async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? null;
    const conDetalle = !uid || (await puedeTratarBienestar(uid));
    anotar(evento, conDetalle ? { ...props, resource_id: resourceId } : { ...props, sin_consentimiento: true });
  })().catch(() => {});
}
