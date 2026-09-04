import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';

// La marca de "matrícula verificada por Vita".
//
// Un componente y no cuatro copias: aparece en el buscador, en el deck de
// Conexiones, en su lista de resultados y en la confirmación de reserva. Con
// copias sueltas, la quinta superficie se olvida — y "se olvidó de mostrarlo"
// acá significa que alguien reserva sin saber si está eligiendo terapia o
// acompañamiento, que es el problema que esto vino a resolver
// (`docs/encuadre-salud-y-responsabilidad.md` §2).
//
// 🔴 Solo se renderiza cuando HAY matrícula. No existe la variante "sin
// matrícula" a propósito: en una grilla, una marca negativa en cada tarjeta se
// leería como advertencia contra profesionales que no hicieron nada mal. La
// distinción completa —qué es cada uno y qué significa— vive en el perfil, que
// es donde hay lugar para explicarla.

export function MatriculaPill({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[s.pill, compact && s.pillCompact]}>
      <MaterialCommunityIcons name="shield-check" size={compact ? 9 : 10} color="#42542F" />
      {!compact && <Text style={s.txt}>Matrícula</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#DCE5CB', borderRadius: 8,
    paddingVertical: 2, paddingHorizontal: 6,
  },
  // En el deck la tarjeta es chica y el nombre ya compite por el ancho: ahí va
  // solo el escudo. El significado lo da el perfil, a un toque de distancia.
  pillCompact: { paddingHorizontal: 3, borderRadius: 6 },
  txt: {
    fontFamily: ViveFonts.semibold, fontSize: 9.5,
    color: '#42542F', letterSpacing: 0.2,
  },
});
