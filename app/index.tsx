import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ViveColors, ViveFonts } from '@/constants/theme';
import OnboardingScreen1 from '@/screens/OnboardingScreen1';

export default function Index() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(role === 'coach' ? '/(coach)' : '/(tabs)' as any);
    }
  }, [user, loading, role]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>v</Text>
          <MaterialCommunityIcons name="sprout" size={30} color={ViveColors.primary} style={styles.logoIcon} />
          <Text style={styles.logo}>ve</Text>
        </View>
      </View>
    );
  }

  if (user) return null;

  return <OnboardingScreen1 />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: ViveColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 42,
    color: ViveColors.primary,
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  logoIcon: {
    marginTop: 4,
  },
});
