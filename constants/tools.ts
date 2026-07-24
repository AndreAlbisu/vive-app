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
}

export const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario'      },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud'    },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min',  route: '/sueno'       },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min',    route: '/respiracion' },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min',  route: '/meditacion'  },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min',      route: '/escaner'     },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min',     route: '/relajacion'  },
  { id: 'ruido',       label: 'Ruido blanco',     icon: 'volume-medium-outline', duration: 'Libre',      route: '/ruido'       },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min',   route: '/lecturas'    },
  { id: 'anclaje',     label: 'Anclaje',          icon: 'locate-outline',        duration: '2–3 min',    route: '/anclaje'     },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map(t => [t.id, t]));

// Rutina inicial sembrada la primera vez que el usuario abre Hábitos (editable después).
export const DEFAULT_HABIT_TOOL_IDS = ['respiracion', 'gratitud'];
