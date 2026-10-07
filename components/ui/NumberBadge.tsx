import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Easing } from 'react-native';
import { ViveColors, ViveFonts } from '@/constants/theme';

// Círculo de 24px con el número de la fila (Gratitud). Vacío mientras el campo
// no tiene texto; cuando lo tiene, se rellena de terracota con un rebote corto
// (~300ms, cubic-bezier que sobrepasa levemente). Así el progreso se ve solo,
// sin un contador aparte.
//
// El rebote es `scale` (nativo). El relleno de color no se puede animar en el
// hilo nativo, así que es un cambio de estilo directo — el rebote es lo que
// comunica el momento. Respeta prefers-reduced-motion: sin rebote, cambia seco.
export function NumberBadge({
  n,
  filled,
  reduced = false,
}: {
  n: number;
  filled: boolean;
  reduced?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevFilled = useRef(filled);

  useEffect(() => {
    const paso = filled && !prevFilled.current; // pasó de vacío a lleno
    prevFilled.current = filled;
    if (!paso || reduced) return;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.28,
        duration: 170,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 9,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [filled, reduced, scale]);

  return (
    <Animated.View
      style={[
        styles.badge,
        filled ? styles.badgeFilled : styles.badgeEmpty,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.num, filled ? styles.numFilled : styles.numEmpty]}>{n}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(193,105,79,0.40)',
  },
  badgeFilled: {
    backgroundColor: ViveColors.primary,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
  },
  num: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
  },
  numEmpty: { color: ViveColors.primary },
  numFilled: { color: ViveColors.onPrimaryInk },
});
