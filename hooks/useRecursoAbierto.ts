import { useEffect, useRef } from 'react';
import { anotar } from '@/lib/analytics';

/**
 * Anota que se abrió un recurso.
 *
 * 🔴 POR QUÉ HACE FALTA: hasta el 01/09/2026 solo se medía `recurso_completado`,
 * y con eso **no se puede saber qué funciona y qué no**. Un recurso con pocas
 * completaciones puede ser uno que nadie abre (problema de descubrimiento, se
 * arregla en Recursos) o uno que todos abren y abandonan a los cuarenta
 * segundos (problema del recurso). Son diagnósticos opuestos y el dato de
 * llegada era el mismo. Con "abierto" y "completado" la tasa sale sola.
 *
 * ⚠️ Va por `anotar` y NO por `recordCompletion`, a propósito: esta mitad no
 * necesita sesión. Es lo que permite medir a quien está explorando sin cuenta
 * —que después del rediseño del onboarding es exactamente a donde mandamos a
 * quien dijo "solo estoy mirando"— y además hace visible un problema que hoy
 * sería invisible: si `ensureAnonSession()` estuviera fallando, se verían
 * aperturas con cero completaciones en vez de silencio en las dos mitades.
 *
 * 📝 Dispara UNA VEZ por montaje. Si la pantalla se re-renderiza —y las de
 * herramientas lo hacen mucho, tienen timers— no se cuenta de nuevo.
 */
export function useRecursoAbierto(resourceId: string): void {
  const anotado = useRef(false);
  useEffect(() => {
    if (anotado.current) return;
    anotado.current = true;
    anotar('recurso_iniciado', { resource_id: resourceId });
  }, [resourceId]);
}
