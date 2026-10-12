import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

// El aro fino que crece y se apaga, como una gota en el agua. Lo usan las
// bienvenidas 5 a 8 (12/10/2026). Andre las pidió "artísticas y modernas,
// bellas, hasta hipnóticas", y aclaró que no quiere confeti ni circo: por eso
// acá hay una sola pieza, callada, y no chispas ni franjas de color.
//
// Se maneja con un valor compartido `t` que va de 0 a 1, de dos maneras:
//
//   · una sola vez: `retraso` dice en qué parte de `t` recién sale.
//   · en ronda: con `fase`, `t` es un reloj que da vueltas (0→1, 0→1…) y el
//     aro vuelve a salir en cada vuelta. Varios aros con fases repartidas
//     hacen una fila pareja de ondas.
//
// Es una vista redonda con borde, sin SVG, para que ande igual en iPhone y
// Android. `x`, `y` y `radio` van en px de la vista que lo contiene.

export function Anillo({ t, x, y, radio, color, retraso = 0, fase, trazo = 2, fuerza = 0.5 }: {
  t: SharedValue<number>; x: number; y: number; radio: number; color: string;
  retraso?: number; fase?: number; trazo?: number; fuerza?: number;
}) {
  const style = useAnimatedStyle(() => {
    let v: number;
    if (fase === undefined) {
      v = Math.min(1, Math.max(0, (t.value - retraso) / (1 - retraso)));
    } else {
      v = t.value + fase;
      v -= Math.floor(v);
    }
    const p = 1 - (1 - v) * (1 - v);   // sale rápido y frena
    return {
      // Entra de a poco para que no aparezca de golpe, y se apaga al crecer.
      opacity: fuerza * (1 - v) * Math.min(1, v * 8),
      transform: [{ scale: Math.max(0.001, p) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.aro,
        { left: x - radio, top: y - radio, width: 2 * radio, height: 2 * radio, borderRadius: radio },
        { borderWidth: trazo, borderColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  aro: { position: 'absolute' },
});
