import { useCallback, useEffect, useRef, useState } from 'react';
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { aroCaja } from '@/components/ui/Anillo';
import { Grain } from '@/components/ui/Grain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "alguien cerca" (12/10/2026, pedido de Andre): la quinta, y la
// primera que termina en el isotipo B (`vita-isotipo-B.svg`) en vez de los tres
// aros de `VitaMark`. Qué cuenta, en tres tiempos:
//
//   1. Un círculo terracota, lleno, quieto en el medio del crema. A su
//      alrededor dan vueltas dos aros oliva (uno de ellos doble), cada uno a
//      su ritmo y para su lado, acercándose y alejándose. Cada vez que un aro
//      pasa por encima del círculo, ese tramo se vuelve crema.
//      "hay alguien cerca"
//   2. Tocás: el círculo se corre despacio a su lugar y los dos aros terminan
//      la vuelta y se quedan donde van.
//   3. Queda el isotipo B, con "vita / te acompaña" debajo.
//
// 📌 En el isotipo los dos aros están a la misma distancia del círculo lleno,
// separados 60°. Por eso la espera es una órbita: el isotipo es un momento de
// esa ronda, y al tocar la ronda se frena justo ahí.
//
// 🔴 Todo son VISTAS con borde, no SVG: los aros se mueven en cada cuadro y en
// SVG eso se traba. El cambio a crema sale de tener los aros dos veces: en
// oliva debajo del círculo, y en crema ADENTRO del círculo, que es una vista
// redonda que recorta lo que se le sale.
//
// 📌 Andre las pidió "artísticas y modernas, bellas, hasta hipnóticas", sin
// confeti ni circo. Por eso acá no hay rebotes ni golpes: todo es continuo.
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
const DISCO = { cx: 68.48, cy: 66, r: 27.6 };   // el círculo lleno
const TRAZO = 3.2;
const VUELTA = 2 * Math.PI;
// Los dos aros, vistos desde el círculo lleno: a qué distancia y en qué ángulo
// quedan en el isotipo, qué radios tienen, y cómo dan vueltas mientras esperan.
function desdeElDisco(cx: number, cy: number) {
  return { dist: Math.hypot(cx - DISCO.cx, cy - DISCO.cy), angulo: Math.atan2(cy - DISCO.cy, cx - DISCO.cx) };
}
const ORBITAS = [
  { ...desdeElDisco(50, 34),    radios: [26],       sentido: 1,  vuelta: 9000,  fase: 0 },
  { ...desdeElDisco(31.52, 66), radios: [26, 19.6], sentido: -1, vuelta: 14000, fase: 0.5 },
];
type Orbita = (typeof ORBITAS)[number];
const RADIO_MAX = 26;
// Cuánto se aparta el círculo lleno del centro del isotipo.
const DISCO_DX = DISCO.cx - 50;
const DISCO_DY = DISCO.cy - 50;

const FRASE_1 = 'hay alguien cerca';

const VAIVEN      = 0.3;   // cuánto se acercan al círculo mientras dan vueltas
const ACOMODA_MS  = 1500;  // el círculo va a su lugar y los aros frenan
const MARCA_EN    = 1350;
const FIN_EN      = 2100;  // todo quieto
const HOLD_MS     = 700;
const EXIT_MS     = 450;
const AUTO_MS     = 4000;
const SALTEAR_MS  = 600;
const BREATH_MS   = 6400;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
// Arranca despacio y frena largo: para llegar al isotipo sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/**
 * Un aro (o dos, uno adentro del otro) dando vueltas alrededor del punto
 * (`x`, `y`), que es el centro del círculo lleno. Se usa dos veces por aro:
 * en oliva debajo del círculo y en crema adentro.
 */
