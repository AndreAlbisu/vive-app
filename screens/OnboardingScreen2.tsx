import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { EntradaDesdeColor } from '@/components/EntradaDesdeColor';
import { useTonoOnboarding } from '@/hooks/useTonoOnboarding';
import { ScaleCard } from '@/components/ScaleCard';
import { guardarCamino } from '@/lib/guiaContextual';
import { registrarEvento } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';

// "¿Qué te trae por acá?" — opción A del brief, elegida por Andre el 01/09/2026.
// Ver `docs/onboarding-bifurcacion-opciones.md`.
//
// 🔴 Lo que reemplaza: "¿Cómo te gustaría empezar?" (explorar la app / sé qué
// necesito / no sé por dónde empezar). El problema no era visual. Eran tres
// pantallas seguidas preguntando lo mismo con distinto grano —"¿cómo te
// gustaría empezar?", "¿por dónde querés empezar?", "¿qué aspecto querés
// explorar?"— y ninguna preguntaba por la PERSONA: todas preguntaban cómo
// quiere usar el producto, en el único momento en que no lo puede saber.
//
// 📝 Y "Sé qué necesito" no era un camino: desembocaba en el mismo lugar que
// "no sé por dónde empezar" (un profesional), y se diferenciaba de "explorar"
// en qué tab abría primero. Eso es una preferencia de pantalla inicial, no una
// bifurcación de producto. Los perfiles que llegan son tres pero los caminos
// son dos: el que trae algo y el que vino a mirar.
//
// 🔴 Esta pantalla se come el viejo paso 1 de 3 (el universo cuerpo/mente/alma):
// es exactamente el mismo dato, pero preguntado por lo que le pasa a la persona
// en vez de disfrazado de pregunta de navegación. De ahí sale
// `user_quiz_answers.axis`, que ya tiene columna.
//
// ⚠️ Las CUATRO opciones pesan visualmente lo mismo, a propósito. "¿Qué te
// trae?" pesa más que "¿cómo querés empezar?", así que si "Solo estoy mirando"
// fuera un link chiquito al pie, la pantalla estaría empujando a inventar un
// problema para poder seguir.

type TraeId = 'cuerpo' | 'mente' | 'alma' | 'mirando';

const OPTIONS: {
  id: TraeId;
  title: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  accentLight: string;
}[] = [
  {
    id: 'cuerpo',
    title: 'Algo del cuerpo',
    desc: 'No dormís, sin energía',
    icon: 'heart-outline',
    accent: '#E8743B',
    accentLight: 'rgba(232, 116, 59, 0.30)',
  },
  {
    id: 'mente',
    title: 'Algo de la cabeza',
    desc: 'Ansiedad, ánimo, vínculos',
    icon: 'brain',
    accent: '#5B8DB8',
    accentLight: 'rgba(91, 141, 184, 0.30)',
  },
  {
    id: 'alma',
    title: 'Algo del rumbo',
    desc: 'Trabajo, propósito',
    icon: 'shimmer',
    accent: '#9B7FD4',
    accentLight: 'rgba(155, 127, 212, 0.30)',
  },
  // 📝 Verde y no un gris: un color apagado la haría leer como la opción de
  // descarte, que es justo lo que no queremos. Es el verde del sistema, o sea
  // el color de la app misma — que es literalmente lo que ofrece.
  {
    id: 'mirando',
    title: 'Solo estoy mirando',
    desc: 'Quiero ver qué hay',
    icon: 'compass-outline',
    accent: '#6B7A56',
    accentLight: 'rgba(107, 122, 86, 0.30)',
  },
];

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
});

