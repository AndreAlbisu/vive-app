import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts } from '@/constants/theme';
import { VitaMark } from '@/components/VitaMark';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Reflection } from '@/lib/weeklyReflection';

// El momento de pantalla completa (Parte C). Modal transparente + Animated.View
// propios en vez del `animationType="slide"` nativo — igual que el bottom sheet
// de filtros en app/search3.tsx — porque necesitamos el easing exacto del
// mockup (cubic-bezier(.32,.1,.25,1), 400ms), que el slide nativo no permite
// controlar.
//
// `visible` es un prop, no estado propio: quien lo usa (Inicio) decide CUÁNDO
// corresponde mostrarlo (ver lib/sobreVosMomento.ts). Este componente solo
// sabe animar la entrada/salida — por eso mantiene su propio `mounted`,
// desacoplado de `visible`, para poder animar la salida ANTES de desmontar
// (si atara el Modal directo a `visible`, se iría de golpe sin transición).

const OFFSCREEN = 700; // mismo valor que usa search3.tsx para su sheet — sale de pantalla de sobra sin depender de Dimensions.

type Props = {
  visible: boolean;
  reflection: Reflection | null;
  moodColor: string | null;
  onClose: () => void;
  onSeeProgress: () => void;
};

export function SobreVosMomento({ visible, reflection, moodColor, onClose, onSeeProgress }: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
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
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: reducedMotion ? 100 : 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: OFFSCREEN, duration: reducedMotion ? 100 : 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, reducedMotion, backdropOpacity, translateY]);

  if (!reflection || !moodColor) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] },
        ]}
        // Sin esto, la vista se re-rasteriza (bordes redondeados + overflow
        // hidden + el gradiente adentro) en CADA frame del translateY — es lo
        // que se sentía como lag al aparecer. Con esto, el sistema la renderiza
        // una vez como bitmap y solo mueve esa imagen durante la animación.
        shouldRasterizeIOS
        renderToHardwareTextureAndroid
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

        <View style={s.markRow}>
          <VitaMark size={18} color="rgba(255,248,239,0.85)" strokeWidth={7} />
          <Text style={s.markText}>vita</Text>
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
          <Pressable style={s.go} onPress={onClose} accessibilityRole="button">
            <Text style={s.goText}>Seguir</Text>
          </Pressable>
          <Pressable style={s.sub} onPress={onSeeProgress} accessibilityRole="button">
            <Text style={s.subText}>Ver mi progreso completo</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    fontFamily: ViveFonts.frauncesSemiBold,
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
    fontFamily: ViveFonts.frauncesSemiBold,
    fontSize: 22,
    lineHeight: 33,
    color: '#FFF8EF',
    marginTop: 16,
  },
  reflectBold: {
    fontFamily: ViveFonts.frauncesSerif,
  },
  acts: {
    marginTop: 26,
    gap: 10,
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
  sub: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  subText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
});
