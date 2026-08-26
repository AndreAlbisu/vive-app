import React, { useEffect, useRef, useState } from 'react';
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
  Easing,
  InteractionManager,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Asistente flotante "Sofía" — SOLO interfaz, sin conexión a ningún backend/LLM
// todavía. Los atajos navegan a pantallas que YA existen; el campo de escribir
// está deshabilitado a propósito (preview de lo que viene).
//
// Montado a nivel de app/(tabs)/_layout.tsx (no dentro de cada pantalla) para
// que sea un solo elemento global, visible en las 4 tabs principales (Inicio,
// Conexiones, Recursos, Mensajes) y en ningún otro lado.
//
// El orbe se arrastra con `PanResponder` + `Animated.ValueXY` (mismo mecanismo
// que ya usa el slider de filtros de app/search3.tsx). Al tocarlo (sin
// arrastrar) abre un panel a pantalla casi completa.
//
// ⚠️ A propósito, SIN `<Modal>`: se probó con Modal + las mismas mitigaciones
// que lleva `SobreVosMomento.tsx` (rasterizado, animación diferida con
// InteractionManager) y igual se sentía lento — `Modal` arma una pantalla
// nativa nueva cada vez que se abre, y ese costo no se puede evitar desde
// nuestro lado con trucos de animación. Como este componente ya está montado
// arriba de `<Tabs>` (no dentro de una pantalla), no hace falta Modal para
// quedar por encima de todo — un View absoluto normal alcanza y sale gratis
// ese costo. `SobreVosMomento.tsx` no puede aplicar el mismo arreglo todavía:
// vive DENTRO del árbol de Inicio, no al lado de `<Tabs>`, así que un View
// absoluto ahí quedaría por DEBAJO de la isla de tabs en vez de por encima.

const FOREST = '#3F512F'; // color propio de Sofía — ViveColors.primary (terracota)
                           // se parecía demasiado al avatar del perfil.
const CARD   = '#F7F2E7'; // fondo sólido del panel — antes era glass translúcido.
const LINE   = 'rgba(63,81,47,0.14)';

const ORB_SIZE       = 54;
const HEADER_ORB      = 38;
const EDGE_MARGIN    = 8;
const DRAG_THRESHOLD  = 6; // px — por debajo de esto, un toque cuenta como tap y no como arrastre.
const SHEET_OFFSCREEN = 900;

type Shortcut = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: Href;
};

// "¿Qué me recomendás para hoy?" no tiene pantalla propia — la recomendación
// según el check-in ya vive como card arriba de Recursos (useRecommendedResource
// en app/(tabs)/recursos.tsx). Llevar ahí cumple las dos ramas del pedido: si
// hay recomendación, es lo primero que se ve; si no, es la pantalla de Recursos.
const SHORTCUTS: Shortcut[] = [
  { id: 'reco',    label: '¿Qué me recomendás para hoy?',  icon: 'compass',   route: '/(tabs)/recursos' },
  { id: 'start',   label: 'Ayudame a arrancar',             icon: 'sunrise',   route: '/(tabs)' },
  { id: 'mal-dia', label: 'Estoy teniendo un mal día',       icon: 'edit-3',    route: '/diario' },
  { id: 'coaches', label: 'Quiero ver a los profesionales',  icon: 'users',     route: '/(tabs)/conexiones' },
];

