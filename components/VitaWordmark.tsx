import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { ViveFonts } from '@/constants/theme';

/**
 * Wordmark "vita" — único en toda la app (Home, onboarding, login, register,
 * splash, etc.). Plus Jakarta Sans ExtraBold (24/08/2026, era Fraunces
 * SemiBold — Fraunces salió del proyecto), minúscula, sin tracking extra,
 * mismo tamaño y color en todos lados. `style` es solo para posicionamiento
 * (márgenes, alineación) — no para pisar tipografía/color/tamaño.
 */
export function VitaWordmark({ style }: { style?: StyleProp<TextStyle> }) {
  return <Text style={[s.wordmark, style]}>vita</Text>;
}

const s = StyleSheet.create({
  wordmark: {
    fontFamily: ViveFonts.wordmark,
    fontSize: 28,
    letterSpacing: 0,
    color: '#565E32',
  },
});
