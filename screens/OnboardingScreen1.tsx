import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { PASTEL_DURAZNO } from '@/constants/tools';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  cancelAnimation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle as SvgCircle,
  Text as SvgText,
} from 'react-native-svg';

// ── Animated SVG wrappers (module-level, stable references) ───────────────────
const AnimatedCircle  = Animated.createAnimatedComponent(SvgCircle);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

// =============================================================================
// Geometry & timing  — identical values to the web reference
// =============================================================================
const VB_W = 320;
const VB_H = 568;
const CX   = 160;
const CY   = 290;   // diagram centroid, slightly above SVG vertical midpoint

const R         = 66;    // resting circle radius
const ORBIT_R   = 150;   // far orbital radius (entry start)
const REST_DIST = 46;    // center→circle-center distance at rest

// Venn triangle INVERTIDO (apex abajo): bottom, top-right, top-left — reflejo
// vertical del original [270,30,150] (degrees, clockwise from right; y+ = abajo).
const REST_ANGLES  = [90, 330, 210] as const;
// Start angles reflejados igual, para que cada círculo entre por su propio arco.
const START_ANGLES = [160, 40, 280] as const;

// 07/10: toda la intro en 4 segundos como mucho (Joaquín). Entrada más corta,
// y desde que se apoya el dedo hasta la pantalla siguiente pasan unos 2,3 s.
const ENTRY_MS      = 1200;
const HOLD_MS       = 1100;
// Cuánto queda quieto el final (disco + "vita" + "te acompaña") antes de
// salir. Es el remate del gesto: sin esta pausa la frase no se llega a leer.
const REVEAL_HOLD_MS = 700;
const EXIT_MS        = 450;
const BRAND_REST_Y   = CY - 90;

// ── Palette ───────────────────────────────────────────────────────────────────
// El wordmark pasa a verde bosque sólido (ViveColors.accent) con un duplicado
// terracota (ViveColors.primary) desplazado — "mala registración" de imprenta.
// El fondo es crema plano del token (ViveColors.background), sin degradé.
const PAL = {
  subColor: '#9E5742',   // tagline "te acompaña"
} as const;

// Desfasaje de la mala registración, en unidades del viewBox (≈2px en pantalla).
// Sutil a propósito: si se nota demasiado parece error.
const MISREG = 2;

// Durazno calmo (Joaquín, 06/10, laboratorio) — antes naranja (#FF9A52…), se
// sentía fuerte; este tono es más suave y menos "neón" al superponerse.
// Colores de la paleta de la app (07/10, Andre y Joaquín: el durazno #F39A7E
// se veía muy salmón y no era de la paleta). Mismo escalonado de tres tonos,
// ahora con la familia terracota: terracota de marca, su tono medio (el
// "Cansado" de la escala de ánimo) y el durazno pastel de las herramientas.
const AURA_COLORS = [ViveColors.primary, '#DDAE93', PASTEL_DURAZNO] as const;
const GRAD_IDS    = ['vgA', 'vgB', 'vgC'] as const;
const DEG         = Math.PI / 180;

// ── Precomputed stable positions (captured as primitives in worklets) ─────────
const START_POS = START_ANGLES.map((a) => ({
  x: CX + Math.cos(a * DEG) * ORBIT_R,
  y: CY + Math.sin(a * DEG) * ORBIT_R,
}));
const REST_POS = REST_ANGLES.map((a) => ({
  x: CX + Math.cos(a * DEG) * REST_DIST,
  y: CY + Math.sin(a * DEG) * REST_DIST,
}));

// =============================================================================
// Worklet helpers
// =============================================================================

function lerp(a: number, b: number, f: number): number {
  'worklet';
  return a + (b - a) * f;
}

