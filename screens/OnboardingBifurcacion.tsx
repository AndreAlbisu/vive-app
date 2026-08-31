import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, useWindowDimensions,
  AccessibilityInfo, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';

import { ViveFonts } from '@/constants/theme';
import { TONOS, type Tono } from '@/constants/onboardingTonos';
import { VitaWordmark } from '@/components/VitaWordmark';

// Bifurcación usuario/profesional — rediseño 30/08/2026 (maqueta de Andre).
//
// 📝 Se mantiene como bifurcación real de dos opciones, decisión de Andre. Se
// evaluó y descartó un 70/30 (una sola acción principal + el profesional como
// línea al pie): con una sola opción la pantalla no decide nada. También se
// evaluó sacarla del flujo —el ritual iría directo a "¿Cómo te gustaría
// empezar?" de onboarding2, que es la pregunta que decide de verdad— y se dejó
// para más adelante: hoy conviene que el camino del profesional se vea fuerte,
// porque sumar profesionales es el cuello de botella.
//
// 📝 El copy dice "Quiero crecer" y no "Quiero ser acompañado": este último está
// en masculino (etiqueta mal a cualquiera que no se identifique ahí, en la
// primera pantalla) y es pasivo — deja afuera al que entra a usar herramientas
// por su cuenta, que es un camino válido del producto.
//
// 📝 El título de la maqueta está en serif. En el proyecto NO hay serif —
// Fraunces salió el 24/08/2026 y se reemplazó por Plus Jakarta Sans en toda la
// app— así que va en `ViveFonts.title`. Traer un serif de vuelta es una decisión
// de sistema, no de esta pantalla.
//
// 📝 Única pantalla que NO usa <AppBg>. El gradiente de la app (#F7EFE4 →
// #EDE0CF) se oscurece justo donde va el abanico y lo lava contra el durazno de
// la columna derecha; acá el crema va plano, como en la maqueta.
//
// La navegación no cambia: /onboarding2 y /coach-login.

const CREMA        = '#F7F2EA';
const SALVIA       = '#E8E7DB';
const SALVIA_LINE  = 'rgba(86,110,60,0.38)';
const SALVIA_RULE  = 'rgba(86,110,60,0.38)';
const DURAZNO      = '#F8E7DA';
const DURAZNO_LINE = 'rgba(200,120,58,0.40)';
const DURAZNO_RULE = 'rgba(200,120,58,0.45)';
const TEXTO        = '#26402F';
const TEXTO_SUAVE  = '#5C6B58';
const VERDE_ICON   = TONOS.crecer;
const NARANJA      = TONOS.acompanar;

// ── Geometría ────────────────────────────────────────────────────────────────
// Coordenadas normalizadas (x en fracción del ancho, y en fracción del alto).
// NO rediseñar la forma acá: el objetivo es copiar la referencia.
//
// La silueta es la de DOS ASTAS simétricas: estrecha y vertical en el centro →
// se abre hacia afuera → sigue alta y erguida en los laterales.
//
// 🔴 Las dos tangentes, que son todo el gesto:
//   · en el centro, VERTICAL (control 1 justo encima del cuello);
//   · en la punta lateral, DIAGONAL/VERTICAL — NO horizontal. El control 2 está
//     por debajo y por dentro de la punta, así el asta llega al borde subiendo
//     y no acostada.
//
// 🔴 Historial de errores, para no repetirlos: (a) mandar todas las curvas a un
// mismo punto central se lee como el lomo de un libro abierto; (b) hacerlas
// morir a alturas muy distintas con poca curva las achata en un abanico; (c)
// doblar desde el arranque las vuelve arcos con un pico en la punta; (d) poner
// el control 1 a la misma altura que la punta lateral las deja horizontales
// contra los bordes, que es lo contrario de un asta.
//
// Curva base del lado izquierdo, del cuello hacia la punta, dos tramos cúbicos
// con tangente continua en el empalme:
//   M .50 .560  C .50 .485, .42 .440, .30 .405   C .18 .370, .07 .320, 0 .235
const BASE_CUELLO = 0.560;

// Cuánto sube el título respecto del centro del bloque de arriba. Sale del alto
// de pantalla y no de un número clavado, igual que el resto de las medidas de
// esta pantalla: 22pt son un gesto distinto en un SE que en un 15 Pro Max.
const TITULO_SUBE = 0.05;

