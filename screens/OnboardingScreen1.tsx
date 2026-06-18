import { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useFrameCallback,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle as SvgCircle,
  Filter,
  FeGaussianBlur,
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

// Classic Venn triangle: top, bottom-right, bottom-left (degrees, clockwise from right)
const REST_ANGLES  = [270, 30, 150] as const;
// Off-plane start angles so each circle swings in along its own arc
const START_ANGLES = [200, -40, 80] as const;

const ENTRY_MS      = 1900;
const HOLD_MS       = 1500;
const BRAND_GROW_MS = 1100;

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL = {
  bg:        '#FBF3E7',
  bgTo:      '#F4E2C8',
  textColor: '#7A3D12',
  subColor:  '#B97A3E',
  ring:      'rgba(122,61,18,0.28)',
} as const;

const AURA_COLORS = ['#FF9A52', '#FFB36B', '#FFC98C'] as const;
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

function useRingAnimProps(
  idx: 0 | 1 | 2,
  entryP: SharedValue<number>,
  mergeP: SharedValue<number>,
) {
  const sx = START_POS[idx].x;
  const sy = START_POS[idx].y;
  const rx = REST_POS[idx].x;
  const ry = REST_POS[idx].y;

  return useAnimatedProps(() => {
    const ee = eioq(entryP.value);
    const me = eioq(mergeP.value);
    const cx = lerp(lerp(sx, rx, ee), CX, me);
    const cy = lerp(lerp(sy, ry, ee), CY, me);
    return {
      cx,
      cy,
      r:           lerp(R, R * 1.5, me),
      strokeWidth: lerp(1.2, 0, me),
    };
  });
}

// =============================================================================
// Component
// =============================================================================

export default function OnboardingScreen1() {
  const router  = useRouter();
  const [hintText, setHintText] = useState('mantené presionado');

  // ── Shared values ─────────────────────────────────────────────────────────
  const entryP   = useSharedValue(0);
  const mergeP   = useSharedValue(0);
  const phaseV   = useSharedValue(0);    // 0 entering | 1 resting | 2 merging | 3 revealed
  const holdingV = useSharedValue(false);
  const hintOp   = useSharedValue(0);
  const diagOp   = useSharedValue(1);
  const diagSc   = useSharedValue(1);
  const rvlOp    = useSharedValue(0);

  // ── JS-thread callbacks (called via runOnJS) ──────────────────────────────

  const navigateNext = useCallback(() => {
    router.push('/onboarding2');
  }, []);

  const triggerReveal = useCallback(() => {
    // Diagram scales out + fades (mirrors web reference CSS transitions)
    diagOp.value = withTiming(0,   { duration: 750 });
    diagSc.value = withTiming(1.4, { duration: 950 });
    hintOp.value = withTiming(0,   { duration: 280 });
    // Cream overlay fades in over BRAND_GROW_MS
    rvlOp.value  = withTiming(1,   { duration: BRAND_GROW_MS });
    setTimeout(navigateNext, BRAND_GROW_MS + 250);
  }, []);

  // ── Frame callback — all phase logic runs on UI thread ────────────────────
  // Mirrors useSequence() from the reference, replacing RAF with useFrameCallback.

  useFrameCallback((frame) => {
    if (phaseV.value === 3) return;
    const dt = frame.timeSincePreviousFrame ?? 16;
    const p  = phaseV.value;

    if (p === 0) {
      // entering → resting
      const next = Math.min(1, entryP.value + dt / ENTRY_MS);
      entryP.value = next;
      if (next >= 1) {
        phaseV.value = 1;
        hintOp.value = withTiming(1, { duration: 600 });
      }
    } else {
      // resting (1) or merging (2)
      if (holdingV.value) {
        const next = Math.min(1, mergeP.value + dt / HOLD_MS);
        mergeP.value = next;
        if (p === 1) {
          phaseV.value = 2;
          runOnJS(setHintText)('manteniendo…');
        }
        if (next >= 1) {
          phaseV.value = 3;
          runOnJS(triggerReveal)();
        }
      } else {
        // Release: reverse at 2.5× speed (reference: 600ms reverse)
        const next = Math.max(0, mergeP.value - dt / 600);
        mergeP.value = next;
        if (next === 0 && p === 2) {
          phaseV.value = 1;
          runOnJS(setHintText)('mantené presionado');
        }
      }
    }
  });

  // ── Animated props (9 circle hooks — fixed call order) ───────────────────

  // Outer deep glow — large blur, r × 1.15, 70 % opacity
  const og0 = useCircleAnimProps(0, 1.15, 0.7, entryP, mergeP);
  const og1 = useCircleAnimProps(1, 1.15, 0.7, entryP, mergeP);
  const og2 = useCircleAnimProps(2, 1.15, 0.7, entryP, mergeP);
  // Inner glow — medium blur, r × 0.88, 100 % opacity
  const ig0 = useCircleAnimProps(0, 0.88, 1.0, entryP, mergeP);
  const ig1 = useCircleAnimProps(1, 0.88, 1.0, entryP, mergeP);
  const ig2 = useCircleAnimProps(2, 0.88, 1.0, entryP, mergeP);
  // Thin rings (stroke fades to 0 during merge)
  const rg0 = useRingAnimProps(0, entryP, mergeP);
  const rg1 = useRingAnimProps(1, entryP, mergeP);
  const rg2 = useRingAnimProps(2, entryP, mergeP);

  // Brand name: y slides from CY-92 down to CY; fontSize grows 28→34
  const brandProps = useAnimatedProps(() => {
    const me = eioq(mergeP.value);
    return {
      y:        lerp(CY - 90, CY, me),
      fontSize: lerp(52, 62, me),
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
    <View style={styles.root}>
      {/* Warm cream gradient background */}
      <LinearGradient colors={[PAL.bg, PAL.bgTo]} style={StyleSheet.absoluteFill} />

      {/* Solid cream overlay that fades in during reveal */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: PAL.bg }, overlayStyle]}
        pointerEvents="none"
      />

      {/* Full-screen hold target */}
      <Pressable
        style={styles.pressable}
        onPressIn={() => { holdingV.value = true; }}
        onPressOut={() => { holdingV.value = false; }}
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
                  <Stop offset="0%"   stopColor={color} stopOpacity="0.95" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              ))}

              {/* Medium blur for inner glow layer */}
              <Filter id="blurMed" x="-100%" y="-100%" width="300%" height="300%">
                <FeGaussianBlur stdDeviation="15" />
              </Filter>
              {/* Deep blur for outer glow layer */}
              <Filter id="blurDeep" x="-150%" y="-150%" width="400%" height="400%">
                <FeGaussianBlur stdDeviation="26" />
              </Filter>
            </Defs>

            {/* ── Layer 1: deep outer glow ── */}
            <AnimatedCircle animatedProps={og0} fill={`url(#${GRAD_IDS[0]})`} filter="url(#blurDeep)" />
            <AnimatedCircle animatedProps={og1} fill={`url(#${GRAD_IDS[1]})`} filter="url(#blurDeep)" />
            <AnimatedCircle animatedProps={og2} fill={`url(#${GRAD_IDS[2]})`} filter="url(#blurDeep)" />

            {/* ── Layer 2: inner glow ── */}
            <AnimatedCircle animatedProps={ig0} fill={`url(#${GRAD_IDS[0]})`} filter="url(#blurMed)" />
            <AnimatedCircle animatedProps={ig1} fill={`url(#${GRAD_IDS[1]})`} filter="url(#blurMed)" />
            <AnimatedCircle animatedProps={ig2} fill={`url(#${GRAD_IDS[2]})`} filter="url(#blurMed)" />

            {/* ── Layer 3: thin rings (fade during merge) ── */}
            <AnimatedCircle animatedProps={rg0} fill="none" stroke={PAL.ring} />
            <AnimatedCircle animatedProps={rg1} fill="none" stroke={PAL.ring} />
            <AnimatedCircle animatedProps={rg2} fill="none" stroke={PAL.ring} />

            {/* ── Brand name: floats above, glides to center on merge ── */}
            <AnimatedSvgText
              animatedProps={brandProps}
              x={CX}
              textAnchor="middle"
              fontFamily="Fraunces_700Bold"
              fontWeight="700"
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
              fontFamily="SpaceGrotesk_400Regular"
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
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    paddingBottom: 20,
  },
  hint: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    letterSpacing: 1,
    color: '#B97A3E',
  },
});
