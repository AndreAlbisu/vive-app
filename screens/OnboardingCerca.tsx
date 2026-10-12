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
//   1. Una flor: seis círculos terracota, transparentes, girando despacio
//      alrededor de un punto. Donde se pisan el color se hace más hondo. La
//      flor se abre y se cierra, como si respirara. "hay alguien cerca"
//   2. Tocás: los seis se juntan en uno solo, lleno, que se corre a su lugar.
//   3. De ATRÁS de ese círculo salen los aros, uno y después el otro (que es
//      doble). Mientras están encima del círculo son crema; a medida que
//      asoman, la parte que queda afuera es oliva. Así queda el isotipo B,
//      con "vita / te acompaña" debajo.
//
// 📌 En el isotipo los dos aros están a la misma distancia del círculo lleno.
// Por eso pueden salir los dos del mismo punto, cada uno para su lado.
//
// 🔴 Todo son VISTAS, no SVG: se mueven en cada cuadro y en SVG eso se traba.
// El cambio a crema sale de tener los aros dos veces: en oliva debajo del
// círculo, y en crema ADENTRO del círculo, que es una vista redonda que
// recorta lo que se le sale.
//
// 📌 Andre las pidió "artísticas y modernas, bellas, hasta hipnóticas", sin
// confeti ni circo. Ya probó y descartó para este isotipo: las ondas tipo gota
// (aburridas) y los aros dando vueltas alrededor del círculo (no lo convenció).
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
// quedan en el isotipo, qué radios tienen y cuánto esperan para salir.
function desdeElDisco(cx: number, cy: number) {
  return { dist: Math.hypot(cx - DISCO.cx, cy - DISCO.cy), angulo: Math.atan2(cy - DISCO.cy, cx - DISCO.cx) };
}
const AROS = [
  { ...desdeElDisco(50, 34),    radios: [26],       espera: 0 },
  { ...desdeElDisco(31.52, 66), radios: [26, 19.6], espera: 220 },
];
type Aro = (typeof AROS)[number];
const RADIO_MAX = 26;
// La flor: cuántos círculos, cuánto se ve cada uno y qué tan lejos del medio
// van (en radios del círculo) cuando la flor está cerrada y cuando está abierta.
const PETALOS     = 6;
const PETALO_OP   = 0.24;
const PETALO_MIN  = 0.28;
const PETALO_MAX  = 0.92;
// Cuánto se aparta el círculo lleno del centro del isotipo.
const DISCO_DX = DISCO.cx - 50;
const DISCO_DY = DISCO.cy - 50;

const FRASE_1 = 'hay alguien cerca';

const JUNTA_MS    = 950;   // los seis se hacen uno
const ACOMODA_EN  = 250;
const ACOMODA_MS  = 1250;  // el círculo va a su lugar
const SALE_EN     = 850;   // empiezan a asomar los aros
const SALE_MS     = 1000;
const MARCA_EN    = 1550;
const FIN_EN      = 2300;  // todo quieto
const HOLD_MS     = 700;
const EXIT_MS     = 450;
const AUTO_MS     = 4000;
const SALTEAR_MS  = 600;
const BREATH_MS   = 6400;  // la flor se abre y se cierra
const VUELTA_MS   = 18000; // una vuelta entera de la flor

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
// Arranca despacio y frena largo: para llegar al isotipo sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Uno de los círculos transparentes de la flor. (`x`, `y`) es el medio. */
function Petalo({ i, k, x, y, giro, reloj, junta }: {
  i: number; k: number; x: number; y: number;
  giro: SharedValue<number>; reloj: SharedValue<number>; junta: SharedValue<number>;
}) {
  const r = DISCO.r * k;
  const style = useAnimatedStyle(() => {
    const abre = 0.5 - 0.5 * Math.cos(reloj.value * VUELTA);
    const d = r * (PETALO_MIN + (PETALO_MAX - PETALO_MIN) * abre) * (1 - junta.value);
    const angulo = giro.value + (i * VUELTA) / PETALOS;
    return {
      transform: [{ translateX: d * Math.cos(angulo) }, { translateY: d * Math.sin(angulo) }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r },
        { backgroundColor: TERRACOTA, opacity: PETALO_OP },
        style,
      ]}
    />
  );
}

