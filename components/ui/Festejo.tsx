import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { ViveColors } from '@/constants/theme';

// Los golpes de efecto de las bienvenidas 5 a 8 (12/10/2026, pedido de Andre:
// "visuales, divertidas, asombrosas"). Tres piezas, las tres hechas con vistas
// redondas que se agrandan o se mueven: nada de SVG, para que anden igual en
// iPhone y Android.
//
//   · `Oleada`  una franja de color que barre toda la pantalla desde un punto.
//   · `Anillo`  un aro fino que crece y se apaga, como una gota en el agua.
//   · `Chispas` un puñado de puntitos de la paleta que salen disparados.
//
// Las tres se manejan igual: un valor compartido `t` que va de 0 a 1. En 0 y en
// 1 no se ve nada, así que alcanza con dejarlas montadas.
//
// 🔴 Van en coordenadas de PANTALLA (`x`, `y` en px), no del isotipo. Hay que
// ponerlas como hijas directas de la vista que ocupa toda la pantalla.

const COLORES = [ViveColors.primary, ViveColors.text, ViveColors.accent];
const CAIDA = 46;   // cuánto caen las chispas al final del vuelo, en px

/** Un número entre 0 y 1 que depende solo de `i`: siempre sale el mismo dibujo. */
function azar(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Una franja de color que sale de (`x`, `y`) y barre hasta `radio`. Es un
 * círculo de `color` que crece, y atrás uno de `fondo` que lo va tapando.
 */
export function Oleada({ t, x, y, radio, color, fondo, grosor = 0.14 }: {
  t: SharedValue<number>; x: number; y: number; radio: number;
  color: string; fondo: string; grosor?: number;
}) {
  const caja = { left: x - radio, top: y - radio, width: 2 * radio, height: 2 * radio, borderRadius: radio };
  const frente = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? 1 : 0,
    transform: [{ scale: Math.max(0.001, t.value) }],
  }));
  const cola = useAnimatedStyle(() => ({
    opacity: t.value > grosor && t.value < 1 ? 1 : 0,
    transform: [{ scale: Math.max(0.001, (t.value - grosor) / (1 - grosor)) }],
  }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.suelto, caja, { backgroundColor: color }, frente]} />
      <Animated.View pointerEvents="none" style={[styles.suelto, caja, { backgroundColor: fondo }, cola]} />
    </>
  );
}

/** Un aro fino que crece desde (`x`, `y`) hasta `radio` y se va apagando. */
export function Anillo({ t, x, y, radio, color, retraso = 0, trazo = 3, fuerza = 0.55 }: {
  t: SharedValue<number>; x: number; y: number; radio: number; color: string;
  retraso?: number; trazo?: number; fuerza?: number;
}) {
  const style = useAnimatedStyle(() => {
    const v = Math.min(1, Math.max(0, (t.value - retraso) / (1 - retraso)));
    const p = 1 - (1 - v) * (1 - v);
    return {
      opacity: v <= 0 ? 0 : fuerza * (1 - v),
      transform: [{ scale: Math.max(0.001, p) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.suelto,
        { left: x - radio, top: y - radio, width: 2 * radio, height: 2 * radio, borderRadius: radio },
        { borderWidth: trazo, borderColor: color },
        style,
      ]}
    />
  );
}

function Chispa({ i, cantidad, t, x, y, alcance }: {
  i: number; cantidad: number; t: SharedValue<number>; x: number; y: number; alcance: number;
}) {
  const angulo = ((i + 0.7 * azar(i)) / cantidad) * 2 * Math.PI;
  const lejos = alcance * (0.45 + 0.55 * azar(i + 31));
  const lado = 6 + 8 * azar(i + 67);
  const dx = Math.cos(angulo) * lejos;
  const dy = Math.sin(angulo) * lejos;
  const color = COLORES[i % COLORES.length];
  const hueca = i % 4 === 3;   // una de cada cuatro es un arito, no un punto

  const style = useAnimatedStyle(() => {
    const v = t.value;
    const p = 1 - Math.pow(1 - v, 3);   // sale rápido y frena
    return {
      opacity: v <= 0 || v >= 1 ? 0 : Math.min(1, (1 - v) * 2.5),
      transform: [
        { translateX: x + dx * p - lado / 2 },
        { translateY: y + dy * p + CAIDA * v * v - lado / 2 },
        { scale: 1 - 0.45 * v },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.suelto,
        { left: 0, top: 0, width: lado, height: lado, borderRadius: lado / 2 },
        hueca ? { borderWidth: 2, borderColor: color } : { backgroundColor: color },
        style,
      ]}
    />
  );
}

/** Puntitos de la paleta que salen disparados desde (`x`, `y`). */
export function Chispas({ t, x, y, cantidad = 14, alcance = 130 }: {
  t: SharedValue<number>; x: number; y: number; cantidad?: number; alcance?: number;
}) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <Chispa key={i} i={i} cantidad={cantidad} t={t} x={x} y={y} alcance={alcance} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  suelto: { position: 'absolute' },
});
