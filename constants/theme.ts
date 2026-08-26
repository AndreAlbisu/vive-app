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