/**
 * Un aro (o dos, uno adentro del otro) que sale del punto (`x`, `y`), el
 * centro del círculo lleno, hasta su lugar. Se usa dos veces por aro: en oliva
 * debajo del círculo y en crema adentro.
 */
function Asoma({ aro, k, x, y, color, sale }: {
  aro: Aro; k: number; x: number; y: number; color: string; sale: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const d = aro.dist * k * sale.value;
    return {
      opacity: clamp01(sale.value * 6),
      transform: [{ translateX: d * Math.cos(aro.angulo) }, { translateY: d * Math.sin(aro.angulo) }],
    };
  });
  const lado = 2 * (RADIO_MAX + TRAZO) * k;
  return (
    <Animated.View style={[{ position: 'absolute', left: x - lado / 2, top: y - lado / 2, width: lado, height: lado }, style]}>
      {aro.radios.map(r => (
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
  // El texto va debajo de hasta donde llega la flor abierta.
  const textoY = centroY + DISCO.r * (1 + PETALO_MAX) * K + 14;
  const discoPx = 2 * DISCO.r * K;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const junta   = useSharedValue(0);  // los seis círculos se hacen uno
  const acomoda = useSharedValue(0);  // el círculo va del medio a su lugar
  const giro    = useSharedValue(0);  // en radianes: la flor da vueltas
  // Cuánto asomó cada aro de atrás del círculo.
  const sale0 = useSharedValue(0), sale1 = useSharedValue(0);
  const salen = [sale0, sale1];
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
      junta.value = withTiming(1, { duration: 300 });
      acomoda.value = withTiming(1, { duration: 300 });
      salen.forEach(v => { v.value = withTiming(1, { duration: 300 }); });
    } else {
      // La flor no hace falta frenarla: al juntarse, el giro deja de verse.
      junta.value = withTiming(1, { duration: JUNTA_MS, easing: EASE_SUAVE });
      acomoda.value = withDelay(ACOMODA_EN, withTiming(1, { duration: ACOMODA_MS, easing: EASE_SUAVE }));
      salen.forEach((v, i) => {
        v.value = withDelay(SALE_EN + AROS[i].espera, withTiming(1, { duration: SALE_MS, easing: EASE_SUAVE }));
      });
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), 0);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), SALE_EN);
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

  // Mientras nadie toca: la flor gira, y se abre y se cierra.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      cancelAnimation(giro);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    giro.value = 0;
    giro.value = withRepeat(withTiming(VUELTA, { duration: VUELTA_MS, easing: Easing.linear }), -1, false);
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
  // Todo el isotipo es una sola vista. Antes del toque está corrida para que
  // la flor quede justo en el medio; con `acomoda` vuelve a su lugar.
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

  // El círculo lleno aparece a medida que los seis se juntan.
  const discoStyle = useAnimatedStyle(() => ({ opacity: junta.value }));

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
          {/* La flor. Cuando se juntan quedan los seis debajo del círculo lleno. */}
          {Array.from({ length: PETALOS }, (_, i) => (
            <Petalo key={i} i={i} k={K} x={DISCO.cx * K} y={DISCO.cy * K} giro={giro} reloj={reloj} junta={junta} />
          ))}
          {/* Los aros en oliva, debajo del círculo. */}
          {AROS.map((aro, i) => (
            <Asoma key={i} aro={aro} k={K} x={DISCO.cx * K} y={DISCO.cy * K} color={OLIVA} sale={salen[i]} />
          ))}
          {/* El círculo lleno. Adentro, los mismos aros en crema: como recorta
              lo que se le sale, solo se ven donde lo pisan. */}
          <Animated.View
            style={[
              {
                position: 'absolute', overflow: 'hidden', backgroundColor: TERRACOTA,
                left: (DISCO.cx - DISCO.r) * K, top: (DISCO.cy - DISCO.r) * K,
                width: discoPx, height: discoPx, borderRadius: discoPx / 2,
              },
              discoStyle,
            ]}
          >
            {AROS.map((aro, i) => (
              <Asoma key={i} aro={aro} k={K} x={discoPx / 2} y={discoPx / 2} color={CREMA} sale={salen[i]} />
            ))}
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
