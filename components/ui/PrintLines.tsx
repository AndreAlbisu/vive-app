import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';

// Trama de impresión: líneas horizontales finas (1px cada `spacing`px), muy
// tenues. Simula la trama del riso. Reutilizable; la intensidad va por `opacity`.
export function PrintLines({
  color = '#2D4A3E',   // verde bosque (ViveColors.accent)
  opacity = 0.06,
  spacing = 4,
}: {
  color?: string;
  opacity?: number;
  spacing?: number;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="printLines" patternUnits="userSpaceOnUse" width={spacing} height={spacing}>
            <Line x1="0" y1="0.5" x2={spacing} y2="0.5" stroke={color} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#printLines)" />
      </Svg>
    </View>
  );
}
