import { StyleSheet } from 'react-native';

// Primitivas compartidas de los bottom-sheets (ReportSheet, SessionNotesSheet).
// Se extrajeron para no duplicar el mismo scaffold en cada hoja. Los estilos
// específicos (título, inputs, botón) siguen en cada componente.
export const sheetStyles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#F7EFE4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(86,94,50,0.20)',
    alignSelf: 'center',
    marginBottom: 16,
  },
});
