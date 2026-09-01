import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { EntradaDesdeColor } from '@/components/EntradaDesdeColor';
import { useTonoOnboarding } from '@/hooks/useTonoOnboarding';
import { ScaleCard } from '@/components/ScaleCard';
import { VitaWordmark } from '@/components/VitaWordmark';
import { guardarCamino } from '@/lib/guiaContextual';
import { anotar, cronometro } from '@/lib/analytics';
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
//
// ── Del boceto de Andre (01/09/2026) ────────────────────────────────────────
// Filas en vez de tarjetas, título grande alineado a la izquierda y navegación
// directa al tocar. Cuatro ajustes sobre el boceto, todos con motivo:
//
// 🔴 (a) CADA universo lleva SU color, no tres iguales y uno distinto. En el
// boceto tres círculos eran verdes y solo "Algo de la cabeza" naranja, lo que
// la volvía la recomendada de facto: el ojo va ahí primero. Y ahora que
// medimos, `onboarding_opcion_tocada` estaría midiendo el acento visual en vez
// de la preferencia — justo el dato que necesitamos limpio. Son los mismos
// colores que ya usa la pregunta siguiente para cada universo, así que además
// dan continuidad.
//
// 🔴 (b) Las bajadas hablan de SÍNTOMAS, no de categorías. El boceto decía
// "Sueño, energía, hábitos", que es una taxonomía; acá dice "No dormís, andás
// sin pilas", que es algo que se reconoce como propio. Es literalmente lo que
// justificaba la opción A: dejar de preguntar en el vocabulario del producto.
//
// 📝 (c) "Solo estoy mirando" NO lleva flecha. Las otras tres llevan a una
// pregunta más; esta termina el onboarding y deja en Recursos. La asimetría es
// la señal — con la misma flecha, las cuatro prometen lo mismo y no es así.
//
// ⚠️ (d) Se fue el botón "¿Seguimos?": la fila navega al tocarla, un tap en vez
// de dos. La contra es que se pierde `toques` (cuántas opciones se tocaban
// antes de decidirse), que era señal de duda: ahora el primer toque ya navega.
// Queda `segundos`, que mide lo mismo por otro lado.

type TraeId = 'cuerpo' | 'mente' | 'alma' | 'mirando';

const OPTIONS: {
  id: TraeId;
  title: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  /** Solo las que llevan a otra pregunta. Ver (c). */
  sigue: boolean;
}[] = [
  {
    id: 'cuerpo',
    title: 'Algo del cuerpo',
    desc: 'No dormís, andás sin pilas',
    icon: 'heart-outline',
    accent: '#E8743B',
    sigue: true,
  },
  {
    id: 'mente',
    title: 'Algo de la cabeza',
    desc: 'Ansiedad, bajón, discusiones',
    icon: 'brain',
    accent: '#5B8DB8',
    sigue: true,
  },
  {
    id: 'alma',
    title: 'Algo del rumbo',
    desc: 'No sabés para dónde vas',
    icon: 'star-four-points-outline',
    accent: '#9B7FD4',
    sigue: true,
  },
  {
    id: 'mirando',
    title: 'Solo estoy mirando',
    desc: 'Quiero ver qué hay',
    icon: 'eye-outline',
    accent: '#6B7A56',
    sigue: false,
  },
];

const TEXTO       = '#26402F';
const TEXTO_SUAVE = '#5C6B58';
const LINEA       = 'rgba(63,81,47,0.12)';

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
});

function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}

