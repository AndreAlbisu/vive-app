import { StyleSheet } from 'react-native';
import { ViveFonts } from './theme';

// Estilo compartido del header de las pestañas Profesionales, Recursos y
// Mensajes, para que no se desalineen. Los valores salen EXACTOS del saludo de
// Inicio (`app/(tabs)/index.tsx` → `greetingLine1`, la línea aprobada como
// referencia): Plus Jakarta Sans bold, 30px, verde oliva #565E32, lineHeight 38.
// ⚠️ NO tocar Inicio — este archivo solo lo replica para los otros tres.
export const screenHeader = StyleSheet.create({
  title: {
    fontFamily: ViveFonts.title,   // Plus Jakarta Sans 700
    fontSize: 30,
    color: '#565E32',
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: ViveFonts.regular, // Poppins 400
    fontSize: 15,
    color: '#7A8277',
    marginTop: 1,   // pegado al título (Joaquín, 15/10: subirlo un toque más)
    lineHeight: 21,
  },
});
