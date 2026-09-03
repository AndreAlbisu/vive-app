import { useState, useCallback } from 'react';
import { useConsent } from '@/hooks/useConsent';
import type { ConsentType } from '@/lib/consentRules';

// El gate de consentimiento, listo para poner delante de cualquier acción que
// vaya a guardar dato sensible.
//
// Existe porque son tres pantallas —check-in, diario, gratitud— haciendo lo
// mismo: preguntar antes de escribir, esperar la respuesta, y seguir o abortar.
// Repetir el estado del resolver en cada una era garantizar que la cuarta se lo
// olvidara, y "se olvidaron de preguntar" acá significa tratar dato sensible sin
// consentimiento.
//
// Uso:
//   const gate = useConsentGate(user?.id);
//   ...
//   if (!(await gate.pedir())) return;   // antes de guardar
//   ...
//   <ConsentSheet {...gate.sheetProps} />

export function useConsentGate(userId: string | undefined, type?: ConsentType) {
  const consent = useConsent(userId, type);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  /** `true` si se puede guardar. Si hace falta preguntar, la promesa no resuelve
   *  hasta que la persona conteste el sheet. */
  const pedir = useCallback(async (): Promise<boolean> => {
    if (consent.puede) return true;
    // ⚠️ Fail-closed mientras no se sepa. Asumir el permiso hasta que la
    // consulta conteste sería escribir dato sensible sobre un estado no leído.
    // La ventana es de unos milisegundos al montar la pantalla.
    if (consent.loading) return false;
    return new Promise<boolean>(resolve => setResolver(() => resolve));
  }, [consent.puede, consent.loading]);

  const sheetProps = {
    visible: !!resolver,
    onResponder: consent.responder,
    onCerrar: (granted: boolean) => {
      resolver?.(granted);
      setResolver(null);
    },
  };

  return { pedir, sheetProps, puede: consent.puede, loading: consent.loading };
}
