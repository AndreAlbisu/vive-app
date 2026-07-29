import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';

const FOREST = '#3A4F2A';

// Header compartido por las 4 pantallas de herramientas (Respiración, Sonidos
// ambientales, Gratitud, Diario) — antes cada una tenía su propio header
// copiado del archivo original, con el título centrado en unas y pegado al
// chevron en otras (y distinta tipografía). Un solo componente para que no
// puedan volver a divergir. `right` es el único slot que cambia por tipo de
// herramienta: campana+bookmark en las de sesión, pill de fecha en las de
// registro diario (Ajuste 1, rediseño sesión 76).
export function ToolHeader({
  title,
  onBack,
  right,
}: {
  // Respiración y Sonidos ambientales sacaron el título del header y lo
  // bajaron como encabezado propio dentro del contenido ("Respiración
  // cuadrada" / "Sonidos ambientales", justo arriba del texto) — el header
  // les queda solo con back + right. Gratitud/Diario lo siguen mostrando acá.
  title?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <View style={s.left}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={FOREST} />
        </TouchableOpacity>
        {title && <Text style={s.title} numberOfLines={1}>{title}</Text>}
      </View>
      {right && <View style={s.right}>{right}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  backBtn: { padding: 2 },
  title: {
    fontFamily: ViveFonts.bold,
    fontSize: 20,
    color: FOREST,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
  },
});