export function SofiaAssistant() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [orbPos, setOrbPos] = useState(() => ({
    x: Dimensions.get('window').width - 18 - ORB_SIZE,
    y: Dimensions.get('window').height - (insets.bottom + 8 + 56 + 14) - ORB_SIZE,
  }));
  const pan = useRef(new Animated.ValueXY(orbPos)).current;
  const dragStart = useRef(orbPos);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;

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
        if (moved < DRAG_THRESHOLD) setOpen(true);
      },
    })
  ).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Igual que en SobreVosMomento: sin esto, la animación de apertura
      // compite por el hilo de JS con lo que sea que esté pasando justo en
      // ese instante (el propio tap, re-renders) y se siente lagueada.
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, { toValue: 1, duration: reducedMotion ? 100 : 300, useNativeDriver: true }),
          Animated.timing(sheetY, {
            toValue: 0,
            duration: reducedMotion ? 100 : 380,
            easing: reducedMotion ? Easing.linear : Easing.bezier(0.32, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => task.cancel();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: reducedMotion ? 80 : 200, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SHEET_OFFSCREEN, duration: reducedMotion ? 80 : 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [open, reducedMotion, backdropOpacity, sheetY]);

  function close() {
    setOpen(false);
  }

  // Sin `Modal`, se pierde gratis el manejo del botón físico de "atrás" en
  // Android — se repone a mano, mismo comportamiento de antes (cierra el
  // panel en vez de salir de la pantalla de abajo).
  useEffect(() => {
    if (Platform.OS !== 'android' || !open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  function goTo(route: Href) {
    close();
    router.push(route);
  }

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {!open && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.orbAbs, { transform: pan.getTranslateTransform() }]}
        >
          <View
            style={styles.orb}
            accessibilityRole="button"
            accessibilityLabel="Abrir Sofía, tu asistente. Mantené presionado para moverla"
          >
            <Text style={styles.orbS}>S</Text>
          </View>
        </Animated.View>
      )}

      {mounted && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Cerrar el asistente">
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>
      )}

      {mounted && (
        <Animated.View
          style={[
            styles.sheet,
            {
              top: insets.top + 44,
              paddingBottom: 18 + insets.bottom,
              transform: [{ translateY: sheetY }],
            },
          ]}
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <View style={styles.grab} />

          <View style={styles.topGroup}>
            <View style={styles.sheetHeader}>
              <View style={styles.headerOrb}>
                <Text style={styles.headerOrbS}>S</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerName}>Sofía</Text>
                <Text style={styles.headerSub}>tu asistente</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Feather name="x" size={22} color={ViveColors.text} />
              </Pressable>
            </View>

            <Text style={styles.greeting}>Hola, soy Sofía.{'\n'}¿En qué te doy una mano?</Text>
          </View>

          <View style={styles.bottomGroup}>
            <View style={styles.notice}>
              <Feather name="tool" size={14} color={FOREST} />
              <Text style={styles.noticeText}>
                Todavía estoy aprendiendo a conversar. Mientras tanto, elegí una de estas opciones:
              </Text>
            </View>

            <View style={styles.shortcuts}>
              {SHORTCUTS.map(sc => (
                <Pressable
                  key={sc.id}
                  style={styles.shortcutRow}
                  onPress={() => goTo(sc.route)}
                  accessibilityRole="button"
                >
                  <View style={styles.shortcutIcon}>
                    <Feather name={sc.icon} size={18} color={FOREST} />
                  </View>
                  <Text style={styles.shortcutText}>{sc.label}</Text>
                  <Feather name="chevron-right" size={18} color="rgba(63,81,47,0.35)" />
                </Pressable>
              ))}
            </View>

            {/* Deshabilitado a propósito — preview de lo que viene, sin
                backend ni LLM conectado todavía. */}
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
            <Text style={styles.caption}>El chat está en desarrollo — probá las opciones de arriba mientras tanto</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cubre toda la pantalla (necesario para poder arrastrar el orbe a
  // cualquier lado) sin capturar toques donde no hay nada propio —
  // `box-none` deja pasar todo lo que no sea el orbe.
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
    fontFamily: ViveFonts.bold,
    fontSize: 24,
    color: '#FFFFFF',
  },

  backdrop: {
    backgroundColor: 'rgba(30,26,18,0.45)',
  },

  // Panel casi a pantalla completa (referencia: asistente de Banco Galicia) —
  // deja una franja arriba para que se note que es una hoja sobre la app, no
  // una pantalla nueva.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    // Empuja topGroup arriba del todo y bottomGroup abajo del todo, con el
    // aire del medio como en la referencia — `sheet` ya tiene una altura
    // definida por `top`+`bottom` absolutos, así que `flex:1` acá reparte
    // ese espacio en vez de colapsar al contenido.
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#2E3624',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(63,81,47,0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },

  // Arriba: identidad + saludo grande. Abajo: aviso + opciones + input —
  // `justifyContent: space-between` en el contenedor padre separa los dos
  // grupos con aire en el medio, como en la referencia.
  topGroup: {},
  bottomGroup: {},

  sheetHeader: {
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
    fontFamily: ViveFonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerText: { flex: 1 },
  headerName: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 17,
    color: ViveColors.text,
  },
  headerSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#8A8A72',
    marginTop: 1,
  },

  greeting: {
    fontFamily: ViveFonts.title,
    fontSize: 26,
    lineHeight: 33,
    color: ViveColors.text,
    marginTop: 28,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#6B7A56',
  },

  shortcuts: {
    gap: 10,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(63,81,47,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 13.5,
    color: ViveColors.text,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: ViveColors.text,
    padding: 0,
  },
  caption: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#8A8A72',
    textAlign: 'center',
    marginTop: 10,
  },
});
