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
//   1. Los tres juegos de aros del isotipo, uno ENCIMA del otro, casi en el
//      mismo punto, con algunos aros de más hacia afuera. Cada juego da vueltas
//      apenas corrido del centro, y al cruzarse tantas líneas finas aparecen
//      dibujos que se mueven solos (un muaré): parece que late.
//      "lo que te pasa le pasa a alguien más"
//   2. Tocás: los tres juegos se separan despacio, cada uno hacia su lugar.
//      Mientras se alejan el dibujo cambia todo el tiempo, y los aros de más
//      se apagan.
//   3. Queda el isotipo concéntrico, con "vita / te acompaña" debajo.
//
// 📌 Andre las pidió "artísticas y modernas, bellas, hasta hipnóticas", sin
// confeti ni circo. La primera versión (ondas que crecían como gotas) le
// pareció aburrida y se trababa.
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
// Donde esperan los tres, encimados: el punto medio entre los tres centros.
const NIDO = { x: 50, y: (32 + 57.2 + 57.2) / 3 };
// Los aros de más, que solo están mientras esperan: siguen el mismo paso hacia
// afuera. 🔴 Si sube la cantidad, el dibujo se sale de la pantalla en teléfonos
// chicos y baja el texto.
const DE_MAS     = 3;
const DE_MAS_OP  = 0.55;
const RONDA      = 6;      // cuánto se corre cada juego del centro, como mucho
const TERCIO     = (2 * Math.PI) / 3;

const FRASE_1 = 'lo que te pasa le pasa a alguien más';

const SEPARA_MS  = 1500;   // los tres juegos van a su lugar
const TEJE_EN    = 1300;   // ya casi están: se funden con el dibujo verdadero
const TEJE_MS    = 450;
const MARCA_EN   = 1400;
const FIN_EN     = 2150;   // todo quieto
const HOLD_MS    = 700;
const EXIT_MS    = 450;
const AUTO_MS    = 4000;
const SALTEAR_MS = 600;
const VUELTA_MS  = 9000;   // una vuelta de la ronda
const LATIDO_MS  = 5200;   // la ronda se abre y se cierra

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
// Arranca despacio y frena largo: para separarse sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Hasta dónde llega un juego con sus aros de más, desde su centro. */
function radioEntero(j: Juego): number {
  const paso = j.radios[3] - j.radios[2];
  return j.radios[3] + DE_MAS * paso + TRAZO / 2;
}

/**
 * Uno de los tres juegos de aros. Mientras espera está en el nido, dando
 * vueltas apenas corrido del centro; con `separa` va a su lugar.
 */
function Aros({ j, i, k, separa, giro, reloj }: {
  j: Juego; i: number; k: number;
  separa: SharedValue<number>; giro: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const g = separa.value;
    const abre = 0.5 + 0.5 * Math.sin(reloj.value * 2 * Math.PI);
    const ronda = RONDA * (0.45 + 0.55 * abre) * (1 - g);
    const angulo = giro.value + i * TERCIO;
    return {
      transform: [
        { translateX: ((NIDO.x - j.cx) * (1 - g) + ronda * Math.cos(angulo)) * k },
        { translateY: ((NIDO.y - j.cy) * (1 - g) + ronda * Math.sin(angulo)) * k },
      ],
    };
  });
  const deMasStyle = useAnimatedStyle(() => ({ opacity: DE_MAS_OP * (1 - clamp01(separa.value * 1.5)) }));

  const paso = j.radios[3] - j.radios[2];
  const lado = 2 * radioEntero(j) * k;
  const medio = lado / 2;
  return (
    <Animated.View
      style={[{ position: 'absolute', left: j.cx * k - medio, top: j.cy * k - medio, width: lado, height: lado }, style]}
    >
      {j.radios.map(r => (
        <View key={r} style={[aroCaja(medio, medio, r * k, TRAZO * k), styles.aro]} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, deMasStyle]}>
        {Array.from({ length: DE_MAS }, (_, n) => (
          <View key={n} style={[aroCaja(medio, medio, (j.radios[3] + (n + 1) * paso) * k, TRAZO * k), styles.aro]} />
        ))}
      </Animated.View>
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
  // El texto va debajo de hasta donde llega el dibujo mientras espera.
  const textoY = centroY - H / 2 + (NIDO.y + radioEntero(JUEGOS[0]) + RONDA) * K + 4;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const separa  = useSharedValue(0);  // los tres juegos van del nido a su lugar
  const giro    = useSharedValue(0);  // en radianes: la ronda alrededor del nido
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
      separa.value = withTiming(1, { duration: 300 });
      teje.value = withDelay(200, withTiming(1, { duration: 300 }));
    } else {
      separa.value = withTiming(1, { duration: SEPARA_MS, easing: EASE_SUAVE });
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

  // Mientras nadie toca: los tres juegos dan vueltas alrededor del nido, y la
  // ronda se abre y se cierra. No hace falta frenarla al tocar: se achica sola
  // a medida que se separan.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      cancelAnimation(giro);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: LATIDO_MS, easing: Easing.linear }), -1, false);
    giro.value = 0;
    giro.value = withRepeat(withTiming(2 * Math.PI, { duration: VUELTA_MS, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(reloj); cancelAnimation(giro); };
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
            {JUEGOS.map((j, i) => <Aros key={i} j={j} i={i} k={K} separa={separa} giro={giro} reloj={reloj} />)}
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
