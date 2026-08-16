import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Asistente flotante "Sofía" — SOLO interfaz, sin conexión a ningún backend/LLM
// todavía. Los tres atajos navegan a pantallas que YA existen; el campo de
// escribir está deshabilitado a propósito (preview de lo que viene).
//
// Montado a nivel de app/(tabs)/_layout.tsx (no dentro de cada pantalla) para
// que sea un solo elemento global, visible en las 4 tabs principales
// (Inicio, Conexiones, Recursos, Mensajes) y en ningún otro lado — coach,
// admin, onboarding, auth, etc. quedan afuera porque viven en otros grupos
// de rutas que no montan este layout.

const GLASS        = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const ORB_SIZE      = 54;
const HEADER_ORB    = 34;

type Shortcut = { id: string; label: string; route: Href };

// "¿Qué me recomendás para hoy?" no tiene pantalla propia — la recomendación
// según el check-in ya vive como card arriba de Recursos (useRecommendedResource
// en app/(tabs)/recursos.tsx). Llevar ahí cumple las dos ramas del pedido: si
// hay recomendación, es lo primero que se ve; si no, es la pantalla de Recursos.
const SHORTCUTS: Shortcut[] = [
  { id: 'reco',  label: '¿Qué me recomendás para hoy?', route: '/(tabs)/recursos' },
  { id: 'start', label: 'Ayudame a arrancar',            route: '/(tabs)' },
  { id: 'mal-dia', label: 'Estoy teniendo un mal día',   route: '/diario' },
];

export function SofiaAssistant() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  // 0 = orbe, 1 = panel. Un solo valor maneja fade + scale de los dos estados,
  // así queda una sola transición coordinada en vez de dos independientes.
  const progress = useRef(new Animated.Value(0)).current;

  function toggle(next: boolean) {
    setOpen(next);
    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: reducedMotion ? 0 : 260,
      useNativeDriver: true,
    }).start();
  }

  function goTo(route: Href) {
    toggle(false);
    router.push(route);
  }

  // Mismo cálculo de posición que usa IslandTabBar para sí misma
  // (insets.bottom + 8, altura de la pastilla ≈ 44 + 6*2 = 56) + un margen —
  // así el orbe queda pegado arriba de la isla en cualquier dispositivo, sin
  // depender de una constante fija que podría desalinearse si la isla cambia.
  const bottom = insets.bottom + 8 + 56 + 14;

  const orbStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' as const }),
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0.6], extrapolate: 'clamp' as const }) },
    ],
  };
  const panelStyle = {
    opacity: progress.interpolate({ inputRange: [0.15, 1], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1], extrapolate: 'clamp' as const }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0], extrapolate: 'clamp' as const }) },
    ],
  };

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {/* Backdrop invisible: tocar afuera del panel cierra. Solo existe (y
          solo captura toques) mientras el panel está abierto. */}
      {open && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => toggle(false)}
          accessibilityLabel="Cerrar el asistente"
        />
      )}

      {open && (
        <Animated.View style={[styles.panel, panelStyle]} pointerEvents={open ? 'auto' : 'none'}>
          <View style={styles.panelHeader}>
            <View style={styles.headerOrb}>
              <Text style={styles.headerOrbS}>S</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>Sofía</Text>
              <Text style={styles.headerSub}>tu asistente</Text>
            </View>
            <Pressable onPress={() => toggle(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Feather name="x" size={20} color={ViveColors.text} />
            </Pressable>
          </View>

          <Text style={styles.greeting}>Hola, soy Sofía. ¿En qué te doy una mano?</Text>

          <View style={styles.chips}>
            {SHORTCUTS.map(sc => (
              <Pressable
                key={sc.id}
                style={styles.chip}
                onPress={() => goTo(sc.route)}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>{sc.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Deshabilitado a propósito — preview de lo que viene, sin backend
              ni LLM conectado todavía. */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Muy pronto vas a poder escribirme"
              placeholderTextColor="rgba(86,94,50,0.45)"
              editable={false}
              pointerEvents="none"
            />
            <Feather name="send" size={16} color="rgba(86,94,50,0.35)" />
          </View>
        </Animated.View>
      )}

      {!open && (
        <Animated.View style={orbStyle} pointerEvents={open ? 'none' : 'auto'}>
          <Pressable
            onPress={() => toggle(true)}
            style={styles.orb}
            accessibilityRole="button"
            accessibilityLabel="Abrir Sofía, tu asistente"
          >
            <Text style={styles.orbS}>S</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2E3624',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  orbS: {
    fontFamily: ViveFonts.frauncesSerif, // Fraunces 700
    fontSize: 24,
    color: '#FFFFFF',
  },

  panel: {
    width: 290,
    backgroundColor: GLASS,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#2E3624',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
    }),
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerOrb: {
    width: HEADER_ORB,
    height: HEADER_ORB,
    borderRadius: HEADER_ORB / 2,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOrbS: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 15,
    color: '#FFFFFF',
  },
  headerText: { flex: 1 },
  headerName: {
    fontFamily: ViveFonts.frauncesSemiBold, // Fraunces 600
    fontSize: 16,
    color: ViveColors.text,
  },
  headerSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: '#8A8A72',
    marginTop: 1,
  },

  greeting: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: ViveColors.text,
    marginTop: 14,
  },

  chips: {
    marginTop: 14,
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: ViveColors.text,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  input: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: ViveColors.text,
    padding: 0,
  },
});
