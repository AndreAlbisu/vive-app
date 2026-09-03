import { supabase } from '@/lib/supabase';
import { LEGAL_VERSION } from '@/constants/legal';
import type { ConsentState, ConsentType } from '@/lib/consentRules';

// El I/O del consentimiento. Las reglas están en `lib/consentRules.ts`, que es
// puro y tiene tests.
//
// 🔴 ORDEN DE DESPLIEGUE, NO NEGOCIABLE. Antes de buildear con este código:
//   1. correr `scripts/add-user-consents.sql`
//   2. `npx supabase functions deploy user-consent`
//
// Si el build sale antes, `getConsent` falla (la tabla no existe), el fail-closed
// devuelve null, y **nadie puede hacer su check-in de ánimo**: el sheet se abre,
// `setConsent` falla contra una function que no está, y no se cierra.
//
// Es a propósito que rompa fuerte y no que degrade en silencio. Un fallback que
// dejara pasar el check-in "porque todavía no está la tabla" sería tratar dato
// sensible sin consentimiento, que es exactamente lo que este código existe para
// impedir.

/** El estado ACTUAL, de la vista `user_consents_current` — que ya resuelve el
 *  "último acto por tipo" y hereda la RLS de la tabla (`security_invoker`). */
export async function getConsent(
  userId: string,
  type: ConsentType = 'datos_sensibles_bienestar',
): Promise<ConsentState> {
  const { data, error } = await supabase
    .from('user_consents_current')
    .select('granted, granted_at, policy_version')
    .eq('user_id', userId)
    .eq('consent_type', type)
    .maybeSingle();

  if (error) {
    console.error('[consent] getConsent:', error.message);
    // 🔴 Fail-closed: si no se puede leer el consentimiento, se asume que NO
    // está. Devolver "otorgado" ante un error sería tratar dato sensible sobre
    // la base de una consulta que falló.
    return null;
  }
  if (!data) return null;
  return {
    granted: data.granted as boolean,
    grantedAt: data.granted_at as string,
    policyVersion: (data.policy_version as string | null) ?? null,
  };
}

/** Otorga o revoca.
 *
 *  ⚠️ Va por la edge function y NO por un insert directo: `authenticated` tiene
 *  revocado el insert sobre `user_consents`. Es deliberado — ver el encabezado
 *  de `supabase/functions/user-consent/index.ts`. La fecha la pone el servidor.
 */
export async function setConsent(
  granted: boolean,
  type: ConsentType = 'datos_sensibles_bienestar',
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/user-consent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ consentType: type, granted, policyVersion: LEGAL_VERSION }),
      },
    );
    if (!res.ok) {
      console.error('[consent] setConsent:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[consent] setConsent:', e);
    return false;
  }
}
