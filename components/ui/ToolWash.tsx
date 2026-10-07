import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Lavado de color en la parte superior de una herramienta, en degradé hacia
// transparente. Distingue Gratitud (durazno) de Diario (salvia) sin salir de la
// paleta: el color entra desde los tokens PASTEL_* (constants/tools). Antes las
// dos pantallas eran crema idéntico y se confundían.
//
// Va detrás del contenido (position absolute, pointerEvents none). El color se
// pasa como hex sólido del token y acá se le aplica la opacidad del degradé.
export function ToolWash({
  color,
  opacity = 0.5,
  height = 230,
}: {
  color: string;
  opacity?: number;
  height?: number;
}) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(color, opacity), withAlpha(color, 0)]}
      style={[styles.wash, { height }]}
    />
  );
}

// hex (#RRGGBB) + alpha 0..1 → #RRGGBBAA. RN entiende hex de 8 dígitos.
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
