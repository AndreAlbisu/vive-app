import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Ecualizador de barras para el estado "Sonando…" de Sonidos ambientales.
// No existía un componente compartido con el tile de Ruido en Recursos (se
// verificó antes de codear, rediseño herramientas sesión 76) — se crea acá,
// pensado para reusarse ahí el día que esa pantalla tenga estado de
// reproducción real que animar.
const BAR_COUNT = 4;
const BAR_DURATIONS = [420, 560, 480, 620];

export function SoundEqualizer({ color = '#3A4F2A' }: { color?: string }) {
  const reducedMotion = useReducedMotion();
  const heights = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (reducedMotion) return;

    const loops = heights.map((h, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(h, { toValue: 1, duration: BAR_DURATIONS[i], useNativeDriver: true }),
          Animated.timing(h, { toValue: 0.3, duration: BAR_DURATIONS[i], useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [reducedMotion, heights]);

  return (
    <View style={s.row}>
      {heights.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            s.bar,
            {
              backgroundColor: color,
              transform: [{ scaleY: reducedMotion ? 0.6 : h }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  bar: { width: 3, height: 16, borderRadius: 2 },
});
