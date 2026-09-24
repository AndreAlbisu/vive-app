import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';

// Un menú de opciones desde abajo.
//
// 🔴 Existe porque `Alert.alert` con botones es un menú que en Android se corta
// en TRES: los que sobran no se muestran y no hay error. "Opciones de la sesión"
// pasó de 3 a 5 opciones el 23/09/2026 (ver el pago, tengo un problema), y en
// Android habrían desaparecido justo las nuevas.

export type Opcion = { text: string; onPress: () => void; destructive?: boolean };

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  opciones: Opcion[];
}

export default function OpcionesSheet({ visible, onClose, title, subtitle, opciones }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.flex}>
        <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={sheetStyles.sheet}>
          <View style={sheetStyles.handle} />
          <Text style={s.title}>{title}</Text>
          {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          {opciones.map(o => (
            <TouchableOpacity
              key={o.text}
              style={s.opcion}
              // Se cierra primero: la opción suele abrir otra hoja o navegar, y
              // dos modales a la vez en iOS se pisan.
              onPress={() => { onClose(); setTimeout(o.onPress, 250); }}
              activeOpacity={0.8}
              accessibilityRole="button">
              <Text style={[s.opcionText, o.destructive && s.destructive]}>{o.text}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.volver} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.volverText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: ViveFonts.title, fontSize: 20, color: '#3A4F2A', marginBottom: 6 },
  subtitle: { fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19, color: '#87835C', marginBottom: 10 },
  opcion: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
  },
  opcionText: { fontFamily: ViveFonts.medium, fontSize: 15, color: '#3A4F2A' },
  destructive: { color: '#B4533E' },
  volver: { paddingTop: 16, alignItems: 'center' },
  volverText: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#87835C' },
});