export default function OnboardingScreen2() {
  const router = useRouter();
  // El color del camino elegido en la bifurcación.
  const tonoOnboarding = useTonoOnboarding();
  // Con qué color se llegó desde la bifurcación, si se llegó por ahí.
  const { tono } = useLocalSearchParams<{ tono?: string }>();
  const [selected, setSelected] = useState<TraeId | null>(null);

  const titleAnim = useRef(new Animated.Value(0)).current;
  const card0Anim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const cardAnims = [card0Anim, card1Anim, card2Anim, card3Anim];

  useEffect(() => {
    // 🔴 Primera línea de analítica del onboarding. Hasta hoy no había ninguna
    // —cero `registrarEvento` en las cinco pantallas y en la bifurcación—, así
    // que la discusión sobre qué camino toma la gente se dio entera sobre
    // hipótesis. Sin esto, la próxima también.
    registrarEvento('onboarding_pregunta_vista', { pantalla: 'que_te_trae' }).catch(() => {});

    Animated.stagger(100, [
      Animated.timing(titleAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(card0Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(card1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(card2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(card3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
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

    registrarEvento('onboarding_respuesta', { pantalla: 'que_te_trae', respuesta: selected }).catch(() => {});

    // 🔴 La elección se guardaba en ningún lado: era estado local que solo
    // servía para elegir la ruta y se perdía al salir de la pantalla. Le
    // pedíamos a la persona que se declarara en el peor momento —antes de saber
    // qué es Vita— y después la app no se acordaba de nada. Ahora decide si le
    // mostramos la guía contextual.
    //
    // ⚠️ Los tres universos se guardan como 'guide' y no como tres caminos
    // nuevos: `guiaContextual` decide con eso a quién le explica la app, y a
    // quien vino con un problema concreto no se le explica, se lo lleva. Los
    // tres valores de `Camino` siguen siendo los que ya estaban guardados en
    // dispositivos reales.
    void guardarCamino(selected === 'mirando' ? 'explore' : 'guide');

    // 🔴 Va a Recursos y no a Inicio. Sin cuenta, Inicio es casi todo estados
    // vacíos —pinneados vacíos, un check-in que pide registrarse, sin próxima
    // sesión—, o sea que quien contestó "solo estoy mirando" aterrizaba en la
    // prueba de que no hay nada para mirar. Recursos es lo único que da valor
    // solo, gratis y sin cuenta.
    if (selected === 'mirando') { router.replace('/(tabs)/recursos' as any); return; }

    // Las otras tres llevan el universo a la única pregunta que queda.
    router.push({ pathname: '/onboarding4', params: { universo: selected } });
  }

  return (
    <AppBg tono={tonoOnboarding}>
      <EntradaDesdeColor tono={tono} />
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { console.log('[vita back] onboarding2 → back'); router.back(); }} style={styles.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Animated.View style={fadeUp(titleAnim)}>
            <Text style={styles.title}>¿Qué te trae por acá?</Text>
          </Animated.View>

          <View style={styles.cards}>
            {OPTIONS.map((option, i) => {
              const isSelected = selected === option.id;
              return (
                <Animated.View key={option.id} style={[{ flex: 1 }, fadeUp(cardAnims[i])]}>
                  <ScaleCard
                    onPress={() => setSelected(option.id)}
                    style={[
                      styles.card,
                      { borderColor: isSelected ? option.accent : 'rgba(86,94,50,0.14)' },
                      isSelected && {
                        backgroundColor: option.accentLight,
                        shadowColor: option.accent,
                        shadowOpacity: 0.22,
                        shadowRadius: 14,
                        elevation: 6,
                      },
                    ]}
                  >
                    <View style={[styles.iconBubble, { backgroundColor: isSelected ? 'rgba(86,94,50,0.14)' : 'rgba(255,248,240,0.48)' }]}>
                      <MaterialCommunityIcons name={option.icon} size={26} color={isSelected ? option.accent : 'rgba(255,255,255,0.75)'} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{option.title}</Text>
                      <Text style={styles.cardDesc}>{option.desc}</Text>
                    </View>
                  </ScaleCard>
                </Animated.View>
              );
            })}
          </View>
        </View>

        <Animated.View style={[styles.footer, { opacity: buttonAnim }]}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!selected}
          >
            <Text style={styles.buttonText}>¿Seguimos?</Text>
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    // 📝 24 y no 32: son cuatro tarjetas donde antes había tres, y el aire de
    // más se lo tiene que quedar el mosaico, no el hueco bajo el título.
    gap: 24,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 34,
    color: '#565E32',
    letterSpacing: -0.5,
    lineHeight: 42,
    textAlign: 'center',
  },
  cards: { flex: 1, gap: 10 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(86,94,50,0.14)',
  },
  iconBubble: {
    width: 48,
    height: 48,
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
