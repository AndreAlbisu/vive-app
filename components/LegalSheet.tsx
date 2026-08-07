// LegalSheet — hoja inferior con el texto legal completo (T&C o Privacidad).
//
// Muestra el MISMO documento que /legal, desde constants/legal.ts. Existe aparte
// de la pantalla porque en el registro el usuario tiene que poder leerlo sin
// perder el formulario a medio llenar, y porque el botón de cierre confirma la
// aceptación del checkbox.

import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { TERMS_MD, PRIVACY_MD, LEGAL_IS_DRAFT } from '@/constants/legal';

const FOREST = '#3A4F2A';

interface Props {
  visible: boolean;
  doc: 'terminos' | 'privacidad';
  onClose: () => void;
  /** Botón de cierre. Por defecto "Entendido" y solo cierra. */
  acceptLabel?: string;
  onAccept?: () => void;
}

export default function LegalSheet({ visible, doc, onClose, acceptLabel = 'Entendido', onAccept }: Props) {
  const isPrivacy = doc === 'privacidad';
  const title = isPrivacy ? 'Política de privacidad' : 'Términos y condiciones';
  const body = isPrivacy ? PRIVACY_MD : TERMS_MD;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color="rgba(135,131,92,0.80)" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
            {LEGAL_IS_DRAFT && (
              <View style={s.draftBanner}>
                <MaterialCommunityIcons name="alert-outline" size={16} color="#8A5A2B" />
                <Text style={s.draftText}>
                  Borrador pendiente de revisión legal. Los campos entre corchetes todavía
                  no están completos.
                </Text>
              </View>
            )}
            <Markdown style={mdStyles as any}>{body}</Markdown>
          </ScrollView>

          <TouchableOpacity
            style={s.btn}
            onPress={() => { onAccept?.(); onClose(); }}
            activeOpacity={0.85}>
            <Text style={s.btnText}>{acceptLabel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: ViveColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '82%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: ViveFonts.semibold, fontSize: 18, color: '#565E32', letterSpacing: -0.3 },
  body: { marginBottom: 16 },
  bodyContent: { paddingBottom: 8 },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(193,105,79,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  draftText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: '#8A5A2B' },
  btn: { backgroundColor: '#565E32', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F7EFE4' },
});

const mdStyles = StyleSheet.create({
  body: { color: FOREST },
  heading1: { fontFamily: ViveFonts.semibold, fontSize: 18, color: FOREST, marginBottom: 8, marginTop: 4 },
  heading2: { fontFamily: ViveFonts.semibold, fontSize: 15, color: FOREST, marginBottom: 5, marginTop: 18 },
  heading3: { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST, marginBottom: 4, marginTop: 10 },
  paragraph: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST, lineHeight: 21, marginBottom: 11 },
  strong: { fontFamily: ViveFonts.semibold },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 11 },
  ordered_list: { marginBottom: 11 },
  list_item: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST, lineHeight: 21 },
  hr: { backgroundColor: 'rgba(58,79,42,0.12)', height: 1, marginVertical: 18 },
});
