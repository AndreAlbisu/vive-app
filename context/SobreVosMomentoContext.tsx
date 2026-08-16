import React, { createContext, useContext, useCallback, useState } from 'react';
import type { Reflection } from '@/lib/weeklyReflection';

// Puente entre Inicio (dueña de los datos: la devolución y el color del mood
// de hoy) y `SobreVosMomento` (montado al nivel de app/(tabs)/_layout.tsx,
// sibling de `<Tabs>` — no dentro del árbol de Inicio).
//
// Por qué el momento tuvo que mudarse ahí: vivía dentro de index.tsx con un
// `<Modal>` propio, y sacarle el Modal (mismo arreglo que ya funcionó para
// SofiaAssistant, ver esa entrada de sesión) requiere estar montado al lado
// de `<Tabs>` — un View absoluto DENTRO del árbol de una pantalla queda por
// DEBAJO de la isla de tabs (que la arma `<Tabs>` por fuera, en su propio
// `tabBar` prop), no por encima. Con el componente movido, Inicio ya no puede
// pasarle `reflection`/`moodColor`/`visible` como props directas — de ahí este
// contexto: Inicio llama `open(reflection, moodColor)` cuando corresponde
// (mismo criterio de siempre, ver lib/sobreVosMomento.ts), el componente en
// el layout lee el estado de acá.

type MomentoState = {
  reflection: Reflection | null;
  moodColor: string | null;
  visible: boolean;
};

type SobreVosMomentoContextType = {
  state: MomentoState;
  open: (reflection: Reflection, moodColor: string) => void;
  close: () => void;
};

const EMPTY_STATE: MomentoState = { reflection: null, moodColor: null, visible: false };

const SobreVosMomentoContext = createContext<SobreVosMomentoContextType>({
  state: EMPTY_STATE,
  open: () => {},
  close: () => {},
});

export function SobreVosMomentoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MomentoState>(EMPTY_STATE);

  const open = useCallback((reflection: Reflection, moodColor: string) => {
    setState({ reflection, moodColor, visible: true });
  }, []);

  // No se limpian `reflection`/`moodColor` al cerrar — el componente los
  // sigue necesitando mientras corre su propia animación de salida (mismo
  // motivo por el que `SobreVosMomento` mantenía un `mounted` separado de
  // `visible`).
  const close = useCallback(() => {
    setState(s => ({ ...s, visible: false }));
  }, []);

  return (
    <SobreVosMomentoContext.Provider value={{ state, open, close }}>
      {children}
    </SobreVosMomentoContext.Provider>
  );
}

export function useSobreVosMomento() {
  return useContext(SobreVosMomentoContext);
}
