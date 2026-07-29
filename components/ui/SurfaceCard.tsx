import { useRef, useMemo } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Platform,
  Pressable,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { shadow, radii, type ShadowLayer } from '@/theme/tokens';

// Tratamiento de superficie compartido ("efecto de card cálido") — antes cada
// pantalla dibujaba su propia card con bg+borde+sombra inline, sin ningún
// lugar único. Ver card-efectos-comparador.html (opción E "Combo") y
// theme/tokens.ts (export `shadow`) para los valores. Rediseño sesión 77.
//
// variant:
//  - 'elevated': 3 sombras (contacto+media+halo), grano 5%, borde gradiente,
//    línea de brillo superior, sube al presionar. Para la card más importante
//    de cada pantalla (una por pantalla, no para listas).
//  - 'subtle': sombra 1+2 sin halo, grano 3%, borde plano. Para cards
//    repetidas/secundarias — sin interacción de lift propia (si ya están
//    envueltas en ScaleCard para el gesto, no se duplica la animación acá).
//
// tone='dark' es para superficies oscuras (ej. hero de sesión sobre verde
// bosque): halo tinta en vez de terracota, borde plano en vez de gradiente
// (mismo criterio que usa el propio mockup para su `.hero`, que tampoco
// lleva borde con brillo).
export type SurfaceCardVariant = 'elevated' | 'subtle';
export type SurfaceCardTone = 'light' | 'dark';

const GRAIN_TILE = 48;
// Puntos pseudo-random generados una sola vez al cargar el módulo (no por
// render, no por card) — aproximación de feTurbulence vía SVG <Pattern>, sin
// depender de un PNG externo (no hay ninguna textura en assets/ hoy).
const GRAIN_DOTS = Array.from({ length: 46 }, () => ({
  x: Math.random() * GRAIN_TILE,
  y: Math.random() * GRAIN_TILE,
  r: 0.35 + Math.random() * 0.75,
  o: 0.12 + Math.random() * 0.4,
}));

function Grain({ opacity, borderRadius }: { opacity: number; borderRadius: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Defs>
          <Pattern id="grain" patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
            {GRAIN_DOTS.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#2E261A" fillOpacity={d.o} />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grain)" />
      </Svg>
    </View>
  );
}

type AnimatedLayer = {
  color: string;
  opacity: number | Animated.AnimatedInterpolation<number>;
  offset: { width: number; height: number | Animated.AnimatedInterpolation<number> };
  radius: number | Animated.AnimatedInterpolation<number>;
};

// Capa de fondo (halo/elevación media): View absoluta, más chica que la card
// visible (aproxima el spread negativo de CSS) — NO lleva el contenido.
function BackLayerView({ layer, inset, borderRadius, backgroundColor }: {
  layer: AnimatedLayer;
  inset: number;
  borderRadius: number;
  backgroundColor: string;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: inset, left: inset, right: inset, bottom: inset,
        borderRadius,
        backgroundColor,
        shadowColor: layer.color,
        shadowOpacity: layer.opacity,
        shadowOffset: layer.offset,
        shadowRadius: layer.radius,
      }}
    />
  );
}

