import { Ionicons } from '@expo/vector-icons';
import React from 'react';

// Catálogo de herramientas/prácticas de Vita. Fuente única de verdad, compartida
// por Recursos (grilla de herramientas) y Progreso (hábitos = prácticas elegidas).
// El `id` es la clave estable que también usa `resource_completions.resource_id`
// (ver lib/resourceCompletions.ts) y `user_habits.tool_id`.

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface Tool {
  id: string;
  label: string;
  icon: IoniconName;
  duration: string;
  route?: string;
  color: string;
  /**
   * 🔴 Si el usuario puede llegar o no a esta herramienta. Las 6 en `false` son
   * las que `design/recursos-v2-definiciones.md` retiró de la vista ("se retiran
   * de la vista, sin borrar su código"): la grilla de Recursos ya mostraba solo
   * las 4 visibles vía TOOL_GROUPS, pero el picker de hábitos de Progreso leía
   * este array crudo y ofrecía las 10 — alguien podía agendarse Meditación como
   * hábito y recibir un push diario hacia una pantalla que el equipo decidió no
   * sostener. El flag vive ACÁ y no en cada pantalla a propósito: cualquier
   * consumidor nuevo de TOOLS tiene que decidir explícitamente si filtra o no,
   * en vez de heredar el leak por omisión.
   */
  visible: boolean;
}

// Trío pastel — no existía como constante compartida antes (rediseño de
// Progreso, sesión 75); reusado tanto en los tiles de hábitos como en las
// cards de stats de Progreso para no traer más de 3 tonos a la pantalla.
export const PASTEL_SALVIA   = '#DCE5CB';
export const PASTEL_DURAZNO  = '#F2DCCF';
export const PASTEL_AZUL     = '#DAE0EC';
// Teal — sumado en el rediseño de herramientas (sesión 76) para la card "Olas
// del mar" de Sonidos ambientales; no existía en el trío original.
export const PASTEL_TEAL     = '#D3E4E0';

export const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario',      color: PASTEL_AZUL, visible: true  },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud',    color: PASTEL_SALVIA, visible: true  },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min',  route: '/sueno',       color: PASTEL_DURAZNO, visible: false },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min',    route: '/respiracion', color: PASTEL_DURAZNO, visible: true  },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min',  route: '/meditacion',  color: PASTEL_SALVIA, visible: false },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min',      route: '/escaner',     color: PASTEL_AZUL, visible: false },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min',     route: '/relajacion',  color: PASTEL_DURAZNO, visible: false },
  // No es "Ruido blanco": la pantalla ofrece lluvia, bosque, olas y un ruido grave,
  // y de blanco no tiene nada (medido: -8,7 dB/octava). Tampoco es "Libre" — obliga
  // a elegir 5, 15 o 30 min. El id queda: viaja en completions, guardados y hábitos.
  { id: 'ruido',       label: 'Sonidos ambientales', icon: 'volume-medium-outline', duration: '5–30 min', route: '/ruido',       color: PASTEL_SALVIA, visible: true  },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min',   route: '/lecturas',    color: PASTEL_AZUL, visible: false },
  { id: 'anclaje',     label: 'Anclaje',          icon: 'locate-outline',        duration: '2–3 min',    route: '/anclaje',     color: PASTEL_DURAZNO, visible: false },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map(t => [t.id, t]));

/**
 * Las herramientas que el usuario puede elegir hoy. Es lo que tiene que leer
 * cualquier pantalla que OFREZCA herramientas (grilla, picker de hábitos,
 * sugerencias). `TOOLS` completo queda para RESOLVER un id que ya está guardado
 * —un hábito viejo, un pin, un recordatorio— que sigue teniendo que renderizar
 * con su label y su ícono aunque la herramienta ya no se ofrezca.
 */
export const VISIBLE_TOOLS: Tool[] = TOOLS.filter(t => t.visible);
export const VISIBLE_TOOL_IDS: string[] = VISIBLE_TOOLS.map(t => t.id);

export interface ToolGroup {
  id: string;
  title: string;
  subtitle: string;
  toolIds: string[];
}

/**
 * La grilla de la pantalla Recursos. ⚠️ El orden de esta lista ES el orden de
 * los tiles: `ToolsCarousel` la aplana en el orden en que está escrita. `title`
 * y `subtitle` hoy no se muestran en ningún lado (los grupos quedaron como
 * agrupación conceptual después del rediseño de la fila), así que lo único que
 * cambia al reordenar es la fila de herramientas.
 *
 * Vivía dentro de `app/(tabs)/recursos.tsx` hasta el 15/09/2026. Se mudó acá
 * porque era la ÚNICA definición de "qué herramientas ve el usuario", y estaba
 * en una pantalla: el resto de la app no tenía forma de consultarla, y por eso
 * el picker de hábitos y el motor de recomendación ofrecían las diez. Lo que la
 * grilla lista y lo que `visible` dice tiene que coincidir — hay un test que lo
 * afirma (`__tests__/herramientasVisibles.test.ts`).
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'reflexion',
    title: 'Para reflexionar',
    subtitle: 'Poner en palabras lo que pasa',
    toolIds: ['diario', 'gratitud'],
  },
  {
    id: 'calma',
    title: 'Para calmarte ahora',
    subtitle: 'Cuando la mente va rápido',
    toolIds: ['ruido', 'respiracion'],
  },
];

// Rutina inicial sembrada la primera vez que el usuario abre Hábitos (editable después).
export const DEFAULT_HABIT_TOOL_IDS = ['respiracion', 'gratitud'];
