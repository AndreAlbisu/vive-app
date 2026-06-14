import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type UniversoId = 'cuerpo' | 'mente' | 'alma';

const TEMAS: Record<string, string[]> = {
  cuerpo_energia: ['Sueño', 'Energía y cansancio', 'Actividad física', 'Hábitos', 'Tensión física'],
  cuerpo_alimentacion: ['Comer mejor', 'Relación con la comida'],
  cuerpo_sexualidad: ['Deseo', 'Intimidad', 'Vínculo sexual'],
  mente_sentirme: ['Ansiedad', 'Estrés', 'Tristeza/bajón', 'Pánico', 'Insomnio'],
  mente_entender: ['Patrones que se repiten', 'Autoestima', 'Emociones', 'Mi historia'],
  mente_vinculos: ['Pareja', 'Separación/ruptura', 'Familia', 'Amistades', 'Duelo', 'Comunicación'],
  alma_rumbo: ['Propósito', 'Momentos de cambio', 'Decisiones grandes', 'Identidad'],
  alma_crecer: ['Motivación', 'Hábitos', 'Crecimiento personal', 'Espiritualidad'],
  alma_trabajo: ['Carrera', 'Productividad', 'Liderazgo', 'Decisiones laborales'],
};

const UNIVERSO_COLORS: Record<UniversoId, { accent: string; accentLight: string }> = {
  cuerpo: { accent: '#E8743B', accentLight: 'rgba(232, 116, 59, 0.12)' },
  mente: { accent: '#5B8DB8', accentLight: 'rgba(91, 141, 184, 0.12)' },
  alma: { accent: '#9B7FD4', accentLight: 'rgba(155, 127, 212, 0.12)' },
};

function chipConfig(text: string) {
  const len = text.length;
  if (len <= 7)  return { flexGrow: 1, flexBasis: 82,  borderRadius: 22, py: 18, px: 16, fontSize: 14 };
  if (len <= 13) return { flexGrow: 1, flexBasis: 148, borderRadius: 18, py: 18, px: 20, fontSize: 15 };
  return              { flexGrow: 2, flexBasis: 220, borderRadius: 14, py: 20, px: 22, fontSize: 14 };
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function OnboardingScreen5() {
  const router = useRouter();
  const { universo, categoria } = useLocalSearchParams<{ universo: string; categoria: string }>();
  const [selected, setSelected] = useState<string[]>([]);

  const u = (universo as UniversoId) ?? 'cuerpo';
  const key = `${u}_${categoria}`;
  const temas = TEMAS[key] ?? [];
  const { accent } = UNIVERSO_COLORS[u] ?? UNIVERSO_COLORS.cuerpo;

  // Per-chip animated value (0 = idle, 1 = selected)
  const selectionAnims = useRef<Record<string, Animated.Value>>({});
  function getAnim(tema: string): Animated.Value {
    if (!selectionAnims.current[tema]) {
      selectionAnims.current[tema] = new Animated.Value(0);
    }
    return selectionAnims.current[tema];
  }

  // Per-chip press scale (useNativeDriver:false — same driver as color animations)
  const pressScaleAnims = useRef<Record<string, Animated.Value>>({});
  function getPressAnim(tema: string): Animated.Value {
    if (!pressScaleAnims.current[tema]) {
      pressScaleAnims.current[tema] = new Animated.Value(1);
    }
    return pressScaleAnims.current[tema];
  }

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const titleAnim   = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const chipsAnim   = useRef(new Animated.Value(0)).current;
  const buttonAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(headerAnim,   { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(titleAnim,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(chipsAnim,    { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: selected.length > 0 ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  function toggleTema(tema: string) {
    const anim = getAnim(tema);
    const isCurrentlySelected = selected.includes(tema);
    Animated.timing(anim, {
      toValue: isCurrentlySelected ? 0 : 1,
      duration: 260,
      useNativeDriver: false,
    }).start();
    setSelected((prev) =>
      isCurrentlySelected ? prev.filter((t) => t !== tema) : [...prev, tema]
    );
  }

  function handleContinue() {
    if (selected.length === 0) return;
    console.log('[VIVE Matching] temas seleccionados:', selected);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={ViveColors.text} />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>v</Text>
          <MaterialCommunityIcons name="sprout" size={22} color={ViveColors.primary} style={styles.logoIcon} />
          <Text style={styles.logo}>ve</Text>
        </View>
        <View style={styles.headerSide} />
      </Animated.View>

      <Animated.View style={[styles.progressArea, fadeUp(progressAnim)]}>
        <Text style={styles.progressLabel}>Paso 3 de 3</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionArea}>
          <Animated.Text style={[styles.title, fadeUp(titleAnim)]}>
            ¿Qué te está pasando puntualmente?
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, fadeUp(subtitleAnim)]}>
            Podés elegir más de uno
          </Animated.Text>
        </View>

        <Animated.View style={[styles.mosaic, fadeUp(chipsAnim)]}>
          {temas.map((tema) => {
            const anim = getAnim(tema);
            const cfg = chipConfig(tema);

            const animBorderColor = anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(31,74,67,0.14)', accent],
            });
            const animBg = anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['#FFFFFF', accent],
            });
            const animShadowOpacity = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.20],
            });
            const animTextColor = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [ViveColors.text, '#FFFFFF'],
            });

            const pressAnim = getPressAnim(tema);
            return (
              <AnimatedTouchable
                key={tema}
                onPress={() => toggleTema(tema)}
                activeOpacity={0.95}
                onPressIn={() =>
                  Animated.spring(pressAnim, { toValue: 0.94, useNativeDriver: false, damping: 20, stiffness: 300 }).start()
                }
                onPressOut={() =>
                  Animated.spring(pressAnim, { toValue: 1, useNativeDriver: false, damping: 14, stiffness: 180 }).start()
                }
                style={[
                  styles.chip,
                  {
                    flexGrow: cfg.flexGrow,
                    flexBasis: cfg.flexBasis,
                    borderRadius: cfg.borderRadius,
                    paddingVertical: cfg.py,
                    paddingHorizontal: cfg.px,
                    backgroundColor: animBg,
                    borderColor: animBorderColor,
                    shadowOpacity: animShadowOpacity,
                    transform: [{ scale: pressAnim }],
                  },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.chipText,
                    { fontSize: cfg.fontSize, color: animTextColor },
                  ]}
                >
                  {tema}
                </Animated.Text>
              </AnimatedTouchable>
            );
          })}
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.footer, { opacity: buttonAnim }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={selected.length === 0}
        >
          <Text style={styles.buttonText}>Ver profesionales</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.45,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 24,
    color: ViveColors.primary,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  logoIcon: {
    marginTop: 1,
  },
  headerSide: {
    minWidth: 60,
  },
  progressArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  progressLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.55,
  },
  progressBar: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(31, 74, 67, 0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ViveColors.accent,
    borderRadius: 999,
  },
  scroll: {
    flex: 1,
  },
  // flexGrow:1 + justifyContent:'center' centers content vertically
  // when it fits; scroll kicks in only when content overflows
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 36,
    justifyContent: 'center',
  },
  questionArea: {
    gap: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: ViveFonts.bold,
    fontSize: 28,
    color: ViveColors.text,
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    opacity: 0.55,
    lineHeight: 22,
    textAlign: 'center',
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowColor: '#1F4A43',
    elevation: 2,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  button: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
