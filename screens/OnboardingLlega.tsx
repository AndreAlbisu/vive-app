import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedReaction,
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

// Bienvenida "alguien llega" (07/10/2026, propuesta a prueba de Andre).
//
// Qué cuenta, en tres tiempos, con una frase por tiempo en el mismo lugar:
//   1. Un círculo solo, chico y apagado, sobre un crema frío. "a veces hace falta alguien"
//   2. Tocás: donde apoyaste el dedo nace otro círculo, que va a su encuentro.
//      El primero lo registra (se inclina, se enciende), se chocan suave y el
//      fondo se entibia. (Sin frase: no da el tiempo para leerla.)
//   3. Baja un tercero, el color se va y el trazo se dibuja: es el isotipo de
//      Vita, con "vita / te acompaña" debajo.
//
// 🔴 Reglas de esta pantalla, que son el concepto y no detalles:
//   · Termina en el logo, con la geometría EXACTA de `VitaMark` (centros, radio
//     y trazo salen de ahí: si el isotipo cambia, cambian las constantes MARK_*).
//     Dos círculos solos se leían como el logo de Mastercard (Andre, 07/10).
//   · NADA se va: ningún círculo retrocede ni se aleja.
//   · Alcanza con un toque. Si nadie toca en `AUTO_MS`, pasa solo y se sigue con
//     un toque. Un segundo toque la saltea. VoiceOver: doble toque.
//   · Los colores salen de la paleta (escala de ánimo y terracota).
//
// Convive con `OnboardingScreen1` (los tres círculos de Joaquín), que queda
// intacta: para volver, `app/index.tsx` vuelve a importar aquella.

const SALVIA    = '#BFCBA6'; // "Bien" en la escala de ánimo
const APAGADO   = '#D6D3C5'; // el mismo círculo antes de la compañía
const DURAZNO   = '#DDAE93'; // "Cansado" en la escala de ánimo
const TERRACOTA = '#C06B4A'; // terracota de marca, a media tinta
const PAPEL_FRIO  = '#EFECE5';
const PAPEL_TIBIO = '#F9EADB';
const TRAZO     = '#4B4B2C'; // el color por defecto de `VitaMark`

// Geometría de `VitaMark` (viewBox de 100), medida desde el centro (50, 50).
const MARK_R = 26;
const MARK_STROKE = 4;
const MARK_TOP_Y = -16;
const MARK_LADO_X = 20.5;
const MARK_ABAJO_Y = 16;
const MARK_C = 2 * Math.PI * MARK_R;

const FRASE_1 = 'a veces hace falta alguien';

const APPROACH_MS = 900;   // el segundo círculo llega
const PAUSA_MS    = 100;   // juntos un instante, antes del tercero
const TERCERO_MS  = 550;   // baja el tercero
const LOGO_MS     = 650;   // el trazo se dibuja y el color se va
const HOLD_MS     = 700;   // el logo queda quieto antes de salir
const EXIT_MS     = 450;
const AUTO_MS     = 4000;  // sin tocar: pasa solo
const SALTEAR_MS  = 600;   // desde cuándo un segundo toque la saltea
const BREATH_MS   = 5200;  // una respiración calma
const BREATH_AMP  = 0.035;

const EASE_OUT    = Easing.bezier(0.23, 1, 0.32, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

/** Uno de los tres círculos del isotipo, que se dibuja con el avance `m`. */
function Trazo({ cx, cy, orden, m, fundido }: {
  cx: number; cy: number; orden: number;
  m: SharedValue<number>; fundido: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    // Escalonados: cada uno arranca un poco después del anterior.
    const t = clamp01((m.value - orden * 0.14) / 0.72);
    const dibujado = fundido.value === 1 ? 1 : easeInOutCubic(t);
    return {
      strokeDashoffset: MARK_C * (1 - dibujado),
      opacity: fundido.value === 1 ? m.value : (t > 0 ? 1 : 0),
    };
  });
  return (
    <AnimatedCircle
      animatedProps={props}
      cx={cx} cy={cy} r={MARK_R}
      stroke={TRAZO} strokeWidth={MARK_STROKE} fill="none"
      strokeDasharray={[MARK_C]}
      rotation={-90} origin={`${cx}, ${cy}`}
    />
  );
}

