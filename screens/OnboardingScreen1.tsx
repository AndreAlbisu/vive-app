import { useState, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { anotar, cronometro } from '@/lib/analytics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
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

const ENTRY_MS      = 1900;
const HOLD_MS       = 1500;
const BRAND_GROW_MS = 1100;

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL = {
  bg:        '#FBF3E7',
  bgTo:      '#F4E2C8',
  // Wordmark "vita" (07/10, Joaquín): relleno TERRACOTA con borde fino VERDE
  // OLIVA. El borde se dibuja con doble capa (trazo redondeado abajo + relleno
  // arriba) para que no haga el pico raro en la "v".
  textColor:  '#C1694F',   // relleno terracota de marca
  textStroke: '#6E7A3C',   // borde fino verde oliva
  // Tagline en terracota sólido (sin borde; en 12px un contorno ensuciaría).
  subColor:   '#9E5742',
} as const;

// Durazno calmo (Joaquín, 06/10, laboratorio) — antes naranja (#FF9A52…), se
// sentía fuerte; este tono es más suave y menos "neón" al superponerse.
const AURA_COLORS = ['#F39A7E', '#F7BBA6', '#FBD8CB'] as const;
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

  // ── Shared values ─────────────────────────────────────────────────────────
  const entryP = useSharedValue(0);
  const mergeP = useSharedValue(0);
  const hintOp = useSharedValue(0);
  const diagOp = useSharedValue(1);
  const diagSc = useSharedValue(1);
  const rvlOp  = useSharedValue(0);

  // ── JS-thread callbacks ───────────────────────────────────────────────────

  const navigateNext = useCallback(() => {
    router.replace('/onboarding-bifurcacion');
  }, [router]);

  const triggerReveal = useCallback(() => {
    // `segundos` acá es cuánto tardó en descubrir el gesto, no en decidir nada.
    anotar('onboarding_respuesta', { pantalla: 'bienvenida', respuesta: 'mantuvo', segundos: abandono() });

    diagOp.value = withTiming(0,   { duration: 750 });
    diagSc.value = withTiming(1.4, { duration: 950 });
    hintOp.value = withTiming(0,   { duration: 280 });
    rvlOp.value  = withTiming(1,   { duration: BRAND_GROW_MS });
    setTimeout(navigateNext, BRAND_GROW_MS + 250);
  }, [navigateNext]);

  // ── Entry animation on mount ──────────────────────────────────────────────
  useEffect(() => {
    anotar('onboarding_pantalla_vista', { pantalla: 'bienvenida' });

    entryP.value = withTiming(1, { duration: ENTRY_MS }, (finished) => {
      if (finished) {
        hintOp.value = withTiming(1, { duration: 600 });
        runOnJS(setEntryDone)(true);
      }
    });
  }, []);

  // ── Press handlers ────────────────────────────────────────────────────────
  const handlePressIn = useCallback(() => {
    if (!entryDone) return;
    setHintText('manteniendo…');
    mergeP.value = withTiming(1, { duration: HOLD_MS }, (finished) => {
      if (finished) {
        runOnJS(triggerReveal)();
      }
    });
  }, [entryDone, triggerReveal]);

  const handlePressOut = useCallback(() => {
    cancelAnimation(mergeP);
    mergeP.value = withTiming(0, { duration: 600 }, (finished) => {
      if (finished) {
        runOnJS(setHintText)('mantené presionado');
      }
    });
  }, []);

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

  // Brand name: y slides from CY-90 down to CY; fontSize grows 52→62.
  // "Letras que se juntan" (tracking-in, elegido por Joaquín 06/10 en el
  // laboratorio): en la segunda mitad de la entrada el wordmark aparece con las
  // letras separadas y se juntan a su lugar (letterSpacing 30→0 + fade). Se mide
  // con entryP, así que pasa mientras los círculos terminan de entrar.
  const brandProps = useAnimatedProps(() => {
    const me = eioq(mergeP.value);
    const wp = eioq(Math.min(1, Math.max(0, (entryP.value - 0.45) / 0.5)));
    return {
      y:             lerp(CY - 90, CY, me),
      fontSize:      lerp(52, 62, me),
      letterSpacing: lerp(30, 0, wp),
      opacity:       wp,
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

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: rvlOp.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOp.value,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppBg>
      {/* Dark overlay fades in during reveal before navigating */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,8,38,0.88)' }, overlayStyle]}
        pointerEvents="none"
      />

      {/* Full-screen hold target */}
      <Pressable
        style={styles.pressable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Diagram group — scales out + fades on reveal */}
        <Animated.View style={[StyleSheet.absoluteFill, diagramStyle]}>
          <Svg
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

            {/* ── Brand name: floats above, glides to center on merge.
                Doble capa para un contorno limpio: (1) solo-trazo abajo, con
                juntas/puntas redondeadas (si no, la "v" hace un pico feo), y
                (2) el relleno arriba, que tapa la mitad interior del trazo —
                así el borde queda parejo y fino por fuera. ── */}
            <AnimatedSvgText
              animatedProps={brandProps}
              x={CX}
              textAnchor="middle"
              fontFamily="PlusJakartaSans_800ExtraBold"
              fontWeight="800"
              fill="none"
              stroke={PAL.textStroke}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {'vita'}
            </AnimatedSvgText>
            <AnimatedSvgText
              animatedProps={brandProps}
              x={CX}
              textAnchor="middle"
              fontFamily="PlusJakartaSans_800ExtraBold"
              fontWeight="800"
              fill={PAL.textColor}
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
              {'convive con vos'}
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
    </AppBg>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  hintWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
  },
  hint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    letterSpacing: 1,
    color: '#87835C',
  },
});
