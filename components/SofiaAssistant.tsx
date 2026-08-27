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
// Centro del orbe chico del header, medido dentro del panel. Va como constante
// y no con `onLayout` porque la cadena de padres (sheetInner → topGroup →
// sheetHeader) devuelve coordenadas relativas a cada uno y habría que sumarlas
// igual, de forma asíncrona y después de que la animación ya arrancó.
// ⚠️ Queda acoplado a `sheetInner` (padding 22/12), `grab` (4 de alto + 18 de
// margen) y `HEADER_ORB`. Si cambia alguno, el isotipo aterriza corrido.
const HEADER_ORB_CENTRO = { x: 22 + HEADER_ORB / 2, y: 12 + 4 + 18 + HEADER_ORB / 2 };

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
  // Mismo motivo que `insetsRef`: los handlers del PanResponder capturaron el
  // primer render y no verían cambiar la preferencia de movimiento.
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const pan = useRef(new Animated.ValueXY(orbPos.current)).current;
  const dragStart = useRef(orbPos.current);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ── Apertura: el panel sale DEL ORBE ────────────────────────────────────
  // ── Apertura ────────────────────────────────────────────────────────────
  // Pasó por tres formas. Subía desde abajo (la animación de cualquier hoja).
  // Después escalaba el panel entero desde el orbe, que siempre era un
  // rectángulo. Ahora es un DERRAME: un círculo de color crema se expande desde
  // el orbe hasta inundar el panel, y el contenido entra escalonado adentro.
  //
  // 📝 Además de verse distinto, esto volvió al driver nativo. El morfo anterior
  // animaba `width`/`height`/`borderRadius`/`backgroundColor`, que solo corren
  // en JS; acá se mueve todo con `transform` y `opacity`, o sea en el hilo
  // nativo. Es la única de las ideas que mejoró lo visual y el costo a la vez.
  const revelado = useRef(new Animated.Value(0)).current;
  const contenido = useRef(new Animated.Value(0)).current;
  /** Anticipación: el orbe se comprime antes de abrir. */
  const orbeEscala = useRef(new Animated.Value(1)).current;

  // La geometría se fija al abrir: el orbe se arrastra, así que de dónde sale el
  // derrame cambia entre una apertura y la siguiente. Va en estado porque el
  // `outputRange` de un `interpolate` es fijo por render.
  const [geo, setGeo] = useState<{ cx: number; cy: number; w: number; h: number; d: number; s0: number } | null>(null);

  // Entrada escalonada. Un solo valor para todos los elementos, con el retraso
  // metido en el `inputRange` — N animaciones en paralelo costarían N veces más
  // y se verían igual.
  const entrada = (retraso: number) => ({
    opacity: contenido.interpolate({ inputRange: [retraso, retraso + 0.4], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [{
      translateY: contenido.interpolate({ inputRange: [retraso, retraso + 0.4], outputRange: [10, 0], extrapolate: 'clamp' as const }),
    }],
  });

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
        if (moved >= DRAG_THRESHOLD) return;

        // 🔴 Anticipación: el orbe se comprime un instante antes de abrir. Es el
        // truco más viejo de la animación clásica y es la diferencia entre "se
        // abrió un panel" y "algo contestó" — que para un asistente con nombre
        // propio no es un detalle decorativo.
        if (reducedMotionRef.current) { setOpen(true); return; }
        Animated.timing(orbeEscala, { toValue: 0.86, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true })
          .start(() => setOpen(true));
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
      // Dónde nace el derrame y hasta dónde tiene que llegar. Todo relativo al
      // contenedor del panel, que ya está en su lugar final desde el cuadro uno.
      const { width, height } = Dimensions.get('window');
      const topPanel = insets.top + 44;
      const w = width;
      const h = height - topPanel;
      const cx = orbPos.current.x + ORB_SIZE / 2;
      const cy = orbPos.current.y + ORB_SIZE / 2 - topPanel;

      // El círculo tiene que tapar la esquina MÁS LEJANA, si no queda una punta
      // sin cubrir. Se mide contra las cuatro y se toma la peor.
      const alcance = Math.max(
        Math.hypot(cx, cy), Math.hypot(w - cx, cy),
        Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy),
      );
      const d = alcance * 2;

      setGeo({ cx, cy, w, h, d, s0: ORB_SIZE / d });
      setMounted(true);
      revelado.setValue(0);
      contenido.setValue(0);

      // Igual que en SobreVosMomento: sin esto la apertura compite por el hilo
      // de JS con lo que esté pasando en ese instante y se siente lagueada.
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, { toValue: 1, duration: reducedMotion ? 100 : 260, useNativeDriver: true }),
          Animated.timing(revelado, {
            toValue: 1,
            duration: reducedMotion ? 100 : 460,
            // Sale rápido y frena largo: es lo que hace que el final se lea como
            // que el panel se asienta, en vez de llegar de golpe.
            easing: reducedMotion ? Easing.linear : Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
          // 🔴 El retraso NO es a ojo. El header queda arriba a la izquierda, que
          // es lo ÚLTIMO que alcanza un círculo que sale de abajo a la derecha:
          // con el orbe en su posición de reposo, el crema le llega recién al 54%
          // del tiempo (250ms de 460). Con menos que eso el saludo aparece sobre
          // el fondo oscuro, antes de que exista el panel debajo — se ve en la
          // vista previa de cuadros y es exactamente lo que arruinaría el efecto.
          //
          // ⚠️ Si el orbe está arrastrado a otro lado el número cambia, pero
          // siempre para mejor: la esquina más lejana es la peor de todas y es
          // contra la que está calculado.
          Animated.timing(contenido, {
            toValue: 1,
            delay: reducedMotion ? 0 : 260,
            duration: reducedMotion ? 100 : 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => task.cancel();
    } else {
      // Vuelve al orbe por el mismo camino, más rápido: una salida que dura lo
      // mismo que la entrada se siente lenta. El contenido se va primero, así no
      // se lo ve encogerse con el círculo.
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: reducedMotion ? 80 : 180, useNativeDriver: true }),
        Animated.timing(contenido, { toValue: 0, duration: reducedMotion ? 60 : 120, useNativeDriver: true }),
        Animated.timing(revelado, {
          toValue: 0,
          duration: reducedMotion ? 80 : 260,
          easing: reducedMotion ? Easing.linear : Easing.bezier(0.4, 0, 0.7, 0.9),
          useNativeDriver: true,
        }),
      ]).start(() => { setMounted(false); setGeo(null); orbeEscala.setValue(1); });
    }
  }, [open, reducedMotion, backdropOpacity, revelado, contenido, orbeEscala, insets.top]);

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
          <Animated.View
            style={[styles.orb, { transform: [{ scale: orbeEscala }] }]}
            accessibilityRole="button"
            accessibilityLabel="Abrir Sofía, tu asistente. Mantené presionado para moverla"
          >
            <VitaMark size={34} color="#FFFFFF" strokeWidth={6} />
          </Animated.View>
        </Animated.View>
      )}

      {mounted && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Cerrar el asistente">
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>
      )}

      {mounted && geo && (
        <View style={[styles.sheetShape, { top: insets.top + 44 }]} pointerEvents="box-none">
          {/* ── El derrame ────────────────────────────────────────────────
              Un círculo que nace del tamaño del orbe, en el lugar del orbe, y
              se expande hasta tapar la esquina más lejana del panel. El
              contenedor lo recorta, así que lo que se ve es el crema inundando
              la pantalla desde el botón. Solo escala: hilo nativo. */}
          <Animated.View
            style={[
              styles.derrame,
              {
                width: geo.d,
                height: geo.d,
                borderRadius: geo.d / 2,
                left: geo.cx - geo.d / 2,
                top: geo.cy - geo.d / 2,
                transform: [{ scale: revelado.interpolate({ inputRange: [0, 1], outputRange: [geo.s0, 1] }) }],
              },
            ]}
            pointerEvents="none"
          />

          {/* El verde del orbe, encima del crema y apagándose: el color del
              botón se derrite en el del panel en vez de cortar seco. Va como
              opacidad y no como `backgroundColor` animado justamente para no
              volver al hilo de JS. */}
          <Animated.View
            style={[
              styles.derrame,
              {
                width: geo.d,
                height: geo.d,
                borderRadius: geo.d / 2,
                left: geo.cx - geo.d / 2,
                top: geo.cy - geo.d / 2,
                backgroundColor: FOREST,
                opacity: revelado.interpolate({ inputRange: [0, 0.38], outputRange: [1, 0], extrapolate: 'clamp' }),
                transform: [{ scale: revelado.interpolate({ inputRange: [0, 1], outputRange: [geo.s0, 1] }) }],
              },
            ]}
            pointerEvents="none"
          />

          {/* ── El isotipo se muda ────────────────────────────────────────
              No se apaga: viaja desde el orbe hasta donde queda el orbe chico
              del header, achicándose. Es la misma marca que cambió de lugar, no
              una que desaparece y otra que aparece. Se apaga sobre el final,
              cuando el header ya entró y las dos se superponen. */}
          <Animated.View
            style={[
              styles.marcaViajera,
              {
                left: geo.cx - 17,
                top: geo.cy - 17,
                opacity: revelado.interpolate({ inputRange: [0, 0.62, 0.82], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
                transform: [
                  { translateX: revelado.interpolate({ inputRange: [0, 1], outputRange: [0, HEADER_ORB_CENTRO.x - geo.cx] }) },
                  { translateY: revelado.interpolate({ inputRange: [0, 1], outputRange: [0, HEADER_ORB_CENTRO.y - geo.cy] }) },
                  { scale: revelado.interpolate({ inputRange: [0, 1], outputRange: [1, 24 / 34] }) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <VitaMark size={34} color="#FFFFFF" strokeWidth={6} />
          </Animated.View>

          {/* 🔴 Ancho y alto FIJOS, los finales. Si el contenido se midiera
              contra algo que crece, el texto se reacomodaría en cada cuadro. */}
          <View
            style={[styles.sheetInner, { width: geo.w, height: geo.h, paddingBottom: 18 + insets.bottom }]}
            pointerEvents="box-none"
          >
          <Animated.View style={[styles.grab, entrada(0)]} />

          <View style={styles.topGroup}>
            {/* ── Entrada escalonada ────────────────────────────────────
                Antes aparecía todo junto, que es lo que más lo hacía sentir
                genérico. Los retrasos son fracciones del mismo valor animado,
                no animaciones separadas. */}
            <Animated.View style={[styles.sheetHeader, entrada(0)]}>
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
            </Animated.View>

            <Animated.Text style={[styles.greeting, entrada(0.08)]}>
              Hola, soy Sofía.{'\n'}¿En qué te doy una mano?
            </Animated.Text>
          </View>

          <View style={styles.bottomGroup}>
            <Animated.View style={[styles.notice, entrada(0.16)]}>
              <Feather name="tool" size={14} color={FOREST} />
              <Text style={styles.noticeText}>
                Todavía estoy aprendiendo a conversar. Mientras tanto, elegí una de estas opciones:
              </Text>
            </Animated.View>

            <View style={styles.shortcuts}>
              {SHORTCUTS.map((sc, i) => (
                <Animated.View key={sc.id} style={entrada(0.24 + i * 0.07)}>
                <Pressable
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
                </Animated.View>
              ))}
            </View>

            {/* Deshabilitado a propósito — preview de lo que viene, sin
                backend ni LLM conectado todavía. */}
            <Animated.View style={[styles.inputWrap, entrada(0.55)]}>
              <TextInput
                style={styles.input}
                placeholder="Muy pronto vas a poder escribirme"
                placeholderTextColor="rgba(86,94,50,0.45)"
                editable={false}
                pointerEvents="none"
              />
              <Feather name="send" size={16} color="rgba(86,94,50,0.35)" />
            </Animated.View>
            <Animated.Text style={[styles.caption, entrada(0.6)]}>
              El chat está en desarrollo — probá las opciones de arriba mientras tanto
            </Animated.Text>
          </View>
          </View>
        </View>
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
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // ⚠️ Sin sombra en iOS: `overflow: 'hidden'` es `masksToBounds` en la capa, y
    // eso RECORTA la sombra — quedaría declarada y sin dibujarse. Se podría
    // reponer con una vista extra por fuera, pero sobre el fondo oscuro del
    // backdrop no aporta nada visible. En Android la elevación se dibuja desde
    // el contorno y el recorte no la afecta, así que esa queda.
    ...Platform.select({
      android: { elevation: 12 },
    }),
  },
  // El círculo que se derrama. Tamaño y posición los pone la animación: dependen
  // de dónde quedó el orbe.
  derrame: {
    position: 'absolute',
    backgroundColor: CARD,
  },
  // La marca en tránsito, del orbe al header. 34 es su tamaño en el orbe; la
  // caja es de 34 para que la escala salga de su propio centro.
  marcaViajera: {
    position: 'absolute',
    width: 34,
    height: 34,
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
