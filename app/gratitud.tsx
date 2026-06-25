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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GratitudeEntry {
  id: string;
  item_1: string;
  item_2: string;
  item_3: string;
  created_at: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PLACEHOLDERS: [string, string, string] = [
  'Algo que pasó hoy...',
  'Alguien que te importa...',
  'Algo simple que disfrutaste...',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function formatToday() {
  return new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
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
export default function GratitudScreen() {
  const router = useRouter();
  const [items, setItems] = useState<[string, string, string]>(['', '', '']);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);

  const { user, isLoggedIn, requestAuth } = useAuth();
  const saveScale = useRef(new Animated.Value(1)).current;

  const canSave = items.some(i => i.trim().length > 0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('gratitude_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setEntries(data);
      });
  }, [user]);

  function updateItem(index: 0 | 1 | 2, value: string) {
    setItems(prev => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || saved) return;
    if (!isLoggedIn || !user) { requestAuth(); return; }

    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.95, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();

    const { data, error } = await supabase
      .from('gratitude_entries')
      .insert({
        user_id: user.id,
        item_1: items[0].trim(),
        item_2: items[1].trim(),
        item_3: items[2].trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setEntries(prev => [data, ...prev]);
    }

    setItems(['', '', '']);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gratitud</Text>
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
          {/* ── Intro ────────────────────────────────────────────── */}
          <View style={s.intro}>
            <Text style={s.introEmoji}>🙏</Text>
            <Text style={s.introTitle}>¿Por qué estás agradecido hoy?</Text>
            <Text style={s.introSubtitle}>
              Tres cosas, grandes o pequeñas.{'\n'}Lo que importa es que sean tuyas.
            </Text>
          </View>

          {/* ── Campos de gratitud ───────────────────────────────── */}
          {([0, 1, 2] as const).map(i => (
            <View key={i} style={s.fieldCard}>
              <Text style={s.fieldNumber}>{i + 1}</Text>
              <TextInput
                style={s.fieldInput}
                value={items[i]}
                onChangeText={v => updateItem(i, v)}
                placeholder={PLACEHOLDERS[i]}
                placeholderTextColor={`${ViveColors.text}55`}
                multiline
                textAlignVertical="top"
                maxLength={300}
              />
            </View>
          ))}

          {/* ── Botón guardar ────────────────────────────────────── */}
          <Animated.View style={[s.saveBtnWrap, { transform: [{ scale: saveScale }] }]}>
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
              <Text style={s.saveBtnText}>
                {saved ? '✓ Guardado. Gracias por tomarte este momento 🌱' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Historial ────────────────────────────────────────── */}
          {entries.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Entradas anteriores</Text>
              {entries.map(entry => {
                const displayItems = [entry.item_1, entry.item_2, entry.item_3];
                return (
                  <View key={entry.id} style={s.entryCard}>
                    <Text style={s.entryDate}>{formatDate(entry.created_at)}</Text>
                    {displayItems.map((item, idx) =>
                      item ? (
                        <View key={idx} style={s.entryRow}>
                          <Text style={s.entryBullet}>{idx + 1}</Text>
                          <Text style={s.entryText}>{item}</Text>
                        </View>
                      ) : null
                    )}
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  backIcon: {
    fontSize: 22,
    color: ViveColors.text,
    lineHeight: 26,
  },
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
    paddingTop: 32,
  },

  // Intro
  intro: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  introEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  introTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 20,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  introSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}99`,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Gratitude fields
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 12,
    ...shadow,
  },
  fieldNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 22,
    color: ViveColors.primary,
    lineHeight: 28,
    width: 22,
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 23,
    minHeight: 52,
    padding: 0,
    textAlignVertical: 'top',
  },

  // Save button
  saveBtnWrap: {
    marginTop: 8,
    marginBottom: 36,
  },
  saveBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 10,
    gap: 8,
    ...shadow,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: `${ViveColors.text}88`,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  entryBullet: {
    fontFamily: ViveFonts.bold,
    fontSize: 12,
    color: ViveColors.primary,
    lineHeight: 20,
    width: 14,
    flexShrink: 0,
  },
  entryText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 20,
  },
});
