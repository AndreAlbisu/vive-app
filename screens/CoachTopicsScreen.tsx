import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AXES } from '@/constants/searchData';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const shadow = Platform.select({
  ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4 },
  android: { elevation: 1 },
});

export default function CoachTopicsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!coachRow) { setLoading(false); return; }
      setCoachId(coachRow.id);

      const { data: topicRows } = await supabase
        .from('coach_topics')
        .select('topic')
        .eq('coach_id', coachRow.id);

      setSelected(new Set((topicRows ?? []).map(t => t.topic as string)));
      setLoading(false);
    })();
  }, [user]);

  function toggleTopic(topic: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      return next;
    });
  }

  async function handleSave() {
    if (!coachId) return;
    setSaving(true);

    const { error: deleteError } = await supabase
      .from('coach_topics')
      .delete()
      .eq('coach_id', coachId);

    if (deleteError) {
      setSaving(false);
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos.');
      return;
    }

    const topics = [...selected];
    if (topics.length > 0) {
      const { error: insertError } = await supabase
        .from('coach_topics')
        .insert(topics.map(topic => ({ coach_id: coachId, topic })));

      if (insertError) {
        setSaving(false);
        Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos.');
        return;
      }
    }

    setSaving(false);
    router.back();
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Temas que trabajo</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={ViveColors.primary} />
          </View>
        ) : !coachId ? (
          <View style={s.loadingWrap}>
            <Text style={s.emptyText}>Todavía no completaste tu perfil de coach.</Text>
          </View>
        ) : (
          <>
            <Text style={s.subtitle}>Elegí los subtemas que trabajás — se muestran en tu perfil y los usuarios pueden filtrar por ellos.</Text>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
              {AXES.map(axis => (
                <View key={axis.id} style={s.axisBlock}>
                  <View style={s.axisHeader}>
                    <Text style={s.axisEmoji}>{axis.emoji}</Text>
                    <Text style={s.axisLabel}>{axis.label}</Text>
                  </View>

                  {axis.groups.map((group, gi) => (
                    <View key={gi} style={s.groupBlock}>
                      {group.group !== '' && (
                        <Text style={s.groupLabel}>{group.group}</Text>
                      )}
                      <View style={s.chipsRow}>
                        {group.items.map(topic => {
                          const active = selected.has(topic);
                          return (
                            <TouchableOpacity
                              key={topic}
                              style={[s.chip, active && s.chipActive]}
                              onPress={() => toggleTopic(topic)}
                              activeOpacity={0.75}>
                              {active && (
                                <MaterialIcons name="check" size={14} color="#F7EFE4" style={{ marginRight: 4 }} />
                              )}
                              <Text style={[s.chipText, active && s.chipTextActive]}>{topic}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>

            <SafeAreaView style={s.footerSafe} edges={['bottom']}>
              <View style={s.footer}>
                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#F7EFE4" />
                  ) : (
                    <Text style={s.saveBtnText}>
                      Guardar {selected.size > 0 ? `(${selected.size})` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
    lineHeight: 19,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.72)', textAlign: 'center' },

  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 26 },
  axisBlock: { gap: 14 },
  axisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  axisEmoji: { fontSize: 18 },
  axisLabel: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32' },

  groupBlock: { gap: 10 },
  groupLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: 'rgba(135,131,92,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,248,240,0.55)',
    ...shadow,
  },
  chipActive: {
    backgroundColor: ViveColors.primary,
    borderColor: ViveColors.primary,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
  },
  chipTextActive: {
    color: '#F7EFE4',
    fontFamily: ViveFonts.semibold,
  },

  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  saveBtn: {
    backgroundColor: '#565E32', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#F7EFE4', letterSpacing: 0.2 },
});
