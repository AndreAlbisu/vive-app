import React from 'react';
import { View, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';

import { ViveColors } from '@/constants/theme';

const CREAM       = 'rgba(242,236,223,0.95)';
const CREAM_LIGHT = '#F3EEDF';
const FOREST      = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const DOT_COLOR   = ViveColors.primary; // terracota — mismo punto para todas las notificaciones

const AnimatedFeather = Animated.createAnimatedComponent(Feather);

export type IslandTab = {
  name: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  dot?: boolean;
};

// 20/08/2026: se sacó el label visible (quedó solo como accessibilityLabel).
// Antes cada tab cambiaba de ancho al enfocarse para hacerle lugar al texto —
// `paddingHorizontal`/`maxWidth` no se pueden animar por el driver nativo
// (tiran "not supported by native animated module"), así que ese cambio de
// ancho dependía de `LayoutAnimation` (JS thread) y siempre se sentía un paso
// atrás del dedo, por más que se ajustara el timing — dos rondas de intentos
// documentadas en el historial de este archivo, ninguna lo resolvió del todo.
// Con todos los tabs del mismo ancho fijo no hay ningún layout que animar: el
// nombre de la pantalla ya se ve arriba del todo en cada una, así que no hacía
// falta repetirlo acá abajo. Todo lo que queda animado (el fondo verde +
// crossfade del ícono) sigue el dedo en vivo por el driver nativo, sin jank.
function IslandTabItem({
  tab,
  index,
  position,
  isFocused,
  onPress,
}: {
  tab: IslandTab;
  index: number;
  position: Animated.AnimatedInterpolation<number>;
  isFocused: boolean;
  onPress: () => void;
}) {
  const focus = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={isFocused ? { selected: true } : {}}
      style={styles.tabHit}>
      <View style={styles.tab}>
        <Animated.View pointerEvents="none" style={[styles.bubble, { opacity: focus }]} />
        <View style={styles.iconSlot}>
          <Feather name={tab.icon} size={19} color={FOREST_SOFT} />
          <AnimatedFeather
            name={tab.icon}
            size={19}
            color={CREAM_LIGHT}
            style={[StyleSheet.absoluteFill, { opacity: focus }]}
          />
          {tab.dot && (
            <Animated.View
              pointerEvents="none"
              style={[styles.dot, { opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Tab bar compartida entre la app de usuario y la de coach (nav-isla-compacta,
// versión C): pill de ancho fijo, solo íconos (sin label visible desde el
// 20/08/2026). Vive sobre material-top-tabs (reemplazó a bottom-tabs para
// poder swipear) — cada layout pasa su propio orden/íconos/lógica de punto
// vía `tabs`.
export function IslandTabBar({ state, navigation, position, tabs }: MaterialTopTabBarProps & { tabs: IslandTab[] }) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index].name;

  function onPress(tab: IslandTab, isFocused: boolean) {
    const route = state.routes.find(r => r.name === tab.name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (isFocused || event.defaultPrevented) return;

    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(tab.name);
  }

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <View style={styles.shadowWrap}>
        {/* Sin BlurView a propósito (sacado 06/08/2026). Estaba DENTRO de la
            pastilla, o sea encima de su `backgroundColor` crema al 95% de
            opacidad — difuminaba un rectángulo casi sólido, sobre un fondo de app
            que es un gradiente de tres cremas casi idénticos. Efecto invisible,
            costo real: se re-rasterizaba en cada frame mientras el ancho de la
            pastilla se animaba al cambiar de pestaña.
            Si alguna vez se quiere vidrio esmerilado de verdad, hay que bajarle
            la opacidad a CREAM (0.95 → ~0.55) para que el blur tenga qué mostrar,
            y recién ahí vuelve a tener sentido pagar el costo. */}
        <View style={styles.pill}>
          {tabs.map((tab, i) => {
            const isFocused = activeRouteName === tab.name;
            return (
              <IslandTabItem
                key={tab.name}
                tab={tab}
                index={i}
                position={position}
                isFocused={isFocused}
                onPress={() => onPress(tab, isFocused)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // El shadow y el overflow:hidden (para recortar el blur a las esquinas
  // redondeadas) no pueden vivir en la misma view en iOS — se cortarían
  // mutuamente. Shadow afuera, overflow adentro.
  shadowWrap: {
    borderRadius: 26,
    shadowColor: '#2E3624',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    borderRadius: 26,
    padding: 6,
    overflow: 'hidden',
  },
  tabHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    // Mismo padding siempre, foco o no — es justo lo que evita tener que
    // animar ningún ancho al cambiar de tab (ver nota arriba del componente).
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 22,
  },
  bubble: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FOREST,
    borderRadius: 22,
  },
  iconSlot: {
    width: 19,
    height: 19,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DOT_COLOR,
  },
});
