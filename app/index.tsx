import { useEffect, useState, type ComponentType } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ViveColors } from '@/constants/theme';
// Las bienvenidas conviven y sale una AL AZAR cada vez que se abre la app
// sin sesión (idea de Andre y Joaquín, 07/10):
//   1 = "alguien llega": un círculo solo, el toque trae a otro y se arma el logo.
//   2 = "tres en uno": la idea de Joaquín (tres círculos que se hacen uno con
//       "vita" al medio, manteniendo apretado), rediseñada.
//   3 = esa misma idea como estaba antes del rediseño (`OnboardingScreen1`).
//   4 = "el puente": la imagen del pitch y de la web. Se tiende un puente
//       entre "vos" y "la ayuda", un punto cruza y aparece el isotipo.
//   5 = "alguien cerca": un círculo lleno, solo; el toque le trae compañía y
//       queda el isotipo B (el del círculo terracota), no el de los tres aros.
//   6 = "abrirse": un aro cerrado que se abre para que entren los otros dos.
//       Termina en el isotipo de aros abiertos.
//   7 = "el encuentro": tres aros separados que se juntan, y el pedacito que
//       comparten se llena. Termina en el de círculos con el centro relleno.
//   8 = "las ondas": tres puntos de los que salen ondas hasta cruzarse.
//       Termina en el isotipo concéntrico.
// 📌 De la 5 a la 8 terminan cada una en un isotipo candidato distinto (Andre,
// 12/10): sirven también para comparar los logos en el teléfono.
// El selector "1 · 2 · … · 8" de arriba sale SOLO en desarrollo, para forzar una.
// Cuál salió queda anotado (`onboarding_variante`), así se puede ver después
// cuál lleva más gente a la pantalla siguiente.
import OnboardingLlega from '@/screens/OnboardingLlega';
import OnboardingScreen1 from '@/screens/OnboardingScreen1';
import OnboardingTresEnUno from '@/screens/OnboardingTresEnUno';
import OnboardingPuente from '@/screens/OnboardingPuente';
import OnboardingCerca from '@/screens/OnboardingCerca';
import OnboardingAbrirse from '@/screens/OnboardingAbrirse';
import OnboardingEncuentro from '@/screens/OnboardingEncuentro';
import OnboardingOndas from '@/screens/OnboardingOndas';
import { VitaWordmark } from '@/components/VitaWordmark';
import { limpiarTono } from '@/constants/onboardingTonos';
import { destinoTrasEntrar } from '@/lib/entrada';
import { anotar } from '@/lib/analytics';

type Opcion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const PANTALLAS: Record<Opcion, ComponentType> = {
  1: OnboardingLlega,
  2: OnboardingTresEnUno,
  3: OnboardingScreen1,
  4: OnboardingPuente,
  5: OnboardingCerca,
  6: OnboardingAbrirse,
  7: OnboardingEncuentro,
  8: OnboardingOndas,
};
const OPCIONES: Opcion[] = [1, 2, 3, 4, 5, 6, 7, 8];

// La última que salió en esta apertura de la app, para no repetirla seguida
// (por ejemplo al cerrar sesión y volver a la bienvenida).
let ultima: Opcion | null = null;
function sortear(): Opcion {
  const posibles = OPCIONES.filter(o => o !== ultima);
  const elegida = posibles[Math.floor(Math.random() * posibles.length)];
  ultima = elegida;
  return elegida;
}

export default function Index() {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [opcion, setOpcion] = useState<Opcion>(sortear);
  // Cambia en cada toque del selector: tocar la misma opción la repite.
  const [vuelta, setVuelta] = useState(0);

  const mostrando = !loading && !user;
  useEffect(() => {
    if (mostrando) anotar('onboarding_variante', { variante: opcion });
  }, [mostrando, opcion, vuelta]);

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

  const Pantalla = PANTALLAS[opcion];

  return (
    <View style={styles.todo}>
      <Pantalla key={vuelta} />
      {__DEV__ && (
        <View style={[styles.selector, { top: insets.top + 6 }]}>
          {OPCIONES.map(n => (
            <Pressable
              key={n}
              hitSlop={8}
              onPress={() => { setOpcion(n); setVuelta(v => v + 1); }}
              style={[styles.opcion, opcion === n && styles.opcionActiva]}>
              <Text style={[styles.opcionTexto, opcion === n && styles.opcionTextoActiva]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  todo: { flex: 1 },
  selector: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    gap: 5,
  },
  opcion: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(86,94,50,0.10)',
  },
  opcionActiva: { backgroundColor: ViveColors.accent },
  opcionTexto: { fontSize: 14, color: ViveColors.text },
  opcionTextoActiva: { color: ViveColors.background },
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
