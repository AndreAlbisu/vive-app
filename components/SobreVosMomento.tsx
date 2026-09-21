import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  InteractionManager,
  Platform,
  BackHandler,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts } from '@/constants/theme';
import { VitaMark } from '@/components/VitaMark';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSobreVosMomento } from '@/context/SobreVosMomentoContext';

// El momento de pantalla completa (Parte C). Montado como sibling de `<Tabs>`
// en app/(tabs)/_layout.tsx (no dentro del árbol de Inicio) — mismo lugar que
// `SofiaAssistant`, y por el mismo motivo: sin `<Modal>`.
//
// ⚠️ A propósito, SIN `<Modal>`: lo tenía al principio, con las mismas
// mitigaciones de acá abajo (rasterizado + animación diferida) y Joaquín lo
// siguió sintiendo lento — `Modal` arma una pantalla nativa nueva cada vez
// que se abre, costo que no toca ninguno de esos dos trucos. Se resolvió
// primero en `SofiaAssistant` (ver esa entrada de sesión) sacándole el
// `Modal` — viable porque estaba montado al lado de `<Tabs>`. Este componente
// vivía DENTRO de index.tsx, así que hubo que mudarlo primero (de ahí
// `SobreVosMomentoContext`: Inicio ya no puede pasarle props directas).
//
// Lee su estado de `useSobreVosMomento()` en vez de props — Inicio llama
// `open(reflection, moodColor)` cuando corresponde (ver lib/sobreVosMomento.ts
// para el criterio de "cuándo corresponde"), este componente solo sabe animar
// la entrada/salida. Por eso mantiene su propio `mounted`, desacoplado de
// `visible`: para poder animar la salida ANTES de dejar de renderizar (si
// desmontara apenas `visible` pasa a false, se iría de golpe sin transición).

const OFFSCREEN = 700; // mismo valor que usa search3.tsx para su sheet — sale de pantalla de sobra sin depender de Dimensions.

export function SobreVosMomento() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { state, close } = useSobreVosMomento();
  const { visible, reflection, moodColor } = state;
  const [mounted, setMounted] = useState(visible);

  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // El pick del mood dispara un re-render grande de toda Inicio (la card,
      // el propio check-in animando sus círculos) justo antes de que esto
      // quiera arrancar. `runAfterInteractions` espera a que ese trabajo
      // termine antes de largar la animación del momento, en vez de competir
      // por el hilo de JS/el bridge en el peor momento posible.
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: reducedMotion ? 120 : 350,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: reducedMotion ? 120 : 400,
            easing: reducedMotion ? Easing.linear : Easing.bezier(0.32, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => task.cancel();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: reducedMotion ? 100 : 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: OFFSCREEN, duration: reducedMotion ? 100 : 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, reducedMotion, backdropOpacity, translateY]);

  // Sin `Modal`, se pierde gratis el manejo del botón físico de "atrás" en
  // Android — se repone a mano, mismo comportamiento de antes.
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  // Deslizar hacia abajo cierra. Desde el 21/09/2026 no hay botón "Seguir"
  // (solo cerraba, lo mismo que tocar afuera, y le peleaba el lugar al único
  // botón que lleva a algún lado), así que la rayita de arriba tiene que
  // cumplir lo que promete. `closeRef` porque el PanResponder se crea una vez
  // y capturaría el `close` del primer render.
  const closeRef = useRef(close);
  closeRef.current = close;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          closeRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  function seeProgress() {
    close();
    router.push('/progreso');
  }

  if (!mounted || !reflection || !moodColor) return null;

  return (
    <View style={s.layer} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar">
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] },
        ]}
        // Sin esto, la vista se re-rasteriza (bordes redondeados + overflow
        // hidden + el gradiente adentro) en CADA frame del translateY. Con
        // esto, el sistema la renderiza una vez como bitmap y solo mueve esa
        // imagen durante la animación — sigue valiendo la pena aunque ya no
        // haya Modal, es una optimización distinta y complementaria.
        shouldRasterizeIOS
        renderToHardwareTextureAndroid
        {...pan.panHandlers}
      >
        {/* El "130%" del stop en el mockup (linear-gradient(160deg, mood, forest
            130%)) suaviza cuánto domina el forest dentro del área visible — acá
            se aproxima con dos colores sin location custom. Si al verlo en
            dispositivo el forest pesa de más, ajustar con `locations`. */}
        <LinearGradient
          colors={[moodColor, '#3F512F']}
          start={{ x: 0, y: 0.15 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.grab} />

        {/* 🔴 Firma "Sofía", no "vita" (07/09/2026). El momento es la card
            abierta, así que si el sello de la card es suyo este también tiene
            que serlo — con dos firmas distintas serían dos voces, que es lo que
            `la-voz-de-sofia.md` §4 viene a cerrar.
            ⚠️ Se cambió la PALABRA y no el símbolo: el isotipo es el mismo de
            Vita y también es el de Sofía (su orbe es el mismo invertido), así
            que la marca de la app no se pierde — el watermark grande de abajo
            sigue siendo el de siempre. */}
        <View style={s.markRow}>
          <VitaMark size={18} color="rgba(255,248,239,0.85)" strokeWidth={7} />
          <Text style={s.markText}>Sofía</Text>
        </View>

        <View style={s.watermarkWrap} pointerEvents="none">
          <VitaMark size={150} color="rgba(255,248,239,0.09)" strokeWidth={2} />
        </View>

        <Text style={s.reflect}>
          {reflection.before}
          <Text style={s.reflectBold}>{reflection.bold}</Text>
          {reflection.after}
        </Text>

        <View style={s.acts}>
          <Pressable style={s.go} onPress={seeProgress} accessibilityRole="button">
            <Text style={s.goText}>Ver mi progreso</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    backgroundColor: 'rgba(30,26,18,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingTop: 26,
    paddingHorizontal: 24,
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markText: {
    fontFamily: ViveFonts.feedback,
    fontStyle: 'italic',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  watermarkWrap: {
    position: 'absolute',
    top: -18,
    right: -22,
  },
  reflect: {
    fontFamily: ViveFonts.feedback,
    fontSize: 22,
    lineHeight: 33,
    color: '#FFF8EF',
    marginTop: 16,
  },
  reflectBold: {
    fontFamily: ViveFonts.title,
  },
  acts: {
    marginTop: 26,
  },
  go: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8EF',
    borderRadius: 16,
    paddingVertical: 14,
  },
  goText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14.5,
    color: '#3F512F',
  },
});
