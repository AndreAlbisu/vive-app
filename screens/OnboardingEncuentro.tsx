import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
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
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "el encuentro" (12/10/2026, pedido de Andre): termina en el
// isotipo de círculos completos con el centro relleno. Qué cuenta:
//
//   1. Tres aros oliva separados, sin tocarse, que amagan a acercarse.
//      "un lugar para encontrarse"
//   2. Tocás: los tres se juntan hasta pisarse.
//   3. Apenas se cruzan los tres, el pedacito que comparten se llena de oliva
//      con un rebote chico. Debajo, "vita / te acompaña".
//
// 📌 El concepto es el centro: es lo único que este isotipo tiene de distinto
// respecto de los tres aros de `VitaMark`, y solo existe cuando los tres se
// encuentran. Por eso arrancan separados y el relleno llega último.
//
// 📌 Geometría, trazo y la forma del centro son los del SVG, sin retoques. Si
// el isotipo cambia, cambian las constantes de abajo.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo, en un viewBox de 100 ─────────────────────────────────────────
const ARO_R = 26;
const TRAZO = 3.2;
const AROS = [
  { cx: 50, cy: 34 },
  { cx: 31.52, cy: 66 },
  { cx: 68.48, cy: 66 },
] as const;
// El punto medio entre los tres: de ahí se alejan y ahí vuelven.
const MEDIO = { x: 50, y: (34 + 66 + 66) / 3 };
// El pedacito que comparten los tres, tal cual viene en el SVG.
const CENTRO_D = 'M56.601 59.148C55.525 59.431 54.431 59.644 53.328 59.786C52.224 59.929 51.113 60.000 50.000 60.000C48.887 60.000 47.776 59.929 46.672 59.786C45.569 59.644 44.475 59.431 43.399 59.148C43.692 58.074 44.054 57.021 44.483 55.993C44.911 54.966 45.405 53.967 45.961 53.003C46.518 52.039 47.135 51.112 47.811 50.227C48.486 49.343 49.217 48.502 50.000 47.711C50.783 48.502 51.514 49.343 52.189 50.227C52.865 51.112 53.482 52.039 54.039 53.003C54.595 53.967 55.089 54.966 55.517 55.993C55.946 57.021 56.308 58.074 56.601 59.148Z';
const CENTRO_LADO = 20;        // la vista del centro, en unidades del viewBox
// Separados, los aros se salen del cuadrado de 100: el lienzo tiene margen.
const MARGEN = 16;
const LIENZO = 100 + 2 * MARGEN;

const FRASE_1 = 'un lugar para encontrarse';

const SEPARA     = 0.55;   // cuánto más lejos del medio arranca cada aro
const AMAGUE     = 0.07;   // cuánto se acercan y se alejan mientras esperan
const JUNTA_MS   = 820;
const CENTRO_EN  = 640;
const CENTRO_MS  = 480;
const MARCA_EN   = 1050;
const FIN_EN     = 1650;   // todo quieto
const HOLD_MS    = 700;
const EXIT_MS    = 450;
const AUTO_MS    = 4000;
const SALTEAR_MS = 600;
const BREATH_MS  = 5200;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_REBOTE = Easing.bezier(0.34, 1.56, 0.64, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Uno de los tres aros: va de su lugar separado al del isotipo. */
function Aro({ cx, cy, junta, reloj }: {
  cx: number; cy: number; junta: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    const amague = 1 - AMAGUE * (0.5 - 0.5 * Math.cos(reloj.value * 2 * Math.PI));
    const lejos = 1 + SEPARA * (1 - junta.value) * amague;
    return {
      cx: MEDIO.x + (cx - MEDIO.x) * lejos,
      cy: MEDIO.y + (cy - MEDIO.y) * lejos,
    };
  });
  return (
    <AnimatedCircle
      animatedProps={props}
      r={ARO_R}
      stroke={OLIVA} strokeWidth={TRAZO} fill="none"
    />
  );
}

export default function OnboardingEncuentro() {
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
  const S = Math.min(width * 0.54, 236);   // lado del isotipo
  const K = S / 100;                       // px por unidad del viewBox
  const centroY = height * 0.46;
  const textoY = centroY + S * 0.44 + MARGEN * K + 16;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const junta   = useSharedValue(0);  // los tres aros se acercan
  const centro  = useSharedValue(0);  // el pedacito compartido se llena
  const marca   = useSharedValue(0);
  const sale    = useSharedValue(0);
  const reloj   = useSharedValue(0);  // 0→1 en loop: el amague
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
    setTimeout(navegar, EXIT_MS);
  }, [navegar]);

  const vibrar = useCallback((estilo: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(estilo).catch(() => {});
  }, []);

  /** Toda la secuencia. `rapido`: sin viajes ni rebote (reduced motion). */
  const arrancar = useCallback((rapido: boolean) => {
    if (armado.current) return;
    armado.current = true;
    hintOp.value = withTiming(0, { duration: 250 });
    frase1.value = withTiming(0, { duration: 280 });

    const f = rapido ? 0 : 1;   // con reduced motion todo cae en el mismo instante
    if (rapido) {
      junta.value = withTiming(1, { duration: 300 });
      centro.value = withTiming(1, { duration: 300 });
    } else {
      junta.value = withTiming(1, { duration: JUNTA_MS, easing: EASE_IN_OUT });
      // Con un rebote chico: el centro "cae" en su lugar.
      centro.value = withDelay(CENTRO_EN, withTiming(1, { duration: CENTRO_MS, easing: EASE_REBOTE }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Light), CENTRO_EN + 120);
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

  // El amague: mientras nadie toca, los tres se acercan un poco y vuelven.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(reloj);
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
  const arosStyle = useAnimatedStyle(() => ({ opacity: aparece.value }));

  // El centro crece desde su punto medio, que es también el de los tres aros.
  const centroStyle = useAnimatedStyle(() => ({
    opacity: clamp01(centro.value * 3),
    transform: [{ scale: 0.2 + 0.8 * centro.value }],
  }));

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

  const lienzoPx = LIENZO * K;
  const centroPx = CENTRO_LADO * K;

  return (
    <View style={styles.fondo}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Un lugar para encontrarse. Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - lienzoPx / 2, marginLeft: -lienzoPx / 2 }, arosStyle]}
        >
          <Svg width={lienzoPx} height={lienzoPx} viewBox={`${-MARGEN} ${-MARGEN} ${LIENZO} ${LIENZO}`}>
            {AROS.map((a, i) => <Aro key={i} cx={a.cx} cy={a.cy} junta={junta} reloj={reloj} />)}
          </Svg>
        </Animated.View>

        {/* El centro va en su propia vista para poder agrandarlo desde el medio. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centrado,
            {
              top: centroY - S / 2 + (MEDIO.y - CENTRO_LADO / 2) * K,
              marginLeft: -centroPx / 2,
              width: centroPx,
              height: centroPx,
            },
            centroStyle,
          ]}
        >
          <Svg
            width={centroPx} height={centroPx}
            viewBox={`${MEDIO.x - CENTRO_LADO / 2} ${MEDIO.y - CENTRO_LADO / 2} ${CENTRO_LADO} ${CENTRO_LADO}`}
          >
            <Path d={CENTRO_D} fill={OLIVA} />
          </Svg>
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
