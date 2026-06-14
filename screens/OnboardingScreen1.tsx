import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';

// ── Venn geometry ─────────────────────────────────────────────────────────────
// R = circle radius, D = center-to-center distance (equilateral triangle side)
// H ≈ D × √3/2 = height of the triangle
const R  = 84;
const D  = 82;
const H  = 71;   // Math.round(D * Math.sqrt(3) / 2)
const CW = 250;  // container width
const CH = R * 2 + H;  // container height = 239

// Absolute top-left positions of each circle inside the container
const CIRCLES = [
  { left: CW / 2 - R,           top: 0 },  // top  – Cuerpo
  { left: CW / 2 - D / 2 - R,  top: H },  // bottom-left  – Mente
  { left: CW / 2 + D / 2 - R,  top: H },  // bottom-right – Alma
] as const;

// ── Animation helpers ─────────────────────────────────────────────────────────
function circleIn(anim: Animated.Value) {
  return {
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
  };
}

function fadeUp(anim: Animated.Value, dy = 18) {
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  };
}

export default function OnboardingScreen1() {
  const router = useRouter();

  const c0 = useRef(new Animated.Value(0)).current;
  const c1 = useRef(new Animated.Value(0)).current;
  const c2 = useRef(new Animated.Value(0)).current;
  const viveAnim     = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Phase 1 – circles appear one by one
      Animated.stagger(300, [
        Animated.timing(c0, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(c1, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(c2, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
      // Phase 2 – wordmark emerges
      Animated.delay(160),
      Animated.timing(viveAnim, { toValue: 1, duration: 540, useNativeDriver: true }),
      // Phase 3 – subtitle
      Animated.delay(80),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Phase 4 – button
      Animated.delay(80),
      Animated.timing(buttonAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* ── Venn diagram ─────────────────────────────── */}
        <View style={styles.venn}>
          {([c0, c1, c2] as Animated.Value[]).map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.circle,
                { left: CIRCLES[i].left, top: CIRCLES[i].top },
                circleIn(anim),
              ]}
            />
          ))}
        </View>

        {/* ── Wordmark ─────────────────────────────────── */}
        <Animated.Text style={[styles.vive, fadeUp(viveAnim)]}>
          vive
        </Animated.Text>

        {/* ── Subtitle ─────────────────────────────────── */}
        <Animated.Text style={[styles.subtitle, fadeUp(subtitleAnim)]}>
          Tu camino empieza acá
        </Animated.Text>

      </View>

      {/* ── CTA ──────────────────────────────────────── */}
      <Animated.View style={[styles.footer, fadeUp(buttonAnim)]}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => router.push('/onboarding2')}
        >
          <Text style={styles.buttonText}>¿Empezamos?</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ViveColors.background,
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },

  // Venn
  venn: {
    width: CW,
    height: CH,
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    borderWidth: 1.5,
    borderColor: ViveColors.text,
    backgroundColor: 'transparent',
  },

  // Wordmark — Fraunces, no sprout icon
  vive: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 76,
    color: ViveColors.text,
    letterSpacing: -2,
    lineHeight: 82,
  },

  // Subtitle — color carries opacity so animated opacity can go 0→1 cleanly
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 17,
    color: `${ViveColors.text}A6`,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    paddingBottom: 16,
  },
  button: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
