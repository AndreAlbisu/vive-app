import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const ONBOARDING_SCREENS = new Set(['index', 'onboarding2', 'onboarding3', 'onboarding4', 'onboarding5', 'login', 'register']);

function AuthRedirect() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inProtectedGroup = segments[0] === '(coach)';
    const inOnboardingOrAuth = ONBOARDING_SCREENS.has(segments[0] as string);

    if (!user && inProtectedGroup) {
      router.replace('/');
    } else if (user && inOnboardingOrAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding2" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding3" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding4" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding5" options={{ headerShown: false }} />
          <Stack.Screen name="sala" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="profesional" options={{ headerShown: false }} />
          <Stack.Screen name="booking-calendar" options={{ headerShown: false }} />
          <Stack.Screen name="booking-time" options={{ headerShown: false }} />
          <Stack.Screen name="booking-confirm" options={{ headerShown: false }} />
          <Stack.Screen name="sessions" options={{ headerShown: false }} />
          <Stack.Screen name="diario" options={{ headerShown: false }} />
          <Stack.Screen name="gratitud" options={{ headerShown: false }} />
          <Stack.Screen name="profile-own" options={{ headerShown: false }} />
          <Stack.Screen name="search1" options={{ headerShown: false }} />
          <Stack.Screen name="search2" options={{ headerShown: false }} />
          <Stack.Screen name="search3" options={{ headerShown: false }} />
          <Stack.Screen name="(coach)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="coach-reservas" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <AuthRedirect />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}
