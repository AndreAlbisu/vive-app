import { Ionicons } from '@expo/vector-icons';
import React from 'react';

// Catálogo de herramientas/prácticas de VITA. Fuente única de verdad, compartida
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
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario',      color: PASTEL_AZUL    },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud',    color: PASTEL_SALVIA  },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min',  route: '/sueno',       color: PASTEL_DURAZNO },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min',    route: '/respiracion', color: PASTEL_DURAZNO },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min',  route: '/meditacion',  color: PASTEL_SALVIA  },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min',      route: '/escaner',     color: PASTEL_AZUL    },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min',     route: '/relajacion',  color: PASTEL_DURAZNO },
  { id: 'ruido',       label: 'Ruido blanco',     icon: 'volume-medium-outline', duration: 'Libre',      route: '/ruido',       color: PASTEL_SALVIA  },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min',   route: '/lecturas',    color: PASTEL_AZUL    },
  { id: 'anclaje',     label: 'Anclaje',          icon: 'locate-outline',        duration: '2–3 min',    route: '/anclaje',     color: PASTEL_DURAZNO },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map(t => [t.id, t]));

// Rutina inicial sembrada la primera vez que el usuario abre Hábitos (editable después).
export const DEFAULT_HABIT_TOOL_IDS = ['respiracion', 'gratitud'];
