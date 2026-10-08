import { useCallback, useEffect, useRef } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "tres en uno" (07/10/2026): rediseño estético de la idea de
// Joaquín (`OnboardingScreen1`): tres círculos que, al mantener apretado, se
// hacen uno con "vita" al medio. La idea es la misma; cambia cómo se ve.
//
// Decisiones de diseño, con lo que se fue aprendiendo ese día en el iPhone:
//   · En reposo los tres círculos SON el isotipo de Vita: misma geometría que
//     `VitaMark` (uno arriba, dos abajo), no un Venn invertido.
//   · Tres tintas de la paleta (salvia, durazno, terracota), planas y nítidas,
//     en "multiply": donde se pisan se suman, como una sobreimpresión. Es la
//     idea de imprenta, sin trama de líneas ni sombra en el título.
//   · Al mantener, las tres tintas se juntan y se vuelven UNA: un disco
//     terracota de marca con "vita" calado en crema. El papel se entibia con
//     el mismo avance del dedo.
//   · Al completar, ondas que salen de la pantalla, y "te acompaña".
//   · Se puede apretar desde el primer instante, y desde que se apoya el dedo
//     hasta la pantalla siguiente pasan unos 2,2 s (la intro, 4 s como mucho).
//   · Si nadie toca, los círculos amagan a juntarse cada tanto: enseña el
//     gesto sin texto. VoiceOver completa con el doble toque.

const SALVIA    = '#BFCBA6'; // "Bien" en la escala de ánimo
const DURAZNO   = '#DDAE93'; // "Cansado" en la escala de ánimo
const TERRACOTA = '#C06B4A'; // terracota, a media tinta
const PAPEL_FRIO  = '#EFECE5';
const PAPEL_TIBIO = '#F9EADB';

// Geometría de `VitaMark` (viewBox de 100), en polares desde el centro (50, 50):
// radio y ángulo de cada centro. Arriba (0,-16), izquierda (-20.5,16), derecha (20.5,16).
const MARK_R = 26;
const CENTROS = [
  { r: 16, a: -Math.PI / 2 },
  { r: Math.hypot(20.5, 16), a: Math.atan2(16, -20.5) },
  { r: Math.hypot(20.5, 16), a: Math.atan2(16, 20.5) },
] as const;
const TINTAS = [
  { color: TERRACOTA, fuerza: 0.6 },
  { color: SALVIA,    fuerza: 1 },
  { color: DURAZNO,   fuerza: 1 },
] as const;

