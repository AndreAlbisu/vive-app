import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path } from 'react-native-svg';
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

import { ViveFonts } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { anotar, cronometro } from '@/lib/analytics';

// Bienvenida "el puente" (07/10/2026, idea de Andre). Son las dos diapositivas
// del pitch de Feria 21 ("La ayuda existe. Falta el puente." y "Ese puente es
// Vita"), en una sola pantalla y con el toque como bisagra:
//
//   1. Fondo verde bosque. "La ayuda existe. Falta el puente." Dos orillas,
//      "Vos" (terracota) y "La ayuda" (durazno). Entre las dos, una soga floja
//      de puntos que se hamaca. Cada tanto "Vos" late y una luz sale caminando
//      por los puntos hacia la otra orilla, pero se apaga antes de llegar.
//      📌 12/10 (Andre: "el comienzo no me cierra"). Antes el hueco era una
//      línea punteada quieta; ahora cuenta que se intenta y no se llega.
//      📌 12/10 (Andre: "no me gustan los títulos, los trajimos directo del
//      powerpoint"). Se fue el título grande de arriba con su subrayado. Ahora
//      la frase va como en las otras bienvenidas: una sola línea, en
//      minúscula, debajo del dibujo, en el mismo lugar donde después aparece
//      "vita". Las etiquetas de las orillas quedaron, más chicas y en minúscula.
//   2. Tocás: el puente se tiende en lima (tablero, arco y columnas), un punto
//      crema cruza y la otra orilla late al recibirlo.
//      📌 Arranca en oscuro (Andre, 08/10). La diapositiva empieza en lima y
//      pasa a verde; acá eran tres fondos en cuatro segundos (lima, verde y el
//      crema de la pantalla siguiente) y el lima no es de la paleta de la app.
//      `oscuro` quedó como "ya arrancó": apaga el título y el hueco.
//   3. Apenas el punto llega, TODO se transforma en el isotipo (pedido de
//      Andre, 08/10): las dos orillas se acercan por el tablero, que se acorta
//      con ellas, crecen y pasan de círculos llenos a trazo (son los dos
//      círculos de abajo del logo). Y el ARCO se enrosca: sus dos pies se
//      juntan por debajo y queda cerrado en el círculo de arriba. Debajo,
//      "vita / te acompaña".
//      📌 12/10 (Andre: "el paso al logo no me cierra"). Antes el puente se
//      aplastaba hacia el medio y se apagaba, y el círculo de arriba se
//      dibujaba aparte. Ahora el arco ES el círculo: es una sola línea que
//      cambia de forma. También es más lento y sin rebote.
//
// 📌 Colores, geometría y tiempos salen del artifact "Pitch Vita · Feria 21"
// (diapositivas `puente` y `puentevita`). Si cambian allá, cambian acá. Lo que
// se adaptó: el arco es más alto (un teléfono es angosto), no hay espera antes
// de que empiece a dibujarse (acá responde a un toque), se suma el lema, y el
// logo no aparece arriba del puente: el puente SE VUELVE el logo.
//
// Mismas reglas que las otras bienvenidas: se puede tocar desde el primer
// instante, alcanza con un toque, 4 segundos como mucho, un segundo toque la
// saltea, y si nadie toca pasa sola y espera un toque al final.

const LIMA      = '#E1EDB9';
const BOSQUE    = '#2D4A3E';
const CREMA     = '#FBF6EE';
const TERRACOTA = '#C1694F';
const DURAZNO   = '#DDAE93';
const CREMA_APP = '#F7F2EA';   // el fondo de la pantalla que sigue

// ── El puente, en un viewBox de 320 × 150 ────────────────────────────────────
const VB_W = 320;
const VB_H = 150;
const PISO = 110;
const ORILLA_R = 20;
const ORILLA_IZQ = 26;
const ORILLA_DER = VB_W - 26;
const X0 = 48, X1 = 272;
const CIMA = -10;                 // punto de control del arco
const ARCO = `M${X0} ${PISO}Q${VB_W / 2} ${CIMA} ${X1} ${PISO}`;
const TABLERO_LARGO = X1 - X0;
function yDelArco(x: number): number {
  const t = (x - X0) / (X1 - X0);
  return PISO * (1 - t) * (1 - t) + 2 * (1 - t) * t * CIMA + PISO * t * t;
}
const ARCO_LARGO = (() => {
  let largo = 0, px = X0, py = PISO;
  for (let i = 1; i <= 60; i++) {
    const x = X0 + ((X1 - X0) * i) / 60, y = yDelArco(x);
    largo += Math.hypot(x - px, y - py); px = x; py = y;
  }
  return largo;
})();
// Siete columnas, como en la diapositiva.
const COLUMNAS = [1, 2, 3, 4, 5, 6, 7].map(k => {
  const x = X0 + ((X1 - X0) * k) / 8;
  return { x, y: yDelArco(x) };
});

