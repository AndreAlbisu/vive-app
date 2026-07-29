export const colors = {
  bgGrad:        ['#F7EFE4', '#F0E6D8', '#EDE0CF'] as const,
  textPrimary:   '#565E32',
  textMuted:     '#87835C',
  forest:        '#2D4A3E',
  terracota:     '#C1694F',
  glassBg:       'rgba(255,248,240,0.55)',
  glassBorder:   'rgba(255,255,255,0.65)',
  pillBg:        'rgba(255,255,255,0.60)',
  navBg:         'rgba(255,248,240,0.55)',
  tintTerracota: 'rgba(193,105,79,0.14)',
  tintForest:    'rgba(45,74,62,0.14)',
  pillActiveBg:   '#565E32',
  pillActiveText: '#F7EFE4',
};

export const radii = { card: 20, res: 18, pill: 20, icon: 21 };
export const blur  = { card: 14, nav: 16 };
export const fonts = { sans: 'Poppins', brand: 'Fraunces' };

// Sombra cálida en capas para SurfaceCard (components/ui/SurfaceCard.tsx) —
// rediseño "efecto de superficie", sesión 77. Valores tomados 1:1 de
// card-efectos-comparador.html (opción E "Combo"), traducidos de CSS
// box-shadow (offset/blur/spread/color) a shadowOffset/shadowRadius/
// shadowOpacity de iOS. RN no tiene spread nativo — se aproxima con `inset`
// (cuánto más chica es la View de esa capa respecto a la card visible).
// Android no soporta tinte en `elevation`: la capa de halo se simula con una
// View extra semitransparente detrás (sin blur real, ver SurfaceCard).
export type ShadowLayer = {
  color: string;
  opacity: number;
  offset: { width: number; height: number };
  radius: number;
  inset: number;
};

export type ShadowRecipe = {
  ios: ShadowLayer[]; // orden: halo (más atrás) → contacto (más pegada, va en la propia card)
  android: { elevation: number; haloColor?: string; haloInset?: number };
};

export const shadow: {
  elevated: { light: ShadowRecipe; dark: ShadowRecipe };
  elevatedPressed: { light: ShadowRecipe; dark: ShadowRecipe };
  subtle: { light: ShadowRecipe };
} = {
  elevated: {
    light: {
      ios: [
        { color: '#C06B4A', opacity: 0.22, offset: { width: 0, height: 26 }, radius: 23, inset: 22 },
        { color: '#2E261A', opacity: 0.18, offset: { width: 0, height: 12 }, radius: 14, inset: 10 },
        { color: '#2E261A', opacity: 0.06, offset: { width: 0, height: 1 },  radius: 1,  inset: 0 },
      ],
      android: { elevation: 8, haloColor: 'rgba(192,107,74,0.16)', haloInset: -10 },
    },
    dark: {
      ios: [
        { color: '#000000', opacity: 0.35, offset: { width: 0, height: 26 }, radius: 24, inset: 20 },
        { color: '#141A0F', opacity: 0.40, offset: { width: 0, height: 14 }, radius: 15, inset: 10 },
        { color: '#141A0F', opacity: 0.20, offset: { width: 0, height: 1 },  radius: 1,  inset: 0 },
      ],
      android: { elevation: 10, haloColor: 'rgba(20,26,15,0.30)', haloInset: -8 },
    },
  },
  // Estado "presionado": las 3 capas se intensifican levemente y la card sube
  // (translateY lo maneja SurfaceCard, no este token).
  elevatedPressed: {
    light: {
      ios: [
        { color: '#C06B4A', opacity: 0.26, offset: { width: 0, height: 32 }, radius: 28, inset: 20 },
        { color: '#2E261A', opacity: 0.22, offset: { width: 0, height: 20 }, radius: 19, inset: 12 },
        { color: '#2E261A', opacity: 0.07, offset: { width: 0, height: 2 },  radius: 2,  inset: 0 },
      ],
      android: { elevation: 12, haloColor: 'rgba(192,107,74,0.20)', haloInset: -14 },
    },
    dark: {
      ios: [
        { color: '#000000', opacity: 0.38, offset: { width: 0, height: 30 }, radius: 26, inset: 18 },
        { color: '#141A0F', opacity: 0.44, offset: { width: 0, height: 18 }, radius: 17, inset: 8 },
        { color: '#141A0F', opacity: 0.22, offset: { width: 0, height: 2 },  radius: 2,  inset: 0 },
      ],
      android: { elevation: 13, haloColor: 'rgba(20,26,15,0.34)', haloInset: -12 },
    },
  },
  subtle: {
    light: {
      ios: [
        { color: '#2E261A', opacity: 0.16, offset: { width: 0, height: 10 }, radius: 12, inset: 8 },
        { color: '#2E261A', opacity: 0.05, offset: { width: 0, height: 1 },  radius: 1,  inset: 0 },
      ],
      android: { elevation: 3 }, // sin halo — subtle no lleva el tinte terracota
    },
  },
};
