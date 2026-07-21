import React, { useLayoutEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, LayoutAnimation, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';

import { ViveFonts, ViveColors } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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

// `position` viene de react-native-tab-view enganchado al driver nativo del
// pager — solo se le puede animar opacity/transform desde ahí (paddingHorizontal
// / maxWidth / marginLeft tiran "not supported by native animated module").
// Por eso el fondo verde + crossfade del ícono siguen el dedo en vivo (nativo,
// sin jank), y el ancho de la pastilla + el label aparecen con un snap corto
// al asentarse — igual resuelve el lag que se sentía antes, sin pelear contra
// esa limitación.
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
      <View style={[styles.tab, isFocused && styles.tabActive]}>
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
        {isFocused && <Text style={styles.label}>{tab.label}</Text>}
      </View>
    </Pressable>
  );
}

// Tab bar compartida entre la app de usuario y la de coach (nav-isla-compacta,
// versión C): pill de ancho ajustado al contenido, solo el tab activo se
// expande con label. Vive sobre material-top-tabs (reemplazó a bottom-tabs
// para poder swipear) — cada layout pasa su propio orden/íconos/lógica de
// punto vía `tabs`.
export function IslandTabBar({ state, navigation, position, tabs }: MaterialTopTabBarProps & { tabs: IslandTab[] }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const activeRouteName = state.routes[state.index].name;
  const mounted = useRef(false);

  // Snap del ancho/label — anima el cambio de pastilla sea cual sea la causa
  // (tap en la isla o swipe entre páginas).
  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [activeRouteName, reducedMotion]);

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
        <View style={styles.pill}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 22,
  },
  tabActive: {
    paddingHorizontal: 16,
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
  label: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11.5,
    color: CREAM_LIGHT,
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
