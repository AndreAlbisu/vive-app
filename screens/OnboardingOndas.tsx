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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { CONCENTRICO_ALTO, CONCENTRICO_ANCHO, CONCENTRICO_D } from '@/constants/isotipoConcentrico';
import { aroCaja } from '@/components/ui/Anillo';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "las ondas" (12/10/2026, pedido de Andre): termina en el isotipo
// concéntrico. Qué cuenta, en tres tiempos:
//
//   1. Los tres juegos de aros del isotipo, un poco separados entre sí. Cada
//      aro se inclina hacia atrás y hacia adelante, como una moneda que se
//      balancea, y cada uno lo hace un instante después que el de adentro:
//      una ola lenta recorre el juego de adentro hacia afuera.
//      "lo que te pasa le pasa a alguien más"
//   2. Tocás: los aros se van quedando de frente, quietos, y los tres juegos
//      se acercan hasta engancharse.
//   3. Queda el isotipo concéntrico, con "vita / te acompaña" debajo.
//
// 📌 Andre las pidió "artísticas y modernas, bellas, hasta hipnóticas", sin
// confeti ni circo. Ya probó y descartó para este isotipo: las ondas que
// crecían como gotas (aburridas, y se trababan) y los tres juegos encimados
// armando un muaré ("marea").
//
// 🔴 Cómo está hecho. El isotipo es un dibujo calcado y tejido (los aros pasan
// por arriba y por abajo, ver `constants/isotipoConcentrico.ts`): no se puede
// animar aro por aro. Entonces lo que se mueve son aros SIMPLES, vistas con
// borde, con los centros y los radios medidos del dibujo. Recién cuando
// llegaron a su lugar se funden con el dibujo verdadero, que es igual salvo
// por el tejido. Nada de SVG en movimiento ni de recortes: eso era lo que se
// trababa.
//
// 📌 Los centros y los radios salen de medir el dibujo. Si el isotipo cambia,
// hay que volver a medirlos: si quedan corridos, se nota un salto al fundir.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo concéntrico, en su viewBox de 100 × 87,92 ─────────────────────
// Los tres juegos de aros: su centro y los radios, medidos al medio del trazo.
const JUEGOS = [
  { cx: 50, cy: 32,   radios: [7.45, 13.6, 20.1, 26.85] },
  { cx: 31, cy: 57.2, radios: [6.4, 12.7, 19.0, 25.7] },
  { cx: 69, cy: 57.2, radios: [6.4, 12.7, 19.0, 25.7] },
] as const;
type Juego = (typeof JUEGOS)[number];
const TRAZO = 2.1;
// El punto medio entre los tres centros: de ahí se alejan mientras esperan.
const NIDO = { x: 50, y: (32 + 57.2 + 57.2) / 3 };
const SEPARA     = 0.5;    // cuánto más lejos del medio espera cada juego
const INCLINA    = 1.0;    // hasta dónde se inclina cada aro, en radianes
const DESFASE    = 0.1;    // cada aro va esta parte de la ola detrás del de adentro
const PERSPECTIVA = 700;
// Cada juego se inclina alrededor de un eje distinto.
const EJES = [0, (2 * Math.PI) / 3, -(2 * Math.PI) / 3];

const FRASE_1 = 'lo que te pasa le pasa a alguien más';

const QUIETA_MS  = 1450;   // los aros quedan de frente y los juegos se acercan
const TEJE_EN    = 1300;   // ya casi están: se funden con el dibujo verdadero
const TEJE_MS    = 450;
const MARCA_EN   = 1400;
const FIN_EN     = 2150;   // todo quieto
const HOLD_MS    = 700;
const EXIT_MS    = 450;
const AUTO_MS    = 4000;
const SALTEAR_MS = 600;
const OLA_MS     = 5600;   // lo que tarda la ola en ir y volver

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
// Arranca despacio y frena largo: para separarse sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Un aro: se inclina con la ola mientras espera y queda de frente con `quieta`. */
function Aro({ r, n, i, k, medio, quieta, reloj }: {
  r: number; n: number; i: number; k: number; medio: number;
  quieta: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const ola = Math.sin(2 * Math.PI * (reloj.value - n * DESFASE - i / 3));
    return {
      transform: [
        { perspective: PERSPECTIVA },
        { rotateZ: `${EJES[i]}rad` },
        { rotateX: `${INCLINA * ola * (1 - quieta.value)}rad` },
      ],
    };
  });
  return <Animated.View style={[aroCaja(medio, medio, r * k, TRAZO * k), styles.aro, style]} />;
}

