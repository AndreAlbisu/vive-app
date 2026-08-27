import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Platform,
  Dimensions,
  Easing,
  InteractionManager,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { VitaMark } from '@/components/VitaMark';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Asistente flotante "Sofía" — SOLO interfaz, sin conexión a ningún backend/LLM
// todavía. Los atajos navegan a pantallas que YA existen; el campo de escribir
// está deshabilitado a propósito (preview de lo que viene).
//
// Montado a nivel de app/(tabs)/_layout.tsx (no dentro de cada pantalla) para
// que sea un solo elemento global, visible en las 4 tabs principales (Inicio,
// Conexiones, Recursos, Mensajes) y en ningún otro lado.
//
// El orbe se arrastra con `PanResponder` + `Animated.ValueXY` (mismo mecanismo
// que ya usa el slider de filtros de app/search3.tsx). Al tocarlo (sin
// arrastrar) abre un panel a pantalla casi completa.
//
// ⚠️ A propósito, SIN `<Modal>`: se probó con Modal + las mismas mitigaciones
// que lleva `SobreVosMomento.tsx` (rasterizado, animación diferida con
// InteractionManager) y igual se sentía lento — `Modal` arma una pantalla
// nativa nueva cada vez que se abre, y ese costo no se puede evitar desde
// nuestro lado con trucos de animación. Como este componente ya está montado
// arriba de `<Tabs>` (no dentro de una pantalla), no hace falta Modal para
// quedar por encima de todo — un View absoluto normal alcanza y sale gratis
// ese costo. `SobreVosMomento.tsx` no puede aplicar el mismo arreglo todavía:
// vive DENTRO del árbol de Inicio, no al lado de `<Tabs>`, así que un View
// absoluto ahí quedaría por DEBAJO de la isla de tabs en vez de por encima.

const FOREST = '#3F512F'; // color propio de Sofía — ViveColors.primary (terracota)
                           // se parecía demasiado al avatar del perfil.
const CARD   = '#F7F2E7'; // fondo sólido del panel — antes era glass translúcido.
const LINE   = 'rgba(63,81,47,0.14)';

const ORB_SIZE       = 54;
const HEADER_ORB      = 38;
const EDGE_MARGIN    = 8;
const DRAG_THRESHOLD  = 6; // px — por debajo de esto, un toque cuenta como tap y no como arrastre.

type Shortcut = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: Href;
};

// "¿Qué me recomendás para hoy?" no tiene pantalla propia — la recomendación
// según el check-in ya vive como card arriba de Recursos (useRecommendedResource
// en app/(tabs)/recursos.tsx). Llevar ahí cumple las dos ramas del pedido: si
// hay recomendación, es lo primero que se ve; si no, es la pantalla de Recursos.
const SHORTCUTS: Shortcut[] = [
  { id: 'reco',    label: '¿Qué me recomendás para hoy?',  icon: 'compass',   route: '/(tabs)/recursos' },
  { id: 'start',   label: 'Ayudame a arrancar',             icon: 'sunrise',   route: '/(tabs)' },
  { id: 'mal-dia', label: 'Estoy teniendo un mal día',       icon: 'edit-3',    route: '/diario' },
  { id: 'coaches', label: 'Quiero ver a los profesionales',  icon: 'users',     route: '/(tabs)/conexiones' },
];

