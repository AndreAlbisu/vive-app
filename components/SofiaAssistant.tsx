import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Platform,
  Dimensions,
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
//
// Arrastre: `PanResponder` + `Animated.ValueXY`, mismo mecanismo que ya usa
// el slider de filtros de app/search3.tsx — no se trajo gesture-handler para
// esto. La posición vive en memoria (no en AsyncStorage): se resetea a la
// esquina de abajo a la derecha en cada arranque de la app, no entre tabs
// (el componente no se desmonta al cambiar de tab, vive arriba del navegador).

const FOREST = '#3F512F'; // color propio de Sofía — antes usaba ViveColors.primary
                           // (terracota), muy parecido al círculo del avatar del
                           // perfil en el top bar de Inicio. Forest ya es el
                           // segundo color fuerte de la marca (tab activo de
                           // IslandTabBar, CTAs) y se distingue de un vistazo.
const CARD        = '#F7F2E7'; // fondo sólido del panel — antes era glass
                                // translúcido y se veía todo lo de atrás.
const LINE         = 'rgba(63,81,47,0.14)';
const ORB_SIZE      = 54;
const HEADER_ORB    = 34;
const PANEL_WIDTH   = 290;
const PANEL_HEIGHT_ESTIMATE = 300; // no se puede medir antes de montar; usado solo para decidir si el panel abre arriba o abajo del orbe.
const EDGE_MARGIN   = 8;
const DRAG_THRESHOLD = 6; // px — por debajo de esto, un toque cuenta como tap y no como arrastre.

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
  const [orbPos, setOrbPos] = useState(() => ({
    x: Dimensions.get('window').width - 18 - ORB_SIZE,
    y: Dimensions.get('window').height - (insets.bottom + 8 + 56 + 14) - ORB_SIZE,
  }));

  // Posición absoluta en pantalla (no un delta) — `getTranslateTransform()`
  // la aplica directo, y clampear contra los bordes reales es más simple con
  // coordenadas absolutas que con un offset relativo a la esquina de origen.
  const pan = useRef(new Animated.ValueXY(orbPos)).current;
  const dragStart = useRef(orbPos);

  // 0 = orbe, 1 = panel. Un solo valor maneja fade + scale de los dos estados,
  // así queda una sola transición coordinada en vez de dos independientes.
  const progress = useRef(new Animated.Value(0)).current;

  function clampToScreen(x: number, y: number) {
    const { width, height } = Dimensions.get('window');
    const minX = EDGE_MARGIN;
    const maxX = width - ORB_SIZE - EDGE_MARGIN;
    const minY = insets.top + EDGE_MARGIN;
    // No se deja bajar más que su posición de reposo — ahí abajo empieza la isla.
    const maxY = height - (insets.bottom + 8 + 56 + 14) - ORB_SIZE;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragStart.current = orbPos;
      },
      onPanResponderMove: (_, g) => {
        const next = clampToScreen(dragStart.current.x + g.dx, dragStart.current.y + g.dy);
        pan.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = clampToScreen(dragStart.current.x + g.dx, dragStart.current.y + g.dy);
        pan.setValue(next);
        setOrbPos(next);

        // Sin esto, cualquier toque —arrastre incluido— abriría el panel al
        // soltar. Un desplazamiento chico se trata como tap.
        const moved = Math.hypot(g.dx, g.dy);
        if (moved < DRAG_THRESHOLD) toggle(true);
      },
    })
  ).current;

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

  // El panel se ancla cerca de donde esté el orbe (no siempre en la esquina
  // de origen, ahora que se puede arrastrar), clampeado para no salirse de
  // pantalla. Por default abre ARRIBA del orbe; si no entra (orbe cerca del
  // borde superior), abre abajo.
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const openAbove = orbPos.y - PANEL_HEIGHT_ESTIMATE - 14 >= insets.top + EDGE_MARGIN;
  const panelTop = openAbove
    ? Math.max(insets.top + EDGE_MARGIN, orbPos.y - PANEL_HEIGHT_ESTIMATE - 14)
    : Math.min(screenH - PANEL_HEIGHT_ESTIMATE - EDGE_MARGIN, orbPos.y + ORB_SIZE + 14);
  const panelLeft = Math.min(
    Math.max(orbPos.x + ORB_SIZE - PANEL_WIDTH, EDGE_MARGIN),
    screenW - PANEL_WIDTH - EDGE_MARGIN,
  );

  const orbAnimStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' as const }),
    transform: [
      ...pan.getTranslateTransform(),
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
    <View style={styles.layer} pointerEvents="box-none">
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
        <Animated.View
          style={[styles.panel, panelStyle, { left: panelLeft, top: panelTop }]}
          pointerEvents="auto"
        >
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
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.orbAbs, orbAnimStyle]}
          pointerEvents="auto"
        >
          <View style={styles.orb} accessibilityRole="button" accessibilityLabel="Abrir Sofía, tu asistente. Mantené presionado para moverla">
            <Text style={styles.orbS}>S</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cubre toda la pantalla (necesario para poder arrastrar el orbe a
  // cualquier lado) sin capturar toques donde no hay nada propio —
  // `box-none` deja pasar todo lo que no sea el orbe/panel/backdrop.
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: FOREST,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#1E2617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
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
    position: 'absolute',
    width: PANEL_WIDTH,
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#2E3624',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
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
    backgroundColor: FOREST,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
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
