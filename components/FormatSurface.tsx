import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { resourceFormatGradient } from '@/constants/theme';

// Superficie de color de un formato de recurso: gradiente derivado del token del
// formato (NO hex sueltos — ver `resourceFormatGradient`), grano de papel a ~9%
// en overlay, y dos manchas de luz (clara arriba-derecha, oscura abajo-izquierda).
//
// Un solo lugar para las dos superficies que comparten este tratamiento: las
// cards del deck de Recursos (`app/formato.tsx`) y el hero del reproductor
// (`app/coach-recurso.tsx`). Al abrir un recurso desde el deck, el hero usa el
// MISMO componente para que se sienta que la card se expandió, no que se saltó a
// otra pantalla.

const GRAIN_TILE = 48;
const GRAIN_DOTS = Array.from({ length: 42 }, () => ({
  x: Math.random() * GRAIN_TILE, y: Math.random() * GRAIN_TILE,
  r: 0.35 + Math.random() * 0.7, o: 0.15 + Math.random() * 0.4,
}));

function Grain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={{ opacity: 0.09 }}>
        <Defs>
          <Pattern id="fs-grain" patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
            {GRAIN_DOTS.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#000" fillOpacity={d.o} />)}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#fs-grain)" />
      </Svg>
    </View>
  );
}

export function FormatSurface({
  format,
  variant = 0,
  style,
  children,
}: {
  format: string;
  /** Desplaza levemente el par de colores para que cards seguidas no se sientan idénticas. */
  variant?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [from, to] = resourceFormatGradient(format, variant);
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      <Grain />
      <View style={fs.blobLight} pointerEvents="none" />
      <View style={fs.blobDark} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const fs = StyleSheet.create({
  blobLight: {
    position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  blobDark: {
    position: 'absolute', bottom: -60, left: -50, width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
});