// Diámetro del aro de la flecha. Tiene que seguir a `s.arrow.width`: es de
// donde nace el derrame, y con otro número el círculo aparecería saltando.
const ARO = 56;
const BASE_PUNTA  = 0.235;
const BASE = {
  c1: [0.500, 0.485] as const,
  c2: [0.420, 0.440] as const,
  p1: [0.300, 0.405] as const,
  c3: [0.180, 0.370] as const,
  c4: [0.070, 0.320] as const,
  p2: [0.000, 0.235] as const,
};

// Cada asta: su propia punta en el borde lateral y su propio final en el cuello.
// Las de afuera son más altas y más erguidas; las de adentro, más tendidas. La
// última es la de más adentro y ES el borde del color — el relleno cierra sobre
// ese mismo path, así superficie y líneas no pueden desincronizarse.
const LINEAS = [
  { punta: 0.210, cuello: 0.525 },
  { punta: 0.238, cuello: 0.532 },
  { punta: 0.266, cuello: 0.539 },
  { punta: 0.295, cuello: 0.546 },
  { punta: 0.325, cuello: 0.553 },
  { punta: 0.360, cuello: 0.560 },
];
const BORDE_COLOR = LINEAS.length - 1;
// Ancho del haz en el cuello: las de afuera mueren apenas más lejos del eje, así
// no se superponen en un solo trazo. Fracción del ancho.
const CUELLO = 0.012;
const SEAM   = 0.002;  // media costura entre los dos colores, ídem

type Ala = 'left' | 'right';

// La curva base estirada verticalmente entre la punta y el cuello de esta línea.
function curva(w: number, h: number, i: number, side: Ala): string {
  const { punta, cuello } = LINEAS[i];
  const dx  = SEAM + CUELLO * (1 - i / BORDE_COLOR);
  const esc = (0.5 - dx) / 0.5;

  const X = (x: number) => {
    const v = x * esc;
    return w * (side === 'left' ? v : 1 - v);
  };
  const Y = (y: number) =>
    h * (punta + ((y - BASE_PUNTA) * (cuello - punta)) / (BASE_CUELLO - BASE_PUNTA));

  return [
    `M ${X(0.5)} ${Y(BASE_CUELLO)}`,
    `C ${X(BASE.c1[0])} ${Y(BASE.c1[1])}, ${X(BASE.c2[0])} ${Y(BASE.c2[1])}, ${X(BASE.p1[0])} ${Y(BASE.p1[1])}`,
    `C ${X(BASE.c3[0])} ${Y(BASE.c3[1])}, ${X(BASE.c4[0])} ${Y(BASE.c4[1])}, ${X(BASE.p2[0])} ${Y(BASE.p2[1])}`,
  ].join(' ');
}

// El relleno de color: el asta de más adentro, cerrada hasta el pie.
function pagina(w: number, h: number, side: Ala): string {
  const x0   = side === 'left' ? 0 : w;
  const xFin = w * (side === 'left' ? 0.5 - SEAM : 0.5 + SEAM);
  return `${curva(w, h, BORDE_COLOR, side)} L ${x0} ${h} L ${xFin} ${h} Z`;
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
});

type Camino = {
  id: 'crecer' | 'acompañar';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  rule: string;
  accent: string;
  route: string;
  tono: Tono;
};

const CAMINOS: Camino[] = [
  {
    id: 'crecer',
    icon: 'person-outline',
    title: 'Quiero\ncrecer',
    desc: 'Quiero explorar herramientas para mi crecimiento.',
    rule: SALVIA_RULE,
    accent: VERDE_ICON,
    route: '/onboarding2',
    tono: 'crecer',
  },
  {
    id: 'acompañar',
    icon: 'briefcase-outline',
    title: 'Quiero\nacompañar',
    desc: 'Soy profesional y quiero ofrecer mi acompañamiento.',
    rule: DURAZNO_RULE,
    accent: NARANJA,
    route: '/coach-login',
    tono: 'acompanar',
  },
];

