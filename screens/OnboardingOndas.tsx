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
import { Anillo } from '@/components/ui/Festejo';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "las ondas" (12/10/2026, pedido de Andre): termina en el isotipo
// concéntrico. Qué cuenta, en tres tiempos:
//
//   1. Tres puntos oliva, separados, que laten sobre el crema.
//      "lo que te pasa le pasa a alguien más"
//      De cada uno salen aritos chicos, como gotas que caen en el agua.
//   2. Tocás: de cada punto sale una onda. Los aros aparecen de adentro hacia
//      afuera, uno tras otro, hasta que las tres ondas se cruzan. Y las ondas
//      NO frenan en el isotipo: siguen de largo, en terracota, verde y oliva,
//      hasta salirse de la pantalla.
//   3. Cuando se cruzan, el isotipo da un latido. Debajo, "vita / te acompaña".
//
// 🔴 Cómo está hecho, porque no es como las otras. El isotipo concéntrico es un
// dibujo calcado y tejido (ver `constants/isotipoConcentrico.ts`): no se puede
// animar aro por aro. Lo que se anima son tres VENTANAS redondas, una por cada
// centro, que crecen. Cada ventana recorta una copia entera y quieta del
// dibujo; entre las tres lo terminan mostrando todo. La ventana se agranda con
// `scale` y su contenido se achica con la inversa, así el dibujo no se mueve.
// No usa recortes ni máscaras de SVG, que al animarse fallan en Android.
//
// 📌 Los centros salen de medir el dibujo. Si el isotipo cambia, hay que volver
// a medirlos: si quedan corridos, los aros dejan de aparecer de a uno.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo concéntrico, en su viewBox de 100 × 87,92 ─────────────────────
// El centro de cada juego de aros y cuánto tarda en salir su onda.
const CENTROS = [
  { cx: 50, cy: 32,   espera: 0 },
  { cx: 31, cy: 57.2, espera: 110 },
  { cx: 69, cy: 57.2, espera: 220 },
] as const;
const VENTANA_R  = 29.6;   // tapa hasta el borde de afuera del aro más grande
const VENTANA_R0 = 3;      // de arranque: cae en el hueco del aro más chico
const PUNTO_R    = 1.7;
const GOTA_R     = 13;     // hasta dónde llegan los aritos mientras esperan
// Las ondas que siguen de largo: un color por centro, y dos por cada uno.
const ECO_COLORES = [ViveColors.primary, ViveColors.accent, ViveColors.text];
const ECO_SEGUNDA = 0.24;  // la segunda onda de cada centro sale más tarde

const FRASE_1 = 'lo que te pasa le pasa a alguien más';

const ONDA_MS    = 1000;
const ECO_MS     = 1700;   // lo que tardan las ondas en salirse de la pantalla
const LATE_EN    = 1050;   // las tres ondas ya se cruzaron
const LATE_MS    = 520;
const LATE_AMP   = 0.06;
const MARCA_EN   = 1000;
const FIN_EN     = 1800;   // todo quieto
const HOLD_MS    = 700;
const EXIT_MS    = 450;
const AUTO_MS    = 4000;
const SALTEAR_MS = 600;
const LATIDO_MS  = 2600;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Qué fracción de su tamaño entero tiene la ventana con la onda en `v`. */
function escala(v: number): number {
  'worklet';
  return (VENTANA_R0 + (VENTANA_R - VENTANA_R0) * v) / VENTANA_R;
}

/**
 * Una ventana redonda sobre el isotipo, centrada en uno de los tres centros.
 * `onda` la lleva de un punto a su tamaño entero.
 */
