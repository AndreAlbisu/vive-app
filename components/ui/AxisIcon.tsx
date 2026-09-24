import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Axis } from '@/constants/searchData';

// El ícono de cada área de bienestar (24/09/2026, pedido de Andre). Antes eran
// emojis (🌿 💭 ✨): cada sistema los dibuja distinto, no toman el color de la
// app y al lado de los íconos de línea del resto de la interfaz se veían de
// otro producto. Un solo componente para las cuatro pantallas que los usan.
export function AxisIcon({ axis, size = 16, color }: { axis: Pick<Axis, 'icon' | 'color'>; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={axis.icon} size={size} color={color ?? axis.color} />;
}