/** Uno de los tres juegos de aros: espera apartado y con `quieta` va a su lugar. */
function Aros({ j, i, k, quieta, reloj }: {
  j: Juego; i: number; k: number; quieta: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const lejos = SEPARA * (1 - quieta.value) * k;
    return {
      transform: [{ translateX: (j.cx - NIDO.x) * lejos }, { translateY: (j.cy - NIDO.y) * lejos }],
    };
  });
  const medio = (j.radios[3] + TRAZO) * k;
  return (
    <Animated.View
      style={[{ position: 'absolute', left: j.cx * k - medio, top: j.cy * k - medio, width: 2 * medio, height: 2 * medio }, style]}
    >
      {j.radios.map((r, n) => (
        <Aro key={r} r={r} n={n} i={i} k={k} medio={medio} quieta={quieta} reloj={reloj} />
      ))}
    </Animated.View>
  );
}

export default function OnboardingOndas() {
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
  const S = Math.min(width * 0.66, 280);   // ancho del isotipo
  const K = S / CONCENTRICO_ANCHO;         // px por unidad del viewBox
  const H = CONCENTRICO_ALTO * K;
  const centroY = height * 0.45;
  // El texto va debajo de hasta donde llegan los juegos mientras esperan apartados.
  const abajo = NIDO.y + (JUEGOS[1].cy - NIDO.y) * (1 + SEPARA) + JUEGOS[1].radios[3] + TRAZO;
  const textoY = centroY - H / 2 + abajo * K + 12;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const quieta  = useSharedValue(0);  // los aros quedan de frente y los juegos se acercan
  const teje    = useSharedValue(0);  // los aros simples se funden con el dibujo
  const marca   = useSharedValue(0);
  const sale    = useSharedValue(0);
  const reloj   = useSharedValue(0);  // 0→1 en loop: el latido de los puntos
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

  /** Toda la secuencia. `rapido`: sin ondas que crecen (reduced motion). */
  const arrancar = useCallback((rapido: boolean) => {
    if (armado.current) return;
    armado.current = true;
    hintOp.value = withTiming(0, { duration: 250 });
    frase1.value = withTiming(0, { duration: 280 });

    const f = rapido ? 0 : 1;   // con reduced motion todo cae en el mismo instante
    if (rapido) {
      quieta.value = withTiming(1, { duration: 300 });
      teje.value = withDelay(200, withTiming(1, { duration: 300 }));
    } else {
      quieta.value = withTiming(1, { duration: QUIETA_MS, easing: EASE_SUAVE });
      teje.value = withDelay(TEJE_EN, withTiming(1, { duration: TEJE_MS, easing: Easing.linear }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), 0);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), TEJE_EN);
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
    }, rapido ? 550 : FIN_EN);
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

  // Mientras nadie toca: la ola que inclina los aros. No hace falta frenarla
  // al tocar: se aplana sola a medida que `quieta` llega a 1.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: OLA_MS, easing: Easing.linear }), -1, false);
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
  // El fundido: primero aparece el dibujo verdadero encima, y recién después
  // se van los aros simples. Así nunca se ve más claro en el medio.
  const dibujoStyle = useAnimatedStyle(() => ({ opacity: clamp01(teje.value * 2) }));
  const arosStyle = useAnimatedStyle(() => ({
    opacity: aparece.value * (1 - clamp01(teje.value * 2 - 1)),
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

  return (
    <View style={styles.fondo}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Lo que te pasa le pasa a alguien más. Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        <View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - H / 2, marginLeft: -S / 2, width: S, height: H }]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, arosStyle]}>
            {JUEGOS.map((j, i) => <Aros key={i} j={j} i={i} k={K} quieta={quieta} reloj={reloj} />)}
          </Animated.View>
          {/* El dibujo verdadero, quieto: aparece cuando los aros ya llegaron. */}
          <Animated.View style={[StyleSheet.absoluteFill, dibujoStyle]}>
            <Svg width={S} height={H} viewBox={`0 0 ${CONCENTRICO_ANCHO} ${CONCENTRICO_ALTO}`}>
              <Path d={CONCENTRICO_D} fill={OLIVA} fillRule="evenodd" />
            </Svg>
          </Animated.View>
        </View>

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
  aro: { borderColor: OLIVA },
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