export default function OnboardingScreen2() {
  const router = useRouter();
  // El color del camino elegido en la bifurcación.
  const tonoOnboarding = useTonoOnboarding();
  // Con qué color se llegó desde la bifurcación, si se llegó por ahí.
  const { tono } = useLocalSearchParams<{ tono?: string }>();

  // Sin botón de confirmar ya no hay estado de selección: la fila navega. El
  // guard evita que un doble tap dispare dos viajes.
  const yendo = useRef(false);
  const medir = useRef(cronometro()).current;

  const titleAnim = useRef(new Animated.Value(0)).current;
  const subAnim   = useRef(new Animated.Value(0)).current;
  const card0Anim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;

  const cardAnims = [card0Anim, card1Anim, card2Anim, card3Anim];

  useEffect(() => {
    // 🔴 Hasta hoy el onboarding no tenía una sola línea de analítica, así que
    // la discusión sobre qué camino toma la gente se dio entera sobre
    // hipótesis. Sin esto, la próxima también.
    anotar('onboarding_pantalla_vista', { pantalla: 'que_te_trae' });

    Animated.stagger(90, [
      Animated.timing(titleAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(subAnim,   { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card0Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card1Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card2Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card3Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  function elegir(id: TraeId) {
    if (yendo.current) return;
    yendo.current = true;

    anotar('onboarding_respuesta', {
      pantalla: 'que_te_trae',
      respuesta: id,
      // Sin paso de confirmación no hay `toques` que medir (ver (d) arriba); la
      // demora sigue siendo la señal de cuánto costó decidirse.
      segundos: medir(),
    });

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
    void guardarCamino(id === 'mirando' ? 'explore' : 'guide');

    // 🔴 Va a Recursos y no a Inicio. Sin cuenta, Inicio es casi todo estados
    // vacíos —pinneados vacíos, un check-in que pide registrarse, sin próxima
    // sesión—, o sea que quien contestó "solo estoy mirando" aterrizaba en la
    // prueba de que no hay nada para mirar. Recursos es lo único que da valor
    // solo, gratis y sin cuenta.
    if (id === 'mirando') {
      anotar('onboarding_fin', { destino: 'recursos', desde: 'que_te_trae' });
      router.replace('/(tabs)/recursos' as any);
      return;
    }

    // Las otras tres llevan el universo a la única pregunta que queda.
    router.push({ pathname: '/onboarding4', params: { universo: id } });
  }

  return (
    <AppBg tono={tonoOnboarding}>
      <EntradaDesdeColor tono={tono} />
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => { console.log('[vita back] onboarding2 → back'); router.back(); }}
            style={styles.backBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={TEXTO} />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
          <View style={styles.logoRow}><VitaWordmark /></View>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.content}>
          <View style={styles.pregunta}>
            <Animated.Text style={[styles.title, fadeUp(titleAnim)]}>
              ¿Qué te trae por acá?
            </Animated.Text>
            <Animated.Text style={[styles.subtitle, fadeUp(subAnim)]}>
              Elegí lo que más se acerque a cómo estás hoy.
            </Animated.Text>
          </View>

          <View style={styles.filas}>
            {OPTIONS.map((option, i) => (
              <Animated.View key={option.id} style={fadeUp(cardAnims[i])}>
                <ScaleCard style={styles.fila} onPress={() => elegir(option.id)}>
                  <View style={[styles.iconBubble, { backgroundColor: tint(option.accent, 0.14) }]}>
                    <MaterialCommunityIcons name={option.icon} size={24} color={option.accent} />
                  </View>
                  <View style={styles.filaTexto}>
                    <Text style={styles.filaTitulo}>{option.title}</Text>
                    <Text style={styles.filaDesc}>{option.desc}</Text>
                  </View>
                  {/* Ver (c): la que no sigue no promete que siga. */}
                  {option.sigue && (
                    <MaterialCommunityIcons name="arrow-right" size={20} color={TEXTO_SUAVE} />
                  )}
                </ScaleCard>
              </Animated.View>
            ))}
          </View>
        </View>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 70 },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: TEXTO,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  headerSide: { minWidth: 70 },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    justifyContent: 'center',
    gap: 34,
  },
  // Alineado a la izquierda, como el boceto: centrado se leía como un cartel, y
  // así se lee como alguien que pregunta.
  pregunta: { gap: 12 },
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.8,
    color: TEXTO,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: TEXTO_SUAVE,
  },

  filas: { gap: 14 },
  // Píldora ancha y baja, casi del color del fondo: se lee como una lista y no
  // como cuatro objetos flotando.
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: LINEA,
    backgroundColor: 'rgba(255,252,246,0.42)',
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filaTexto: { flex: 1, gap: 3 },
  filaTitulo: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: TEXTO,
  },
  // ⚠️ #5C6B58 sobre el crema da ~4.6:1, apenas arriba del mínimo AA (4.5). El
  // gris del boceto quedaba por debajo. No aclararlo más sin volver a medir.
  filaDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: TEXTO_SUAVE,
  },
});
