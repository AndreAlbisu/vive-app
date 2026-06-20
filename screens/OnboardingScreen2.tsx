import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';

type OptionId = 'explore' | 'search' | 'guide';

const OPTIONS: {
  id: OptionId;
  title: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  accentLight: string;
}[] = [
  {
    id: 'explore',
    title: 'Quiero explorar la app',
    desc: 'Ver todo lo que ofrece VIVE',
    icon: 'map-outline',
    accent: '#E8743B',
    accentLight: 'rgba(232, 116, 59, 0.10)',
  },
  {
    id: 'search',
    title: 'Sé qué necesito',
    desc: 'Busco el profesional indicado',
    icon: 'compass-outline',
    accent: '#5B8DB8',
    accentLight: 'rgba(91, 141, 184, 0.10)',
  },
  {
    id: 'guide',
    title: 'No sé por dónde empezar',
    desc: 'Necesito que me orienten',
    icon: 'shimmer',
    accent: '#9B7FD4',
    accentLight: 'rgba(155, 127, 212, 0.10)',
  },
];

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
});

export default function OnboardingScreen2() {
  const router = useRouter();
  const [selected, setSelected] = useState<OptionId | null>(null);

  const titleAnim = useRef(new Animated.Value(0)).current;
  const card0Anim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const cardAnims = [card0Anim, card1Anim, card2Anim];

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(titleAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(card0Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(card1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(card2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
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
    if (selected === 'explore') { router.replace('/(tabs)' as any); return; }
    if (selected === 'search') { router.replace('/register'); return; }
    if (selected === 'guide') { router.push('/onboarding3'); return; }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { console.log('[vita back] onboarding2 → back'); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={ViveColors.text} />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View style={fadeUp(titleAnim)}>
          <Text style={styles.title}>¿Cómo te gustaría empezar?</Text>
        </Animated.View>

        <View style={styles.cards}>
          {OPTIONS.map((option, i) => {
            const isSelected = selected === option.id;
            return (
              <Animated.View key={option.id} style={[{ flex: 1 }, fadeUp(cardAnims[i])]}>
                <ScaleCard
                  onPress={() => setSelected(option.id)}
                  style={[
                    styles.card,
                    { borderColor: isSelected ? option.accent : 'transparent' },
                    isSelected && {
                      backgroundColor: option.accentLight,
                      shadowColor: option.accent,
                      shadowOpacity: 0.22,
                      shadowRadius: 14,
                      elevation: 6,
                    },
                  ]}
                >
                  <View style={[styles.iconBubble, { backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : option.accentLight }]}>
                    <MaterialCommunityIcons name={option.icon} size={26} color={option.accent} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{option.title}</Text>
                    <Text style={styles.cardDesc}>{option.desc}</Text>
                  </View>
                </ScaleCard>
              </Animated.View>
            );
          })}
        </View>
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.45,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 32,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 34,
    color: ViveColors.text,
    letterSpacing: -0.5,
    lineHeight: 42,
    textAlign: 'center',
  },
  cards: {
    flex: 1,
    gap: 12,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 22,
    textAlign: 'center',
  },
  cardDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.55,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
