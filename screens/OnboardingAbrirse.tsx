import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { Anillo } from '@/components/ui/Anillo';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "abrirse" (12/10/2026, pedido de Andre): termina en el isotipo de
// aros abiertos (`Logo Vita - aros abiertos`). Qué cuenta, en tres tiempos:
//
//   1. Los tres aros abiertos, uno adentro del otro, con el mismo centro.
//      Cada uno gira a su ritmo y para su lado, así que los huecos se
//      persiguen, se cruzan y casi nunca coinciden: un giroscopio lento.
//      "abrirse es el primer paso"
//   2. Tocás: los tres se sueltan del centro DE A UNO, del más chico al más
//      grande. Cada uno termina la vuelta que venía dando, toma su tamaño y se
//      desliza hasta su lugar, con el hueco donde va.
//   3. Quedan los tres aros abiertos, enganchados, y del medio salen dos ondas
//      finas. Debajo, "vita / te acompaña".
//
// 📌 Andre las pidió "artísticas y modernas, bellas, hasta hipnóticas", sin
// confeti ni circo. Por eso acá no hay rebotes ni golpes: todo es continuo.
//
// 📌 Los tres arcos son los del SVG, sin retoques (radio 26, trazo 2,2, puntas
// redondas, 318° de vuelta cada uno). Si el isotipo cambia, cambian los `d`.
//
// 🔴 Cada aro termina en un múltiplo exacto de vuelta entera: así el hueco cae
// donde lo dibuja el SVG. Por eso al tocar se le hace completar la vuelta que
// venía dando en vez de frenarlo donde esté.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo de aros abiertos, en un viewBox de 100 ────────────────────────
const ARO_R = 26;
const TRAZO = 2.2;
const VUELTA = 2 * Math.PI;
// Cada aro: su arco, el centro alrededor del que gira, y cómo espera (de qué
// tamaño, para qué lado gira y cuánto tarda en dar una vuelta).
const AROS = [
  { d: 'M24.129 31.409A26 26 0 1 1 29.040 49.385', cx: 50,    cy: 34, escala: 0.6,  sentido: 1,  vuelta: 6500 },
  { d: 'M42.218 89.697A26 26 0 1 1 55.327 76.452', cx: 31.52, cy: 66, escala: 1,    sentido: -1, vuelta: 10000 },
  { d: 'M83.655 44.888A26 26 0 1 1 65.630 40.157', cx: 68.48, cy: 66, escala: 1.4,  sentido: 1,  vuelta: 15000 },
] as const;
type Aro = (typeof AROS)[number];
const NIDO  = { x: 50, y: 50 };      // donde esperan los tres, uno adentro del otro
const RUEDA = 2 * (ARO_R + TRAZO);   // el lado de la vista de cada aro

const FRASE_1 = 'abrirse es el primer paso';

const RUEDA_MS    = 1400;  // lo que tarda cada aro en ir del nido a su lugar
const PASO_MS     = 170;   // cada uno sale un poco después del anterior
const ONDA_EN     = 1350;
const ONDA_MS     = 1500;
const MARCA_EN    = 1500;
const FIN_EN      = 2200;  // todo quieto
const HOLD_MS     = 700;
const EXIT_MS     = 450;
const AUTO_MS     = 4000;
const SALTEAR_MS  = 600;
const BREATH_MS   = 5200;
const BREATH_AMP  = 0.03;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
// Arranca despacio y frena largo: para ir del nido al isotipo sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/**
 * Uno de los tres aros. Mientras espera está en el nido, a su escala y girando;
 * con `acomoda` va a su lugar y a su tamaño. El trazo se afina o engorda al
 * revés que la escala, así los tres se ven siempre del mismo grosor.
 */
