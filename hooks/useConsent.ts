import { useState, useEffect, useCallback } from 'react';
import { getConsent, setConsent } from '@/lib/consent';
import { necesitaPedir, puedeTratar, type ConsentState, type ConsentType } from '@/lib/consentRules';

// El consentimiento de datos sensibles, listo para usar en una pantalla.
//
// ⚠️ `loading` arranca en true y `puede` en false, y ese orden importa: mientras
// no se sepa, la respuesta es NO. Al revés —asumir otorgado hasta que la
// consulta conteste— habría una ventana en cada montaje donde la app trata dato
// sensible sin permiso confirmado. Es la misma decisión fail-closed que toma
// `getConsent` cuando la query falla.

export function useConsent(userId: string | undefined, type: ConsentType = 'datos_sensibles_bienestar') {
  const [estado, setEstado] = useState<ConsentState>(null);
  const [loading, setLoading] = useState(true);

  const refrescar = useCallback(async () => {
    if (!userId) { setEstado(null); setLoading(false); return; }
    setLoading(true);
    const e = await getConsent(userId, type);
    setEstado(e);
    setLoading(false);
  }, [userId, type]);

  useEffect(() => { void refrescar(); }, [refrescar]);

  /** Registra la respuesta y deja el estado local al día sin esperar otra query. */
  const responder = useCallback(async (granted: boolean): Promise<boolean> => {
    const ok = await setConsent(granted, type);
    if (!ok) return false;
    setEstado({ granted, grantedAt: new Date().toISOString(), policyVersion: null });
    return true;
  }, [type]);

  return {
    loading,
    puede: puedeTratar(estado),
    hayQuePedir: !loading && necesitaPedir(estado),
    responder,
    refrescar,
  };
}
