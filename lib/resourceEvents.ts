import { supabase } from '@/lib/supabase';
import { puedeTratarBienestar } from '@/lib/consent';
import { anotarSensible } from '@/lib/analytics';

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

/** Evento de analítica sobre un recurso: con `resource_id` dice qué usó
 *  quién, así que sin consentimiento sale sin cuál (`anotarSensible`). */
export function anotarUsoDeRecurso(evento: string, resourceId: string, props: Record<string, unknown> = {}): void {
  anotarSensible(evento, { ...props, resource_id: resourceId }, ['resource_id']);
}