export default function OnboardingBifurcacion() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const brandAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const splitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(brandAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(splitAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();
  }, []);

  /**
   * La salida: **el propio botón crece**. No es un círculo nuevo del mismo
   * color puesto encima — es el aro de la flecha que tocaste, que se llena de
   * su color, se agranda desde su propio borde hasta tapar la pantalla, y
   * mientras tanto todo lo demás se desvanece.
   *
   * 🔴 Un solo `Animated.Value` para las cinco cosas que pasan, con el escalonado
   * metido en los `inputRange`. Cinco animaciones en paralelo costarían cinco
   * veces más y se verían igual — mismo criterio que la entrada de Sofía.
   *
   * 🔴 Todo lo que se anima corre en el hilo nativo: `opacity` y `scale`, nunca
   * `backgroundColor` (que no lo soporta). Por eso el relleno de color es una
   * capa aparte adentro del aro a la que se le sube la opacidad, y no el
   * `backgroundColor` del aro cambiando de valor.
   */
  const [salida, setSalida] = useState<{ id: string; escala: number } | null>(null);
  const paso = useRef(new Animated.Value(0)).current;
  const flechas = useRef<Record<string, View | null>>({}).current;
  const yendo = useRef(false);

  // Lo que NO es el botón elegido: se va antes de que el botón termine de
  // crecer, así el crecimiento pasa sobre una pantalla ya vacía.
  const desvanece = {
    opacity: paso.interpolate({ inputRange: [0, 0.42], outputRange: [1, 0], extrapolate: 'clamp' as const }),
  };

  function elegir(c: Camino) {
    if (yendo.current) return;   // el segundo toque no dispara un segundo viaje
    yendo.current = true;

    const ir = () => router.push({ pathname: c.route, params: { tono: c.tono } } as any);
    const nodo = flechas[c.id];

    // ⚠️ Sin flecha medida o con "reducir movimiento" prendido se navega y ya:
    // la transición es un adorno, no puede ser la única forma de avanzar.
    AccessibilityInfo.isReduceMotionEnabled().then(reducir => {
      if (reducir || !nodo || typeof nodo.measureInWindow !== 'function') { ir(); return; }

      nodo.measureInWindow((x, y, w, h) => {
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Cuánto tiene que crecer para tapar la esquina MÁS lejana. Se mide
        // contra las cuatro y se toma la peor: la flecha está abajo y a un
        // costado, así que a ojo siempre queda una punta sin cubrir.
        const alcance = Math.max(
          Math.hypot(cx, cy), Math.hypot(width - cx, cy),
          Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy),
        );

        setSalida({ id: c.id, escala: (alcance * 2) / ARO });
        paso.setValue(0);
        Animated.timing(paso, {
          toValue: 1,
          duration: 620,
          // Sale despacio y termina rápido: el arranque es lo que se lee como
          // "esto que toqué se está abriendo", el final ya es solo color.
          easing: Easing.bezier(0.32, 0, 0.24, 1),
          useNativeDriver: true,
        }).start(ir);
      });
    });
  }

  // 🔴 Se navega con `push`, así que esta pantalla queda MONTADA debajo. Al
  // volver atrás seguiría tapada por el círculo a pantalla completa y con
  // `yendo` trabado, o sea muerta: las dos alas dejarían de responder. Se
  // repone todo al recuperar el foco.
  useFocusEffect(
    useCallback(() => {
      yendo.current = false;
      setSalida(null);
      paso.setValue(0);
    }, [paso]),
  );

  const yCierre = height * BASE_CUELLO;
  const alas: Ala[] = ['left', 'right'];

  return (
    <View style={s.root}>
      {/* El cuello: los dos paneles de color y el campo de líneas */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: splitAnim }, desvanece]} pointerEvents="none">
        <Svg width={width} height={height}>
          {alas.map(side => (
            <Path
              key={`pag-${side}`}
              d={pagina(width, height, side)}
              fill={side === 'left' ? SALVIA : DURAZNO}
            />
          ))}
          {/* Costura entre los dos lados */}
          <Rect x={width * (0.5 - SEAM)} y={yCierre} width={width * SEAM * 2} height={height - yCierre} fill={CREMA} />
          {alas.map(side =>
            LINEAS.slice(0, BORDE_COLOR).map((_, i) => {
              const k = i / BORDE_COLOR;  // 0 = la de más afuera
              return (
                <Path
                  key={`${side}-${i}`}
                  d={curva(width, height, i, side)}
                  fill="none"
                  // Más afuera = más fina y más tenue
                  strokeWidth={0.70 + k * 0.25}
                  strokeOpacity={0.55 + k * 0.40}
                  stroke={side === 'left' ? SALVIA_LINE : DURAZNO_LINE}
                />
              );
            }),
          )}
        </Svg>
      </Animated.View>

      {/* Bloque superior — ocupa hasta el punto de convergencia */}
      <Animated.View style={[s.top, { height: yCierre - height * 0.018 }, desvanece]} pointerEvents="none">
        <SafeAreaView edges={['top']} />
        <View style={s.topInner}>
          <Animated.View style={fadeUp(brandAnim)}>
            <VitaWordmark />
          </Animated.View>
          {/* El paddingBottom es lo que lo sube: `titleArea` centra en el
              espacio sobrante, así que acortarlo por abajo corre el centro
              hacia arriba sin sacar el título de su caja. */}
          <Animated.View style={[s.titleArea, { paddingBottom: height * TITULO_SUBE }, fadeUp(titleAnim)]}>
            <Text style={s.title}>¿Qué buscás{'\n'}en Vita?</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Columnas — transparentes: el color lo pone la capa de atrás */}
      <View style={s.columns}>
        {CAMINOS.map(c => (
          <TouchableOpacity
            key={c.id}
            // La elegida se pinta ENCIMA de la otra: el aro crece hasta taparlo
            // todo, y sin esto su hermana quedaría dibujada arriba del color.
            style={[
              s.col,
              { paddingTop: height * 0.006, paddingBottom: height * 0.115 },
              salida?.id === c.id && { zIndex: 2 },
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${c.title.replace('\n', ' ')}. ${c.desc}`}
            onPress={() => elegir(c)}>
            <Animated.View style={[s.colTop, desvanece]}>
              <Ionicons name={c.icon} size={38} color={c.accent} />
              <Text style={s.colTitle}>{c.title}</Text>
              <View style={[s.rule, { backgroundColor: c.rule }]} />
              <Text style={s.colDesc}>{c.desc}</Text>
            </Animated.View>
            {/* La flecha va anclada al pie para que las dos queden a la misma
                altura aunque las descripciones tengan distinta cantidad de líneas */}
            {/* 🔴 El objeto que viaja. No se lo reemplaza por un círculo nuevo:
                es este mismo aro el que se llena de su color y crece desde su
                propio borde. Por eso el `ref` para medirlo y el `zIndex` de
                arriba — lo que se agranda es el botón que la persona tocó. */}
            <Animated.View
              ref={n => { flechas[c.id] = n as unknown as View | null; }}
              collapsable={false}
              style={[
                s.arrow,
                { borderColor: c.accent },
                salida?.id === c.id && {
                  transform: [{
                    scale: paso.interpolate({
                      inputRange: [0, 1], outputRange: [1, salida.escala],
                    }),
                  }],
                },
              ]}>
              {/* El relleno, como capa aparte: `backgroundColor` no corre en el
                  hilo nativo y `opacity` sí. Entra antes de que el aro empiece
                  a crecer, si no se agranda un anillo vacío. */}
              {salida?.id === c.id && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: ARO / 2,
                      backgroundColor: c.accent,
                      opacity: paso.interpolate({
                        inputRange: [0, 0.22], outputRange: [0, 1], extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              )}
              <Animated.View style={salida?.id === c.id ? desvanece : undefined}>
                <MaterialCommunityIcons name="arrow-right" size={22} color={TEXTO} />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  // `overflow: 'visible'` en toda la cadena que contiene el aro: al crecer se
  // sale de su columna por varias pantallas, y en Android un hijo fuera del
  // padre se recorta salvo que se diga lo contrario.
  root: { flex: 1, backgroundColor: CREMA, overflow: 'visible' },

  top: { paddingHorizontal: 24 },
  topInner: { flex: 1, alignItems: 'center', paddingTop: 12 },
  // Sin subtítulo el bloque superior queda holgado: el título se centra en el
  // espacio que sobra entre el wordmark y el punto de convergencia. El
  // `paddingBottom` que lo sube un poco va inline, porque depende del alto de
  // pantalla (ver `TITULO_SUBE`).
  titleArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.8,
    color: TEXTO,
    textAlign: 'center',
  },
  columns: { flex: 1, flexDirection: 'row', overflow: 'visible' },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  colTop: { alignItems: 'center', gap: 17 },
  colTitle: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: TEXTO,
    textAlign: 'center',
  },
  rule: { width: 64, height: 1, marginTop: -3 },
  colDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: TEXTO_SUAVE,
    textAlign: 'center',
  },
  arrow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
