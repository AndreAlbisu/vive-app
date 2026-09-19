import React from 'react';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

// Feather no trae ondas, así que el de Mental se dibuja acá copiando su trazo:
// grilla de 24, línea de 2, puntas y uniones redondeadas. Así queda parejo
// con el pulso de Físico y el sol de Espiritual, que sí son de Feather.
// Tres ondas y no dos: con dos y poca curva se leía como el signo "≈".
const ONDAS = [7, 12, 17].map(y => `M2 ${y} q2.5 -3 5 0 t5 0 t5 0 t5 0`);

export function EjeIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (name === 'ondas') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {ONDAS.map(d => (
          <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  }
  return <Feather name={name as any} size={size} color={color} />;
}
