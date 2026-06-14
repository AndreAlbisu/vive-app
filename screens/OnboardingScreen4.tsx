import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type UniversoId = 'cuerpo' | 'mente' | 'alma';

const SUBCATEGORIAS: Record<UniversoId, { id: string; title: string; desc: string }[]> = {
  cuerpo: [
    { id: 'energia', title: 'Energía y hábitos', desc: 'Cómo te movés y recargás día a día' },
    { id: 'alimentacion', title: 'Alimentación', desc: 'Tu relación con lo que comés' },
    { id: 'sexualidad', title: 'Sexualidad e intimidad', desc: 'Tu cuerpo, tu deseo y tus vínculos íntimos' },
  ],
  mente: [
    { id: 'sentirme', title: 'Sentirme mejor con lo que estoy viviendo', desc: 'Lo que está pasando ahora' },
    { id: 'entender', title: 'Entender por qué me pasa lo que me pasa', desc: 'Ir más a fondo' },
    { id: 'vinculos', title: 'Lo que me pasa con mis vínculos', desc: 'Tus relaciones y lo que generan' },
  ],
  alma: [
    { id: 'rumbo', title: 'Mi rumbo y mi propósito', desc: 'A dónde vas y por qué' },
    { id: 'crecer', title: 'Crecer y motivarme', desc: 'Avanzar y encontrar impulso' },
    { id: 'trabajo', title: 'Trabajo y carrera', desc: 'Tu vida profesional y lo que querés de ella' },
  ],
};

const UNIVERSO_COLORS: Record<UniversoId, { accent: string; accentLight: string }> = {
  cuerpo: { accent: '#E8743B', accentLight: 'rgba(232, 116, 59, 0.10)' },
  mente: { accent: '#5B8DB8', accentLight: 'rgba(91, 141, 184, 0.10)' },
  alma: { accent: '#9B7FD4', accentLight: 'rgba(155, 127, 212, 0.10)' },
};

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function OnboardingScreen4() {
  const router = useRouter();
  const { universo } = useLocalSearchParams<{ universo: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const u = (universo as UniversoId) ?? 'cuerpo';
  const subcats = SUBCATEGORIAS[u] ?? SUBCATEGORIAS.cuerpo;
  const { accent, accentLight } = UNIVERSO_COLORS[u] ?? UNIVERSO_COLORS.cuerpo;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(headerAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(cardsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: selected ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  function handleContinue() {
    if (!selected) return;
    router.push({ pathname: '/onboarding5', params: { universo: u, categoria: selected } });
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
        <Text style={styles.progressLabel}>Paso 2 de 3</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.questionArea}>
          <Animated.Text style={[styles.title, fadeUp(titleAnim)]}>
            ¿Qué aspecto querés explorar?
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, fadeUp(subtitleAnim)]}>
            Elegí por donde querés arrancar
          </Animated.Text>
        </View>

        <Animated.View style={[styles.cards, fadeUp(cardsAnim)]}>
          {subcats.map((sub) => {
            const isSelected = selected === sub.id;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.card,
                  { borderColor: isSelected ? accent : 'transparent' },
                  isSelected && {
                    backgroundColor: accentLight,
                    shadowColor: accent,
                    shadowOpacity: 0.22,
                    shadowRadius: 16,
                    elevation: 6,
                  },
                ]}
                onPress={() => setSelected(sub.id)}
                activeOpacity={0.82}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{sub.title}</Text>
                  <Text style={styles.cardDesc}>{sub.desc}</Text>
                </View>
                {isSelected && (
                  <Text style={[styles.cardArrow, { color: accent }]}>→</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: buttonAnim }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>¿Seguimos?</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 32,
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
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 22,
  },
  cardDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.55,
    lineHeight: 18,
  },
  cardArrow: {
    fontSize: 20,
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
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
