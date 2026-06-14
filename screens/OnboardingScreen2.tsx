import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type OptionId = 'explore' | 'search' | 'guide';

const OPTIONS: {
  id: OptionId;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  color: string;
}[] = [
  { id: 'explore', label: 'Quiero explorar la app', icon: 'map-outline', bg: '#FFF3EE', color: '#E8743B' },
  { id: 'search', label: 'Sé qué necesito, busco con quién', icon: 'compass-outline', bg: '#EEF4FF', color: '#5B8DB8' },
  { id: 'guide', label: 'No sé por dónde empezar', icon: 'shimmer', bg: '#F0FBF4', color: '#6BBF8A' },
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
    if (selected === 'explore') { router.replace('/(tabs)/'); return; }
    if (selected === 'guide') { router.push('/onboarding3'); return; }
    console.log('[VIVE Onboarding] ir a Conexiones con buscador');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={fadeUp(titleAnim)}>
          <Text style={styles.title}>¿Cómo te gustaría empezar?</Text>
        </Animated.View>

        <View style={styles.cards}>
          {OPTIONS.map((option, i) => {
            const isSelected = selected === option.id;
            return (
              <Animated.View key={option.id} style={[styles.cardWrap, fadeUp(cardAnims[i])]}>
                <TouchableOpacity
                  onPress={() => setSelected(option.id)}
                  activeOpacity={0.82}
                  style={[
                    styles.card,
                    { backgroundColor: option.bg },
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <MaterialCommunityIcons name={option.icon} size={40} color={option.color} />
                  <Text style={[styles.cardLabel, { color: ViveColors.text }]}>{option.label}</Text>
                </TouchableOpacity>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 32,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 34,
    color: ViveColors.text,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  cards: {
    flex: 1,
    gap: 14,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderWidth: 2.5,
    borderColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  cardSelected: {
    borderColor: 'rgba(31,74,67,0.25)',
  },
  cardLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
    letterSpacing: -0.2,
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
