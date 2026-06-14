import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type UniversoId = 'cuerpo' | 'mente' | 'alma';

const UNIVERSOS: {
  id: UniversoId;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  desc: string;
  accent: string;
  accentLight: string;
  accentShadow: string;
}[] = [
  {
    id: 'cuerpo',
    icon: 'heart-outline',
    title: 'Cuerpo',
    desc: 'Cómo te sentís físicamente',
    accent: '#E8743B',
    accentLight: 'rgba(232, 116, 59, 0.10)',
    accentShadow: 'rgba(232, 116, 59, 0.20)',
  },
  {
    id: 'mente',
    icon: 'brain',
    title: 'Mente',
    desc: 'Tus emociones, tu cabeza y tus vínculos',
    accent: '#5B8DB8',
    accentLight: 'rgba(91, 141, 184, 0.10)',
    accentShadow: 'rgba(91, 141, 184, 0.20)',
  },
  {
    id: 'alma',
    icon: 'shimmer',
    title: 'Alma',
    desc: 'Tu rumbo, tu propósito y tu crecimiento',
    accent: '#9B7FD4',
    accentLight: 'rgba(155, 127, 212, 0.10)',
    accentShadow: 'rgba(155, 127, 212, 0.20)',
  },
];

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function OnboardingScreen3() {
  const router = useRouter();
  const [selected, setSelected] = useState<UniversoId | null>(null);

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
    router.push({ pathname: '/onboarding4', params: { universo: selected } });
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
        <Text style={styles.progressLabel}>Paso 1 de 3</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.questionArea}>
          <Animated.Text style={[styles.title, fadeUp(titleAnim)]}>
            ¿Por dónde querés empezar?
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, fadeUp(subtitleAnim)]}>
            Arranquemos por lo que más te está pesando hoy
          </Animated.Text>
        </View>

        <Animated.View style={[styles.cards, fadeUp(cardsAnim)]}>
          {UNIVERSOS.map((u) => {
            const isSelected = selected === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                style={[
                  styles.card,
                  { borderColor: isSelected ? u.accent : 'transparent' },
                  isSelected && {
                    backgroundColor: u.accentLight,
                    shadowColor: u.accent,
                    shadowOpacity: 0.22,
                    shadowRadius: 16,
                    elevation: 6,
                  },
                ]}
                onPress={() => setSelected(u.id)}
                activeOpacity={0.82}
              >
                <View style={[styles.iconBubble, { backgroundColor: isSelected ? 'rgba(255,255,255,0.55)' : u.accentLight }]}>
                  <MaterialCommunityIcons name={u.icon} size={28} color={u.accent} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{u.title}</Text>
                  <Text style={styles.cardDesc}>{u.desc}</Text>
                </View>
                {isSelected && (
                  <Text style={[styles.cardArrow, { color: u.accent }]}>→</Text>
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
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 2,
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: ViveFonts.bold,
    fontSize: 18,
    color: ViveColors.text,
    lineHeight: 24,
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
