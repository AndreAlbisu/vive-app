import { supabase } from '@/lib/supabase';

export type ResourceEventType = 'view' | 'play' | 'complete' | 'coach_profile_visit' | 'booking_started';

/**
 * Registra un evento del funnel de recursos (resource_events). Fire-and-forget:
 * nunca bloquea la UI ni interrumpe el flujo si falla.
 */
export function logResourceEvent(userId: string, resourceId: string, event: ResourceEventType): void {
  supabase.from('resource_events').insert({ user_id: userId, resource_id: resourceId, event }).then();
}
