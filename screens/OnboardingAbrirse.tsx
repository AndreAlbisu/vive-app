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
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { Chispas, Oleada } from '@/components/ui/Festejo';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "abrirse" (12/10/2026, pedido de Andre): termina en el isotipo de
// aros abiertos (`Logo Vita - aros abiertos`). Qué cuenta, en tres tiempos:
//
//   1. Un aro oliva, CERRADO, solo en el medio del crema. Respira.
//      "abrirse es el primer paso"
//   2. Tocás: el aro se abre (aparece el hueco) y sube a hacer lugar. Los
//      otros dos entran RODANDO desde los costados de la pantalla, uno por
//      lado, y se enganchan: cada llegada empuja al isotipo y saca chispas.
//   3. Con el último, una franja terracota barre la pantalla. Quedan los tres
//      aros abiertos, enganchados, con "vita / te acompaña".
//
// 🔴 Ruedan de verdad: lo que giran sale de lo que avanzan (distancia / radio),
// así que llegan con el hueco justo donde va. Si se cambia de dónde salen, el
// giro se acomoda solo; no hay un ángulo escrito a mano.
//
// 📌 El concepto es el hueco: en este isotipo ningún aro está cerrado, y cada
// uno termina adentro de otro. Por eso el primero arranca cerrado.
//
// 📌 Los tres arcos son los del SVG, sin retoques (radio 26, trazo 2,2, puntas
// redondas, 318° de vuelta cada uno). Si el isotipo cambia, cambian los `d`.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const TERRACOTA = ViveColors.primary;
const OLIVA     = ViveColors.text;
const CREMA     = ViveColors.background;
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El isotipo de aros abiertos, en un viewBox de 100 ────────────────────────
const ARO_R = 26;
const TRAZO = 2.2;
const VUELTA  = 2 * Math.PI * ARO_R;                 // un aro cerrado
const ABIERTO = (ARO_R * 318 * Math.PI) / 180;       // lo que queda dibujado
const HUECO   = VUELTA - ABIERTO;
// El de arriba, con la vuelta entera: el último tramo es el hueco, y se
// esconde corriendo el punteado.
const ARRIBA_CERRADO = 'M24.129 31.409A26 26 0 1 1 29.040 49.385A26 26 0 0 1 24.129 31.409';
// Los dos que llegan rodando: su arco y el centro alrededor del que giran.
const IZQ = { d: 'M42.218 89.697A26 26 0 1 1 55.327 76.452', cx: 31.52, cy: 66 };
const DER = { d: 'M83.655 44.888A26 26 0 1 1 65.630 40.157', cx: 68.48, cy: 66 };
const RUEDA = 2 * (ARO_R + TRAZO);   // el lado de la vista de cada rueda
// Cuánto se aparta el aro de arriba del centro del isotipo.
const ARRIBA_DY = 34 - 50;

const FRASE_1 = 'abrirse es el primer paso';