export function SurfaceCard({
  variant,
  tone = 'light',
  onPress,
  style,
  backgroundColor = '#F7F2E7',
  borderRadius = radii.card,
  grainOpacity,
  children,
}: {
  variant: SurfaceCardVariant;
  tone?: SurfaceCardTone;
  onPress?: (e: GestureResponderEvent) => void;
  style?: ViewStyle | ViewStyle[];
  backgroundColor?: string;
  borderRadius?: number;
  /** Override manual — default 0.05 en elevated, 0.03 en subtle (spec). */
  grainOpacity?: number;
  children: React.ReactNode;
}) {
  const idleRecipe = variant === 'elevated' ? shadow.elevated[tone] : shadow.subtle.light;
  const pressedRecipe = variant === 'elevated' ? shadow.elevatedPressed[tone] : idleRecipe;
  const isPressable = variant === 'elevated' && !!onPress;

  const press = useRef(new Animated.Value(0)).current;

  function animateTo(toValue: number) {
    Animated.spring(press, {
      toValue,
      useNativeDriver: false, // shadowOpacity/shadowRadius/elevation no soportan native driver
      damping: toValue ? 20 : 14,
      stiffness: toValue ? 300 : 180,
    }).start();
  }

  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  // Una capa animada por índice (idle → pressed) si es pressable; si no, se
  // queda fija en los valores idle (sin costo de interpolación). Depende de
  // idleRecipe/pressedRecipe (no solo isPressable) para no quedarse con
  // sombras stale si variant/tone cambiaran en una instancia ya montada —
  // hoy ningún call site lo hace, pero el memo antes no lo cubría.
  const layers: AnimatedLayer[] = useMemo(() => {
    return idleRecipe.ios.map((idle: ShadowLayer, i: number) => {
      if (!isPressable) return idle;
      const pressed = pressedRecipe.ios[i];
      return {
        color: idle.color,
        opacity: press.interpolate({ inputRange: [0, 1], outputRange: [idle.opacity, pressed.opacity] }),
        offset: {
          width: 0,
          height: press.interpolate({ inputRange: [0, 1], outputRange: [idle.offset.height, pressed.offset.height] }),
        },
        radius: press.interpolate({ inputRange: [0, 1], outputRange: [idle.radius, pressed.radius] }),
      };
    });
  }, [isPressable, idleRecipe, pressedRecipe, press]);

  const backLayers = idleRecipe.ios.slice(0, -1);
  const contactLayer = layers[layers.length - 1];

  const androidHaloColor = isPressable
    ? press.interpolate({
        inputRange: [0, 1],
        outputRange: [idleRecipe.android.haloColor ?? 'transparent', pressedRecipe.android.haloColor ?? 'transparent'],
      })
    : idleRecipe.android.haloColor;

  const grain = grainOpacity ?? (variant === 'elevated' ? 0.05 : 0.03);
  const useGradientBorder = variant === 'elevated' && tone === 'light';

  // El contenido clippeado necesita SU PROPIO radio, un punto menos que el
  // wrapper que lo contiene cuando ese wrapper achica 1px por el borde
  // gradiente (padding-box) — si no, la esquina del contenido queda con un
  // radio mayor que la caja que lo recorta.
  function renderContent(radius: number) {
    return (
      <View style={{ borderRadius: radius, overflow: 'hidden', backgroundColor }}>
        <Grain opacity={grain} borderRadius={radius} />
        {variant === 'elevated' && (
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.9)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.topLine}
          />
        )}
        {children}
      </View>
    );
  }

  const cardBody = useGradientBorder ? (
    <LinearGradient
      colors={['rgba(255,255,255,0.9)', 'rgba(192,107,74,0.28)', 'rgba(63,81,47,0.20)']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={{ borderRadius, padding: 1 }}
    >
      <View style={{ borderRadius: borderRadius - 1, overflow: 'hidden' }}>{renderContent(borderRadius - 1)}</View>
    </LinearGradient>
  ) : (
    <View
      style={{
        borderRadius,
        borderWidth: 1,
        borderColor: tone === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(63,81,47,0.08)',
      }}
    >
      {renderContent(borderRadius)}
    </View>
  );

  return (
    <Animated.View style={[style, { transform: [{ translateY: isPressable ? translateY : 0 }] }]}>
      <View style={{ position: 'relative' }}>
        {Platform.OS === 'ios' &&
          backLayers.map((idleLayer, i) => (
            <BackLayerView
              key={i}
              layer={layers[i]}
              inset={idleLayer.inset}
              borderRadius={borderRadius}
              backgroundColor={backgroundColor}
            />
          ))}

        {Platform.OS === 'android' && idleRecipe.android.haloColor && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: idleRecipe.android.haloInset ?? 0,
              left: idleRecipe.android.haloInset ?? 0,
              right: idleRecipe.android.haloInset ?? 0,
              bottom: idleRecipe.android.haloInset ?? 0,
              borderRadius: borderRadius + 10,
              backgroundColor: androidHaloColor as any,
            }}
          />
        )}

        {/* Capa de contacto — la única con contenido real, layout normal (no absoluta) */}
        <Animated.View
          style={
            Platform.OS === 'ios'
              ? {
                  borderRadius,
                  backgroundColor,
                  shadowColor: contactLayer.color,
                  shadowOpacity: contactLayer.opacity,
                  shadowOffset: contactLayer.offset,
                  shadowRadius: contactLayer.radius,
                }
              : { borderRadius, backgroundColor, elevation: idleRecipe.android.elevation }
          }
        >
          {isPressable ? (
            <Pressable
              onPressIn={() => animateTo(1)}
              onPressOut={() => animateTo(0)}
              onPress={onPress}
              style={{ borderRadius, overflow: 'hidden' }}
            >
              {cardBody}
            </Pressable>
          ) : (
            cardBody
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  topLine: {
    position: 'absolute',
    top: 0, left: 14, right: 14, height: 1,
  },
});