function Ronda({ o, k, x, y, color, angulo, acomoda, reloj }: {
  o: Orbita; k: number; x: number; y: number; color: string;
  angulo: SharedValue<number>; acomoda: SharedValue<number>; reloj: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const cerca = 0.5 - 0.5 * Math.cos((reloj.value + o.fase) * VUELTA);
    const d = o.dist * k * (1 - VAIVEN * (1 - acomoda.value) * cerca);
    return {
      transform: [{ translateX: d * Math.cos(angulo.value) }, { translateY: d * Math.sin(angulo.value) }],
    };
  });
  const lado = 2 * (RADIO_MAX + TRAZO) * k;
  return (
    <Animated.View style={[{ position: 'absolute', left: x - lado / 2, top: y - lado / 2, width: lado, height: lado }, style]}>
      {o.radios.map(r => (
        <View key={r} style={[aroCaja(lado / 2, lado / 2, r * k, TRAZO * k), { borderColor: color }]} />
      ))}
    </Animated.View>
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
  // El texto va debajo de hasta donde llegan los aros cuando dan vueltas.
  const textoY = centroY + (ORBITAS[0].dist + RADIO_MAX + TRAZO) * K + 6;
  const discoPx = 2 * DISCO.r * K;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const acomoda = useSharedValue(0);  // el círculo va del medio a su lugar
  // El ángulo de cada aro alrededor del círculo, en radianes. Arrancan donde
  // van en el isotipo.
  const ang0 = useSharedValue(ORBITAS[0].angulo), ang1 = useSharedValue(ORBITAS[1].angulo);
  const angulos = [ang0, ang1];
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
    angulos.forEach((a, i) => {
      cancelAnimation(a);
      // Sigue para el mismo lado hasta completar la vuelta: ahí está su lugar.
      const o = ORBITAS[i];
      const dadas = Math.abs(a.value - o.angulo) / VUELTA;
      const destino = o.angulo + o.sentido * VUELTA * (rapido ? Math.round(dadas) : 1);
      a.value = withTiming(destino, { duration: rapido ? 300 : ACOMODA_MS, easing: Easing.out(Easing.quad) });
    });
    if (rapido) {
      acomoda.value = withTiming(1, { duration: 300 });
    } else {
      acomoda.value = withTiming(1, { duration: ACOMODA_MS, easing: EASE_SUAVE });
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), 0);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), ACOMODA_MS - 200);
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

  // Mientras nadie toca: los dos aros dan vueltas alrededor del círculo.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    // 🔴 Si ya arrancó, el giro es de la secuencia: no se pisa.
    if (!armado.current) {
      angulos.forEach((a, i) => {
        const o = ORBITAS[i];
        a.value = o.angulo;
        a.value = withRepeat(
          withTiming(o.angulo + o.sentido * VUELTA, { duration: o.vuelta, easing: Easing.linear }), -1, false,
        );
      });
    }
    return () => {
      cancelAnimation(reloj);
      if (!armado.current) angulos.forEach(a => cancelAnimation(a));
    };
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
  // Todo el isotipo es una sola vista. Antes del toque está corrida para que
  // el círculo lleno quede justo en el medio; con `acomoda` vuelve a su lugar.
  const isotipoStyle = useAnimatedStyle(() => {
    const g = acomoda.value;
    return {
      opacity: aparece.value,
      transform: [
        { translateX: -DISCO_DX * K * (1 - g) },
        { translateY: -DISCO_DY * K * (1 - g) },
      ],
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
          {/* Los aros en oliva, debajo del círculo. */}
          {ORBITAS.map((o, i) => (
            <Ronda
              key={i} o={o} k={K} x={DISCO.cx * K} y={DISCO.cy * K} color={OLIVA}
              angulo={angulos[i]} acomoda={acomoda} reloj={reloj}
            />
          ))}
          {/* El círculo lleno. Adentro, los mismos aros en crema: como recorta
              lo que se le sale, solo se ven donde lo pisan. */}
          <View
            style={{
              position: 'absolute', overflow: 'hidden', backgroundColor: TERRACOTA,
              left: (DISCO.cx - DISCO.r) * K, top: (DISCO.cy - DISCO.r) * K,
              width: discoPx, height: discoPx, borderRadius: discoPx / 2,
            }}
          >
            {ORBITAS.map((o, i) => (
              <Ronda
                key={i} o={o} k={K} x={discoPx / 2} y={discoPx / 2} color={CREMA}
                angulo={angulos[i]} acomoda={acomoda} reloj={reloj}
              />
            ))}
          </View>
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