// ── El arco que se enrosca ───────────────────────────────────────────────────
// Para que una sola línea pase de arco a círculo, las dos formas tienen que
// estar escritas igual: un punto de salida y cuatro tramos curvos, 13 puntos
// en total. El arco se parte en cuatro (pie, cuarto, cima, cuarto, pie) y el
// círculo también (abajo, izquierda, arriba, derecha, abajo): así los pies
// del arco terminan juntos en el punto de abajo del círculo.
type Punto = [number, number];
function mezcla(a: Punto, b: Punto, t: number): Punto {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** El arco (una curva de un solo punto de control) en cuatro tramos de dos. */
const ARCO_PUNTOS: Punto[] = (() => {
  const p0: Punto = [X0, PISO], p1: Punto = [VB_W / 2, CIMA], p2: Punto = [X1, PISO];
  // Un pedazo de la curva, entre `a` y `b` (de 0 a 1), como tramo de dos controles.
  const pedazo = (a: number, b: number): Punto[] => {
    const en = (t: number) => mezcla(mezcla(p0, p1, t), mezcla(p1, p2, t), t);
    const ini = en(a), fin = en(b);
    const control = mezcla(mezcla(p0, p1, a), mezcla(p1, p2, a), b);
    return [mezcla(ini, control, 2 / 3), mezcla(fin, control, 2 / 3), fin];
  };
  return [p0, ...pedazo(0, 0.25), ...pedazo(0.25, 0.5), ...pedazo(0.5, 0.75), ...pedazo(0.75, 1)];
})();
/** Un círculo de centro (`cx`, `cy`) y radio `r`, con los mismos 13 puntos. */
function circuloPuntos(cx: number, cy: number, r: number): Punto[] {
  const k = 0.5523 * r;   // lo que hay que alejar los controles para que salga redondo
  return [
    [cx, cy + r],
    [cx - k, cy + r], [cx - r, cy + k], [cx - r, cy],
    [cx - r, cy - k], [cx - k, cy - r], [cx, cy - r],
    [cx + k, cy - r], [cx + r, cy - k], [cx + r, cy],
    [cx + r, cy + k], [cx + k, cy + r], [cx, cy + r],
  ];
}

// ── La soga floja de puntos, antes del toque ─────────────────────────────────
const SOGA_N      = 13;
const SOGA_CAIDA  = 13;    // cuánto cuelga en el medio, en unidades del viewBox
const SOGA_BASE   = 0.3;   // cuánto se ve un punto apagado
const LUZ_ANCHO   = 0.1;   // el tamaño de la luz que camina (la soga entera es 1)
const LUZ_LLEGA   = 0.72;  // hasta dónde llega antes de apagarse del todo
const SOGA_MS     = 3400;  // una pasada de la luz

const FRASE_1 = 'la ayuda existe. falta el puente.';

// Geometría de `VitaMark` (viewBox de 100): radio, trazo y centros.
const MARK_R = 26;
const MARK_LADO_X = 20.5;
const MARK_Y = 16;                 // los de abajo, +16; el de arriba, -16
const MARK_TRAZO = 7;

// Más rápida que la diapositiva: el puente se tiende, el punto cruza y, apenas
// llega, todo se vuelve el logo.
// 08/10 (Andre): el puente un 20% más rápido y la formación del logo un 20%
// más lenta que la primera versión (800 / 650 ms de puente, 520 ms de logo).
const TIENDE_MS = 640;
const COL_EN    = 208;    // primera columna; después, una cada `COL_PASO`
const COL_PASO  = 48;
const COL_MS    = 256;
const CRUZA_EN  = 416;
const CRUZA_MS  = 520;
const LLEGA_EN  = 936;    // la otra orilla late
const MORF_EN   = 1040;   // todo se transforma en el isotipo
// 12/10 (Andre): más lenta otra vez (era 625), para que se vea el arco enroscarse.
const MORF_MS   = 1000;
const MARCA_EN  = 1750;
const FIN_EN    = 2350;   // todo quieto
const HOLD_MS   = 700;
const EXIT_MS   = 450;
const AUTO_MS   = 4000;
const SALTEAR_MS = 600;

const EASE_OUT    = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
// Arranca despacio y frena largo: para transformarse sin tirones.
const EASE_SUAVE  = Easing.bezier(0.45, 0, 0.15, 1);

const AnimatedPath   = Animated.createAnimatedComponent(Path);
const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

/** Una columna: cae desde el arco hasta el tablero. */
function Columna({ x, y, cae }: { x: number; y: number; cae: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({
    y2: y + (PISO - y) * cae.value,
    opacity: cae.value > 0 ? 1 : 0,
  }));
  return (
    <AnimatedLine
      animatedProps={props}
      x1={x} y1={y} x2={x}
      stroke={LIMA} strokeWidth={2} strokeLinecap="round"
    />
  );
}

/** La luz que sale de "Vos": qué tan prendido está el lugar `t` de la soga (0 a 1). */
function luzEn(t: number, reloj: number): number {
  'worklet';
  // Arranca un poco antes de la orilla y sigue de largo, para que la vuelta
  // del reloj caiga cuando no hay nada prendido.
  const donde = -0.25 + 1.6 * reloj;
  const d = (t - donde) / LUZ_ANCHO;
  return Math.exp(-d * d) * clamp01(1 - t / LUZ_LLEGA);
}

/** Un punto de la soga. `x` e `y0` en px; cuelga, se hamaca y se prende con la luz. */
function PuntoSoga({ t, x, lado, caida, reloj, oscuro, aparece }: {
  t: number; x: number; lado: number; caida: number;
  reloj: SharedValue<number>; oscuro: SharedValue<number>; aparece: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const luz = luzEn(t, reloj.value);
    const hamaca = 0.82 + 0.18 * Math.sin(reloj.value * 2 * Math.PI);
    const queda = 1 - clamp01(oscuro.value * 2);
    return {
      opacity: aparece.value * queda * (SOGA_BASE + (1 - SOGA_BASE) * luz),
      transform: [
        // Al tocar se tensa: sube a la línea del tablero mientras se apaga.
        { translateY: caida * 4 * t * (1 - t) * hamaca * (1 - oscuro.value) },
        { scale: 1 + 0.7 * luz },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - lado / 2, top: -lado / 2, width: lado, height: lado, borderRadius: lado / 2 },
        { backgroundColor: LIMA },
        style,
      ]}
    />
  );
}

