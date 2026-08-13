// Pantalla de documentos legales — T&C, Política de Privacidad y botón de
// arrepentimiento.
//
// Fuente única: docs/*.md → constants/legal.ts (generado por `npm run sync:legal`).
// Antes esto no existía: los ítems del menú de perfil no hacían nada y el
// registro mostraba un resumen escrito a mano que no era el documento real.
//
// Ruta: /legal?doc=terminos | /legal?doc=privacidad | /legal?doc=arrepentimiento

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { TERMS_MD, PRIVACY_MD, REGRET_MD, LEGAL_IS_DRAFT } from '@/constants/legal';

const FOREST = '#3A4F2A';

export type LegalDoc = 'terminos' | 'privacidad' | 'arrepentimiento';

const DOCS: Record<LegalDoc, { title: string; body: string }> = {
  terminos:       { title: 'Términos y condiciones', body: TERMS_MD },
  privacidad:     { title: 'Política de privacidad', body: PRIVACY_MD },
  arrepentimiento:{ title: 'Botón de arrepentimiento', body: REGRET_MD },
};

export default function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  // Un `doc` desconocido cae en los Términos, igual que antes: la pantalla se
  // alcanza también desde links viejos y es preferible mostrar algo que romper.
  const { title, body } = useMemo(
    () => DOCS[(doc as LegalDoc)] ?? DOCS.terminos,
    [doc],
  );

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.headerDivider} />

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}>
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
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
  },
  headerSpacer: { width: 32 },
  headerDivider: { height: 1, backgroundColor: 'rgba(58,79,42,0.10)' },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 48 },
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
    marginBottom: 18,
  },
  draftText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#8A5A2B',
  },
});

const mdStyles = StyleSheet.create({
  body: { color: FOREST },
  heading1: { fontFamily: ViveFonts.semibold, fontSize: 20, color: FOREST, marginBottom: 10, marginTop: 8 },
  heading2: { fontFamily: ViveFonts.semibold, fontSize: 16, color: FOREST, marginBottom: 6, marginTop: 20 },
  heading3: { fontFamily: ViveFonts.medium, fontSize: 14.5, color: FOREST, marginBottom: 4, marginTop: 12 },
  paragraph: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST, lineHeight: 22, marginBottom: 12 },
  strong: { fontFamily: ViveFonts.semibold },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST, lineHeight: 22 },
  hr: { backgroundColor: 'rgba(58,79,42,0.12)', height: 1, marginVertical: 20 },
});
