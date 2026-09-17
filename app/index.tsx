import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ViveColors } from '@/constants/theme';
import OnboardingScreen1 from '@/screens/OnboardingScreen1';
import { VitaWordmark } from '@/components/VitaWordmark';
import { limpiarTono } from '@/constants/onboardingTonos';
import { destinoTrasEntrar } from '@/lib/entrada';

export default function Index() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      // Entrar a la app es el final del onboarding: el tono del camino elegido
      // deja de aplicar. Si no, queda guardado para siempre y tiñe pantallas de
      // auth a las que se llega por cualquier otro lado.
      void limpiarTono();
      // Mismo criterio que `AuthRedirect`: la vuelta de Google o Apple puede caer
      // acá, y una cuenta recién creada tiene que seguir a "¿Cómo te gustaría
      // empezar?", no saltearla.
      void destinoTrasEntrar(user, role).then(d => router.replace(d as any));
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
