import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

/**
 * Catálogo de las herramientas nativas de VITA (las hardcodeadas de la
 * pantalla Recursos). Fuente compartida para el inicio (pinneados, íconos
 * MaterialCommunityIcons) y la pantalla de guardados (íconos Ionicons).
 * La clave `id` es el slug que se guarda en saved_resources / pinned_resources.
 *
 * ⚠️ `app/(tabs)/recursos.tsx` todavía mantiene su propio array `TOOLS`
 * (Ionicons) para la grilla — si agregás/renombrás una tool, tocá ambos.
 */
export type VitaTool = {
  id: string;
  label: string;
  ionicon: React.ComponentProps<typeof Ionicons>['name'];
  mdicon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  duration: string;
  route: string;
};

export const VITA_TOOLS: VitaTool[] = [
  { id: 'diario',      label: 'Diario',           ionicon: 'book-outline',          mdicon: 'notebook-outline',  duration: 'Libre',      route: '/diario'      },
  { id: 'gratitud',    label: 'Gratitud',         ionicon: 'heart-outline',         mdicon: 'heart-outline',     duration: '5 min',      route: '/gratitud'    },
  { id: 'sueno',       label: 'Sueño',            ionicon: 'moon-outline',          mdicon: 'weather-night',     duration: '10–20 min',  route: '/sueno'       },
  { id: 'respiracion', label: 'Respiración',      ionicon: 'cloud-outline',         mdicon: 'weather-windy',     duration: '3–8 min',    route: '/respiracion' },
  { id: 'meditacion',  label: 'Meditación',       ionicon: 'leaf-outline',          mdicon: 'leaf',              duration: '10–15 min',  route: '/meditacion'  },
  { id: 'escaner',     label: 'Escáner corporal', ionicon: 'body-outline',          mdicon: 'human',             duration: '8 min',      route: '/escaner'     },
  { id: 'relajacion',  label: 'Relajación',       ionicon: 'musical-notes-outline', mdicon: 'music-note',        duration: '10 min',     route: '/relajacion'  },
  { id: 'ruido',       label: 'Ruido blanco',     ionicon: 'volume-medium-outline', mdicon: 'volume-high',       duration: 'Libre',      route: '/ruido'       },
  { id: 'lecturas',    label: 'Lecturas breves',  ionicon: 'library-outline',       mdicon: 'book-open-variant', duration: '5–10 min',   route: '/lecturas'    },
  { id: 'anclaje',     label: 'Anclaje',          ionicon: 'locate-outline',        mdicon: 'anchor',            duration: '2–3 min',    route: '/anclaje'     },
];

export const VITA_TOOL_MAP: Record<string, VitaTool> =
  Object.fromEntries(VITA_TOOLS.map(t => [t.id, t]));