const ENTRY_MS   = 1000;
const HOLD_MS    = 1000;  // mantener apretado
const QUIETO_MS  = 700;   // el final queda quieto
const EXIT_MS    = 450;
const AMAGUE_MS  = 3200;  // cada cuánto amagan a juntarse si nadie toca
const BREATH_MS  = 5200;
const BREATH_AMP = 0.03;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}
function easeOutCubic(x: number): number {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(x: number): number {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Una de las tres tintas: entra en arco hasta su lugar del isotipo y, con el
 *  avance del dedo, va al centro y crece hasta ser el círculo único. */
function Tinta({ i, K, D, crece, lejos, entra, une, reloj, base }: {
  i: 0 | 1 | 2; K: number; D: number; crece: number; lejos: number;
  entra: SharedValue<number>; une: SharedValue<number>; reloj: SharedValue<number>;
  base: object;
}) {
  const { r, a } = CENTROS[i];
  const { color, fuerza } = TINTAS[i];
  const estilo = useAnimatedStyle(() => {
    // Escalonadas: cada una entra un poco después de la anterior.
    const en = easeOutCubic(clamp01((entra.value - i * 0.09) / 0.82));
    const me = easeInOutCubic(clamp01(une.value));
    const radio = r * K * (1 - me) + (1 - en) * lejos;
    const angulo = a + (1 - en) * 1.25;
    const respira = 1 + BREATH_AMP * (1 - me) * Math.sin(reloj.value * 2 * Math.PI + i * 2.1);
    return {
      // Al juntarse se aclaran un poco: tres tintas enteras encimadas dan marrón.
      opacity: clamp01(en * 2) * fuerza * (1 - 0.35 * me),
      transform: [
        { translateX: Math.cos(angulo) * radio },
        { translateY: Math.sin(angulo) * radio },
        { scale: (0.9 + 0.1 * en) * (1 + (crece - 1) * me) * respira },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.centrado, base, { width: D, height: D, borderRadius: D / 2, marginLeft: -D / 2, marginTop: -D / 2, backgroundColor: color, mixBlendMode: 'multiply' }, estilo]}
    />
  );
}

/** Una de las tres manchas que giran DENTRO del círculo único. Es lo que lo
 *  mantiene vivo: el uno sigue teniendo a los tres adentro, moviéndose lento. */
function Mancha({ i, UNO, color, fuerza, reloj }: {
  i: number; UNO: number; color: string; fuerza: number; reloj: SharedValue<number>;
}) {
  const lado = UNO * 0.92;
  const estilo = useAnimatedStyle(() => {
    const a = reloj.value * 2 * Math.PI + (i * 2 * Math.PI) / 3;
    return {
      transform: [
        { translateX: Math.cos(a) * UNO * 0.24 },
        { translateY: Math.sin(a) * UNO * 0.24 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: (UNO - lado) / 2, top: (UNO - lado) / 2,
          width: lado, height: lado, borderRadius: lado / 2, backgroundColor: color, opacity: fuerza },
        estilo,
      ]}
    />
  );
}

/** Una de las ondas que salen al completar: no se apagan antes de irse, salen
 *  de la pantalla (no se ve dónde terminan). `relleno` es el resplandor. */
function Aro({ onda, retraso, hasta, fuerza, base, relleno }: {
  onda: SharedValue<number>; retraso: number; hasta: number; fuerza: number;
  base: object; relleno?: boolean;
}) {
  const estilo = useAnimatedStyle(() => {
    const t = clamp01((onda.value - retraso) / (1 - retraso));
    return {
      opacity: t > 0 ? fuerza * (relleno ? 1 - t : 1 - 0.6 * t) : 0,
      transform: [{ scale: 0.85 + (hasta - 0.85) * (1 - Math.pow(1 - t, 1.5)) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.centrado, base, relleno ? styles.resplandor : styles.aro, estilo]}
    />
  );
}

export default function OnboardingTresEnUno() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const abandono = useRef(cronometro()).current;

  const revelado = useRef(false);
  const tocado = useRef(false);
  const amague = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Geometría ──────────────────────────────────────────────────────────────
  const S = Math.min(width * 0.6, 256);    // lado del isotipo
  const K = S / 100;
  const D = MARK_R * 2 * K;                // diámetro de cada tinta
  const UNO = S * 0.84;                    // diámetro del círculo único
  const centroY = height * 0.46;
  const textoY = centroY + S * 0.44 + 22;  // donde descansa "vita"
  const ALTO_MARCA = 60;
  const SUBE = centroY - (textoY + ALTO_MARCA / 2);  // de ahí al centro del círculo
  const WASH = Math.max(width, height) * 2.3;
  const FUERA = (2 * Math.hypot(width / 2, Math.max(centroY, height - centroY))) / UNO;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const entra  = useSharedValue(0);
  const une    = useSharedValue(0);  // avance del dedo, 0→1
  const cierre = useSharedValue(0);  // completado: "te acompaña"
  const onda   = useSharedValue(0);
  const sale   = useSharedValue(0);
  const reloj  = useSharedValue(0);
  const hintOp = useSharedValue(0);
  const dedoX  = useSharedValue(0);
  const dedoY  = useSharedValue(0);
  const dedo   = useSharedValue(0);
  const pop    = useSharedValue(0);  // el golpecito del círculo al cerrarse

  const navegar = useCallback(() => {
    router.replace('/onboarding-bifurcacion');
  }, [router]);

  const pararAmague = useCallback(() => {
    if (amague.current) clearInterval(amague.current);
    amague.current = null;
  }, []);

  const revelar = useCallback(() => {
    if (revelado.current) return;
    revelado.current = true;
    pararAmague();
    // `segundos` acá es cuánto tardó en descubrir el gesto, no en decidir nada.
    anotar('onboarding_respuesta', { pantalla: 'bienvenida', respuesta: 'mantuvo', segundos: abandono() });
    // Si soltó justo al completar, el pressOut pudo arrancar la vuelta: se fija el final.
    cancelAnimation(une);
    une.value = withTiming(1, { duration: 160 });
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    hintOp.value = withTiming(0, { duration: 220 });
    cierre.value = withTiming(1, { duration: 400, easing: EASE_OUT });
    pop.value = withSequence(
      withTiming(1, { duration: 110, easing: EASE_OUT }),
      withSpring(0, { duration: 600, dampingRatio: 0.5 }),
    );
    onda.value = withTiming(1, { duration: 1150, easing: Easing.linear });
    sale.value = withDelay(QUIETO_MS, withTiming(1, { duration: EXIT_MS, easing: EASE_OUT }));
    setTimeout(navegar, QUIETO_MS + EXIT_MS);
  }, [navegar, pararAmague]);

  // ── Entrada ────────────────────────────────────────────────────────────────
  useEffect(() => {
    anotar('onboarding_pantalla_vista', { pantalla: 'bienvenida' });
    // 🔴 Se puede apretar desde el primer instante: nada espera a la entrada.
    entra.value = withTiming(1, { duration: ENTRY_MS, easing: Easing.linear });
    hintOp.value = withDelay(300, withTiming(1, { duration: 350 }));
    // Si nadie toca, los círculos amagan a juntarse: muestra qué hace el gesto.
    amague.current = setInterval(() => {
      if (tocado.current || revelado.current) return;
      une.value = withSequence(
        withTiming(0.2, { duration: 520, easing: EASE_OUT }),
        withTiming(0, { duration: 620, easing: EASE_OUT }),
      );
    }, AMAGUE_MS);
    return pararAmague;
  }, []);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      cancelAnimation(entra);
      entra.value = 1;
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(reloj);
  }, [reduced]);

  // ── Dedo ───────────────────────────────────────────────────────────────────
  const alApoyar = useCallback((ev: GestureResponderEvent) => {
    if (revelado.current) return;
    tocado.current = true;
    pararAmague();
    const { pageX, pageY } = ev.nativeEvent;
    dedoX.value = pageX;
    dedoY.value = pageY;
    dedo.value = 0;
    dedo.value = withTiming(1, { duration: 650, easing: EASE_OUT });
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // Reduced motion: sin viaje ni mantener. Un toque y sigue.
    if (reduced) { revelar(); return; }
    cancelAnimation(une);
    une.value = withTiming(1, { duration: Math.max(150, (1 - une.value) * HOLD_MS), easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(revelar);
    });
  }, [reduced, revelar, pararAmague]);

  const alSoltar = useCallback(() => {
    if (revelado.current || reduced) return;
    // Soltó antes: vuelven a su lugar con un resorte (venía con el dedo).
    cancelAnimation(une);
    une.value = withSpring(0, { duration: 520, dampingRatio: 0.75 });
  }, [reduced]);

  // VoiceOver / TalkBack no pueden "mantener": el doble toque completa.
  const alActivar = useCallback(() => {
    if (revelado.current) return;
    tocado.current = true;
    pararAmague();
    une.value = withTiming(1, { duration: 600, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(revelar);
    });
  }, [revelar, pararAmague]);

  // ── Estilos animados (transform, opacity y color) ──────────────────────────
  // El papel se entibia con el mismo avance del dedo.
  const washStyle = useAnimatedStyle(() => {
    const me = easeInOutCubic(clamp01(une.value));
    return {
      opacity: clamp01(me * 2.5) * (1 - sale.value),
      transform: [{ scale: 0.04 + 0.96 * me }],
    };
  });

  const grupoStyle = useAnimatedStyle(() => ({
    opacity: 1 - sale.value,
    transform: [{ scale: 1 + 0.04 * sale.value }],
  }));

  // El círculo único: aparece encima de las tres tintas cuando ya casi se
  // juntaron, y las resuelve en un solo color.
  const unoStyle = useAnimatedStyle(() => {
    const me = easeInOutCubic(clamp01(une.value));
    const t = clamp01((me - 0.5) / 0.5);
    return {
      opacity: t,
      transform: [{ scale: (0.82 + 0.18 * t) * (1 + 0.05 * pop.value) }],
    };
  });

  // El aro fino que lo rodea al cerrarse: el trazo del isotipo, ahora en uno.
  const aroFinoStyle = useAnimatedStyle(() => ({
    opacity: cierre.value,
    transform: [{ scale: 0.93 + 0.07 * cierre.value + 0.03 * pop.value }],
  }));

  // "vita": descansa debajo del isotipo, sube al centro del círculo y pasa de
  // verde a crema (calado sobre el terracota).
  const marcaStyle = useAnimatedStyle(() => {
    const en = easeOutCubic(clamp01((entra.value - 0.35) / 0.6));
    const me = easeInOutCubic(clamp01(une.value));
    return {
      opacity: en,
      color: interpolateColor(clamp01((me - 0.55) / 0.35), [0, 1], [ViveColors.accent, ViveColors.background]),
      // Las letras llegan separadas y se juntan (idea de Joaquín, 06/10). El
      // translateX compensa el espacio que letterSpacing deja después de la "a".
      letterSpacing: 16 * (1 - en),
      transform: [
        { translateX: 8 * (1 - en) },
        { translateY: SUBE * me },
        { scale: 1 + 0.1 * me },
      ],
    };
  });

  const lemaStyle = useAnimatedStyle(() => ({
    opacity: cierre.value,
    transform: [{ translateY: 6 * (1 - cierre.value) }],
  }));

  const dedoStyle = useAnimatedStyle(() => ({
    opacity: 0.22 * (1 - dedo.value) * (dedo.value > 0 ? 1 : 0),
    transform: [
      { translateX: dedoX.value - 40 },
      { translateY: dedoY.value - 40 },
      { scale: 0.4 + 1.6 * dedo.value },
    ],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOp.value }));

  const enCentro = { top: centroY };
  const unoBase = { top: centroY, width: UNO, height: UNO, borderRadius: UNO / 2, marginLeft: -UNO / 2, marginTop: -UNO / 2 };

  return (
    <View style={styles.papel}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        onPressOut={alSoltar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        {/* El papel que se entibia: crece desde el centro con el dedo. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centrado,
            { top: centroY, width: WASH, height: WASH, borderRadius: WASH / 2,
              marginLeft: -WASH / 2, marginTop: -WASH / 2, backgroundColor: PAPEL_TIBIO },
            washStyle,
          ]}
        />

        {/* Las ondas del final, por debajo del círculo. */}
        <Aro onda={onda} retraso={0}    hasta={FUERA}        fuerza={0.16} base={unoBase} relleno />
        <Aro onda={onda} retraso={0}    hasta={FUERA * 1.25} fuerza={0.45} base={unoBase} />
        <Aro onda={onda} retraso={0.14} hasta={FUERA * 1.15} fuerza={0.36} base={unoBase} />
        <Aro onda={onda} retraso={0.28} hasta={FUERA * 1.05} fuerza={0.28} base={unoBase} />

        <Animated.View style={[StyleSheet.absoluteFill, grupoStyle]} pointerEvents="none">
          {/* Las tres tintas, en "multiply": donde se pisan, se suman. */}
          {([0, 1, 2] as const).map(i => (
            <Tinta
              key={i} i={i} K={K} D={D} crece={UNO / D} lejos={S * 1.5}
              entra={entra} une={une} reloj={reloj} base={enCentro}
            />
          ))}
          {/* El círculo único. No es un disco liso: adentro siguen las tres
              tintas, girando lento, con una luz arriba y el grano del papel. */}
          <Animated.View style={[styles.centrado, styles.uno, unoBase, unoStyle]}>
            <Mancha i={0} UNO={UNO} color={ViveColors.primaryInk} fuerza={0.55} reloj={reloj} />
            <Mancha i={1} UNO={UNO} color={DURAZNO} fuerza={0.32} reloj={reloj} />
            <Mancha i={2} UNO={UNO} color={SALVIA} fuerza={0.24} reloj={reloj} />
            <View style={[styles.luz, { width: UNO, height: UNO, borderRadius: UNO / 2, left: -UNO * 0.2, top: -UNO * 0.24 }]} />
            <Grain opacity={0.1} />
          </Animated.View>
          <Animated.View
            style={[
              styles.centrado, styles.aroFino,
              { top: centroY, width: UNO + 22, height: UNO + 22, borderRadius: (UNO + 22) / 2,
                marginLeft: -(UNO + 22) / 2, marginTop: -(UNO + 22) / 2 },
              aroFinoStyle,
            ]}
          />
        </Animated.View>

        {/* El papel: quieto, encima de las tintas y debajo del texto. */}
        <Grain opacity={0.05} />

        <Animated.View style={[styles.texto, { top: textoY }, grupoStyle]} pointerEvents="none">
          <Animated.Text style={[styles.marca, { height: ALTO_MARCA }, marcaStyle]}>vita</Animated.Text>
          <Animated.Text style={[styles.lema, lemaStyle]}>te acompaña</Animated.Text>
        </Animated.View>

        {/* La onda del toque. */}
        <Animated.View pointerEvents="none" style={[styles.dedo, dedoStyle]} />

        <SafeAreaView style={styles.hintWrap} edges={['bottom']} pointerEvents="none">
          <Animated.Text style={[styles.hint, hintStyle]}>mantené apretado</Animated.Text>
        </SafeAreaView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  papel: { flex: 1, backgroundColor: PAPEL_FRIO, overflow: 'hidden' },
  todo: { flex: 1 },
  centrado: { position: 'absolute', left: '50%' },
  uno: { backgroundColor: ViveColors.primary, overflow: 'hidden' },
  luz: { position: 'absolute', backgroundColor: ViveColors.background, opacity: 0.1 },
  aroFino: { borderWidth: 2, borderColor: '#4B4B2C' },
  // Fino a propósito: el borde escala con el aro y llega varias veces más grueso.
  aro: { borderWidth: 1.5, borderColor: ViveColors.primary },
  resplandor: { backgroundColor: ViveColors.primary },
  dedo: {
    position: 'absolute', left: 0, top: 0,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: ViveColors.primary,
  },
  texto: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  marca: {
    fontFamily: ViveFonts.wordmark,
    fontSize: 52,
    lineHeight: 60,
    color: ViveColors.accent,
  },
  // Queda donde descansaba "vita": cuando el nombre sube al círculo, este
  // lugar se libera y el lema lo ocupa.
  lema: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: ViveFonts.regular,
    fontSize: 17,
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
    color: ViveColors.text,
  },
});
