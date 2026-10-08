import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';

// Grano de papel reutilizable, con la intensidad como parámetro (`opacity`).
// Pensado para la splash (grano fuerte, ~16%) pero reusable en otras superficies.
//
// 🔴 Enfoque de PUNTITOS pseudo-random vía <Pattern> — NO feTurbulence. Los
// filtros SVG de react-native-svg flaquean en Android (y acá no hay un Android
// para probarlos), así que se usa el mismo patrón de puntos que ya usan las
// cards (SurfaceCard/SaveScreen) y que se ve igual en iOS y Android.
//
// Rendimiento: los puntos se generan UNA vez al cargar el módulo (no por frame),
// y el Rect con el patrón es estático. El color oscurece el crema como un
// multiply suave.
const TILE = 42;
// Densidad más alta que las cards (~46 a 4-5%) para que a 16% lea como grano
// marcado, no como unos puntitos sueltos.
const DOTS = Array.from({ length: 90 }, () => ({
  x: Math.random() * TILE,
  y: Math.random() * TILE,
  r: 0.35 + Math.random() * 0.8,
  o: 0.25 + Math.random() * 0.55,
}));

export function Grain({ opacity = 0.16 }: { opacity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grainDots" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            {DOTS.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#2E261A" fillOpacity={d.o} />
            ))}
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grainDots)" />
      </Svg>
    </View>
  );
}
