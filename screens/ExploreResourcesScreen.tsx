import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { AXES } from '@/constants/searchData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const FOREST = '#3A4F2A';

type ResourceRow = {
  id: string;
  type: string;
  title: string;
  duration_min: number | null;
  coachName: string;
};

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'volume-medium-outline',
  podcast: 'mic-outline',
  video: 'videocam-outline',
  guia_pasos: 'list-outline',
  lectura_breve: 'book-outline',
};
const TYPE_LABEL: Record<string, string> = {
  audio: 'Audio guía',
  podcast: 'Podcast/Charla',
  video: 'Video',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

// Filtro secundario por formato (AND con el tema). Orden fijo.
const FORMAT_ORDER = ['audio', 'podcast', 'video', 'lectura_breve', 'guia_pasos'];

// Subtemas de cada eje aplanados (los groups son solo agrupación interna).
const AXIS_TOPICS = AXES.map(a => ({
  id: a.id,
  emoji: a.emoji,
  label: a.label,
  color: a.color,
  topics: a.groups.flatMap(g => g.items),
}));

export default function ExploreResourcesScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();

  const [selected, setSelected] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Cargar guardados (para el estado del bookmark).
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map(r => r.resource_id as string)));
      });
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('resources')
      .select(
        selected
          ? 'id, type, title, duration_min, profiles!inner(name), resource_topics!inner(topic)'
          : 'id, type, title, duration_min, profiles!inner(name)'
      )
      .not('attributed_to_coach_id', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(40);

    if (selected) query = query.eq('resource_topics.topic', selected);
    if (format) query = query.eq('type', format);

    const { data } = await query;
    setRows(
      (data ?? []).map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        duration_min: r.duration_min,
        coachName: r.profiles?.name ?? 'un coach',
      })),
    );
    setLoading(false);
  }, [selected, format]);

  useEffect(() => { load(); }, [load]);

  async function toggleSave(resourceId: string) {
    if (!user) { requestAuth(); return; }
    const isSaved = savedIds.has(resourceId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(resourceId); else next.add(resourceId);
      return next;
    });
    if (isSaved) {
      await supabase.from('saved_resources').delete()
        .eq('user_id', user.id).eq('resource_id', resourceId);
    } else {
      await supabase.from('saved_resources')
        .insert({ user_id: user.id, resource_id: resourceId });
    }
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Explorar recursos</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Filtro por subtema, agrupado por eje (una fila horizontal por eje) */}
        <View style={s.filters}>
          {AXIS_TOPICS.map(axis => (
            <View key={axis.id} style={s.axisBlock}>
              <View style={s.axisHeader}>
                <Text style={s.axisEmoji}>{axis.emoji}</Text>
                <Text style={[s.axisLabel, { color: axis.color }]}>{axis.label}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                {axis.topics.map(topic => {
                  const active = selected === topic;
                  return (
                    <TouchableOpacity
                      key={topic}
                      style={[
                        s.chip,
                        active ? { backgroundColor: axis.color, borderColor: axis.color }
                               : { borderColor: `${axis.color}55` },
                      ]}
                      onPress={() => setSelected(active ? null : topic)}
                      activeOpacity={0.75}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{topic}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}

          {/* Filtro secundario por formato (AND con el tema) */}
          <View style={s.formatBlock}>
            <View style={s.axisHeader}>
              <Text style={[s.axisLabel, { color: '#565E32' }]}>Formato</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              {FORMAT_ORDER.map(f => {
                const active = format === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, active ? s.formatChipActive : s.formatChipIdle]}
                    onPress={() => setFormat(active ? null : f)}
                    activeOpacity={0.75}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{TYPE_LABEL[f]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.results} showsVerticalScrollIndicator={false}>
          <Text style={s.resultsLabel}>
            {selected
              ? `Recursos en ${selected}${format ? ` · ${TYPE_LABEL[format]}` : ''}`
              : format ? TYPE_LABEL[format] : 'Todos los recursos de coaches'}
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 24 }} />
          ) : rows.length === 0 ? (
            <Text style={s.empty}>
              {selected || format
                ? 'No hay recursos con estos filtros todavía. Probá otro tema o formato.'
                : 'Todavía no hay recursos publicados.'}
            </Text>
          ) : (
            rows.map(r => {
              const isSaved = savedIds.has(r.id);
              return (
                <TouchableOpacity
                  key={r.id}
                  style={s.card}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/recurso', params: { id: r.id } })}>
                  <View style={s.cardIcon}>
                    <Ionicons name={TYPE_ICON[r.type] ?? 'book-outline'} size={20} color={FOREST} />
                  </View>
                  <View style={s.cardText}>
                    <Text style={s.cardTitle} numberOfLines={2}>{r.title}</Text>
                    <Text style={s.cardMeta} numberOfLines={1}>
                      {TYPE_LABEL[r.type] ?? r.type}
                      {r.duration_min ? ` · ${r.duration_min} min` : ''} · Por {r.coachName}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleSave(r.id)} hitSlop={8}>
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? FOREST : 'rgba(135,131,92,0.60)'}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  filters: { paddingBottom: 6 },
  axisBlock: { marginBottom: 10 },
  axisHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 6,
  },
  axisEmoji: { fontSize: 14 },
  axisLabel: { fontFamily: ViveFonts.semibold, fontSize: 12.5, letterSpacing: -0.1 },
  chipsRow: { gap: 8, paddingHorizontal: 16, paddingRight: 24 },
  chip: {
    borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 13, paddingVertical: 7,
    backgroundColor: 'rgba(255,248,240,0.45)',
  },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: '#565E32' },
  chipTextActive: { color: '#F7EFE4' },

  formatBlock: { marginTop: 2 },
  formatChipActive: { backgroundColor: FOREST, borderColor: FOREST },
  formatChipIdle: { borderColor: 'rgba(58,79,42,0.30)' },

  results: { paddingHorizontal: 16, paddingTop: 8 },
  resultsLabel: {
    fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32', marginBottom: 12,
  },
  empty: {
    fontFamily: ViveFonts.regular, fontSize: 13,
    color: 'rgba(135,131,92,0.85)', paddingVertical: 12,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
    padding: 12, marginBottom: 10,
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: 'rgba(135,131,92,0.90)' },
});
