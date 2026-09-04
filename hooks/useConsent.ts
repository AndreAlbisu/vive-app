import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Token del último toque. Con el switch siempre tappeable (optimista), los
  // resultados de red que lleguen DESPUÉS de un toque más nuevo se descartan
  // (last-write-wins) — así jugar de un lado a otro no se traba ni se pisa.
  const opToken = useRef(0);

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
   *  function (server lejos + cold-start = 1-2s de lag). El switch queda SIEMPRE
   *  tappeable; si el guardado del ÚLTIMO toque falla, re-lee del servidor →
   *  revierte a la verdad. Un resultado de un toque viejo (hubo otro después) se
   *  descarta. Seguro porque el gate real (`getConsent`) lee del server aparte:
   *  este estado optimista solo decide qué muestra el switch, no qué se trata. */
  const responder = useCallback(async (granted: boolean): Promise<boolean> => {
    const token = ++opToken.current;
    setEstado({ granted, grantedAt: new Date().toISOString(), policyVersion: null });
    const ok = await setConsent(granted, type);
    if (token !== opToken.current) return true; // hubo un toque más nuevo: descartar
    if (!ok) { await refrescar(); return false; }
    return true;
  }, [type, refrescar]);

  return {
    loading,
    puede: puedeTratar(estado),
    hayQuePedir: !loading && necesitaPedir(estado),
    responder,
    refrescar,
  };
}