export function SofiaAssistant() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 🔴 La posición vive en un ref y NO en estado, y los insets se espejan en
  // otro. El motivo es el mismo para los dos: `PanResponder.create` corre una
  // sola vez (está en un `useRef`), así que todo lo que sus handlers lean del
  // render queda congelado en el PRIMER valor para siempre.
  //
  // Con `useState`, `onPanResponderGrant` hacía `dragStart.current = orbPos` y
  // leía siempre la posición inicial. El primer arrastre andaba; del segundo en
  // adelante el orbe saltaba a "posición original + desplazamiento" apenas lo
  // movías. (Reportado el 27/08/2026: "funciona muy raro cuando la movés y
  // soltás en algún lado".)
  //
  // 📝 De paso deja de re-renderizar el árbol entero en cada soltada: la
  // posición la dibuja `pan`, que es un `Animated.ValueXY`, no el estado.
  const orbPos = useRef({
    x: Dimensions.get('window').width - 18 - ORB_SIZE,
    y: Dimensions.get('window').height - (insets.bottom + 8 + 56 + 14) - ORB_SIZE,
  });
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const pan = useRef(new Animated.ValueXY(orbPos.current)).current;
  const dragStart = useRef(orbPos.current);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ── Apertura: el panel sale DEL ORBE ────────────────────────────────────
  // Antes subía desde abajo de la pantalla, que es la animación de una hoja
  // cualquiera y no tenía nada que ver con el botón que la abrió. Después pasó a
  // crecer desde el orbe, pero escalando el panel entero: siempre era un
  // rectángulo, chico primero y grande después.
  //
  // 🔴 Ahora lo que se anima es la FORMA. El contenedor empieza siendo el orbe
  // —mismo lugar, mismo tamaño, mismo redondeo, mismo verde— y se amolda hasta
  // ser el panel; el contenido aparece después, cuando el espacio ya existe.
  //
  // ⚠️ Por eso este valor va con `useNativeDriver: false`: `width`, `height`,
  // `borderRadius` y `backgroundColor` no se pueden animar en el hilo nativo,
  // solo `transform` y `opacity`. El fondo oscuro sigue en el driver nativo
  // aparte (es otro valor, así que la mezcla es legal).
  const morfo = useRef(new Animated.Value(0)).current;

  // La geometría se fija al abrir y vive en estado porque el `outputRange` de un
  // `interpolate` es fijo por render: el orbe se arrastra, así que de dónde sale
  // cambia entre una apertura y la siguiente.
  const [geo, setGeo] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  function clampToScreen(x: number, y: number) {
    const { width, height } = Dimensions.get('window');
    const minX = EDGE_MARGIN;
    const maxX = width - ORB_SIZE - EDGE_MARGIN;
    // Por `insetsRef` y no por `insets`: esta función la llaman los handlers del
    // PanResponder, que capturaron el primer render. Leído directo, un inset que
    // llega tarde (o una rotación) dejaba el límite calculado con valores viejos.
    const minY = insetsRef.current.top + EDGE_MARGIN;
    // No se deja bajar más que su posición de reposo — ahí abajo empieza la isla.
    const maxY = height - (insetsRef.current.bottom + 8 + 56 + 14) - ORB_SIZE;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  // Deja el orbe donde terminó el gesto: lo dibuja y lo confirma. Solo toca
  // refs, así que no le afecta haber sido capturada en el primer render.
  function confirmarPosicion(dx: number, dy: number) {
    const next = clampToScreen(dragStart.current.x + dx, dragStart.current.y + dy);
    pan.setValue(next);
    orbPos.current = next;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragStart.current = orbPos.current;
      },
      onPanResponderMove: (_, g) => {
        const next = clampToScreen(dragStart.current.x + g.dx, dragStart.current.y + g.dy);
        pan.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        confirmarPosicion(g.dx, g.dy);

        // Sin esto, cualquier toque —arrastre incluido— abriría el panel al
        // soltar. Un desplazamiento chico se trata como tap.
        const moved = Math.hypot(g.dx, g.dy);
        if (moved < DRAG_THRESHOLD) setOpen(true);
      },
      // 🔴 Un gesto puede terminar sin soltarse: si otro responder se queda con
      // el toque, `onPanResponderRelease` NO corre. Sin esto la posición quedaba
      // dibujada donde el dedo la dejó pero sin confirmar en `orbPos`, y el
      // arrastre siguiente volvía a saltar — el mismo síntoma, por otra puerta.
      // No abre el panel: un gesto interrumpido no es un tap.
      onPanResponderTerminate: (_, g) => {
        confirmarPosicion(g.dx, g.dy);
      },
    })
  ).current;

  useEffect(() => {
    if (open) {
      // De dónde sale y adónde llega. Se calcula al abrir: el orbe se arrastra.
      const { width, height } = Dimensions.get('window');
      setGeo({
        x: orbPos.current.x,
        y: orbPos.current.y,
        w: width,
        h: height - (insets.top + 44),
      });
      setMounted(true);
      morfo.setValue(0);

      // Igual que en SobreVosMomento: sin esto, la animación de apertura compite
      // por el hilo de JS con lo que sea que esté pasando justo en ese instante
      // (el propio tap, re-renders) y se siente lagueada. Acá pesa más que antes,
      // porque la forma se anima desde JS y no desde el hilo nativo.
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, { toValue: 1, duration: reducedMotion ? 100 : 240, useNativeDriver: true }),
          Animated.timing(morfo, {
            toValue: 1,
            duration: reducedMotion ? 100 : 420,
            // Sale rápido y frena largo: es lo que hace leer el final como que
            // el panel "se asienta" en vez de llegar de golpe.
            easing: reducedMotion ? Easing.linear : Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: false,
          }),
        ]).start();
      });
      return () => task.cancel();
    } else {
      // Vuelve al orbe por el mismo camino, más rápido: una salida que dura lo
      // mismo que la entrada se siente lenta.
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: reducedMotion ? 80 : 180, useNativeDriver: true }),
        Animated.timing(morfo, {
          toValue: 0,
          duration: reducedMotion ? 80 : 250,
          easing: reducedMotion ? Easing.linear : Easing.bezier(0.4, 0, 0.7, 0.9),
          useNativeDriver: false,
        }),
      ]).start(() => { setMounted(false); setGeo(null); });
    }
  }, [open, reducedMotion, backdropOpacity, morfo, insets.top]);

  function close() {
    setOpen(false);
  }

  // Sin `Modal`, se pierde gratis el manejo del botón físico de "atrás" en
  // Android — se repone a mano, mismo comportamiento de antes (cierra el
  // panel en vez de salir de la pantalla de abajo).
  useEffect(() => {
    if (Platform.OS !== 'android' || !open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  function goTo(route: Href) {
    close();
    router.push(route);
  }

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {!open && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.orbAbs, { transform: pan.getTranslateTransform() }]}
        >
          <View
            style={styles.orb}
            accessibilityRole="button"
            accessibilityLabel="Abrir Sofía, tu asistente. Mantené presionado para moverla"
          >
            <VitaMark size={34} color="#FFFFFF" strokeWidth={6} />
          </View>
        </Animated.View>
      )}

      {mounted && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Cerrar el asistente">
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>
      )}

      {mounted && geo && (
        <Animated.View
          style={[
            styles.sheetShape,
            {
              // El contenedor ES el orbe al principio: mismo lugar, mismo
              // tamaño, mismo redondeo y mismo verde. De ahí se amolda.
              left:   morfo.interpolate({ inputRange: [0, 1], outputRange: [geo.x, 0] }),
              top:    morfo.interpolate({ inputRange: [0, 1], outputRange: [geo.y, insets.top + 44] }),
              width:  morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE, geo.w] }),
              height: morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE, geo.h] }),
              // Arriba termina en el redondeo del panel; abajo termina en cero,
              // porque ese borde queda al ras del final de la pantalla y una
              // esquina redondeada ahí se ve como un panel flotando mal apoyado.
              borderTopLeftRadius:     morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE / 2, 28] }),
              borderTopRightRadius:    morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE / 2, 28] }),
              borderBottomLeftRadius:  morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE / 2, 0] }),
              borderBottomRightRadius: morfo.interpolate({ inputRange: [0, 1], outputRange: [ORB_SIZE / 2, 0] }),
              // El verde del orbe se derrite en el crema del panel. Termina antes
              // que la forma para que el contenido no aparezca sobre verde.
              backgroundColor: morfo.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [FOREST, CARD, CARD],
              }),
            },
          ]}
        >
          {/* El isotipo se va apagando enseguida: mientras se ve, el contenedor
              todavía es casi el orbe, así que la transición se lee continua —
              no como que una cosa desapareció y otra apareció en su lugar. */}
          <Animated.View
            style={[
              styles.morphMark,
              { opacity: morfo.interpolate({ inputRange: [0, 0.22], outputRange: [1, 0], extrapolate: 'clamp' }) },
            ]}
            pointerEvents="none"
          >
            <VitaMark size={34} color="#FFFFFF" strokeWidth={6} />
          </Animated.View>

          {/* 🔴 Ancho y alto FIJOS, los finales. Si el contenido se midiera contra
              el contenedor mientras crece, el texto se reacomodaría en cada
              cuadro — caro y feo. Acá se maqueta una vez y el contenedor lo
              recorta (`overflow: 'hidden'`) hasta que hay lugar. */}
          <Animated.View
            style={[
              styles.sheetInner,
              {
                width: geo.w,
                height: geo.h,
                paddingBottom: 18 + insets.bottom,
                // Aparece cuando el espacio ya está hecho, no mientras se hace.
                opacity: morfo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
              },
            ]}
          >
          <View style={styles.grab} />

          <View style={styles.topGroup}>
            <View style={styles.sheetHeader}>
              <View style={styles.headerOrb}>
                <VitaMark size={24} color="#FFFFFF" strokeWidth={7} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerName}>Sofía</Text>
                <Text style={styles.headerSub}>tu asistente</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Feather name="x" size={22} color={ViveColors.text} />
              </Pressable>
            </View>

            <Text style={styles.greeting}>Hola, soy Sofía.{'\n'}¿En qué te doy una mano?</Text>
          </View>

          <View style={styles.bottomGroup}>
            <View style={styles.notice}>
              <Feather name="tool" size={14} color={FOREST} />
              <Text style={styles.noticeText}>
                Todavía estoy aprendiendo a conversar. Mientras tanto, elegí una de estas opciones:
              </Text>
            </View>

            <View style={styles.shortcuts}>
              {SHORTCUTS.map(sc => (
                <Pressable
                  key={sc.id}
                  style={styles.shortcutRow}
                  onPress={() => goTo(sc.route)}
                  accessibilityRole="button"
                >
                  <View style={styles.shortcutIcon}>
                    <Feather name={sc.icon} size={18} color={FOREST} />
                  </View>
                  <Text style={styles.shortcutText}>{sc.label}</Text>
                  <Feather name="chevron-right" size={18} color="rgba(63,81,47,0.35)" />
                </Pressable>
              ))}
            </View>

            {/* Deshabilitado a propósito — preview de lo que viene, sin
                backend ni LLM conectado todavía. */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Muy pronto vas a poder escribirme"
                placeholderTextColor="rgba(86,94,50,0.45)"
                editable={false}
                pointerEvents="none"
              />
              <Feather name="send" size={16} color="rgba(86,94,50,0.35)" />
            </View>
            <Text style={styles.caption}>El chat está en desarrollo — probá las opciones de arriba mientras tanto</Text>
          </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cubre toda la pantalla (necesario para poder arrastrar el orbe a
  // cualquier lado) sin capturar toques donde no hay nada propio —
  // `box-none` deja pasar todo lo que no sea el orbe.
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: FOREST,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#1E2617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  // 📝 La letra "S" salió el 27/08/2026: el orbe lleva el isotipo de Vita en
  // blanco sobre el verde del fondo, o sea la marca invertida. `VitaMark` ya
  // parametriza color y grosor, así que no hubo que tocar el logo — y el día que
  // el estudio lo cierre, cambia en `components/VitaMark.tsx` y esto lo hereda.
  //
  // ⚠️ `strokeWidth` va en unidades del viewBox (100 = ancho de la marca), así
  // que escala con `size`: a 30px un trazo de 4 se vería filoso, por eso 6. Es
  // el mismo criterio que ya usaban `SobreVosMomento` (18/7) e `index` (13/9).
  //
  // Los tamaños (34 en un orbe de 54, 24 en uno de 38) salieron de comparar
  // cinco combinaciones renderizadas: a 30 la marca se ve tímida y a 38 aprieta
  // contra el borde. En los dos casos ocupa ~63% del diámetro.

  backdrop: {
    backgroundColor: 'rgba(30,26,18,0.45)',
  },

  // Panel casi a pantalla completa (referencia: asistente de Banco Galicia) —
  // deja una franja arriba para que se note que es una hoja sobre la app, no
  // una pantalla nueva.
  // La FORMA: lo que se amolda del orbe al panel. Posición, tamaño, redondeo y
  // color los pone la animación — acá va solo lo que no cambia.
  //
  // 🔴 `overflow: 'hidden'` es lo que hace que esto funcione: el contenido está
  // maquetado al tamaño final desde el primer cuadro, y este recorte es lo único
  // que impide que se desborde mientras el espacio todavía es chico.
  sheetShape: {
    position: 'absolute',
    overflow: 'hidden',
    // ⚠️ Sin sombra en iOS: `overflow: 'hidden'` es `masksToBounds` en la capa, y
    // eso RECORTA la sombra — quedaría declarada y sin dibujarse. Se podría
    // reponer con una vista extra por fuera, pero sobre el fondo oscuro del
    // backdrop no aporta nada visible. En Android la elevación se dibuja desde
    // el contorno y el recorte no la afecta, así que esa queda.
    ...Platform.select({
      android: { elevation: 12 },
    }),
  },
  // El isotipo del arranque, clavado arriba a la izquierda en una caja del
  // tamaño del orbe: mientras se ve, el contenedor todavía mide eso.
  morphMark: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El CONTENIDO, a tamaño final fijo.
  sheetInner: {
    // 🔴 Antes `justifyContent: 'space-between'`, que empujaba `topGroup`
    // arriba del todo y `bottomGroup` abajo del todo — con poco contenido
    // (4 atajos nomás), el aire del medio quedaba enorme y el panel se leía
    // partido en dos, no como una sola tarjeta (pedido de Joaquín,
    // 27/08/2026, con captura). El espacio entre los dos grupos ahora lo da
    // `bottomGroup.marginTop`, fijo y chico, no lo que sobre de la pantalla.
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(63,81,47,0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },

  // Arriba: identidad + saludo grande. Abajo: aviso + opciones + input —
  // `justifyContent: space-between` en el contenedor padre separa los dos
  // grupos con aire en el medio, como en la referencia.
  topGroup: {},
  // 20 — Joaquín pidió juntarlo más después de ver el primer valor (32).
  bottomGroup: { marginTop: 20 },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerOrb: {
    width: HEADER_ORB,
    height: HEADER_ORB,
    borderRadius: HEADER_ORB / 2,
    backgroundColor: FOREST,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerName: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 17,
    color: ViveColors.text,
  },
  headerSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#8A8A72',
    marginTop: 1,
  },

  greeting: {
    fontFamily: ViveFonts.title,
    fontSize: 26,
    lineHeight: 33,
    color: ViveColors.text,
    marginTop: 28,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#6B7A56',
  },

  shortcuts: {
    gap: 10,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(63,81,47,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 13.5,
    color: ViveColors.text,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: ViveColors.text,
    padding: 0,
  },
  caption: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#8A8A72',
    textAlign: 'center',
    marginTop: 10,
  },
});
