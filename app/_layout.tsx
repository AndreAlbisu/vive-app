import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { registerForPushNotifications } from '@/lib/notifications';

const ONBOARDING_SCREENS = new Set(['index', 'onboarding-bifurcacion', 'onboarding2', 'onboarding3', 'onboarding4', 'onboarding5', 'login', 'register']);

function NotificationSetup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications(user.id);
  }, [user?.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notifs] Recibida en foreground:', notification.request.content.title);
    });
    return () => sub.remove();
  }, []);

  return null;
}

function AuthRedirect() {
  const { user, loading, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inCoachGroup = segments[0] === '(coach)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboardingOrAuth = ONBOARDING_SCREENS.has(segments[0] as string);

    if (!user) {
      if (inCoachGroup) router.replace('/onboarding-bifurcacion');
      return;
    }

    const destination = role === 'coach' ? '/(coach)' : '/(tabs)';

    if (inOnboardingOrAuth) {
      router.replace(destination as any);
    } else if (role === 'coach' && inTabsGroup) {
      router.replace('/(coach)');
    } else if (role === 'user' && inCoachGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, role, segments]);

  return null;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Fraunces_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <AuthRedirect />
      <NotificationSetup />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding-bifurcacion" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding2" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding3" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding4" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding5" options={{ headerShown: false }} />
          <Stack.Screen name="sala" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="coach-login" options={{ headerShown: false }} />
          <Stack.Screen name="coach-application" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profesional" options={{ headerShown: false }} />
          <Stack.Screen name="booking-calendar" options={{ headerShown: false }} />
          <Stack.Screen name="booking-time" options={{ headerShown: false }} />
          <Stack.Screen name="booking-confirm" options={{ headerShown: false }} />
          <Stack.Screen name="booking-success" options={{ headerShown: false }} />
          <Stack.Screen name="diario" options={{ headerShown: false }} />
          <Stack.Screen name="gratitud" options={{ headerShown: false }} />
          <Stack.Screen name="progreso" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
