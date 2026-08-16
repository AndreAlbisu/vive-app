import Svg, { Circle } from 'react-native-svg';

/**
 * Isotipo de Vita — tres círculos superpuestos en trébol.
 *
 * Geometría tomada de la imagen de referencia: un círculo arriba y dos abajo,
 * con los centros en triángulo y un solapamiento tal que los tres se cruzan en
 * una región chica al medio. Las proporciones (radio contra separación de
 * centros) son las de la referencia, no una aproximación a ojo.
 *
 * `strokeWidth` está en unidades del viewBox, así que el trazo **escala con la
 * marca**: a 24px y a 200px se ve igual de proporcionado. Es lo que se espera
 * de un logo — la versión anterior lo mantenía en píxeles fijos, que engorda el
 * trazo al achicar y lo afina al agrandar.
 *
 * ⚠️ **El logo NO está cerrado.** Sigue en pie el conflicto con `VitaWordmark`
 * (la palabra "vita" en Fraunces minúscula, que dice ser el único wordmark de
 * la app) y es parte del encargo al estudio de diseño. Todo lo que dibuja la
 * marca vive en este archivo: si cambia, se reemplaza acá y nada más.
 */
export function VitaMark({
  size = 54,
  color = '#4B4B2C',
  strokeWidth = 4,
}: {
  size?: number;
  /** Color del trazo. */
  color?: string;
  /** Grosor en unidades del viewBox (100 = ancho de la marca). Escala con `size`. */
  strokeWidth?: number;
}) {
  // Radio y centros en un viewBox de 100, derivados de la referencia:
  // separación horizontal entre los dos de abajo = 41 contra un diámetro de 52,
  // o sea que se pisan bastante — de ahí la región llena del centro.
  const R = 26;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50"   cy="34" r={R} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx="29.5" cy="66" r={R} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx="70.5" cy="66" r={R} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
