import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';

// Pastilla chica bajo el header de una herramienta. El criterio es distinto por
// herramienta a propósito (Gratitud: días seguidos; Diario: entradas del mes),
// así que el texto y el ícono los decide quien la usa.
//
// Degrada sin romper: si quien la usa no tiene el dato (valor null/0), no la
// renderiza — acá no se decide eso, se decide afuera.
export function RachaPill({
  icon,
  label,
  color,
  tint,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;       // color del ícono y el texto
  tint: string;        // fondo (versión translúcida del color)
}) {
  return (
    <View style={[styles.pill, { backgroundColor: tint }]}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
  },
});
