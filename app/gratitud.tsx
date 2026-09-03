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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { PASTEL_SALVIA, PASTEL_DURAZNO } from '@/constants/tools';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useAuth } from '@/context/AuthContext';
import { useConsentGate } from '@/hooks/useConsentGate';
import { ConsentSheet } from '@/components/ConsentSheet';
import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/logging';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

const CREAM_DEEP = '#EAE2D0';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GratitudeEntry {
  id: string;
  item_1: string;
  item_2: string;
  item_3: string;
  created_at: string;
}

// Ícono + color por campo (ver PLACEHOLDERS) — mismo lenguaje visual que los
// cards pastel de Sonidos/Recursos, rediseño herramientas sesión 76.
const FIELD_META: { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string }[] = [
  { icon: 'clock-outline',   bg: PASTEL_DURAZNO },
  { icon: 'account-outline', bg: PASTEL_SALVIA },
  { icon: 'leaf',            bg: CREAM_DEEP },
];

// ─── Data ─────────────────────────────────────────────────────────────────────
const PLACEHOLDERS: [string, string, string] = [
  'Algo que pasó hoy...',
  'Alguien que te importa...',
  'Algo simple que disfrutaste...',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function formatTodayShort() {
  return new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '');
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
  useRecursoAbierto('gratitud');
  const router = useRouter();
  const [items, setItems] = useState<[string, string, string]>(['', '', '']);
  const [focused, setFocused] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [streak, setStreak] = useState(0);

  const { user, isLoggedIn, requestAuth } = useAuth();
  // Mismo criterio que el diario y el check-in: es dato sensible, así que el
  // consentimiento va antes de guardar.
  const consentGate = useConsentGate(user?.id);
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

  // Racha de Gratitud: no hay streak propio en la tabla — se calcula sobre
  // resource_completions (resource_id='gratitud'), mismo algoritmo que
  // useResourceProgress pero acotado a esta herramienta. Sin migración nueva.
  useEffect(() => {
    if (!user) return;
    const from = new Date();
    from.setDate(from.getDate() - 30);
    supabase
      .from('resource_completions')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('resource_id', 'gratitud')
      .gte('completed_at', from.toISOString())
      .then(({ data }) => {
        const dates = new Set((data ?? []).map(r => (r.completed_at as string).split('T')[0]));
        let s = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (dates.has(d.toISOString().split('T')[0])) s++;
          else break;
        }
        setStreak(s);
      });
  }, [user, saved]);

  function updateItem(index: 0 | 1 | 2, value: string) {
    setItems(prev => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function setFieldFocused(index: 0 | 1 | 2, value: boolean) {
    setFocused(prev => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || saved) return;
    if (!isLoggedIn || !user) { requestAuth('guardar_gratitud'); return; }

    // Antes de la animación a propósito: si dice que no, el botón no tiene que
    // haber hecho el gesto de guardar algo que no se guardó.
    if (!(await consentGate.pedir())) return;

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

    if (error || !data) {
      await logError('GratitudScreen: save entry failed', error);
      Alert.alert('Error', 'No se pudo guardar tu gratitud. Intentá de nuevo');
      return;
    }

    setEntries(prev => [data, ...prev]);
    recordCompletion(user.id, 'gratitud', 300).catch(() => {});

    setItems(['', '', '']);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <ToolHeader
        title="Gratitud"
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
          {/* ── Intro ────────────────────────────────────────────── */}
          <View style={s.intro}>
            <View style={s.introIconWrap}>
              <MaterialCommunityIcons name="heart-outline" size={26} color="#C1694F" />
            </View>
            <Text style={s.introTitle}>¿Por qué estás agradecido hoy?</Text>
            <Text style={s.introSubtitle}>
              Tres cosas, grandes o pequeñas.{'\n'}Lo que importa es que sean tuyas.
            </Text>
            {streak > 0 && (
              <View style={s.streakPill}>
                <MaterialCommunityIcons name="fire" size={14} color="#C1694F" />
                <Text style={s.streakText}>{streak} {streak === 1 ? 'día seguido' : 'días seguidos'}</Text>
              </View>
            )}
          </View>

          {/* ── Campos de gratitud ───────────────────────────────── */}
          {([0, 1, 2] as const).map(i => (
            <View key={i} style={[s.fieldCard, focused[i] && s.fieldCardFocused]}>
              <View style={[s.fieldIconWrap, { backgroundColor: FIELD_META[i].bg }]}>
                <MaterialCommunityIcons name={FIELD_META[i].icon} size={17} color={ViveColors.primary} />
              </View>
              <TextInput
                style={s.fieldInput}
                value={items[i]}
                onChangeText={v => updateItem(i, v)}
                onFocus={() => setFieldFocused(i, true)}
                onBlur={() => setFieldFocused(i, false)}
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
              {saved ? (
                <View style={s.savedRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color="#F7EFE4" />
                  <Text style={s.saveBtnText}>Guardado. Gracias por tomarte este momento</Text>
                </View>
              ) : (
                <Text style={[s.saveBtnText, !canSave && s.saveBtnTextDisabled]}>Guardar</Text>
              )}
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
    paddingTop: 32,
  },

  // Intro
  intro: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  introIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(193,105,79,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(193,105,79,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  streakText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#C1694F',
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
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.25)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 12,
    ...shadow,
  },
  fieldCardFocused: {
    borderColor: '#C1694F',
  },
  fieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: ViveColors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    backgroundColor: CREAM_DEEP,
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
    textAlign: 'center',
    lineHeight: 22,
  },
  saveBtnTextDisabled: {
    color: 'rgba(86,94,50,0.40)',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
