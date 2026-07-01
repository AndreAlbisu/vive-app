// VIVE Design System
export const ViveColors = {
  primary: '#C1694F',    // Terracota
  background: '#F7EFE4', // Crema cálido
  text: '#565E32',       // Oliva — texto principal
  accent: '#2D4A3E',     // Forest — progreso, confirmaciones
  calm: '#87835C',       // Oliva muted
};

export const ViveFonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  frauncesSerif: 'Fraunces_700Bold',
  spaceGroteskSemibold: 'SpaceGrotesk_600SemiBold',
  spaceGroteskRegular: 'SpaceGrotesk_400Regular',
};

// Floating pill tab bar: bottom=24 + height=64 = 88px, plus ~22px breathing room
export const TAB_BAR_CLEARANCE = 110;

// Escala de mood check-in (5 niveles, de más bajo a más alto)
export const ViveMoodColors: Record<number, string> = {
  1: '#B25D3B', // Bajón   — terracota oscuro/arcilla
  2: '#C98A73', // Cansado — rosa polvo
  3: '#CBB98C', // Neutral — arena/dorado apagado
  4: '#8FA382', // Bien    — salvia
  5: '#4C5B45', // Genial  — verde bosque
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
