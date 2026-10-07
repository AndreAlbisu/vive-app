import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect } from 'react-native-svg';

// Grano de papel reutilizable (ruido feTurbulence), con la intensidad como
// parámetro. Pensado para la splash (grano fuerte, ~16%) pero reusable en otras
// superficies más adelante sin duplicar código — por eso `opacity` es prop.
//
// 🔴 Rendimiento: el ruido se renderiza UNA sola vez (Rect estático con filtro,
// no animado), así que no corre por frame. Aun así, feTurbulence sobre un área
// grande puede tardar en rasterizar en el primer frame; si en algún lado se
// nota, se reemplaza por un PNG tileable detrás de esta misma API.
//
// ⚠️ Android: los filtros SVG de react-native-svg son sólidos en iOS pero pueden
// flaquear en Android. Si el grano no se ve, el fallback es un PNG de ruido.
//
// El color sale negro con alfa del ruido → oscurece el fondo como un multiply
// suave. `color` permite teñirlo si hiciera falta.
export function Grain({
  opacity = 0.16,
  baseFrequency = 0.85,
  numOctaves = 3,
  seed = 7,
}: {
  opacity?: number;
  baseFrequency?: number;
  numOctaves?: number;
  seed?: number;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id="grainFilter" x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={numOctaves}
              seed={seed}
              stitchTiles="stitch"
              result="noise"
            />
            {/* RGB → negro (0), alfa = alfa del ruido. Grano negro con densidad
                variable; la intensidad global la pone la View (opacity). */}
            <FeColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            />
          </Filter>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" filter="url(#grainFilter)" />
      </Svg>
    </View>
  );
}
