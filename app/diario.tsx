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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'diario_entradas';

// ─── Types ────────────────────────────────────────────────────────────────────
type MoodLevel = 1 | 2 | 3 | 4 | 5;

interface JournalEntry {
  id: string;
  date: string;
  mood: MoodLevel;
  text: string;
  prompt: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const MOODS: { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😔', label: 'Mal' },
  { level: 2, emoji: '😕', label: 'Regular' },
  { level: 3, emoji: '😐', label: 'Neutro' },
  { level: 4, emoji: '🙂', label: 'Bien' },
  { level: 5, emoji: '😊', label: 'Muy bien' },
];

const DAILY_PROMPT = '¿Qué fue lo más importante que sentiste hoy?';

function formatToday() {
  return new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
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
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [journalText, setJournalText] = useState('');
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const { isLoggedIn, requestAuth } = useAuth();
  const saveScale = useRef(new Animated.Value(1)).current;

  const canSave = journalText.trim().length > 0;
  const words = countWords(journalText);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) setEntries(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!canSave || saved) return;
    if (!isLoggedIn) { requestAuth(); return; }

    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.95, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();

    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: formatToday(),
      mood: selectedMood ?? 3,
      text: journalText.trim(),
      prompt: DAILY_PROMPT,
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setJournalText('');
    setSelectedMood(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const entryMood = MOODS.find(m => m.level === selectedEntry?.mood);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Diario</Text>
        <Text style={s.headerDate}>{formatToday()}</Text>
      </View>
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
          {/* ── Paso 1: Check-in de ánimo ────────────────────────── */}
          <View style={s.section}>
            <Text style={s.stepLabel}>¿Cómo estás hoy?</Text>
            <View style={s.moodRow}>
              {MOODS.map(m => {
                const active = selectedMood === m.level;
                return (
                  <TouchableOpacity
                    key={m.level}
                    style={[s.moodOption, active && s.moodOptionActive]}
                    onPress={() => setSelectedMood(m.level)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.moodEmoji}>{m.emoji}</Text>
                    <Text style={[s.moodLabel, active && s.moodLabelActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Paso 2: Prompt del día ───────────────────────────── */}
          <View style={[s.section, s.promptCard]}>
            <Text style={s.quoteChar}>"</Text>
            <Text style={s.promptText}>{DAILY_PROMPT}</Text>
            <Text style={s.promptHint}>
              No hay respuesta correcta. Escribí lo que te salga.
            </Text>
          </View>

          {/* ── Paso 3: Área de escritura ────────────────────────── */}
          <View style={[s.section, s.writeCard]}>
            <TextInput
              style={s.textArea}
              value={journalText}
              onChangeText={setJournalText}
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
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={s.saveBtnText}>Guardado 🌱</Text>
                </View>
              ) : (
                <Text style={s.saveBtnText}>Guardar entrada</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── Historial ────────────────────────────────────────── */}
          {entries.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Entradas anteriores</Text>
              {entries.map(entry => {
                const mood = MOODS.find(m => m.level === entry.mood);
                const preview =
                  entry.text.length > 64
                    ? entry.text.slice(0, 64).trimEnd() + '...'
                    : entry.text;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={s.entryCard}
                    onPress={() => setSelectedEntry(entry)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.entryEmoji}>{mood?.emoji}</Text>
                    <View style={s.entryInfo}>
                      <Text style={s.entryDate}>{entry.date}</Text>
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
            <Text style={s.modalTitle}>
              {entryMood?.emoji}{'  '}{selectedEntry?.date}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={s.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.modalPromptBadge}>
              <Text style={s.modalPromptText}>{selectedEntry?.prompt}</Text>
            </View>
            <Text style={s.modalBodyText}>{selectedEntry?.text}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
  },
  headerDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}66`,
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

  // Mood check-in
  stepLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.text,
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moodOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 5,
    ...shadow,
  },
  moodOptionActive: {
    backgroundColor: `${ViveColors.primary}10`,
    borderColor: ViveColors.primary,
  },
  moodEmoji: {
    fontSize: 22,
  },
  moodLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: `${ViveColors.text}88`,
    textAlign: 'center',
  },
  moodLabelActive: {
    fontFamily: ViveFonts.medium,
    color: ViveColors.primary,
  },

  // Prompt card
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: `${ViveColors.text}0F`,
    ...shadow,
  },
  quoteChar: {
    fontFamily: ViveFonts.bold,
    fontSize: 24,
    color: ViveColors.primary,
    lineHeight: 24,
    marginBottom: 4,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    ...shadow,
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
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: {
    backgroundColor: `${ViveColors.text}22`,
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
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    ...shadow,
  },
  entryEmoji: {
    fontSize: 26,
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}0D`,
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
