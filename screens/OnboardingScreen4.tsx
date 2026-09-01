import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { useTonoOnboarding } from '@/hooks/useTonoOnboarding';
import { AppBg } from '@/components/ui/AppBg';
import { VitaWordmark } from '@/components/VitaWordmark';
import { guardarRespuestas, puertaDeCategoria } from '@/lib/onboardingRespuestas';
import { registrarEvento } from '@/lib/supabase';

// La única pregunta que queda después de "¿Qué te trae por acá?" — opción A del
// brief (`docs/onboarding-bifurcacion-opciones.md`), elegida el 01/09/2026.
//
// 🔴 Antes era el paso 2 de 3 y venía detrás de otra pantalla que preguntaba el
// universo por separado. Ese paso se colapsó en la pregunta anterior, así que
// esta pasó a ser la última: dos pantallas para quien trae algo, donde antes
// había cuatro para todos.
//
// 🔴 Y su botón dejó de mentir. El flujo terminaba con un tercer paso cuyo
// botón decía "Ver profesionales" y hacía `router.replace('/register')`:
// contestabas tres pantallas, te prometían profesionales y aparecía un campo de
// email. Ahora la promesa se cumple en el acto y sin cuenta — Profesionales
// anda como anónimo, `requestAuth` recién aparece al reservar.

type UniversoId = 'cuerpo' | 'mente' | 'alma';

