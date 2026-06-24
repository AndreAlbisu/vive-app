import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase, ensureAnonSession } from '@/lib/supabase';
import { logError } from '@/lib/logging';

type JournalEntry = {
  id: string;
  content: string;
  mood: string | null;
  created_at: string;
};

const MOODS = [
  { emoji: '😊', key: 'bien' },
  { emoji: '🔥', key: 'genial' },
  { emoji: '😐', key: 'regular' },
  { emoji: '😔', key: 'mal' },
  { emoji: '😴', key: 'cansado' },
] as const;

const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function DiarioScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [text, setText]       = useState('');
  const [mood, setMood]       = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [userId, setUserId]   = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      setLoading(true);
      setError(null);
      const uid = await ensureAnonSession();
      setUserId(uid);
      await fetchEntries(uid);
    } catch (err) {
      await logError('DiarioScreen: init failed', err);
      setError('No se pudo conectar. Revisá tu conexión.');
      setLoading(false);
    }
  }

  async function fetchEntries(uid: string) {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('journal_entries')
      .select('id, content, mood, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (err) {
      await logError('DiarioScreen: fetchEntries failed', err);
      setError('No se pudieron cargar las entradas.');
    } else {
      setEntries(data ?? []);
      setError(null);
    }
    setLoading(false);
  }

  async function save() {
    if (!text.trim() || !userId) return;
    setSaving(true);
    Keyboard.dismiss();

    const { error: err } = await supabase.from('journal_entries').insert({
      user_id: userId,
      content: text.trim(),
      mood,
    });

    if (err) {
      await logError('DiarioScreen: save entry failed', err);
      Alert.alert('Error', 'No se pudo guardar la entrada.');
    } else {
      setText('');
      setMood(null);
      await fetchEntries(userId);
    }
    setSaving(false);
  }

  function confirmDelete(id: string) {
    Alert.alert('Eliminar entrada', '¿Querés eliminar esta entrada? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('journal_entries').delete().eq('id', id);
          if (userId) await fetchEntries(userId);
        },
      },
    ]);
  }

  function renderEntry({ item }: { item: JournalEntry }) {
    const moodEmoji = MOODS.find((m) => m.key === item.mood)?.emoji;
    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
          <View style={styles.entryHeaderRight}>
            {moodEmoji ? <Text style={styles.entryMood}>{moodEmoji}</Text> : null}
            <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={10}>
              <MaterialCommunityIcons name="trash-can-outline" size={17} color={ViveColors.text} style={{ opacity: 0.3 }} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.entryContent}>{item.content}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={ViveColors.text} />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Diario</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Compose */}
        <View style={styles.compose}>
          <TextInput
            ref={inputRef}
            style={styles.composeInput}
            value={text}
            onChangeText={setText}
            placeholder="¿Qué estás pensando hoy?"
            placeholderTextColor={`${ViveColors.text}50`}
            multiline
            maxLength={800}
            textAlignVertical="top"
          />
          <View style={styles.composeFooter}>
            {/* Mood row */}
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setMood(mood === m.key ? null : m.key)}
                  style={[styles.moodBtn, mood === m.key && styles.moodBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, (!text.trim() || saving) && styles.saveBtnDisabled]}
              onPress={save}
              disabled={!text.trim() || saving}
              activeOpacity={0.82}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ViveColors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="wifi-off" size={40} color={ViveColors.text} style={{ opacity: 0.25, marginBottom: 14 }} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={init} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="notebook-outline" size={48} color={ViveColors.primary} style={{ opacity: 0.35, marginBottom: 14 }} />
            <Text style={styles.emptyTitle}>Tu primer entrada te espera</Text>
            <Text style={styles.emptySubtitle}>Escribí lo que sentís o pensás hoy.</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.id}
            renderItem={renderEntry}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.45,
  },
  headerTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 22,
    color: ViveColors.text,
    letterSpacing: -0.3,
  },

  // Compose
  compose: {
    marginHorizontal: 18,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#1F4A43', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  composeInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    minHeight: 90,
    lineHeight: 22,
    paddingTop: 0,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 4,
  },
  moodBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  moodBtnActive: {
    backgroundColor: 'rgba(232,116,59,0.12)',
  },
  moodEmoji: {
    fontSize: 20,
  },
  saveBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 38,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  divider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
    marginHorizontal: 20,
    marginVertical: 14,
  },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  errorText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    opacity: 0.5,
    textAlign: 'center',
  },

  // Entry list
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 12,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#1F4A43', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.text,
    opacity: 0.45,
    letterSpacing: 0.2,
  },
  entryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryMood: {
    fontSize: 17,
  },
  entryContent: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 21,
  },
});