/**
 * Una de las ondas que salen del logo al cerrarse. Son tres, escalonadas, y
 * salen de la pantalla sin apagarse (no se ve dónde terminan); `relleno` es el
 * resplandor tibio que las acompaña.
 */
function Aro({ onda, retraso, hasta, fuerza, base, relleno }: {
  onda: SharedValue<number>; retraso: number; hasta: number; fuerza: number;
  base: object; relleno?: boolean;
}) {
  const estilo = useAnimatedStyle(() => {
    const t = clamp01((onda.value - retraso) / (1 - retraso));
    return {
      // No se apagan antes de irse: siguen visibles hasta cruzar el borde, así
      // no se ve dónde terminan. `hasta` ya las deja fuera de la pantalla.
      // (El resplandor es relleno y cubre todo: ese sí se apaga del todo.)
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

export default function OnboardingLlega() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const abandono = useRef(cronometro()).current;

  // Estado del recorrido (JS).
  const listo = useRef(false);     // el círculo solo ya apareció: se puede tocar
  const unido = useRef(false);
  const saliendo = useRef(false);
  const toco = useRef(false);
  const tocoEn = useRef(0);
  const pendientes = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [hint, setHint] = useState('tocá la pantalla');
  const [esperaToque, setEsperaToque] = useState(false);

  // ── Geometría ──────────────────────────────────────────────────────────────
  const S = Math.min(width * 0.58, 250);   // lado del logo
  const K = S / 100;                       // px por unidad del viewBox
  const D = MARK_R * 2 * K;                // diámetro de cada círculo
  const LADO_X = MARK_LADO_X * K;
  const ABAJO_Y = MARK_ABAJO_Y * K;
  const ARRIBA_Y = MARK_TOP_Y * K;
  const START_X = width / 2 + D * 0.7;     // sin toque: el segundo llega desde afuera
  const TOP_START_Y = -height * 0.45;      // el tercero baja desde arriba
  const centroY = height * 0.46;
  const WASH = Math.max(width, height) * 2.3;
  // Escala con la que un aro del tamaño del logo llega a la esquina más lejana.
  const FUERA = (2 * Math.hypot(width / 2, Math.max(centroY, height - centroY))) / S;

  // ── Valores compartidos ────────────────────────────────────────────────────
  const aparece = useSharedValue(0);  // entrada del círculo solo
  const p       = useSharedValue(0);  // llega el segundo, lineal 0→1
  const q       = useSharedValue(0);  // baja el tercero (resorte: se pasa un poco)
  const m       = useSharedValue(0);  // se vuelve el logo: trazo, color fuera, título
  const sale    = useSharedValue(0);  // salida
  const reloj   = useSharedValue(0);  // 0→1 en loop: la respiración
  const rebote  = useSharedValue(0);  // el choque suave al tocarse
  const calor   = useSharedValue(0);  // el fondo que se entibia
  const onda    = useSharedValue(0);  // la onda que sale del logo
  const frase1  = useSharedValue(0);
  const hintOp  = useSharedValue(0);
  const lado    = useSharedValue(1);  // de qué lado llega: 1 derecha, -1 izquierda
  // De dónde sale el segundo, medido desde el centro. Con toque: el dedo.
  const desdeX  = useSharedValue(START_X);
  const desdeY  = useSharedValue(-D * 0.5);
  const nace    = useSharedValue(0);  // 1 = nace bajo el dedo (crece desde chico)
  const dedoX   = useSharedValue(0);
  const dedoY   = useSharedValue(0);
  const dedo    = useSharedValue(0);  // la onda del toque
  const fundido = useSharedValue(0);  // 1 = reduced motion: sin dibujar, solo fundir

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

  // Los bordes se tocan: choque suave, el fondo se entibia, cambia la frase.
  const alTocarse = useCallback(() => {
    vibrar(Haptics.ImpactFeedbackStyle.Soft);
    frase1.value = withTiming(0, { duration: 280 });
  }, [vibrar]);

  // El segundo ya está en su lugar: tercero, logo, y después salir o esperar.
  const alUnirse = useCallback(() => {
    if (unido.current) return;
    unido.current = true;
    // `segundos`: cuánto tardó en llegar acá. `respuesta` distingue a quien
    // tocó de quien dejó que pasara solo.
    anotar('onboarding_respuesta', {
      pantalla: 'bienvenida',
      respuesta: toco.current ? 'mantuvo' : 'solo',
      segundos: abandono(),
    });
    // El trazo arranca mientras el tercero todavía se está apoyando: los
    // tiempos se pisan para que desde el toque hasta la pantalla siguiente
    // pasen unos 3 segundos (Joaquín, 07/10: la intro, 4 segundos como mucho).
    const hastaLogo = PAUSA_MS + TERCERO_MS - 150;
    q.value = withDelay(PAUSA_MS, withSpring(1, { duration: TERCERO_MS, dampingRatio: 0.62 }));
    m.value = withDelay(hastaLogo, withTiming(1, { duration: LOGO_MS, easing: Easing.linear }));
    onda.value = withDelay(hastaLogo + LOGO_MS - 150, withTiming(1, { duration: 1200, easing: Easing.linear }));
    luego(() => vibrar(Haptics.ImpactFeedbackStyle.Light), hastaLogo + LOGO_MS - 150);
    const armado = hastaLogo + LOGO_MS;
    if (toco.current) {
      luego(salir, armado + HOLD_MS);
    } else {
      // Pasó solo: nadie pidió avanzar, así que se espera un toque.
      luego(() => {
        setHint('tocá para empezar');
        hintOp.value = withTiming(1, { duration: 300 });
        setEsperaToque(true);
      }, armado);
    }
  }, [salir, vibrar, luego]);

  const completar = useCallback((ms: number) => {
    p.value = withTiming(1, { duration: ms, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(alUnirse);
    });
  }, [alUnirse]);

  // ── Entrada ────────────────────────────────────────────────────────────────
  useEffect(() => {
    anotar('onboarding_pantalla_vista', { pantalla: 'bienvenida' });
    // 🔴 Se puede tocar desde el primer instante (Andre, 07/10): nada de
    // esperar a que termine la entrada. Todo aparece junto y rápido.
    listo.current = true;
    aparece.value = withTiming(1, { duration: 450, easing: EASE_OUT });
    frase1.value = withDelay(150, withTiming(1, { duration: 450, easing: EASE_OUT }));
    hintOp.value = withDelay(300, withTiming(1, { duration: 350 }));
    const t1 = setTimeout(() => {}, 0);
    // Sin tocar, pasa solo.
    const t2 = setTimeout(() => {
      if (!toco.current && !unido.current) {
        hintOp.value = withTiming(0, { duration: 250 });
        completar(APPROACH_MS + 300);
      }
    }, AUTO_MS);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      pendientes.current.forEach(clearTimeout);
    };
  }, []);

  // La respiración: un solo reloj para los tres círculos, así la fase entre
  // ellos se puede cerrar (desfasados antes, juntos al unirse).
  useEffect(() => {
    if (reduced) {
      cancelAnimation(reloj);
      return;
    }
    reloj.value = 0;
    reloj.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(reloj);
  }, [reduced]);

  // Reduced motion: sin viajes ni trazo que se dibuja. Los círculos aparecen
  // ya en su lugar, el logo se funde y se sigue con un toque.
  useEffect(() => {
    if (!reduced || unido.current) return;
    fundido.value = 1;
    cancelAnimation(p);
    p.value = 1;
    calor.value = withTiming(1, { duration: 400 });
    hintOp.value = withTiming(0, { duration: 200 });
    frase1.value = withTiming(0, { duration: 200 });
    alUnirse();
  }, [reduced]);

  // El instante en que los bordes se tocan (no el final del recorrido): ahí va
  // el choque, la vibración y el fondo.
  useAnimatedReaction(
    () => {
      // Distancia entre los centros de los dos círculos, con las mismas cuentas
      // que sus estilos. Se tocan cuando baja del diámetro.
      const e = easeOutCubic(p.value);
      const lugar = easeInOutCubic(clamp01((p.value - 0.3) / 0.7));
      const dx = desdeX.value + (lado.value * LADO_X - desdeX.value) * e + lado.value * LADO_X * lugar;
      const dy = desdeY.value + (ABAJO_Y - desdeY.value) * e - ABAJO_Y * lugar;
      return p.value > 0.03 && dx * dx + dy * dy <= D * D;
    },
    (toca, antes) => {
      if (!toca || antes !== false || fundido.value === 1) return;
      rebote.value = withSequence(
        withTiming(1, { duration: 110, easing: EASE_OUT }),
        withSpring(0, { duration: 750, dampingRatio: 0.45 }),
      );
      calor.value = withTiming(1, { duration: 1500, easing: EASE_OUT });
      scheduleOnRN(alTocarse);
    },
  );

  // ── Dedo ───────────────────────────────────────────────────────────────────
  const alApoyar = useCallback((ev: GestureResponderEvent) => {
    if (saliendo.current) return;
    if (esperaToque) { salir(); return; }
    if (toco.current) {
      // Segundo toque: la saltea.
      if (Date.now() - tocoEn.current > SALTEAR_MS) salir();
      return;
    }
    if (!listo.current || unido.current) return;
    // Alcanza con un toque: desde acá sigue solo, se mantenga el dedo o no.
    toco.current = true;
    tocoEn.current = Date.now();
    const { pageX, pageY } = ev.nativeEvent;
    // El que llega nace donde se apoyó el dedo, y se ubica de ese lado.
    if (p.value === 0) {
      lado.value = pageX < width / 2 ? -1 : 1;
      desdeX.value = pageX - width / 2;
      desdeY.value = pageY - centroY;
      nace.value = 1;
    }
    dedoX.value = pageX;
    dedoY.value = pageY;
    dedo.value = 0;
    dedo.value = withTiming(1, { duration: 650, easing: EASE_OUT });
    hintOp.value = withTiming(0, { duration: 250 });
    cancelAnimation(p);
    completar(Math.max(200, (1 - p.value) * APPROACH_MS));
  }, [esperaToque, salir, completar, width, D, centroY]);

  // VoiceOver / TalkBack: el doble toque completa (o avanza, si ya llegó).
  const alActivar = useCallback(() => {
    if (esperaToque) { salir(); return; }
    if (unido.current || toco.current) return;
    toco.current = true;
    tocoEn.current = Date.now();
    hintOp.value = withTiming(0, { duration: 250 });
    completar(700);
  }, [esperaToque, salir, completar]);

  // ── Estilos animados (transform, opacity y color) ──────────────────────────
  const washStyle = useAnimatedStyle(() => ({
    opacity: clamp01(calor.value * 3) * (1 - sale.value),
    transform: [{ scale: 0.04 + 0.96 * calor.value }],
  }));

  // "Vos": chico y apagado en el centro. Cuando el otro aparece, lo registra
  // (se inclina hacia ese lado y se enciende) y después le hace lugar.
  const salviaStyle = useAnimatedStyle(() => {
    const e = easeOutCubic(p.value);
    const lugar = easeInOutCubic(clamp01((p.value - 0.3) / 0.7));
    const mira = Math.sin(Math.PI * clamp01(p.value / 0.45));
    const respira = 1 + BREATH_AMP * (1 - m.value) * Math.sin(reloj.value * 2 * Math.PI);
    const color = clamp01((m.value - 0.45) / 0.55);
    return {
      opacity: aparece.value * (1 - color),
      backgroundColor: interpolateColor(clamp01(e * 1.6), [0, 1], [APAGADO, SALVIA]),
      transform: [
        { translateX: lado.value * (mira * 5 * K - LADO_X * lugar - rebote.value * 3 * K) },
        { translateY: ABAJO_Y * lugar },
        { scale: (0.74 + 0.04 * aparece.value + 0.22 * clamp01(e * 1.4)) * respira },
        { scaleX: 1 - 0.05 * rebote.value },
      ],
    };
  });

  // Quien llega: nace bajo el dedo (chico, y crece) y va hasta su lugar del
  // trébol. Sin toque, entra ya formado desde afuera.
  const duraznoStyle = useAnimatedStyle(() => {
    const e = easeOutCubic(p.value);
    // Media vuelta de desfase mientras está lejos; en fase cuando ya están juntos.
    const fase = Math.PI * (1 - clamp01(q.value));
    const respira = 1 + BREATH_AMP * (1 - m.value) * Math.sin(reloj.value * 2 * Math.PI + fase);
    const color = clamp01((m.value - 0.45) / 0.55);
    return {
      opacity: clamp01(p.value * 6) * (1 - color),
      transform: [
        { translateX: desdeX.value + (lado.value * LADO_X - desdeX.value) * e + lado.value * rebote.value * 3 * K },
        { translateY: desdeY.value + (ABAJO_Y - desdeY.value) * e },
        // Nunca desde cero: arranca en 0,3 y crece mientras viaja.
        { scale: respira * (1 - 0.7 * nace.value * (1 - easeOutCubic(clamp01(p.value * 2.2)))) },
        { scaleX: 1 - 0.06 * rebote.value },
      ],
    };
  });

  // El tercero: baja con un resorte (se apoya sobre los otros dos) y cierra el trébol.
  const terceroStyle = useAnimatedStyle(() => {
    const respira = 1 + BREATH_AMP * (1 - m.value) * Math.sin(reloj.value * 2 * Math.PI);
    const color = clamp01((m.value - 0.45) / 0.55);
    return {
      opacity: clamp01(q.value * 3) * 0.6 * (1 - color),
      transform: [
        { translateY: TOP_START_Y + (ARRIBA_Y - TOP_START_Y) * q.value },
        { scale: respira },
      ],
    };
  });

  const logoStyle = useAnimatedStyle(() => ({
    opacity: 1 - sale.value,
    transform: [{ scale: 1 + 0.03 * sale.value }],
  }));

  const dedoStyle = useAnimatedStyle(() => ({
    opacity: 0.22 * (1 - dedo.value) * (dedo.value > 0 ? 1 : 0),
    transform: [
      { translateX: dedoX.value - 40 },
      { translateY: dedoY.value - 40 },
      { scale: 0.4 + 1.6 * dedo.value },
    ],
  }));

  const frase1Style = useAnimatedStyle(() => ({
    opacity: frase1.value,
    transform: [{ translateY: 8 * (1 - frase1.value) }],
  }));

  const marcaStyle = useAnimatedStyle(() => {
    const t = easeOutCubic(clamp01((m.value - 0.45) / 0.55));
    return {
      opacity: t * (1 - sale.value),
      // Las letras llegan separadas y se juntan (idea de Joaquín, 06/10). El
      // translateX compensa el espacio que letterSpacing deja después de la "a".
      letterSpacing: 16 * (1 - t),
      transform: [{ translateX: 8 * (1 - t) }],
    };
  });

  const lemaStyle = useAnimatedStyle(() => {
    const t = clamp01((m.value - 0.75) / 0.25);
    return {
      opacity: t * (1 - sale.value),
      transform: [{ translateY: 6 * (1 - t) }],
    };
  });

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOp.value }));

  const circulo = { width: D, height: D, borderRadius: D / 2, marginLeft: -D / 2, marginTop: -D / 2 };
  const textoY = centroY + S * 0.44 + 24;
  const aroBase = { top: centroY, width: S, height: S, borderRadius: S / 2, marginLeft: -S / 2, marginTop: -S / 2 };

  return (
    <View style={styles.papel}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        style={styles.todo}
        onPressIn={alApoyar}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Vita te acompaña. Empezar"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={alActivar}
      >
        {/* El fondo que se entibia: crece desde donde se juntan. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.centrado,
            { top: centroY, width: WASH, height: WASH, borderRadius: WASH / 2,
              marginLeft: -WASH / 2, marginTop: -WASH / 2, backgroundColor: PAPEL_TIBIO },
            washStyle,
          ]}
        />

        <Animated.View style={[styles.centrado, circulo, { top: centroY }, salviaStyle]} />
        {/* Encima y en "multiply": donde se pisan, las tintas se suman y el
            color se oscurece, como una sobreimpresión. */}
        <Animated.View
          style={[
            styles.centrado, circulo,
            { top: centroY, backgroundColor: DURAZNO, mixBlendMode: 'multiply' },
            duraznoStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.centrado, circulo,
            { top: centroY, backgroundColor: TERRACOTA, mixBlendMode: 'multiply' },
            terceroStyle,
          ]}
        />

        {/* El papel: quieto, encima de las tintas y debajo del trazo y el texto. */}
        <Grain opacity={0.05} />

        {/* Las ondas que salen del logo cuando se cierra: un resplandor y tres
            aros escalonados que pasan los bordes de la pantalla. */}
        <Aro onda={onda} retraso={0}    hasta={FUERA}        fuerza={0.16} base={aroBase} relleno />
        <Aro onda={onda} retraso={0}    hasta={FUERA * 1.25} fuerza={0.45} base={aroBase} />
        <Aro onda={onda} retraso={0.14} hasta={FUERA * 1.15} fuerza={0.36} base={aroBase} />
        <Aro onda={onda} retraso={0.28} hasta={FUERA * 1.05} fuerza={0.28} base={aroBase} />

        {/* El isotipo, que se dibuja exactamente donde quedaron los tres círculos. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.centrado, { top: centroY - S / 2, marginLeft: -S / 2 }, logoStyle]}
        >
          <Svg width={S} height={S} viewBox="0 0 100 100">
            <Trazo cx={50 - MARK_LADO_X} cy={50 + MARK_ABAJO_Y} orden={0} m={m} fundido={fundido} />
            <Trazo cx={50 + MARK_LADO_X} cy={50 + MARK_ABAJO_Y} orden={1} m={m} fundido={fundido} />
            <Trazo cx={50} cy={50 + MARK_TOP_Y} orden={2} m={m} fundido={fundido} />
          </Svg>
        </Animated.View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  papel: { flex: 1, backgroundColor: PAPEL_FRIO, overflow: 'hidden' },
  todo: { flex: 1 },
  centrado: { position: 'absolute', left: '50%' },
  // Fino a propósito: el borde escala con el aro y llega varias veces más grueso.
  aro: { borderWidth: 1.5, borderColor: ViveColors.primary },
  resplandor: { backgroundColor: ViveColors.primary, opacity: 0 },
  dedo: {
    position: 'absolute', left: 0, top: 0,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: ViveColors.primary,
  },
  texto: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  encima: { position: 'absolute', top: 14, left: 0, right: 0 },
  frase: {
    textAlign: 'center',
    fontFamily: ViveFonts.title,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: ViveColors.accent,
  },
  marca: {
    fontFamily: ViveFonts.wordmark,
    fontSize: 52,
    lineHeight: 60,
    color: ViveColors.accent,
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
    color: ViveColors.text,
  },
});
