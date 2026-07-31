import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ViveColors } from '@/constants/theme';
import OnboardingScreen1 from '@/screens/OnboardingScreen1';
import { VitaWordmark } from '@/components/VitaWordmark';

export default function Index() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(role === 'coach' ? '/(coach)' : '/(tabs)' as any);
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <VitaWordmark />
        <ActivityIndicator color={ViveColors.primary} style={styles.spinner} />
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
  spinner: {
    marginTop: 16,
  },
});