const SUBCATEGORIAS: Record<UniversoId, { id: string; title: string; desc: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[]> = {
  cuerpo: [
    { id: 'energia', title: 'Energía y hábitos', desc: 'Cómo te movés y recargás día a día', icon: 'lightning-bolt-outline' },
    { id: 'alimentacion', title: 'Alimentación', desc: 'Tu relación con lo que comés', icon: 'food-apple-outline' },
    { id: 'sexualidad', title: 'Sexualidad e intimidad', desc: 'Tu cuerpo, tu deseo y tus vínculos íntimos', icon: 'flower-outline' },
  ],
  mente: [
    { id: 'sentirme', title: 'Sentirme mejor', desc: 'Con lo que estoy viviendo ahora', icon: 'emoticon-outline' },
    { id: 'entender', title: 'Entender qué me pasa', desc: 'Ir más a fondo en mis patrones', icon: 'magnify' },
    { id: 'vinculos', title: 'Mis vínculos', desc: 'Tus relaciones y lo que generan', icon: 'account-group-outline' },
  ],
  alma: [
    { id: 'rumbo', title: 'Mi rumbo y propósito', desc: 'A dónde vas y por qué', icon: 'map-marker-outline' },
    { id: 'crecer', title: 'Crecer y motivarme', desc: 'Avanzar y encontrar impulso', icon: 'leaf' },
    { id: 'trabajo', title: 'Trabajo y carrera', desc: 'Tu vida profesional y lo que querés', icon: 'briefcase-outline' },
  ],
};

const UNIVERSO_COLORS: Record<UniversoId, { accent: string; accentLight: string }> = {
  cuerpo: { accent: '#E8743B', accentLight: 'rgba(232, 116, 59, 0.30)' },
  mente: { accent: '#5B8DB8', accentLight: 'rgba(91, 141, 184, 0.30)' },
  alma: { accent: '#9B7FD4', accentLight: 'rgba(155, 127, 212, 0.30)' },
};

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function OnboardingScreen4() {
  const router = useRouter();
  // El color del camino elegido en la bifurcación.
  const tonoOnboarding = useTonoOnboarding();
  const { universo } = useLocalSearchParams<{ universo: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const u = (universo as UniversoId) ?? 'cuerpo';
  const subcats = SUBCATEGORIAS[u] ?? SUBCATEGORIAS.cuerpo;
  const { accent, accentLight } = UNIVERSO_COLORS[u] ?? UNIVERSO_COLORS.cuerpo;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Segunda mitad de la analítica del onboarding: con esto y el evento de la
    // pantalla anterior se puede ver dónde se cae la gente entre las dos.
    registrarEvento('onboarding_pregunta_vista', { pantalla: 'categoria', universo: u }).catch(() => {});

    Animated.stagger(110, [
      Animated.timing(headerAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(cardsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: selected ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  function handleContinue() {
    if (!selected) return;

    registrarEvento('onboarding_respuesta', { pantalla: 'categoria', universo: u, respuesta: selected }).catch(() => {});

    // 🔴 Acá se guarda lo que la persona contestó, que antes se tiraba entero.
    // Todavía no hay cuenta, así que se encola local y `AuthContext` lo vuelca
    // a `user_quiz_answers` cuando aparezca la sesión — una sola vez, y sin
    // pisar un quiz posterior. El eje declarado decide QUÉ recomendarle y el
    // topic CÓMO nombrárselo.
    //
    // 📝 Sin `temas`: el paso 3 salió del flujo con la opción A. Era el dato
    // más específico que se recolectaba, pero no lo podía usar nadie — su
    // vocabulario no es el de los coaches (`Alimentación` 0 de 2 y
    // `Sexualidad` 0 de 3 no existen del otro lado), así que "llevarte a
    // profesionales filtrados por lo que dijiste" nunca se pudo hacer con
    // ellos. Con universo + categoría sí.
    void guardarRespuestas({ universo: u, categoria: selected });

    // 🔴 `replace` y no `push`: es el final del onboarding. Con `push`, el
    // gesto de back desde Profesionales devolvería a la pregunta que la persona
    // ya contestó, en una pila que no lleva a ningún lado.
    //
    // ⚠️ Si la categoría no mapeara a ninguna puerta, se entra igual a
    // Profesionales pero por el menú. Quedarse en el onboarding sería peor: la
    // respuesta ya está guardada y la persona ya tocó "Ver profesionales".
    const puerta = puertaDeCategoria(selected);
    router.replace(
      puerta
        ? ({ pathname: '/(tabs)/conexiones', params: { puerta } } as any)
        : ('/(tabs)/conexiones' as any),
    );
  }

  return (
    <AppBg tono={tonoOnboarding}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
          <TouchableOpacity onPress={() => { console.log('[vita back] onboarding4 → back'); router.back(); }} style={styles.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <VitaWordmark />
          </View>
          <View style={styles.headerSide} />
        </Animated.View>

        <Animated.View style={[styles.progressArea, fadeUp(progressAnim)]}>
          {/* 📝 "Última pregunta" y no "Paso 2 de 2": la pantalla anterior no
              muestra contador —una de sus cuatro opciones termina el flujo ahí
              mismo, así que prometerle dos pasos a todo el mundo sería falso—
              y un "2 de 2" que aparece sin haber visto un "1 de 2" se lee como
              si te hubieras salteado algo. */}
          <Text style={styles.progressLabel}>Última pregunta</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </Animated.View>

        <View style={styles.content}>
          <View style={styles.questionArea}>
            <Animated.Text style={[styles.title, fadeUp(titleAnim)]}>
              ¿Qué aspecto querés explorar?
            </Animated.Text>
            <Animated.Text style={[styles.subtitle, fadeUp(subtitleAnim)]}>
              Elegí por dónde querés arrancar
            </Animated.Text>
          </View>

          <Animated.View style={[styles.cards, fadeUp(cardsAnim)]}>
            {subcats.map((sub) => {
              const isSelected = selected === sub.id;
              return (
                <ScaleCard
                  key={sub.id}
                  style={[
                    styles.card,
                    { borderColor: isSelected ? accent : 'rgba(86,94,50,0.14)' },
                    isSelected && {
                      backgroundColor: accentLight,
                      shadowColor: accent,
                      shadowOpacity: 0.22,
                      shadowRadius: 14,
                      elevation: 6,
                    },
                  ]}
                  onPress={() => setSelected(sub.id)}
                >
                  <View style={[styles.iconBubble, { backgroundColor: isSelected ? 'rgba(86,94,50,0.14)' : 'rgba(255,248,240,0.48)' }]}>
                    <MaterialCommunityIcons name={sub.icon} size={26} color={isSelected ? accent : 'rgba(255,255,255,0.75)'} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{sub.title}</Text>
                    <Text style={styles.cardDesc}>{sub.desc}</Text>
                  </View>
                </ScaleCard>
              );
            })}
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: buttonAnim }]}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!selected}
          >
            <Text style={styles.buttonText}>Ver profesionales</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  headerSide: { minWidth: 60 },
  progressArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  progressLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
  },
  progressBar: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ViveColors.accent,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 28,
  },
  questionArea: { gap: 8, alignItems: 'center' },
  title: {
    fontFamily: ViveFonts.bold,
    fontSize: 28,
    color: '#565E32',
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#87835C',
    lineHeight: 22,
    textAlign: 'center',
  },
  cards: { flex: 1, gap: 12 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(86,94,50,0.14)',
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: { flex: 1, gap: 4, alignItems: 'center' },
  cardTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
    lineHeight: 22,
    textAlign: 'center',
  },
  cardDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  button: {
    backgroundColor: '#565E32',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#F7EFE4',
    letterSpacing: 0.3,
  },
});
