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

type GratitudeEntry = {
  id: string;
  content: string;
  created_at: string;
};

const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function GratitudScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [text, setText]       = useState('');
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
    } catch {
      setError('No se pudo conectar. Revisá tu conexión.');
      setLoading(false);
    }
  }

  async function fetchEntries(uid: string) {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('gratitude_entries')
      .select('id, content, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (err) {
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

    const { error: err } = await supabase.from('gratitude_entries').insert({
      user_id: userId,
      content: text.trim(),
    });

    if (err) {
      Alert.alert('Error', 'No se pudo guardar la entrada.');
    } else {
      setText('');
      await fetchEntries(userId);
    }
    setSaving(false);
  }

  function confirmDelete(id: string) {
    Alert.alert('Eliminar', '¿Eliminás esta entrada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('gratitude_entries').delete().eq('id', id);
          if (userId) await fetchEntries(userId);
        },
      },
    ]);
  }

  function renderEntry({ item, index }: { item: GratitudeEntry; index: number }) {
    const accent = index % 2 === 0 ? ViveColors.accent : ViveColors.calm;
    return (
      <View style={styles.entryCard}>
        <View style={[styles.entryDot, { backgroundColor: accent }]} />
        <View style={styles.entryBody}>
          <Text style={styles.entryContent}>{item.content}</Text>
          <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={10} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={17} color={ViveColors.text} style={{ opacity: 0.28 }} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={ViveColors.text} />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gratitud</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Prompt */}
        <View style={styles.promptArea}>
          <Text style={styles.promptTitle}>¿Por qué estás agradecido hoy?</Text>
          <Text style={styles.promptSub}>Anotá algo, por pequeño que sea.</Text>
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Hoy estoy agradecido por…"
            placeholderTextColor={`${ViveColors.text}50`}
            returnKeyType="done"
            onSubmitEditing={save}
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.addBtn, (!text.trim() || saving) && styles.addBtnDisabled]}
            onPress={save}
            disabled={!text.trim() || saving}
            activeOpacity={0.82}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialCommunityIcons name="plus" size={22} color="#fff" />}
          </TouchableOpacity>
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
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>Comenzá tu lista de gratitud</Text>
            <Text style={styles.emptySubtitle}>Escribí algo por lo que estés agradecido hoy.</Text>
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

  // Prompt
  promptArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  promptTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 20,
    color: ViveColors.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  promptSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.5,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 18,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    ...Platform.select({
      ios: { shadowColor: '#1F4A43', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  addBtnDisabled: {
    opacity: 0.4,
  },

  divider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
    marginHorizontal: 20,
    marginVertical: 16,
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
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 14,
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
    gap: 10,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#1F4A43', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },
  entryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  entryBody: {
    flex: 1,
    gap: 4,
  },
  entryContent: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.text,
    opacity: 0.4,
  },
  deleteBtn: {
    marginTop: 2,
    flexShrink: 0,
  },
});
