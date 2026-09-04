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
  const [guardando, setGuardando] = useState(false);

  const refrescar = useCallback(async () => {
    if (!userId) { setEstado(null); setLoading(false); return; }
    setLoading(true);
    const e = await getConsent(userId, type);
    setEstado(e);
    setLoading(false);
  }, [userId, type]);

  useEffect(() => { void refrescar(); }, [refrescar]);

  /** Registra la respuesta. Optimista a propósito: mueve el estado local EN EL
   *  ACTO para que el switch del Perfil no espere el round-trip a la edge
   *  function (que con el server lejos + cold-start eran 1-2s de lag visible).
   *  Si el guardado falla, re-lee del servidor → revierte a la verdad. Seguro
   *  porque el gate real (`getConsent`) lee del server aparte, así que este
   *  estado optimista no decide qué se trata, solo qué muestra el switch. */
  const responder = useCallback(async (granted: boolean): Promise<boolean> => {
    setGuardando(true);
    setEstado({ granted, grantedAt: new Date().toISOString(), policyVersion: null });
    const ok = await setConsent(granted, type);
    setGuardando(false);
    if (!ok) { await refrescar(); return false; }
    return true;
  }, [type, refrescar]);

  return {
    loading,
    guardando,
    puede: puedeTratar(estado),
    hayQuePedir: !loading && necesitaPedir(estado),
    responder,
    refrescar,
  };
}
