// Barra deslizable de precio. La usan el quiz (presupuesto por sesión) y el
// buscador (precio máximo).
//
// 🔴 Reemplaza al `CustomSlider` que vivía en app/search3.tsx, que NO SE MOVÍA:
// su PanResponder se creaba una sola vez con `useRef(PanResponder.create(...))`
// y adentro leía `trackWidth` y `onValueChange` del primer render, cuando el
// ancho todavía era 0. El `if (trackWidth === 0) return` cortaba cada arrastre.
// Acá todo lo que el gesto necesita se lee de refs.
//
// Además: tocar en cualquier punto de la barra salta ahí (no solo arrastrar la
// bolita), y el gesto no se lo roba el ScrollView de la pantalla.

import { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Platform } from 'react-native';
import { ViveColors, ViveFonts } from '@/constants/theme';

const THUMB = 26;

export function PriceSlider({
  value, onValueChange, min, max, step = 500, formatLabel,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  formatLabel: (v: number) => string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onValueChange);
  onChangeRef.current = onValueChange;
  const rangoRef = useRef({ min, max, step });
  rangoRef.current = { min, max, step };
  const startX = useRef(0);

  function valorEn(x: number): number {
    const { min: lo, max: hi, step: st } = rangoRef.current;
    const w = widthRef.current;
    if (w <= 0) return lo;
    const pct = Math.max(0, Math.min(1, x / w));
    const crudo = lo + pct * (hi - lo);
    return Math.max(lo, Math.min(hi, Math.round(crudo / st) * st));
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Sin esto, un arrastre con algo de movimiento vertical lo toma el
      // ScrollView y la barra se queda quieta a mitad de camino.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        startX.current = e.nativeEvent.locationX;
        onChangeRef.current(valorEn(startX.current));
      },
      onPanResponderMove: (_, g) => {
        onChangeRef.current(valorEn(startX.current + g.dx));
      },
    }),
  ).current;

  const pct = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const fillW = trackWidth * pct;

  return (
    <View style={sl.wrap}>
      <Text style={sl.label}>{formatLabel(value)}</Text>
      <View
        style={sl.track}
        onLayout={e => {
          widthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Precio máximo por sesión"
        accessibilityValue={{ text: formatLabel(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => {
          const d = e.nativeEvent.actionName === 'increment' ? step : -step;
          onValueChange(Math.max(min, Math.min(max, value + d)));
        }}
        {...pan.panHandlers}>
        <View style={sl.rail} pointerEvents="none" />
        <View style={[sl.fill, { width: fillW }]} pointerEvents="none" />
        <View
          style={[sl.thumb, { left: Math.max(0, Math.min(trackWidth - THUMB, fillW - THUMB / 2)) }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  wrap: { gap: 6, paddingVertical: 4 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 22, color: ViveColors.text },
  // Alto de 44 para que el toque sea cómodo aunque la barra se vea fina.
  track: { height: 44, justifyContent: 'center' },
  rail: {
    position: 'absolute', left: 0, right: 0, top: 20,
    height: 4, borderRadius: 2, backgroundColor: 'rgba(63,81,47,0.14)',
  },
  fill: {
    position: 'absolute', left: 0, top: 20,
    height: 4, borderRadius: 2, backgroundColor: ViveColors.primary,
  },
  thumb: {
    position: 'absolute', top: 9,
    width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: ViveColors.primary,
    borderWidth: 3, borderColor: '#FFF8EF',
    ...Platform.select({
      ios: { shadowColor: '#2E261A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
});
