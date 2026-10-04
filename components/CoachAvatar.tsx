import React, { useState } from 'react';
import { Image, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type Props = {
  uri?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * La foto del profesional en el camino de la reserva, con el ícono de persona
 * si no tiene foto o si no carga. Es `Image` de React Native y no expo-image a
 * propósito: el 01/10 la app se cerraba al abrir el perfil con expo-image y no
 * se aisló la causa. Solo acepta https, porque en la pantalla final la dirección
 * llega por la ruta y una ruta la puede armar cualquiera.
 */
export function CoachAvatar({ uri, size, style }: Props) {
  const [fallo, setFallo] = useState(false);
  const valida = !!uri && uri.startsWith('https://') && !fallo;
  const forma = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[s.base, forma, style]}>
      {valida ? (
        <Image
          source={{ uri: uri! }}
          style={forma}
          resizeMode="cover"
          onError={() => setFallo(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <MaterialIcons name="person" size={Math.round(size * 0.6)} color="rgba(135,131,92,0.80)" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
