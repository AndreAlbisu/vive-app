import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { registerForPushNotifications } from '@/lib/notifications';
import { reconcileResourceReminders } from '@/lib/resourceReminders';

const ONBOARDING_SCREENS = new Set(['index', 'onboarding-bifurcacion', 'onboarding2', 'onboarding3', 'onboarding4', 'onboarding5', 'login', 'register']);

function NotificationSetup() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications(user.id);
    reconcileResourceReminders(user.id);
  }, [user]);

  useEffect(() => {
    const fgSub = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notifs] Recibida en foreground:', notification.request.content.title);
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.type === 'invitacion_review' && data?.booking_id) {
        router.push({ pathname: '/review', params: { booking_id: data.booking_id } });
      }
      if (data?.type === 'resource_reminder' && data?.ref) {
        if (data.kind === 'coach_resource') {
          router.push({ pathname: '/coach-recurso', params: { id: data.ref } });
        } else {
          router.push(`/${data.ref}` as any);
        }
      }
    });

    return () => {
      fgSub.remove();
      tapSub.remove();
    };
  }, [router]);

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
  }, [user, loading, role, segments, router]);

  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Tope para la carga de tipografías. `useFonts` puede quedarse sin resolver ni
// fallar, y como el render está condicionado a ella, eso deja el splash nativo
// puesto para siempre: la app se ve colgada, sin error y sin salida. Expo Go
// nunca lo mostró porque no usa el splash de la app (docs de v54), así que el
// cuelgue se estrenó en el primer build standalone.
const FONT_TIMEOUT_MS = 5000;

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
  });

  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFontsTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  // Arrancar sin la tipografía cargada es feo pero usable; no arrancar, no.
  const ready = fontsLoaded || !!fontError || fontsTimedOut;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          <Stack.Screen name="nueva-contrasena" options={{ headerShown: false }} />
          <Stack.Screen name="coach-login" options={{ headerShown: false }} />
          <Stack.Screen name="coach-application" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(coach)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="profesional" options={{ headerShown: false }} />
          <Stack.Screen name="booking-calendar" options={{ headerShown: false }} />
          <Stack.Screen name="booking-time" options={{ headerShown: false }} />
          <Stack.Screen name="booking-confirm" options={{ headerShown: false }} />
          <Stack.Screen name="booking-success" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="diario"      options={{ headerShown: false }} />
          <Stack.Screen name="gratitud"   options={{ headerShown: false }} />
          <Stack.Screen name="respiracion" options={{ headerShown: false }} />
          <Stack.Screen name="meditacion" options={{ headerShown: false }} />
          <Stack.Screen name="escaner"    options={{ headerShown: false }} />
          <Stack.Screen name="anclaje"    options={{ headerShown: false }} />
          <Stack.Screen name="sueno"      options={{ headerShown: false }} />
          <Stack.Screen name="relajacion" options={{ headerShown: false }} />
          <Stack.Screen name="ruido"      options={{ headerShown: false }} />
          <Stack.Screen name="lecturas"   options={{ headerShown: false }} />
          <Stack.Screen name="progreso" options={{ headerShown: false }} />
          <Stack.Screen name="review" options={{ headerShown: false }} />
          <Stack.Screen name="favoritos" options={{ headerShown: false }} />
          <Stack.Screen name="quiz" options={{ headerShown: false }} />
          <Stack.Screen name="coach-topics" options={{ headerShown: false }} />
          <Stack.Screen name="coach-agenda" options={{ headerShown: false }} />
          <Stack.Screen name="resource-proposals" options={{ headerShown: false }} />
          <Stack.Screen name="resource-proposal-new" options={{ headerShown: false }} />
          <Stack.Screen name="recurso" options={{ headerShown: false }} />
          <Stack.Screen name="coach-recurso" options={{ headerShown: false }} />
          <Stack.Screen name="recursos-guardados" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="legal" options={{ headerShown: false }} />
          {/* Las cinco de acá abajo no estaban en esta lista — les faltaba el
              `headerShown: false` explícito que tiene el resto de la app, así
              que mostraban el header nativo de Expo Router (título = nombre de
              archivo) DUPLICADO encima del propio header que ya dibujan sus
              pantallas (`AdminScreen`, `BlockedAccountsScreen`,
              `CoachReservasScreen`, `UsdtPaymentScreen`, `RefundAddressScreen`
              — las cinco tienen su propio `SafeAreaView`+`s.header`). Mismo bug
              que ya se había arreglado antes para `coach-datos-cobro`.
              Encontradas de a una: primero al revisar la navegación nueva del
              coach (sesión 127/128 de Andre agregó `/coach-ajustes`, que
              linkea a `admin`/`cuentas-bloqueadas`), y de ahí se hizo el
              barrido completo del resto de `app/*.tsx` contra esta lista. */}
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="cuentas-bloqueadas" options={{ headerShown: false }} />
          <Stack.Screen name="coach-reservas" options={{ headerShown: false }} />
          <Stack.Screen name="pago-usdt" options={{ headerShown: false }} />
          <Stack.Screen name="reembolso" options={{ headerShown: false }} />
          <Stack.Screen name="perfil" options={{ headerShown: false }} />
          <Stack.Screen name="agenda" options={{ headerShown: false }} />
          <Stack.Screen name="coach-availability" options={{ headerShown: false }} />
          <Stack.Screen name="coach-notifications" options={{ headerShown: false }} />
          <Stack.Screen name="coach-recurso-nuevo" options={{ headerShown: false }} />
          <Stack.Screen name="coach-weekly-pattern" options={{ headerShown: false }} />
          <Stack.Screen name="coach-visibilidad" options={{ headerShown: false }} />
          <Stack.Screen name="coach-datos-cobro" options={{ headerShown: false }} />
          <Stack.Screen name="coach-credenciales" options={{ headerShown: false }} />
          <Stack.Screen name="coach-ajustes" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="explorar-recursos" options={{ headerShown: false }} />
          <Stack.Screen name="mis-recomendaciones" options={{ headerShown: false }} />
          <Stack.Screen name="mis-recordatorios" options={{ headerShown: false }} />
          <Stack.Screen name="profile-own" options={{ headerShown: false }} />
          <Stack.Screen name="search3" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
