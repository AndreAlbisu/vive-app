import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colorDeTono } from '@/constants/onboardingTonos';

/**
 * La segunda mitad de la transición de la bifurcación.
 *
 * El ala que tocaste se expande hasta tapar la pantalla y recién ahí se navega;
 * esta pantalla monta ya cubierta por ese mismo color y lo desvanece. Lo que se
 * ve es un solo movimiento continuo, no dos pantallas que se turnan.
 *
 * 🔴 Se pinta desde el PRIMER cuadro, con `useState` inicializado y no dentro de
 * un efecto: si el color apareciera un cuadro después, se vería un destello de
 * la pantalla nueva antes de que la tape, que es justo lo que la transición
 * viene a evitar.
 *
 * Sin `tono` no renderiza nada, así que entrar a la pantalla por cualquier otro
 * camino no paga ni un render de más.
 */
export function EntradaDesdeColor({ tono }: { tono?: string | string[] }) {
  const color = colorDeTono(tono);
  const fade = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(!!color);

  useEffect(() => {
    if (!color) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: 420,
      // Un respiro antes de descubrir: sin él la pantalla nueva aparece encima
      // del movimiento anterior y las dos mitades se pisan.
      delay: 90,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [color, fade]);

  if (!visible || !color) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: fade, zIndex: 50 }]}
    />
  );
}
