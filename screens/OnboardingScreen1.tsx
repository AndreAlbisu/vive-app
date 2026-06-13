import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';

export default function OnboardingScreen1() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>vive</Text>
        <Text style={styles.subtitle}>Tu camino empieza acá</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => router.push('/onboarding2')}>
          <Text style={styles.buttonText}>¿Empezamos?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ViveColors.background,
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 80,
    color: ViveColors.primary,
    letterSpacing: -3,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 18,
    color: ViveColors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  footer: {
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