const SOLO_ESCALA = 0.86;  // el aro solo, un poco más chico que en el isotipo
const ACOMODA_MS  = 600;   // el aro sube y hace lugar
const ABRE_EN     = 60;
const ABRE_MS     = 420;
const IZQ_EN      = 220;
const DER_EN      = 480;
const RUEDA_MS    = 680;
const LLEGA       = 0.45;  // en qué parte del viaje la rueda toca su lugar
const EMPUJE_PX   = 7;     // cuánto corre al isotipo cada llegada
const FESTEJO_MS  = 900;
const MARCA_EN    = 1150;
const FIN_EN      = 1800;  // todo quieto
const HOLD_MS     = 700;
const EXIT_MS     = 450;
const AUTO_MS     = 4000;
const SALTEAR_MS  = 600;
const BREATH_MS   = 5200;
const BREATH_AMP  = 0.035;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
// Llega, se pasa un poco de largo y vuelve: la rueda rebota contra las otras.
const EASE_REBOTE = Easing.bezier(0.34, 1.4, 0.64, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/**
 * Uno de los dos aros que llegan. Entra rodando desde `desde` (px, con signo:
 * negativo viene de la izquierda) y gira lo que le toca por lo que avanza.
 */
function Rueda({ aro, k, llega, desde }: {
  aro: { d: string; cx: number; cy: number }; k: number;
  llega: SharedValue<number>; desde: number;
}) {
  const lado = RUEDA * k;
  const style = useAnimatedStyle(() => {
    const tx = desde * (1 - llega.value);
    return {
      opacity: llega.value > 0 ? 1 : 0,
      transform: [{ translateX: tx }, { rotate: `${tx / (ARO_R * k)}rad` }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: (aro.cx - RUEDA / 2) * k, top: (aro.cy - RUEDA / 2) * k, width: lado, height: lado },
        style,
      ]}
    >
      <Svg width={lado} height={lado} viewBox={`${aro.cx - RUEDA / 2} ${aro.cy - RUEDA / 2} ${RUEDA} ${RUEDA}`}>
        <Path d={aro.d} stroke={OLIVA} strokeWidth={TRAZO} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export default function OnboardingAbrirse() {
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
  const acomoda = useSharedValue(0);  // el aro va del medio a su lugar
  const abre    = useSharedValue(0);  // se le abre el hueco
  const izq     = useSharedValue(0);  // el segundo aro
  const der     = useSharedValue(0);  // el tercero
  const llegan  = useSharedValue(1);  // reduced motion: los que llegan se funden
  const empujeI = useSharedValue(0);  // el golpe de cada llegada contra el isotipo
  const empujeD = useSharedValue(0);
  const oleada  = useSharedValue(0);  // la franja que barre la pantalla
  const chispaI = useSharedValue(0);
  const chispaD = useSharedValue(0);
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
      llegan.value = 0;
      abre.value = 1;
      izq.value = 1;
      der.value = 1;
      llegan.value = withTiming(1, { duration: 300 });
      acomoda.value = withTiming(1, { duration: 300 });
    } else {
      acomoda.value = withTiming(1, { duration: ACOMODA_MS, easing: EASE_IN_OUT });
      abre.value = withDelay(ABRE_EN, withTiming(1, { duration: ABRE_MS, easing: EASE_OUT }));
      izq.value = withDelay(IZQ_EN, withTiming(1, { duration: RUEDA_MS, easing: EASE_REBOTE }));
      der.value = withDelay(DER_EN, withTiming(1, { duration: RUEDA_MS, easing: EASE_REBOTE }));
      // Cada llegada: un empujón al isotipo, chispas donde se enganchan y un golpe.
      const golpeI = IZQ_EN + RUEDA_MS * LLEGA;
      const golpeD = DER_EN + RUEDA_MS * LLEGA;
      const empujon = () => withSequence(
        withTiming(1, { duration: 90, easing: EASE_OUT }),
        withTiming(0, { duration: 320, easing: EASE_REBOTE }),
      );
      empujeI.value = withDelay(golpeI, empujon());
      empujeD.value = withDelay(golpeD, empujon());
      chispaI.value = withDelay(golpeI, withTiming(1, { duration: FESTEJO_MS, easing: Easing.linear }));
      chispaD.value = withDelay(golpeD, withTiming(1, { duration: FESTEJO_MS, easing: Easing.linear }));
      oleada.value = withDelay(golpeD, withTiming(1, { duration: FESTEJO_MS, easing: EASE_OUT }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), ABRE_EN);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Light), golpeI);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Medium), golpeD);
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

  // La respiración del aro mientras está solo.
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
  // Todo el isotipo es una sola vista. Antes del toque está bajada y achicada
  // para que el aro de arriba quede justo en el medio; con `acomoda` vuelve a
  // su lugar.
  const isotipoStyle = useAnimatedStyle(() => {
    const g = acomoda.value;
    const respira = 1 + BREATH_AMP * (1 - g) * Math.sin(reloj.value * 2 * Math.PI);
    const escala = (SOLO_ESCALA + (1 - SOLO_ESCALA) * g) * respira;
    return {
      opacity: aparece.value,
      transform: [
        { translateX: EMPUJE_PX * (empujeI.value - empujeD.value) },
        { translateY: -ARRIBA_DY * K * escala * (1 - g) },
        { scale: escala },
      ],
    };
  });

  // El hueco: el último tramo de la vuelta deja de dibujarse.
  const arribaProps = useAnimatedProps(() => ({ strokeDashoffset: HUECO * abre.value }));
  const lleganStyle = useAnimatedStyle(() => ({ opacity: llegan.value }));

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
        accessibilityLabel="Abrirse es el primer paso. Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        {/* Debajo de todo: la franja que barre la pantalla con la última llegada. */}
        <Oleada
          t={oleada} x={width / 2} y={centroY} radio={Math.hypot(width, height) * 0.8}
          color={TERRACOTA} fondo={CREMA}
        />

        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - S / 2, marginLeft: -S / 2, width: S, height: S }, isotipoStyle]}
        >
          <Svg width={S} height={S} viewBox="0 0 100 100">
            <AnimatedPath
              animatedProps={arribaProps}
              d={ARRIBA_CERRADO}
              stroke={OLIVA} strokeWidth={TRAZO} strokeLinecap="round" fill="none"
              strokeDasharray={[VUELTA]}
            />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, lleganStyle]}>
            <Rueda aro={IZQ} k={K} llega={izq} desde={-width} />
            <Rueda aro={DER} k={K} llega={der} desde={width} />
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

        {/* Donde cada rueda se engancha con el aro de arriba. */}
        <Chispas t={chispaI} x={width / 2 - 9.24 * K} y={centroY} cantidad={10} alcance={S * 0.5} />
        <Chispas t={chispaD} x={width / 2 + 9.24 * K} y={centroY} cantidad={12} alcance={S * 0.6} />

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
