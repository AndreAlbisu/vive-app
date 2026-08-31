// Vita Design System
export const ViveColors = {
  primary: '#C1694F',    // Terracota
  background: '#F7EFE4', // Crema cálido
  text: '#565E32',       // Oliva — texto principal
  accent: '#2D4A3E',     // Forest — progreso, confirmaciones
  calm: '#87835C',       // Oliva muted
};

// 24/08/2026: se sacó Fraunces del proyecto (`frauncesSerif`/`frauncesSemiBold`
// ya no existen). Títulos y feedback pasan a Plus Jakarta Sans — dos tokens
// nuevos (`title`, `feedback`) para que el criterio de "qué fuente le toca a
// qué texto" viva en un solo lugar, no repartido pantalla por pantalla.
export const ViveFonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  // Títulos y encabezados — saludo del home, títulos de sección, títulos de
  // pantalla. Dos pesos: `title` (700, el más común, donde antes iba
  // frauncesSerif) y `titleSemiBold` (600, donde antes iba frauncesSemiBold).
  title: 'PlusJakartaSans_700Bold',
  titleSemiBold: 'PlusJakartaSans_600SemiBold',
  // Texto de devolución/feedback generado — la card "Sobre vos", el momento de
  // pantalla completa, y cualquier otro texto de reflexión dinámica.
  feedback: 'PlusJakartaSans_600SemiBold',
  // El wordmark "vita" del header — peso más pesado, uso puntual.
  wordmark: 'PlusJakartaSans_800ExtraBold',
  spaceGroteskSemibold: 'SpaceGrotesk_600SemiBold',
  spaceGroteskRegular: 'SpaceGrotesk_400Regular',
};

// Floating pill tab bar: bottom=24 + height=64 = 88px, plus ~22px breathing room
export const TAB_BAR_CLEARANCE = 110;

// ── Colores de FORMATO de recurso ────────────────────────────────────────────
// Un solo lugar. Antes vivían duplicados como `FORMAT_COLOR` en `recursos.tsx`
// y `coach-recurso.tsx` — dos copias del mismo hex que se desincronizan solas.
// Los gradientes del deck de Recursos NO son colores nuevos: se derivan de acá
// con `resourceFormatGradient`, que aclara y oscurece el MISMO tono.
export const ResourceFormatColors: Record<string, string> = {
  audio:   '#C06B4A', // terracota
  podcast: '#7E8CA8', // azul grisáceo
  video:   '#8A6FA8', // violeta
  lectura: '#6B7A56', // verde bosque
};

export const ResourceFormatLabels: Record<string, string> = {
  audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura',
};

// Mezcla un hex con blanco (`amount > 0`) o negro (`amount < 0`), `amount` en
// [-1, 1]. Pura, sin dependencias — sirve para derivar tonos de un color base
// sin inventar hex sueltos.
export function mixHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const to2 = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

// Gradiente [claro, oscuro] del color de un formato, para las cards del deck.
// `variant` (0..3) desplaza levemente el par para que cards seguidas del mismo
// formato no se sientan idénticas al deslizar — sin salirse del tono.
export function resourceFormatGradient(format: string, variant = 0): [string, string] {
  const base = ResourceFormatColors[format] ?? ViveColors.primary;
  const shift = (variant % 4) * 0.05;      // 0, .05, .10, .15
  return [mixHex(base, 0.22 - shift), mixHex(base, -0.28 - shift)];
}

// Escala de mood check-in (5 niveles, de más bajo a más alto) — un solo lugar,
// usada en todo lo que represente nivel de ánimo (check-in, gráficos, etc.)
// para que nunca diverjan hex sueltos entre pantallas.
export const ViveMoodColors: Record<number, string> = {
  1: '#C06B4A', // Bajón
  2: '#DDAE93', // Cansado
  3: '#D9D0B8', // Normal
  4: '#BFCBA6', // Bien
  5: '#8FA07C', // Brillando
};

// Expo Router tab navigation colors
export const Colors = {
  light: {
    text: '#1F4A43',
    background: '#FBF6EF',
    tint: '#E8743B',
    icon: '#1F4A43',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#E8743B',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#E8743B',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#E8743B',
  },
};
