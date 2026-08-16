import Svg, { Circle } from 'react-native-svg';

/**
 * Marca de tres círculos superpuestos — el isotipo de Vita.
 *
 * ⚠️ Es el **borrador** del logo, no una decisión cerrada. Hoy conviven dos
 * marcas que no coinciden: estos tres círculos y `VitaWordmark` (la palabra
 * "vita" en Fraunces minúscula), que dice ser el único wordmark de la app.
 * Está anotado como pendiente de diseño desde la sesión 90 y forma parte del
 * encargo al estudio. Acá se usa como decoración: si el logo final es otro,
 * se reemplaza este archivo y nada más.
 *
 * Dibujado en SVG y no como imagen para que escale sin pixelarse y para poder
 * teñirlo desde afuera con `color`.
 */
export function VitaMark({ size = 54, color = 'rgba(120,116,86,0.55)', strokeWidth = 1.4 }: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  // Tres círculos en triángulo, solapados en el centro. El radio (30) contra el
  // desplazamiento (~17) es lo que define cuánto se pisan: más chico el
  // desplazamiento, más se superponen.
  const R = 30;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="36" r={R} stroke={color} strokeWidth={strokeWidth * (100 / size)} fill="none" />
      <Circle cx="35" cy="61" r={R} stroke={color} strokeWidth={strokeWidth * (100 / size)} fill="none" />
      <Circle cx="65" cy="61" r={R} stroke={color} strokeWidth={strokeWidth * (100 / size)} fill="none" />
    </Svg>
  );
}