function eioq(x: number): number {   // easeInOutQuint
  'worklet';
  return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// =============================================================================
// Per-circle animated-props hooks
// Calling each one with an explicit literal index satisfies React's
// hooks-in-fixed-order rule — never call these inside a loop.
// =============================================================================

function useCircleAnimProps(
  idx: 0 | 1 | 2,
  rMult: number,          // radius multiplier: 1.15 outer glow / 0.88 inner
  opacityMult: number,    // 0.7 outer / 1.0 inner
  entryP: SharedValue<number>,
  mergeP: SharedValue<number>,
) {
  // Extracted as primitives so the worklet closure captures numbers, not object refs
  const sx = START_POS[idx].x;
  const sy = START_POS[idx].y;
  const rx = REST_POS[idx].x;
  const ry = REST_POS[idx].y;

  return useAnimatedProps(() => {
    const ee = eioq(entryP.value);
    const me = eioq(mergeP.value);
    const restX = lerp(sx, rx, ee);
    const restY = lerp(sy, ry, ee);
    const cx    = lerp(restX, CX, me);
    const cy    = lerp(restY, CY, me);
    const baseR = lerp(R, R * 1.5, me);
    return {
      cx,
      cy,
      r:       baseR * rMult,
      opacity: lerp(0.9, 1, me) * opacityMult,
    };
  });
}

// =============================================================================
// Component
// =============================================================================

export default function OnboardingScreen1() {
  const router  = useRouter();
  // 🔴 El techo del embudo. Esta pantalla avanza con un LONG PRESS ("mantené
  // presionado"), o sea que tiene una forma de perder gente que ninguna otra
  // tiene: no entender que hay que sostener. Sin medirla, una caída acá se
  // leería como que la app no le interesó a nadie.
  const abandono = useRef(cronometro()).current;
  const [hintText, setHintText] = useState('mantené presionado');
  const [entryDone, setEntryDone] = useState(false);
  const reduced = useReducedMotion();
  // El gesto ya se completó: desde acá soltar el dedo no deshace nada.
  const revealed = useRef(false);

  // ── Shared values ─────────────────────────────────────────────────────────
  const entryP = useSharedValue(0);
  const mergeP = useSharedValue(0);
  const hintOp = useSharedValue(0);
  const diagOp = useSharedValue(1);
  const diagSc = useSharedValue(1);

  // ── JS-thread callbacks ───────────────────────────────────────────────────

  const navigateNext = useCallback(() => {
    router.replace('/onboarding-bifurcacion');
  }, [router]);

  const triggerReveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    // `segundos` acá es cuánto tardó en descubrir el gesto, no en decidir nada.
    anotar('onboarding_respuesta', { pantalla: 'bienvenida', respuesta: 'mantuvo', segundos: abandono() });

    // Si soltó justo al completar, el pressOut pudo arrancar la vuelta antes de
    // llegar acá: se fija el final.
    cancelAnimation(mergeP);
    mergeP.value = withTiming(1, { duration: 200 });
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    // El final queda quieto REVEAL_HOLD_MS y recién después se va, hacia el
    // mismo crema de la pantalla siguiente.
    hintOp.value = withTiming(0, { duration: 280 });
    diagOp.value = withDelay(REVEAL_HOLD_MS, withTiming(0,   { duration: EXIT_MS }));
    diagSc.value = withDelay(REVEAL_HOLD_MS, withTiming(1.4, { duration: EXIT_MS + 200 }));
    setTimeout(navigateNext, REVEAL_HOLD_MS + EXIT_MS + 50);
  }, [navigateNext]);

  // ── Entry animation on mount ──────────────────────────────────────────────
  useEffect(() => {
    anotar('onboarding_pantalla_vista', { pantalla: 'bienvenida' });

    // 🔴 Se puede apoyar el dedo desde el primer instante (Andre, 07/10): la
    // instrucción aparece enseguida y el gesto no espera a que termine la entrada.
    hintOp.value = withDelay(300, withTiming(1, { duration: 350 }));
    entryP.value = withTiming(1, { duration: ENTRY_MS }, (finished) => {
      if (finished) {
        runOnJS(setEntryDone)(true);
      }
    });
  }, []);

  // Reduced-motion: los círculos quedan quietos en su posición final (sin
  // orbitar). El hook es async, así que si la preferencia resuelve DESPUÉS de
  // montar, se corta la animación en curso y se salta al final.
  useEffect(() => {
    if (!reduced) return;
    cancelAnimation(entryP);
    entryP.value = 1;
    hintOp.value = 1;
    setEntryDone(true);
  }, [reduced]);

  // ── Press handlers ────────────────────────────────────────────────────────
  const handlePressIn = useCallback(() => {
    if (revealed.current) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setHintText('manteniendo…');
    mergeP.value = withTiming(1, { duration: HOLD_MS }, (finished) => {
      if (finished) {
        runOnJS(triggerReveal)();
      }
    });
  }, [triggerReveal]);

  const handlePressOut = useCallback(() => {
    if (revealed.current) return;
    cancelAnimation(mergeP);
    mergeP.value = withTiming(0, { duration: 600 }, (finished) => {
      if (finished) {
        runOnJS(setHintText)('mantené presionado');
      }
    });
  }, []);

  // VoiceOver / TalkBack no pueden "mantener": el doble toque completa el gesto.
  const handleActivate = useCallback(() => {
    if (revealed.current) return;
    mergeP.value = withTiming(1, { duration: 600 }, (finished) => {
      if (finished) {
        runOnJS(triggerReveal)();
      }
    });
  }, [triggerReveal]);

  // ── Animated props (9 circle hooks — fixed call order) ───────────────────

  // Outer deep glow — r × 1.15, 30 % opacity (modo "nítido": halo tenue para
  // que el disco interior defina el círculo en vez de difuminarse).
  const og0 = useCircleAnimProps(0, 1.15, 0.3, entryP, mergeP);
  const og1 = useCircleAnimProps(1, 1.15, 0.3, entryP, mergeP);
  const og2 = useCircleAnimProps(2, 1.15, 0.3, entryP, mergeP);
  // Inner glow — medium blur, r × 0.88, 100 % opacity
  const ig0 = useCircleAnimProps(0, 0.88, 1.0, entryP, mergeP);
  const ig1 = useCircleAnimProps(1, 0.88, 1.0, entryP, mergeP);
  const ig2 = useCircleAnimProps(2, 0.88, 1.0, entryP, mergeP);

  // Brand name: y slides from BRAND_REST_Y down to CY; fontSize grows 52→62.
  // "Letras que se juntan" (tracking-in, elegido por Joaquín 06/10 en el
  // laboratorio): en la segunda mitad de la entrada el wordmark aparece con las
  // letras separadas y se juntan a su lugar (letterSpacing 30→0 + fade). Se mide
  // con entryP, así que pasa mientras los círculos terminan de entrar.
  const brandProps = useAnimatedProps(() => {
    const me = eioq(mergeP.value);
    const wp = eioq(Math.min(1, Math.max(0, (entryP.value - 0.45) / 0.5)));
    return {
      y:             lerp(BRAND_REST_Y, CY, me),
      fontSize:      lerp(52, 62, me),
      letterSpacing: lerp(30, 0, wp),
      opacity:       wp,
    } as any;
  });

  // Capa de atrás del wordmark: misma animación que brandProps, pero desplazada
  // en y (+MISREG; el de x va en el elemento) y a 55% de opacidad. Es la "mala
  // registración" de imprenta — una tinta corrida un pelo.
  const brandBackProps = useAnimatedProps(() => {
    const me = eioq(mergeP.value);
    const wp = eioq(Math.min(1, Math.max(0, (entryP.value - 0.45) / 0.5)));
    return {
      y:             lerp(BRAND_REST_Y, CY, me) + MISREG,
      fontSize:      lerp(52, 62, me),
      letterSpacing: lerp(30, 0, wp),
      opacity:       wp * 0.55,
    } as any;
  });

  // Tagline: fades in when me > 0.85
  const taglineProps = useAnimatedProps(() => {
    const me = eioq(mergeP.value);
    return { opacity: me > 0.85 ? (me - 0.85) / 0.15 : 0 } as any;
  });

  // ── Animated styles ───────────────────────────────────────────────────────

  const diagramStyle = useAnimatedStyle(() => ({
    opacity:   diagOp.value,
    transform: [{ scale: diagSc.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOp.value,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.cream}>
      {/* Fondo claro: hora, señal y batería en oscuro. */}
      <StatusBar barStyle="dark-content" />

      {/* Full-screen hold target */}
      <Pressable
        style={styles.pressable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={handleActivate}
      >
        {/* Diagram group — scales out + fades on reveal */}
        <Animated.View style={[StyleSheet.absoluteFill, diagramStyle]}>
          {/* ── Círculos: intactos (color, blur, tamaño, posición, animación,
              tiempos). Solo se los movió a su propio SVG para poder meter las
              texturas encima sin tocarlos. ── */}
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <Defs>
              {AURA_COLORS.map((color, i) => (
                <RadialGradient
                  key={i}
                  id={GRAD_IDS[i]}
                  cx="50%" cy="50%" r="55%"
                  fx="50%" fy="50%"
                >
                  {/* Modo "nítido" (Joaquín, 06/10): núcleo plano y opaco con
                      caída recién cerca del borde, para que cada orbe se lea
                      como un DISCO definido (un Venn), no como niebla. */}
                  <Stop offset="0%"   stopColor={color} stopOpacity="0.67" />
                  <Stop offset="72%"  stopColor={color} stopOpacity="0.62" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              ))}
            </Defs>

            {/* ── Layer 1: deep outer glow ── */}
            <AnimatedCircle animatedProps={og0} fill={`url(#${GRAD_IDS[0]})`} />
            <AnimatedCircle animatedProps={og1} fill={`url(#${GRAD_IDS[1]})`} />
            <AnimatedCircle animatedProps={og2} fill={`url(#${GRAD_IDS[2]})`} />

            {/* ── Layer 2: inner glow ── */}
            <AnimatedCircle animatedProps={ig0} fill={`url(#${GRAD_IDS[0]})`} />
            <AnimatedCircle animatedProps={ig1} fill={`url(#${GRAD_IDS[1]})`} />
            <AnimatedCircle animatedProps={ig2} fill={`url(#${GRAD_IDS[2]})`} />
          </Svg>
        </Animated.View>

        {/* ── Grano: ENCIMA de los círculos, DEBAJO del wordmark. Va FUERA del
            grupo animado: es el papel, y el papel no se agranda ni se desvanece
            cuando los círculos salen. Muy leve (07/10, visto en el iPhone): a
            16% no se leía como grano, solo agrisaba el crema; y la trama de
            líneas se veía como una persiana encima de los círculos, se sacó. ── */}
        <Grain opacity={0.05} />

        {/* Wordmark group — sale igual que los círculos */}
        <Animated.View style={[StyleSheet.absoluteFill, diagramStyle]} pointerEvents="none">
          {/* ── Wordmark: su propio SVG, encima del grano. Dos capas con "mala
              registración" de imprenta: atrás terracota corrida +MISREG a 55%,
              adelante verde bosque sólido (sin contorno). ── */}
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          >
            <AnimatedSvgText
              animatedProps={brandBackProps}
              x={CX + MISREG}
              textAnchor="middle"
              fontFamily={ViveFonts.wordmark}
              fontWeight="800"
              fill={ViveColors.primary}
            >
              {'vita'}
            </AnimatedSvgText>
            <AnimatedSvgText
              animatedProps={brandProps}
              x={CX}
              textAnchor="middle"
              fontFamily={ViveFonts.wordmark}
              fontWeight="800"
              fill={ViveColors.accent}
            >
              {'vita'}
            </AnimatedSvgText>

            {/* ── Tagline: appears near completion ── */}
            <AnimatedSvgText
              animatedProps={taglineProps}
              x={CX}
              y={CY + 28}
              textAnchor="middle"
              fontFamily={ViveFonts.regular}
              fontSize={12}
              letterSpacing={0.8}
              fill={PAL.subColor}
            >
              {'te acompaña'}
            </AnimatedSvgText>
          </Svg>
        </Animated.View>

        {/* Hint text — outside SVG for reliable font rendering */}
        <SafeAreaView style={styles.hintWrap} edges={['bottom']}>
          <Animated.Text style={[styles.hint, hintStyle]}>
            {hintText}
          </Animated.Text>
        </SafeAreaView>
      </Pressable>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Crema PLANO del token (sin degradé — el riso no tiene degradés).
  cream: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  pressable: {
    flex: 1,
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
    color: ViveColors.text,
  },
});
