import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';
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

// Bienvenida "alguien cerca" (12/10/2026, pedido de Andre): la quinta, y la
// primera que termina en el isotipo B (`vita-isotipo-B.svg`) en vez de los tres
// aros de `VitaMark`. Qué cuenta, en tres tiempos:
//
//   1. Un círculo terracota, lleno, solo en el medio del crema. Respira.
//      "hay alguien cerca"
//   2. Tocás: el círculo se corre y hace lugar. A su lado nace una onda (dos
//      aros, uno dentro del otro, que crecen desde un punto) y arriba se dibuja
//      el tercero. Donde los aros pisan el círculo lleno, pasan a crema.
//   3. Queda el isotipo B, con "vita / te acompaña" debajo.
//
// 📌 El círculo lleno NUNCA cambia: no se vacía ni pierde el color. Es la
// diferencia con "alguien llega", donde las tintas se van y queda solo el trazo.
//
// 📌 Geometría y colores son los del SVG, sin retoques. Si el isotipo cambia,
// cambian las constantes de abajo. Los colores coinciden con la paleta de la
// app (terracota, oliva y crema de `ViveColors`), por eso salen de ahí.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const TERRACOTA = ViveColors.primary;
const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo B, en un viewBox de 100 ───────────────────────────────────────
const DISCO   = { cx: 68.48, cy: 66, r: 27.6 };   // el círculo lleno
const IZQ     = { cx: 31.52, cy: 66 };            // la onda: dos aros con el mismo centro
const ARRIBA  = { cx: 50, cy: 34 };
const ARO_R   = 26;
const ECO_R   = 19.6;                             // el aro de adentro
const TRAZO   = 3.2;
const ARO_C   = 2 * Math.PI * ARO_R;
// Cuánto se aparta el círculo lleno del centro del isotipo.
const DISCO_DX = DISCO.cx - 50;
const DISCO_DY = DISCO.cy - 50;

const FRASE_1 = 'hay alguien cerca';

const SOLO_ESCALA = 0.86;  // el círculo solo, un poco más chico que en el isotipo
const ACOMODA_MS  = 700;   // el círculo hace lugar
const ONDA_EN     = 260;
const ONDA_MS     = 720;
const ECO_RETRASO = 0.22;  // el aro de adentro sale un poco después
const ARRIBA_EN   = 620;
const ARRIBA_MS   = 640;
const MARCA_EN    = 1100;
const FIN_EN      = 1700;  // todo quieto
const HOLD_MS     = 700;
const EXIT_MS     = 450;
const AUTO_MS     = 4000;
const SALTEAR_MS  = 600;
const BREATH_MS   = 5200;
const BREATH_AMP  = 0.035;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Un aro de la onda: crece desde su centro hasta el radio `r`. */
function Onda({ r, retraso, color, onda }: {
  r: number; retraso: number; color: string; onda: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    const t = clamp01((onda.value - retraso) / (1 - retraso));
    return { r: r * t, opacity: t > 0 ? 1 : 0 };
  });
  return (
    <AnimatedCircle
      animatedProps={props}
      cx={IZQ.cx} cy={IZQ.cy}
      stroke={color} strokeWidth={TRAZO} fill="none"
    />
  );
}

/** El aro de arriba: se dibuja desde abajo, desde donde están los otros. */
function Trazo({ color, dibuja }: { color: string; dibuja: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: ARO_C * (1 - dibuja.value),
    opacity: dibuja.value > 0 ? 1 : 0,
  }));
  return (
    <AnimatedCircle
      animatedProps={props}
      cx={ARRIBA.cx} cy={ARRIBA.cy} r={ARO_R}
      stroke={color} strokeWidth={TRAZO} fill="none"
      strokeDasharray={[ARO_C]}
      rotation={90} origin={`${ARRIBA.cx}, ${ARRIBA.cy}`}
    />
  );
}

export default function OnboardingCerca() {
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

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const acomoda = useSharedValue(0);  // el círculo va del medio a su lugar
  const onda    = useSharedValue(0);  // los dos aros de al lado
  const dibuja  = useSharedValue(0);  // el aro de arriba
  const aros    = useSharedValue(1);  // reduced motion: los aros se funden, no se dibujan
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
    setTimeout(navegar, EXIT_MS);
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
    if (rapido) {
      aros.value = 0;
      onda.value = 1;
      dibuja.value = 1;
      aros.value = withTiming(1, { duration: 300 });
      acomoda.value = withTiming(1, { duration: 300 });
    } else {
      acomoda.value = withTiming(1, { duration: ACOMODA_MS, easing: EASE_IN_OUT });
      onda.value = withDelay(ONDA_EN, withTiming(1, { duration: ONDA_MS, easing: EASE_OUT }));
      dibuja.value = withDelay(ARRIBA_EN, withTiming(1, { duration: ARRIBA_MS, easing: EASE_IN_OUT }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), ONDA_EN);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Light), ARRIBA_EN + ARRIBA_MS - 100);
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

  // La respiración del círculo mientras está solo.
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
  // Todo el isotipo es una sola vista. Antes del toque está corrida y achicada
  // para que el círculo lleno quede justo en el medio; con `acomoda` vuelve a
  // su lugar y el círculo termina abajo a la derecha, donde va en el isotipo.
  const isotipoStyle = useAnimatedStyle(() => {
    const g = acomoda.value;
    const respira = 1 + BREATH_AMP * (1 - g) * Math.sin(reloj.value * 2 * Math.PI);
    const escala = (SOLO_ESCALA + (1 - SOLO_ESCALA) * g) * respira;
    return {
      opacity: aparece.value,
      transform: [
        { translateX: -DISCO_DX * K * escala * (1 - g) },
        { translateY: -DISCO_DY * K * escala * (1 - g) },
        { scale: escala },
      ],
    };
  });

  const arosStyle = useAnimatedStyle(() => ({ opacity: aros.value }));

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
        accessibilityLabel="Hay alguien cerca. Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - S / 2, marginLeft: -S / 2, width: S, height: S }, isotipoStyle]}
        >
          <Svg width={S} height={S} viewBox="0 0 100 100">
            <Circle cx={DISCO.cx} cy={DISCO.cy} r={DISCO.r} fill={TERRACOTA} />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, arosStyle]}>
            <Svg width={S} height={S} viewBox="0 0 100 100">
              <Defs>
                <ClipPath id="cercaDisco">
                  <Circle cx={DISCO.cx} cy={DISCO.cy} r={DISCO.r} />
                </ClipPath>
              </Defs>
              <G>
                <Onda r={ARO_R} retraso={0} color={OLIVA} onda={onda} />
                <Onda r={ECO_R} retraso={ECO_RETRASO} color={OLIVA} onda={onda} />
                <Trazo color={OLIVA} dibuja={dibuja} />
              </G>
              {/* Los mismos aros otra vez, en crema y recortados al círculo
                  lleno: donde lo pisan, se ven claros. */}
              <G clipPath="url(#cercaDisco)">
                <Onda r={ARO_R} retraso={0} color={CREMA} onda={onda} />
                <Onda r={ECO_R} retraso={ECO_RETRASO} color={CREMA} onda={onda} />
                <Trazo color={CREMA} dibuja={dibuja} />
              </G>
            </Svg>
          </Animated.View>
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
    borderWidth: 2, borderColor: TERRACOTA,
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