function Ventana({ cx, cy, k, onda }: {
  cx: number; cy: number; k: number; onda: SharedValue<number>;
}) {
  const lado = 2 * VENTANA_R * k;
  const ventanaStyle = useAnimatedStyle(() => ({
    opacity: onda.value > 0 ? 1 : 0,
    transform: [{ scale: escala(onda.value) }],
  }));
  // La inversa: el dibujo de adentro queda del mismo tamaño y en el mismo lugar.
  const dibujoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / escala(onda.value) }],
  }));
  return (
    <Animated.View
      style={[
        styles.ventana,
        { left: (cx - VENTANA_R) * k, top: (cy - VENTANA_R) * k, width: lado, height: lado, borderRadius: lado / 2 },
        ventanaStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, dibujoStyle]}>
        <View style={{ position: 'absolute', left: -(cx - VENTANA_R) * k, top: -(cy - VENTANA_R) * k }}>
          <Svg
            width={CONCENTRICO_ANCHO * k} height={CONCENTRICO_ALTO * k}
            viewBox={`0 0 ${CONCENTRICO_ANCHO} ${CONCENTRICO_ALTO}`}
          >
            <Path d={CONCENTRICO_D} fill={OLIVA} fillRule="evenodd" />
          </Svg>
        </View>
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
  const textoY = centroY + H / 2 + 22;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const onda0 = useSharedValue(0), onda1 = useSharedValue(0), onda2 = useSharedValue(0);
  const ondas = [onda0, onda1, onda2];
  const funde   = useSharedValue(1);  // reduced motion: el isotipo se funde entero
  const eco     = useSharedValue(0);  // las ondas que siguen de largo
  const latido  = useSharedValue(0);  // el del final, cuando se cruzan
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
      funde.value = 0;
      ondas.forEach(o => { o.value = 1; });
      funde.value = withTiming(1, { duration: 300 });
    } else {
      ondas.forEach((o, i) => {
        o.value = withDelay(CENTROS[i].espera, withTiming(1, { duration: ONDA_MS, easing: EASE_IN_OUT }));
      });
      eco.value = withTiming(1, { duration: ECO_MS, easing: Easing.linear });
      latido.value = withDelay(LATE_EN, withTiming(1, { duration: LATE_MS, easing: EASE_OUT }));
      // Una gota por punto, y el latido cuando se cruzan.
      CENTROS.forEach(c => luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), c.espera + 40));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Medium), LATE_EN);
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

  // El latido de los puntos mientras esperan.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: LATIDO_MS, easing: Easing.linear }), -1, false);
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
  const isotipoStyle = useAnimatedStyle(() => ({ opacity: funde.value }));
  // El latido: el isotipo entero se infla un poco y vuelve.
  const lateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + LATE_AMP * Math.sin(Math.PI * latido.value) }],
  }));

  // Los tres puntos: laten mientras esperan y se van cuando sale la primera onda.
  const puntosStyle = useAnimatedStyle(() => {
    const late = 0.5 - 0.5 * Math.cos(reloj.value * 2 * Math.PI);
    return {
      opacity: aparece.value * (0.7 + 0.3 * late) * (1 - clamp01(onda0.value * 6)),
    };
  });

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

  const punto = 2 * PUNTO_R * K;
  const ecoRadio = Math.max(width, height) * 0.72;

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
        {/* Debajo de todo: las ondas que siguen de largo hasta salirse. */}
        {CENTROS.map((c, i) => [0, 1].map(j => (
          <Anillo
            key={`${i}-${j}`}
            t={eco}
            x={width / 2 + (c.cx - CONCENTRICO_ANCHO / 2) * K}
            y={centroY + (c.cy - CONCENTRICO_ALTO / 2) * K}
            radio={ecoRadio}
            color={ECO_COLORES[i]}
            retraso={c.espera / ECO_MS + j * ECO_SEGUNDA}
          />
        )))}

        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - H / 2, marginLeft: -S / 2, width: S, height: H }, lateStyle]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, puntosStyle]}>
            {/* Las gotas: aritos que salen de cada punto mientras esperan. */}
            {CENTROS.map((c, i) => (
              <Anillo
                key={`gota-${i}`}
                t={reloj} x={c.cx * K} y={c.cy * K} radio={GOTA_R * K}
                color={ECO_COLORES[i]} retraso={i * 0.16} trazo={2} fuerza={0.7}
              />
            ))}
            {CENTROS.map((c, i) => (
              <View
                key={i}
                style={[
                  styles.punto,
                  { left: c.cx * K - punto / 2, top: c.cy * K - punto / 2, width: punto, height: punto, borderRadius: punto / 2 },
                ]}
              />
            ))}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, isotipoStyle]}>
            {CENTROS.map((c, i) => <Ventana key={i} cx={c.cx} cy={c.cy} k={K} onda={ondas[i]} />)}
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
  ventana: { position: 'absolute', overflow: 'hidden' },
  punto: { position: 'absolute', backgroundColor: OLIVA },
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
