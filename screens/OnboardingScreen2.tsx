import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ViveColors, ViveFonts } from '@/constants/theme';

type OptionId = 'explore' | 'search' | 'guide';

const OPTIONS: { id: OptionId; label: string; log: string }[] = [
  { id: 'explore', label: 'Quiero explorar la app', log: 'ir a Inicio' },
  { id: 'search', label: 'Sé qué necesito, busco con quién', log: 'ir a Conexiones con buscador' },
  { id: 'guide', label: 'No sé por dónde empezar', log: 'iniciar matching guiado' },
];

export default function OnboardingScreen2() {
  const [selected, setSelected] = useState<OptionId | null>(null);
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: selected ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  function handleContinue() {
    if (!selected) return;
    const option = OPTIONS.find((o) => o.id === selected)!;
    console.log(`[VIVE Onboarding] ${option.log}`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>¿Cómo querés empezar?</Text>
        </View>

        <View style={styles.cards}>
          {OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(option.id)}
                activeOpacity={0.82}
              >
                <Text style={styles.cardText}>{option.label}</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 32,
    paddingTop: 56,
    gap: 36,
  },
  header: {
    gap: 10,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 30,
    color: ViveColors.text,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  microcopy: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    opacity: 0.6,
    lineHeight: 22,
  },
  cards: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: ViveColors.primary,
    backgroundColor: '#FDF0E8',
  },
  cardText: {
    fontFamily: ViveFonts.medium,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 32,
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
