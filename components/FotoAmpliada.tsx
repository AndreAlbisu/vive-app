import { Modal, View, Image, Pressable, StatusBar, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// La foto de perfil, en grande.
//
// En la portada la imagen va recortada a sangre —`cover` sobre un contenedor
// más ancho que alto— así que de un retrato se ve una franja. Acá se muestra
// ENTERA (`contain`): es la única pantalla donde se ve la foto tal cual la
// subió la persona.
//
// 📝 Fondo casi negro y no el crema de la app: con `contain` sobran márgenes
// arriba y abajo, y sobre un fondo claro esas bandas compiten con la foto. Es
// además lo que espera cualquiera que abrió una imagen en cualquier app.
//
// ⚠️ Se cierra tocando en cualquier lado, no solo en la X. La X está igual
// porque tocar-para-cerrar es una convención que no se anuncia sola, y quien no
// la conoce se queda sin salida visible.

type Props = {
  uri: string | null;
  onCerrar: () => void;
};

export function FotoAmpliada({ uri, onCerrar }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onCerrar}>
      {/* Iconos claros: el fondo de esta pantalla es oscuro y el resto de la
          app va en `dark-content`. Al cerrarse, cada pantalla restaura el suyo. */}
      <StatusBar barStyle="light-content" />
      <Pressable style={s.backdrop} onPress={onCerrar} accessibilityLabel="Cerrar la foto">
        {!!uri && <Image source={{ uri }} style={s.foto} resizeMode="contain" />}

        <Pressable
          style={[s.cerrar, { top: insets.top + 8 }]}
          onPress={onCerrar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <MaterialIcons name="close" size={22} color="#FFF8EF" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,16,12,0.97)' },
  foto: { flex: 1, width: '100%' },
  cerrar: {
    position: 'absolute', right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
});
