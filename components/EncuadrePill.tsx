import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import type { Encuadre } from '@/lib/credentialRules';

// La etiqueta de qué tipo de sesión es, con el ⓘ que abre la explicación.
//
// 🔴 LAS DOS VARIANTES TIENEN EL MISMO PESO. Mismo tamaño, misma forma, mismo
// ⓘ. El cartel anterior era asimétrico —escudo verde para el matriculado,
// bloque naranja de advertencia para el resto— y esa asimetría convertía una
// distinción legal en un juicio sobre la persona. Acá lo único que cambia es el
// texto y un tono de color, no la jerarquía.
//
// 🔴 EL ⓘ VA EN LAS DOS. Si apareciera solo en la variante sin matrícula, el
// ⓘ mismo pasaría a ser la marca negativa — "este necesita explicación" — y
// habríamos reconstruido el problema con un ícono en vez de un cartel.
//
// 📝 La etiqueta sola no alcanza para entender nada, y está bien que así sea:
// es el primer nivel de tres (etiqueta → sheet → Formación). Lo que tiene que
// lograr acá es que se note que hay una distinción y que se pueda tocar.

type Props = {
  encuadre: Encuadre;
  onInfo: () => void;
};

export function EncuadrePill({ encuadre, onInfo }: Props) {
  return (
    <Pressable
      style={[s.pill, encuadre.habilitado ? s.pillPro : s.pillAcomp]}
      onPress={onInfo}
      accessibilityRole="button"
      accessibilityLabel={`${encuadre.etiqueta}. Tocá para saber qué significa.`}
      hitSlop={8}
    >
      <MaterialCommunityIcons
        name={encuadre.habilitado ? 'shield-check' : 'hand-heart-outline'}
        size={13}
        color={encuadre.habilitado ? '#42542F' : '#6B7A56'}
      />
      <Text style={[s.txt, !encuadre.habilitado && s.txtAcomp]}>{encuadre.etiqueta}</Text>
      <MaterialCommunityIcons
        name="information-outline"
        size={13}
        color={encuadre.habilitado ? 'rgba(66,84,47,0.55)' : 'rgba(107,122,86,0.55)'}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: 9,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  pillPro: { backgroundColor: '#DCE5CB' },
  // Arena, no naranja de advertencia: es una categoría, no una alerta.
  pillAcomp: { backgroundColor: 'rgba(135,131,92,0.13)' },
  txt: {
    fontFamily: ViveFonts.semibold, fontSize: 11.5,
    color: '#42542F', letterSpacing: 0.15,
  },
  txtAcomp: { color: '#6B7A56' },
});