export default function OnboardingPuente() {
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
  const [oscuroYa, setOscuroYa] = useState(true);    // barra de estado clara hasta salir

  // ── Geometría ──────────────────────────────────────────────────────────────
  const W = Math.min(width - 32, 420);     // ancho del puente
  const K = W / VB_W;
  const H = VB_H * K;
  const pisoY = height * 0.52;             // el tablero, un poco bajo el centro
  const puenteTop = pisoY - PISO * K;
  const etiquetaY = pisoY + ORILLA_R * K + 10;
  // El isotipo se arma sobre el puente: sus dos círculos de abajo quedan a la
  // altura del tablero (ahí terminan las orillas) y el de arriba cae donde
  // estaba la cima del arco.
  const S = Math.min(width * 0.5, 220);    // lado del isotipo
  const KL = S / 100;
  const D = MARK_R * 2 * KL;               // diámetro final de cada círculo
  const logoCY = pisoY - MARK_Y * KL;
  const ORILLA_X = W / 2 - ORILLA_IZQ * K; // distancia de cada orilla al centro
  const ESCALA_0 = (2 * ORILLA_R * K) / D; // tamaño de la orilla respecto del final
  const textoY = pisoY + (MARK_R + MARK_TRAZO) * KL + 18;
  // El lienzo donde el arco se enrosca: tiene que entrar el arco entero y
  // también el círculo de arriba, que puede quedar más alto.
  const arribaCY = logoCY - MARK_Y * KL;
  const morfTop = Math.min(puenteTop, arribaCY - (MARK_R + MARK_TRAZO) * KL) - 6;
  const morfAlto = pisoY - morfTop + 8;
  // Las dos formas, en px de ese lienzo y en fila (x, y, x, y…).
  const arcoPx = ARCO_PUNTOS.flatMap(([x, y]) => [x * K, (y - PISO) * K + pisoY - morfTop]);
  const circuloPx = circuloPuntos(W / 2, arribaCY - morfTop, MARK_R * KL).flat();
  const TABLERO_MEDIO = (TABLERO_LARGO / 2) * K;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);
  const oscuro  = useSharedValue(0);  // ya arrancó: se van el título y el hueco
  const tiende  = useSharedValue(0);  // tablero y arco
  const col0 = useSharedValue(0), col1 = useSharedValue(0), col2 = useSharedValue(0), col3 = useSharedValue(0);
  const col4 = useSharedValue(0), col5 = useSharedValue(0), col6 = useSharedValue(0);
  const cols = [col0, col1, col2, col3, col4, col5, col6];
  const cruza   = useSharedValue(0);  // el punto
  const late    = useSharedValue(0);  // la otra orilla al recibirlo
  const morf    = useSharedValue(0);  // orillas y puente → isotipo
  const reloj   = useSharedValue(0);  // 0→1 en loop: la luz que camina por la soga
  const marca   = useSharedValue(0);
  const sale    = useSharedValue(0);
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
    // La pantalla que sigue es clara: la barra vuelve a oscuro con el fundido.
    setTimeout(() => setOscuroYa(false), EXIT_MS * 0.6);
    setTimeout(navegar, EXIT_MS);
  }, [navegar]);

  const vibrar = useCallback((estilo: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(estilo).catch(() => {});
  }, []);

  /** Toda la secuencia. `rapido`: sin dibujo ni viajes (reduced motion). */
  const arrancar = useCallback((rapido: boolean) => {
    if (armado.current) return;
    armado.current = true;
    hintOp.value = withTiming(0, { duration: 250 });
    oscuro.value = withTiming(1, { duration: rapido ? 250 : 420, easing: EASE_OUT });

    const f = rapido ? 0 : 1;   // con reduced motion todo cae en el mismo instante
    if (rapido) {
      tiende.value = 1;
      cols.forEach(c => { c.value = 1; });
      morf.value = withTiming(1, { duration: 300 });
    } else {
      tiende.value = withTiming(1, { duration: TIENDE_MS, easing: EASE_IN_OUT });
      cols.forEach((c, i) => {
        c.value = withDelay(COL_EN + i * COL_PASO, withTiming(1, { duration: COL_MS, easing: EASE_OUT }));
      });
      cruza.value = withDelay(CRUZA_EN, withTiming(1, { duration: CRUZA_MS, easing: EASE_IN_OUT }));
      late.value = withDelay(LLEGA_EN, withSequence(
        withTiming(1, { duration: 130, easing: EASE_OUT }),
        withTiming(0, { duration: 200, easing: EASE_OUT }),
      ));
      morf.value = withDelay(MORF_EN, withTiming(1, { duration: MORF_MS, easing: EASE_SUAVE }));
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Soft), LLEGA_EN);
      luego(() => vibrar(Haptics.ImpactFeedbackStyle.Light), MORF_EN + MORF_MS - 120);
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
    hintOp.value = withDelay(300, withTiming(1, { duration: 350 }));
    const t = setTimeout(() => arrancar(reducedRef.current), AUTO_MS);
    const lista = pendientes.current;
    return () => { clearTimeout(t); lista.forEach(clearTimeout); };
  }, []);

  // La soga: mientras nadie toca, se hamaca y la luz sale una y otra vez.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: SOGA_MS, easing: Easing.linear }), -1, false);
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
  // La salida: un velo del crema de la pantalla siguiente.
  const veloStyle = useAnimatedStyle(() => ({ opacity: sale.value }));

  // Columnas y punto: se apagan enseguida, apenas empieza la transformación.
  const puenteStyle = useAnimatedStyle(() => ({
    opacity: aparece.value * (1 - clamp01(morf.value * 4)),
    transform: [{ scale: 0.97 + 0.03 * aparece.value }],
  }));

  // El tablero es una vista: se tiende desde "Vos" y después se acorta junto
  // con las orillas, que se le vienen encima.
  const tableroStyle = useAnimatedStyle(() => {
    const u = tiende.value;
    const m = clamp01(morf.value);
    const entreOrillas = (ORILLA_X - (ORILLA_X - MARK_LADO_X * KL) * m) / ORILLA_X;
    return {
      opacity: (u > 0 ? 1 : 0) * (1 - clamp01(m * 1.8)),
      transform: [
        { translateX: -TABLERO_MEDIO * (1 - u) },
        { scaleX: Math.max(0.001, u * entreOrillas) },
      ],
    };
  });
  // El arco se dibuja con este trazo; cuando empieza a enroscarse lo releva
  // el de abajo, que arranca exactamente encima.
  const arcoProps = useAnimatedProps(() => ({
    strokeDashoffset: ARCO_LARGO * (1 - tiende.value),
    opacity: tiende.value > 0 && morf.value <= 0 ? 1 : 0,
  }));
  // El arco que se enrosca: cada punto va del arco al círculo.
  const enroscaProps = useAnimatedProps(() => {
    const m = clamp01(morf.value);
    const en = (i: number) => (arcoPx[i] + (circuloPx[i] - arcoPx[i]) * m).toFixed(1);
    let d = `M${en(0)} ${en(1)}`;
    for (let i = 2; i < 26; i += 6) {
      d += `C${en(i)} ${en(i + 1)} ${en(i + 2)} ${en(i + 3)} ${en(i + 4)} ${en(i + 5)}`;
    }
    return {
      d,
      strokeWidth: 4 * K + (MARK_TRAZO * KL - 4 * K) * m,
      opacity: morf.value > 0 ? 1 : 0,
    };
  });
  const pasoProps = useAnimatedProps(() => ({
    cx: ORILLA_IZQ + (ORILLA_DER - ORILLA_IZQ) * cruza.value,
    // Aparece al salir y se funde al llegar (12% y 88%, como en la diapositiva).
    opacity: clamp01(cruza.value / 0.12) * clamp01((1 - cruza.value) / 0.12),
  }));

  // Las orillas: de su lugar y tamaño al de los círculos de abajo del isotipo.
  const orillaIzqStyle = useAnimatedStyle(() => ({
    opacity: aparece.value,
    transform: [
      { translateX: -ORILLA_X + (ORILLA_X - MARK_LADO_X * KL) * morf.value },
      // "Vos" late cada vez que sale la luz, hasta que arranca.
      { scale: (ESCALA_0 + (1 - ESCALA_0) * morf.value) * (1 + 0.09 * luzEn(0, reloj.value) * (1 - oscuro.value)) },
    ],
  }));
  const orillaDerStyle = useAnimatedStyle(() => ({
    opacity: aparece.value,
    transform: [
      { translateX: ORILLA_X - (ORILLA_X - MARK_LADO_X * KL) * morf.value },
      { scale: (ESCALA_0 + (1 - ESCALA_0) * morf.value) * (1 + 0.25 * late.value) },
    ],
  }));
  // De círculo lleno a trazo.
  const rellenoStyle = useAnimatedStyle(() => ({ opacity: 1 - clamp01(morf.value * 1.5) }));
  const trazoStyle = useAnimatedStyle(() => ({ opacity: clamp01((morf.value - 0.25) / 0.5) }));

  const etiquetaStyle = useAnimatedStyle(() => ({
    opacity: aparece.value * (1 - clamp01(morf.value * 3)),
  }));

  const fraseStyle = useAnimatedStyle(() => ({
    opacity: aparece.value * (1 - clamp01(oscuro.value * 2.5)),
    transform: [{ translateY: 8 * (1 - aparece.value) }],
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
    opacity: 0.3 * (1 - dedo.value) * (dedo.value > 0 ? 1 : 0),
    transform: [
      { translateX: dedoX.value - 40 },
      { translateY: dedoY.value - 40 },
      { scale: 0.4 + 1.6 * dedo.value },
    ],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOp.value }));

  return (
    <Animated.View style={styles.fondo}>
      <StatusBar barStyle={oscuroYa ? 'light-content' : 'dark-content'} animated />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="La ayuda existe, falta el puente. Ese puente es Vita. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        {/* El puente: tablero, arco, columnas y el punto que cruza. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: puenteTop, marginLeft: -W / 2 }, puenteStyle]}
        >
          <Svg width={W} height={H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <AnimatedPath
              animatedProps={arcoProps}
              d={ARCO}
              stroke={LIMA} strokeWidth={4} strokeLinecap="round" fill="none"
              strokeDasharray={[ARCO_LARGO]}
            />
            {COLUMNAS.map((c, i) => <Columna key={i} x={c.x} y={c.y} cae={cols[i]} />)}
            <AnimatedCircle animatedProps={pasoProps} cy={PISO} r={8} fill={CREMA} />
          </Svg>
        </Animated.View>

        {/* El arco que se enrosca hasta ser el círculo de arriba del isotipo. */}
        <View pointerEvents="none" style={[styles.centrado, { top: morfTop, marginLeft: -W / 2 }]}>
          <Svg width={W} height={morfAlto}>
            <AnimatedPath
              animatedProps={enroscaProps}
              stroke={LIMA} strokeLinecap="round" strokeLinejoin="round" fill="none"
            />
          </Svg>
        </View>

        {/* El tablero. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centrado,
            {
              top: pisoY - 2 * K, marginLeft: -TABLERO_MEDIO,
              width: 2 * TABLERO_MEDIO, height: 4 * K, borderRadius: 2 * K, backgroundColor: LIMA,
            },
            tableroStyle,
          ]}
        />

        {/* La soga floja de puntos: lo que hay antes de que exista el puente. */}
        <View pointerEvents="none" style={[styles.centrado, { top: pisoY, marginLeft: -W / 2, width: W, height: 1 }]}>
          {Array.from({ length: SOGA_N }, (_, i) => {
            const t = i / (SOGA_N - 1);
            return (
              <PuntoSoga
                key={i} t={t}
                x={(X0 + 8 + (TABLERO_LARGO - 16) * t) * K}
                lado={4 * K} caida={SOGA_CAIDA * K}
                reloj={reloj} oscuro={oscuro} aparece={aparece}
              />
            );
          })}
        </View>

        {/* Las dos orillas. Son vistas y no parte del SVG para poder moverlas y
            agrandarlas: terminan siendo los dos círculos de abajo del isotipo. */}
        {([-1, 1] as const).map(lado => (
          <Animated.View
            key={lado}
            pointerEvents="none"
            style={[
              styles.centrado,
              { top: pisoY, width: D, height: D, marginLeft: -D / 2, marginTop: -D / 2 },
              lado === -1 ? orillaIzqStyle : orillaDerStyle,
            ]}
          >
            <Animated.View style={[styles.lleno, { borderRadius: D / 2 }, rellenoStyle]}>
              <View style={[styles.lleno, { borderRadius: D / 2, backgroundColor: lado === -1 ? TERRACOTA : DURAZNO }]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.lleno,
                // El trazo de `VitaMark` va centrado sobre el radio: la mitad
                // queda por fuera del círculo.
                { margin: -(MARK_TRAZO * KL) / 2, borderRadius: D, borderWidth: MARK_TRAZO * KL, borderColor: LIMA },
                trazoStyle,
              ]}
            />
          </Animated.View>
        ))}

        <View
          pointerEvents="none"
          style={[styles.etiquetas, { top: etiquetaY, width: W, marginLeft: -W / 2 }]}
        >
          <Animated.Text style={[styles.etiqueta, { width: 2 * ORILLA_IZQ * K }, etiquetaStyle]}>vos</Animated.Text>
          <Animated.Text style={[styles.etiqueta, styles.etiquetaDer, etiquetaStyle]}>la ayuda</Animated.Text>
        </View>

        {/* Un solo lugar para leer: la frase → "vita / te acompaña". */}
        <View style={[styles.arriba, { top: textoY }]} pointerEvents="none">
          <Animated.Text style={[styles.frase, styles.encima, fraseStyle]}>{FRASE_1}</Animated.Text>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, overflow: 'hidden', backgroundColor: BOSQUE },
  todo: { flex: 1 },
  velo: { backgroundColor: CREMA_APP },
  lleno: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  centrado: { position: 'absolute', left: '50%' },
  arriba: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  encima: { position: 'absolute', top: 14, left: 0, right: 0 },
  frase: {
    textAlign: 'center',
    fontFamily: ViveFonts.title,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: CREMA,
  },
  marca: {
    fontFamily: ViveFonts.wordmark,
    fontSize: 58,
    lineHeight: 66,
    letterSpacing: -1.5,
    color: CREMA,
  },
  lema: {
    marginTop: -2,
    fontFamily: ViveFonts.regular,
    fontSize: 17,
    letterSpacing: 0.4,
    color: LIMA,
  },
  etiquetas: {
    position: 'absolute', left: '50%',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  etiqueta: {
    textAlign: 'center',
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    letterSpacing: 0.4,
    color: LIMA,
    opacity: 0.85,
  },
  // "La ayuda" es más ancha que su orilla: se alinea al borde derecho del puente.
  etiquetaDer: { textAlign: 'right' },
  dedo: {
    position: 'absolute', left: 0, top: 0,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: CREMA,
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
    color: LIMA,
  },
});
