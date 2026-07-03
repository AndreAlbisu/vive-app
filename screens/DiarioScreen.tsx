import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Keyboard, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase, ensureAnonSession } from '@/lib/supabase';
import { logError } from '@/lib/logging';
import { AppBg } from '@/components/ui/AppBg';
import { recordCompletion } from '@/lib/resourceCompletions';

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
      recordCompletion(userId, 'diario').catch(() => {});
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
              <MaterialCommunityIcons name="trash-can-outline" size={17} color="rgba(135,131,92,0.52)" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.entryContent}>{item.content}</Text>
      </View>
    );
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
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
              placeholderTextColor="rgba(135,131,92,0.45)"
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
              <ActivityIndicator size="large" color="#87835C" />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="wifi-off" size={40} color="rgba(135,131,92,0.52)" style={{ marginBottom: 14 }} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={init} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="notebook-outline" size={48} color="rgba(135,131,92,0.52)" style={{ marginBottom: 14 }} />
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
    </AppBg>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

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
    color: 'rgba(135,131,92,0.80)',
  },
  headerTitle: {
    fontFamily: ViveFonts.bold,
    fontSize: 22,
    color: '#565E32',
    letterSpacing: -0.3,
  },

  // Compose
  compose: {
    marginHorizontal: 18,
    marginBottom: 4,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
  },
  composeInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
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
  moodRow: { flexDirection: 'row', gap: 4 },
  moodBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  moodBtnActive: {
    backgroundColor: 'rgba(255,248,240,0.62)',
  },
  moodEmoji: { fontSize: 20 },
  saveBtn: {
    backgroundColor: '#565E32',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 38,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#F7EFE4',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(86,94,50,0.12)',
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
    color: '#87835C',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,248,240,0.65)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  retryBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
  emptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.80)',
    textAlign: 'center',
  },

  // Entry list
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 12,
  },
  entryCard: {
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    padding: 16,
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
    color: 'rgba(135,131,92,0.68)',
    letterSpacing: 0.2,
  },
  entryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryMood: { fontSize: 17 },
  entryContent: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
  },
});