function Rueda({ aro, k, acomoda, angulo, reloj }: {
  aro: Aro; k: number;
  acomoda: SharedValue<number>; angulo: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const lado = RUEDA * k;
  const style = useAnimatedStyle(() => {
    const g = acomoda.value;
    const respira = 1 + BREATH_AMP * (1 - g) * Math.sin(reloj.value * 2 * Math.PI);
    return {
      transform: [
        { translateX: (NIDO.x - aro.cx) * k * (1 - g) },
        { translateY: (NIDO.y - aro.cy) * k * (1 - g) },
        { rotate: `${angulo.value}rad` },
        { scale: (aro.escala + (1 - aro.escala) * g) * respira },
      ],
    };
  });
  const props = useAnimatedProps(() => ({
    strokeWidth: TRAZO / (aro.escala + (1 - aro.escala) * acomoda.value),
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: (aro.cx - RUEDA / 2) * k, top: (aro.cy - RUEDA / 2) * k, width: lado, height: lado },
        style,
      ]}
    >
      <Svg width={lado} height={lado} viewBox={`${aro.cx - RUEDA / 2} ${aro.cy - RUEDA / 2} ${RUEDA} ${RUEDA}`}>
        <AnimatedPath
          animatedProps={props}
          d={aro.d}
          stroke={OLIVA} strokeLinecap="round" fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export default function OnboardingAbrirse() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  // En una ref: el arranque automático corre desde un temporizador armado al
  // montar, y tiene que ver el valor de ese momento, no el del primer render.
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const abandono = useRef(cronometro()).current;

  const armado = useRef(false);    // ya arrancó (por toque o sola)
  const saliendo = useRef(false);
  const toco = useRef(false);
  const tocoEn = useRef(0);
  const pendientes = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [hint, setHint] = useState('tocá la pantalla');
  const [esperaToque, setEsperaToque] = useState(false);

  // ── Geometría ──────────────────────────────────────────────────────────────
  const S = Math.min(width * 0.58, 250);   // lado del isotipo
  const K = S / 100;                       // px por unidad del viewBox
  const centroY = height * 0.46;
  const textoY = centroY + S * 0.44 + 24;
  const ondaRadio = Math.max(width, height) * 0.6;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  // Del nido a su lugar en el isotipo: uno por aro, porque salen escalonados.
  const acom0 = useSharedValue(0), acom1 = useSharedValue(0), acom2 = useSharedValue(0);
  const acomodas = [acom0, acom1, acom2];
  // El giro de cada aro, en radianes.
  const ang0 = useSharedValue(0), ang1 = useSharedValue(0), ang2 = useSharedValue(0);
  const angulos = [ang0, ang1, ang2];
  const onda    = useSharedValue(0);  // las dos ondas finas del final
  const marca   = useSharedValue(0);
  const sale    = useSharedValue(0);
  const reloj   = useSharedValue(0);  // 0→1 en loop: la respiración
  const frase1  = useSharedValue(0);
  const hintOp  = useSharedValue(0);
  const dedoX   = useSharedValue(0);
  const dedoY   = useSharedValue(0);
  const dedo    = useSharedValue(0);

  const luego = useCallback((fn: () => void, ms: number) => {
    pendientes.current.push(setTimeout(fn, ms));
  }, []);

  const navegar = useCallback(() => {
    router.replace('/onboarding-bifurcacion');
  }, [router]);

  const salir = useCallback(() => {
    if (saliendo.current) return;
    saliendo.current = true;
    pendientes.current.forEach(clearTimeout);
    hintOp.value = withTiming(0, { duration: 200 });
    sale.value = withTiming(1, { duration: EXIT_MS, easing: EASE_OUT });
    // Trackeado para que el cleanup lo cancele si se desmonta durante el fade
    // (login OAuth) y `navegar` no corra post-unmount (review 14/10).
    pendientes.current.push(setTimeout(navegar, EXIT_MS));
  }, [navegar]);

  const vibrar = useCallback((estilo: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(estilo).catch(() => {});
  }, []);

  /** Toda la secuencia. `rapido`: sin viajes ni dibujo (reduced motion). */
  const arrancar = useCallback((rapido: boolean) => {
    if (armado.current) return;
    armado.current = true;
    hintOp.value = withTiming(0, { duration: 250 });
    frase1.value = withTiming(0, { duration: 280 });

    const f = rapido ? 0 : 1;   // con reduced motion todo cae en el mismo instante
    angulos.forEach((a, i) => {
      cancelAnimation(a);
      // Sigue girando para el mismo lado hasta completar la vuelta que venía
      // dando: nunca más de una, y frenando de a poco.
      const destino = AROS[i].sentido * VUELTA * (rapido ? Math.round(Math.abs(a.value) / VUELTA) : 1);
      a.value = withTiming(destino, {
        duration: rapido ? 300 : i * PASO_MS + RUEDA_MS,
        easing: Easing.out(Easing.quad),
      });
      acomodas[i].value = rapido
        ? withTiming(1, { duration: 300 })
        : withDelay(i * PASO_MS, withTiming(1, { duration: RUEDA_MS, easing: EASE_SUAVE }));
    });
    if (!rapido) {
      onda.value = withDelay(ONDA_EN, withTiming(1, { duration: ONDA_MS, easing: Easing.linear }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), 0);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), ONDA_EN);
    }
    marca.value = withDelay(f * MARCA_EN, withTiming(1, { duration: rapido ? 300 : 520, easing: EASE_OUT }));

    luego(() => {
      // `segundos`: cuánto tardó en llegar acá. `respuesta` distingue a quien
      // tocó de quien dejó que pasara sola.
      anotar('onboarding_respuesta', {
        pantalla: 'bienvenida',
        respuesta: toco.current ? 'mantuvo' : 'solo',
        segundos: abandono(),
      });
      if (toco.current && !rapido) {
        luego(salir, HOLD_MS);
      } else {
        // Pasó sola (o sin movimiento): se espera un toque para avanzar.
        setHint('tocá para empezar');
        hintOp.value = withTiming(1, { duration: 300 });
        setEsperaToque(true);
      }
    }, rapido ? 350 : FIN_EN);
  }, [salir, vibrar, luego]);

  // ── Entrada ────────────────────────────────────────────────────────────────
  useEffect(() => {
    anotar('onboarding_pantalla_vista', { pantalla: 'bienvenida' });
    // 🔴 Se puede tocar desde el primer instante: todo aparece junto y rápido.
    aparece.value = withTiming(1, { duration: 450, easing: EASE_OUT });
    frase1.value = withDelay(150, withTiming(1, { duration: 450, easing: EASE_OUT }));
    hintOp.value = withDelay(300, withTiming(1, { duration: 350 }));
    const t = setTimeout(() => arrancar(reducedRef.current), AUTO_MS);
    const lista = pendientes.current;
    return () => { clearTimeout(t); lista.forEach(clearTimeout); };
  }, []);

  // Mientras nadie toca: los tres giran, cada uno a su ritmo, y respiran.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    // 🔴 Si ya arrancó, el giro es de la secuencia: no se pisa.
    if (!armado.current) {
      angulos.forEach((a, i) => {
        a.value = 0;
        a.value = withRepeat(
          withTiming(AROS[i].sentido * VUELTA, { duration: AROS[i].vuelta, easing: Easing.linear }), -1, false,
        );
      });
    }
    return () => {
      cancelAnimation(reloj);
      if (!armado.current) angulos.forEach(a => cancelAnimation(a));
    };
  }, [reduced]);

  // ── Dedo ───────────────────────────────────────────────────────────────────
  const alApoyar = useCallback((ev: GestureResponderEvent) => {
    if (saliendo.current) return;
    if (esperaToque) { salir(); return; }
    if (toco.current) {
      // Segundo toque: la saltea.
      if (Date.now() - tocoEn.current > SALTEAR_MS) salir();
      return;
    }
    toco.current = true;
    tocoEn.current = Date.now();
    const { pageX, pageY } = ev.nativeEvent;
    dedoX.value = pageX;
    dedoY.value = pageY;
    dedo.value = 0;
    dedo.value = withTiming(1, { duration: 650, easing: EASE_OUT });
    arrancar(reduced);
  }, [esperaToque, salir, arrancar, reduced]);

  // VoiceOver / TalkBack: el doble toque arranca (o avanza, si ya llegó).
  const alActivar = useCallback(() => {
    if (esperaToque) { salir(); return; }
    if (toco.current) return;
    toco.current = true;
    tocoEn.current = Date.now();
    arrancar(reduced);
  }, [esperaToque, salir, arrancar, reduced]);

  // ── Animados ───────────────────────────────────────────────────────────────
  const isotipoStyle = useAnimatedStyle(() => ({ opacity: aparece.value }));

  const frase1Style = useAnimatedStyle(() => ({
    opacity: frase1.value,
    transform: [{ translateY: 8 * (1 - frase1.value) }],
  }));

  const marcaStyle = useAnimatedStyle(() => ({
    opacity: marca.value,
    transform: [{ translateY: 18 * (1 - marca.value) }],
  }));
  const lemaStyle = useAnimatedStyle(() => {
    const t = clamp01((marca.value - 0.5) / 0.5);
    return { opacity: t, transform: [{ translateY: 8 * (1 - t) }] };
  });

  const dedoStyle = useAnimatedStyle(() => ({
    opacity: 0.22 * (1 - dedo.value) * (dedo.value > 0 ? 1 : 0),
    transform: [
      { translateX: dedoX.value - 40 },
      { translateY: dedoY.value - 40 },
      { scale: 0.4 + 1.6 * dedo.value },
    ],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOp.value }));
  // La salida: un velo del crema de la pantalla siguiente.
  const veloStyle = useAnimatedStyle(() => ({ opacity: sale.value }));

  return (
    <View style={styles.fondo}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Abrirse es el primer paso. Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        {/* Debajo de todo: las ondas que salen del medio cuando quedan enganchados. */}
        <Anillo t={onda} x={width / 2} y={centroY} radio={ondaRadio} color={OLIVA} fuerza={0.4} />
        <Anillo t={onda} x={width / 2} y={centroY} radio={ondaRadio} color={OLIVA} fuerza={0.4} retraso={0.28} />

        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - S / 2, marginLeft: -S / 2, width: S, height: S }, isotipoStyle]}
        >
          {AROS.map((aro, i) => (
            <Rueda key={i} aro={aro} k={K} acomoda={acomodas[i]} angulo={angulos[i]} reloj={reloj} />
          ))}
        </Animated.View>

        {/* El papel: quieto, encima del isotipo y debajo del texto. */}
        <Grain opacity={0.05} />

        {/* Un solo lugar para leer: la frase → "vita / te acompaña". */}
        <View style={[styles.texto, { top: textoY }]} pointerEvents="none">
          <Animated.Text style={[styles.frase, styles.encima, frase1Style]}>{FRASE_1}</Animated.Text>
          <Animated.Text style={[styles.marca, marcaStyle]}>vita</Animated.Text>
          <Animated.Text style={[styles.lema, lemaStyle]}>te acompaña</Animated.Text>
        </View>

        {/* La onda del toque. */}
        <Animated.View pointerEvents="none" style={[styles.dedo, dedoStyle]} />

        <SafeAreaView style={styles.hintWrap} edges={['bottom']} pointerEvents="none">
          <Animated.Text style={[styles.hint, hintStyle]}>{hint}</Animated.Text>
        </SafeAreaView>
      </Pressable>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.velo, veloStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, overflow: 'hidden', backgroundColor: CREMA },
  todo: { flex: 1 },
  velo: { backgroundColor: CREMA_APP },
  centrado: { position: 'absolute', left: '50%' },
  dedo: {
    position: 'absolute', left: 0, top: 0,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: OLIVA,
  },
  texto: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  encima: { position: 'absolute', top: 14, left: 0, right: 0 },
  frase: {
    textAlign: 'center',
    fontFamily: ViveFonts.title,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: OLIVA,
  },
  marca: {
    fontFamily: ViveFonts.wordmark,
    fontSize: 52,
    lineHeight: 60,
    color: OLIVA,
  },
  lema: {
    marginTop: 2,
    fontFamily: ViveFonts.regular,
    fontSize: 16,
    letterSpacing: 0.4,
    color: ViveColors.primaryInk,
  },
  hintWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 28,
  },
  hint: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    letterSpacing: 0.6,
    color: OLIVA,
  },
});
