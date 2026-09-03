import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, ViveMoodColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useConsentGate } from '@/hooks/useConsentGate';
import { ConsentSheet } from '@/components/ConsentSheet';
import { supabase } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

// ─── Types ────────────────────────────────────────────────────────────────────
interface JournalEntry {
  id: string;
  mood: number;
  content: string;
  created_at: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const DAILY_PROMPT = '¿Qué fue lo más importante que sentiste hoy?';

// Pregunta del espacio de escritura, dinámica según el mood_id del check-in
// de hoy (mismos niveles que ViveMoodColors: 1=Bajón..5=Brillando). Si no
// hay check-in de hoy, se usa MOOD_PROMPT_DEFAULT.
const MOOD_PROMPTS: Record<number, string> = {
  1: 'Hoy venís con un bajón. ¿Qué es lo que más te está pesando? Soltalo acá, sin filtro.',
  2: 'Se nota que estás cansado. ¿Qué te está drenando la energía estos días?',
  3: 'Un día tranquilo. ¿Qué anduvo dando vueltas por tu cabeza hoy?',
  4: 'Venís bien hoy. ¿Qué fue lo que sumó para sentirte así?',
  5: '¡Hoy estás brillando! ¿Qué hizo especial este día? Dejalo guardado acá.',
};
const MOOD_PROMPT_DEFAULT = 'Este es tu espacio seguro. Escribí lo que necesites descargar, sin juzgarte.';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function formatTodayShort() {
  return new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ─── Shadow ───────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiarioScreen() {
  useRecursoAbierto('diario');
  const router = useRouter();
  const [journalText, setJournalText] = useState('');
  const [textFocused, setTextFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const historyRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { user, isLoggedIn, requestAuth } = useAuth();
  // El diario y la gratitud son texto libre sobre cómo está la persona: dato
  // sensible del art. 7 igual que el check-in de ánimo. El gate va antes de
  // escribir, no después.
  const consentGate = useConsentGate(user?.id);
  const saveScale = useRef(new Animated.Value(1)).current;

  const canSave = journalText.trim().length > 0;
  const words = countWords(journalText);

  // Mood del día — lee la misma fuente que el check-in de Inicio (mood_entries),
  // Diario ya no pregunta su propio mood (Ajuste 5, evita duplicar el check-in).
  const { entries: moodEntries } = useMoodHistory(user?.id, 1);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMoodEntry = moodEntries.find(e => e.entry_date === todayStr);
  const writingPrompt = todayMoodEntry
    ? (MOOD_PROMPTS[todayMoodEntry.mood_id] ?? MOOD_PROMPT_DEFAULT)
    : MOOD_PROMPT_DEFAULT;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setEntries(data);
      });
  }, [user]);

  async function handleSave() {
    if (!canSave || saved) return;
    if (!isLoggedIn || !user) { requestAuth('guardar_diario'); return; }

    // Antes de la animación a propósito: si dice que no, el botón no tiene que
    // haber hecho el gesto de guardar algo que no se guardó.
    if (!(await consentGate.pedir())) return;

    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.95, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        mood: todayMoodEntry?.mood_id ?? 3,
        content: journalText.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setEntries(prev => [data, ...prev]);
      // Diario es "libre" (sin duración) → completación sin duration_seconds.
      recordCompletion(user.id, 'diario').catch(() => {});
    }

    setJournalText('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function scrollToHistory() {
    historyRef.current?.measureLayout(
      // @ts-ignore — measureLayout típa el arg como número de nodo nativo
      scrollRef.current,
      (_x: number, y: number) => scrollRef.current?.scrollTo({ y, animated: true }),
      () => {}
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <ToolHeader
        title="Diario"
        onBack={() => router.back()}
        right={<Text style={s.datePillText}>{formatTodayShort()}</Text>}
      />
      <View style={s.headerDivider} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Mood del día — lee el check-in de Inicio, no repregunta ── */}
          <View style={s.section}>
            {todayMoodEntry ? (
              <View style={s.moodSummaryRow}>
                <View style={[s.moodDot, { backgroundColor: ViveMoodColors[todayMoodEntry.mood_id] }]} />
                <View style={s.moodSummaryInfo}>
                  <Text style={s.moodSummaryLabel}>Hoy registraste</Text>
                  <Text style={s.moodSummaryValue}>{todayMoodEntry.mood_label}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)')} hitSlop={8}>
                  <Text style={s.moodChangeLink}>Cambiar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.moodInviteRow}>
                <MaterialCommunityIcons name="bell-outline" size={18} color="#C1694F" />
                <Text style={s.moodInviteText}>Todavía no contaste cómo venís hoy.</Text>
                <TouchableOpacity style={s.moodInviteBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
                  <Text style={s.moodInviteBtnText}>Registrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Prompt del día ───────────────────────────── */}
          <View style={[s.section, s.promptCard]}>
            <View style={s.promptIconWrap}>
              <MaterialCommunityIcons name="creation" size={16} color={ViveColors.primary} />
            </View>
            <Text style={s.promptText}>{writingPrompt}</Text>
            <Text style={s.promptHint}>
              No hay respuesta correcta. Escribí lo que te salga.
            </Text>
          </View>

          {/* ── Área de escritura ────────────────────────── */}
          <View style={[s.section, s.writeCard, textFocused && s.writeCardFocused]}>
            <TextInput
              style={s.textArea}
              value={journalText}
              onChangeText={setJournalText}
              onFocus={() => setTextFocused(true)}
              onBlur={() => setTextFocused(false)}
              placeholder="Empezá por donde quieras..."
              placeholderTextColor={`${ViveColors.text}66`}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={s.wordCount}>
              {words} {words === 1 ? 'palabra' : 'palabras'}
            </Text>
          </View>

          {/* ── Botón guardar ────────────────────────────────────── */}
          <Animated.View style={{ transform: [{ scale: saveScale }], marginBottom: 32 }}>
            <TouchableOpacity
              style={[
                s.saveBtn,
                !canSave && !saved && s.saveBtnDisabled,
                saved && s.saveBtnSaved,
              ]}
              onPress={handleSave}
              disabled={!canSave || saved}
              activeOpacity={0.85}
            >
              {saved ? (
                <View style={s.savedRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color="#F7EFE4" />
                  <Text style={s.saveBtnText}>Guardado</Text>
                </View>
              ) : (
                <Text style={[s.saveBtnText, !canSave && s.saveBtnTextDisabled]}>Guardar entrada</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── Historial ────────────────────────────────────────── */}
          <View ref={historyRef} collapsable={false}>
            {entries.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Entradas anteriores</Text>
                {entries.map(entry => {
                  const moodColor = ViveMoodColors[entry.mood];
                  const preview =
                    entry.content.length > 64
                      ? entry.content.slice(0, 64).trimEnd() + '...'
                      : entry.content;
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={s.entryCard}
                      onPress={() => setSelectedEntry(entry)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.entryMoodDot, moodColor && { backgroundColor: moodColor }]} />
                      <View style={s.entryInfo}>
                        <Text style={s.entryDate}>{formatDate(entry.created_at)}</Text>
                        <Text style={s.entryPreview}>{preview}</Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color={`${ViveColors.text}44`}
                      />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>

          {entries.length > 0 && (
            <TouchableOpacity onPress={scrollToHistory} hitSlop={8} style={s.historyLink}>
              <Text style={s.historyLinkText}>Tus últimas entradas</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#C1694F" />
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal: Entrada completa ──────────────────────────────── */}
      <Modal
        visible={selectedEntry !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <SafeAreaView style={s.modalSafe} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedEntry(null)}
              style={s.modalCloseBtn}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close" size={22} color={ViveColors.text} />
            </TouchableOpacity>
            {selectedEntry && ViveMoodColors[selectedEntry.mood] && (
              <View style={[s.entryMoodDot, { backgroundColor: ViveMoodColors[selectedEntry.mood] }]} />
            )}
            <Text style={s.modalTitle}>
              {selectedEntry ? formatDate(selectedEntry.created_at) : ''}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={s.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.modalPromptBadge}>
              <Text style={s.modalPromptText}>{DAILY_PROMPT}</Text>
            </View>
            <Text style={s.modalBodyText}>{selectedEntry?.content}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ConsentSheet {...consentGate.sheetProps} />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  flex: { flex: 1 },

  // Header — layout compartido en ToolHeader; acá solo queda el contenido del slot `right`
  datePillText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },

  // Scroll
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  section: {
    marginBottom: 20,
  },

  // Mood del día (resumen de solo lectura o invitación a registrar)
  moodSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    ...shadow,
  },
  moodDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  moodSummaryInfo: { flex: 1 },
  moodSummaryLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}80`,
  },
  moodSummaryValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
  },
  moodChangeLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#C1694F',
  },
  moodInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(193,105,79,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.20)',
    padding: 14,
  },
  moodInviteText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 18,
  },
  moodInviteBtn: {
    backgroundColor: '#C1694F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  moodInviteBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#F7EFE4',
  },

  // Prompt card
  promptCard: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    ...shadow,
  },
  promptIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${ViveColors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promptText: {
    fontFamily: ViveFonts.medium,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  promptHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}80`,
    lineHeight: 18,
  },

  // Write area
  writeCard: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.25)',
    padding: 16,
    ...shadow,
  },
  writeCardFocused: {
    borderColor: '#C1694F',
  },
  textArea: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 24,
    minHeight: 180,
    textAlignVertical: 'top',
    padding: 0,
  },
  wordCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}55`,
    textAlign: 'right',
    marginTop: 10,
  },

  // Save button
  saveBtn: {
    backgroundColor: ViveColors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: {
    backgroundColor: '#EAE2D0',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  saveBtnSaved: {
    backgroundColor: ViveColors.accent,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.accent,
        shadowOpacity: 0.28,
      },
      android: { elevation: 4 },
    }),
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F7EFE4',
  },
  saveBtnTextDisabled: {
    color: 'rgba(86,94,50,0.40)',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // History
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
  },
  entryCard: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    ...shadow,
  },
  entryMoodDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: `${ViveColors.text}88`,
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  entryPreview: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 19,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  historyLinkText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#C1694F',
  },

  // Modal
  modalSafe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F7EFE4',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
    gap: 12,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
  },
  modalContent: {
    padding: 24,
    gap: 20,
  },
  modalPromptBadge: {
    backgroundColor: `${ViveColors.primary}15`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalPromptText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
    lineHeight: 20,
  },
  modalBodyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 26,
  },
});
