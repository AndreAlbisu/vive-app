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

// ─── Paleta local (consistente con la pantalla de Recursos) ──────────────────
const FOREST       = '#3A4F2A';
const FOREST_SOFT  = '#6B7A56';
const TEXT          = '#565E32';
const CREAM_LIGHT  = '#F7EFE4';
const GLASS_BG     = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

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
  podcast: 'Podcast',
  video: 'Video',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

// Filtro secundario por formato (AND con el tema). Orden fijo.
const FORMAT_ORDER = ['audio', 'podcast', 'video', 'lectura_breve', 'guia_pasos'];

// Etiqueta corta del eje para el selector primario (el label completo es largo).
const AXIS_SHORT: Record<string, string> = {
  fisico: 'Cuerpo',
  emocional: 'Mente',
  crecimiento: 'Propósito',
};

// Subtemas de cada eje aplanados (los groups son solo agrupación interna).
const AXIS_TOPICS = AXES.map(a => ({
  id: a.id,
  emoji: a.emoji,
  short: AXIS_SHORT[a.id] ?? a.label,
  color: a.color,
  topics: a.groups.flatMap(g => g.items),
}));

export default function ExploreResourcesScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();

  const [axisId, setAxisId] = useState<string | null>(null);   // eje elegido (filtro amplio)
  const [topic, setTopic]   = useState<string | null>(null);   // subtema (filtro fino, AND-dentro-del-eje)
  const [format, setFormat] = useState<string | null>(null);
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const activeAxis = AXIS_TOPICS.find(a => a.id === axisId) ?? null;

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
    const needsTopicJoin = !!topic || !!axisId;
    let query = supabase
      .from('resources')
      .select(
        needsTopicJoin
          ? 'id, type, title, duration_min, profiles!inner(name), resource_topics!inner(topic)'
          : 'id, type, title, duration_min, profiles!inner(name)'
      )
      .not('attributed_to_coach_id', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(40);

    if (topic) {
      query = query.eq('resource_topics.topic', topic);
    } else if (axisId) {
      const axisTopics = AXIS_TOPICS.find(a => a.id === axisId)?.topics ?? [];
      query = query.in('resource_topics.topic', axisTopics);
    }
    if (format) query = query.eq('type', format);

    const { data } = await query;
    // el join por subtema puede traer filas duplicadas (un recurso con varios
    // topics del mismo eje) — deduplicamos por id preservando el orden.
    const seen = new Set<string>();
    const mapped: ResourceRow[] = [];
    for (const r of (data ?? []) as any[]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      mapped.push({
        id: r.id,
        type: r.type,
        title: r.title,
        duration_min: r.duration_min,
        coachName: r.profiles?.name ?? 'un coach',
      });
    }
    setRows(mapped);
    setLoading(false);
  }, [axisId, topic, format]);

  useEffect(() => { load(); }, [load]);

  function selectAxis(id: string | null) {
    setAxisId(id);
    setTopic(null);   // cambiar de eje limpia el subtema
  }

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

  const hasFilter = !!axisId || !!topic || !!format;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header editorial */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={TEXT} />
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.title}>Explorar</Text>
            <Text style={s.subtitle}>Todo lo que comparten nuestros coaches</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Selector de eje (filtro primario) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.axisRow}>
            <TouchableOpacity
              style={[s.axisPill, !axisId && s.axisPillActiveNeutral]}
              onPress={() => selectAxis(null)}
              activeOpacity={0.8}>
              <Text style={[s.axisPillText, !axisId && s.axisPillTextActive]}>Todos</Text>
            </TouchableOpacity>
            {AXIS_TOPICS.map(axis => {
              const active = axisId === axis.id;
              return (
                <TouchableOpacity
                  key={axis.id}
                  style={[
                    s.axisPill,
                    active
                      ? { backgroundColor: axis.color, borderColor: axis.color }
                      : { borderColor: `${axis.color}44` },
                  ]}
                  onPress={() => selectAxis(active ? null : axis.id)}
                  activeOpacity={0.8}>
                  <Text style={s.axisEmoji}>{axis.emoji}</Text>
                  <Text style={[s.axisPillText, active && s.axisPillTextActive]}>{axis.short}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Subtemas del eje elegido (aparecen sólo al elegir un eje) */}
          {activeAxis && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}>
              {activeAxis.topics.map(t => {
                const active = topic === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      s.chip,
                      active
                        ? { backgroundColor: activeAxis.color, borderColor: activeAxis.color }
                        : { borderColor: `${activeAxis.color}40` },
                    ]}
                    onPress={() => setTopic(active ? null : t)}
                    activeOpacity={0.75}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Formato (filtro secundario, con ícono) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}>
            {FORMAT_ORDER.map(f => {
              const active = format === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[s.formatChip, active ? s.formatChipActive : s.formatChipIdle]}
                  onPress={() => setFormat(active ? null : f)}
                  activeOpacity={0.75}>
                  <Ionicons
                    name={TYPE_ICON[f] ?? 'ellipse-outline'}
                    size={13}
                    color={active ? CREAM_LIGHT : FOREST_SOFT}
                  />
                  <Text style={[s.formatChipText, active && s.chipTextActive]}>{TYPE_LABEL[f]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Encabezado de resultados */}
          <View style={s.resultsHead}>
            <Text style={s.resultsLabel}>
              {topic
                ? topic
                : activeAxis
                ? activeAxis.short
                : 'Todos los recursos'}
            </Text>
            {!loading && (
              <Text style={s.resultsCount}>
                {rows.length} {rows.length === 1 ? 'recurso' : 'recursos'}
              </Text>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 32 }} />
          ) : rows.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="leaf-outline" size={30} color="rgba(107,122,86,0.55)" />
              <Text style={s.emptyText}>
                {hasFilter
                  ? 'No hay nada con estos filtros todavía.\nProbá con otro tema o formato.'
                  : 'Todavía no hay recursos publicados.'}
              </Text>
              {hasFilter && (
                <TouchableOpacity
                  onPress={() => { setAxisId(null); setTopic(null); setFormat(null); }}
                  activeOpacity={0.7}>
                  <Text style={s.emptyReset}>Limpiar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
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
                    <View style={s.cardMetaRow}>
                      <View style={s.typeTag}>
                        <Text style={s.typeTagText}>{TYPE_LABEL[r.type] ?? r.type}</Text>
                      </View>
                      <Text style={s.cardMeta} numberOfLines={1}>
                        {r.duration_min ? `${r.duration_min} min · ` : ''}{r.coachName}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => toggleSave(r.id)} hitSlop={10} style={s.bookmarkBtn}>
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? ViveColors.primary : 'rgba(135,131,92,0.55)'}
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

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: ViveFonts.frauncesSerif, fontSize: 30, color: FOREST, lineHeight: 36,
  },
  subtitle: {
    fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, marginTop: 1,
  },

  scroll: { paddingBottom: 8 },

  // ── Filtro por eje ──────────────────────────────────────────────────────
  axisRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  axisPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: GLASS_BG,
  },
  axisPillActiveNeutral: { backgroundColor: FOREST, borderColor: FOREST },
  axisEmoji: { fontSize: 14 },
  axisPillText: { fontFamily: ViveFonts.medium, fontSize: 13, color: TEXT },
  axisPillTextActive: { color: CREAM_LIGHT },

  // ── Chips (subtema / formato) ───────────────────────────────────────────
  chipsRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 10, paddingRight: 28 },
  chip: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6.5,
    backgroundColor: 'rgba(255,248,240,0.40)',
  },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: TEXT },
  chipTextActive: { color: CREAM_LIGHT },

  formatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 6.5,
    backgroundColor: 'rgba(255,248,240,0.40)',
  },
  formatChipActive: { backgroundColor: FOREST_SOFT, borderColor: FOREST_SOFT },
  formatChipIdle: { borderColor: 'rgba(107,122,86,0.28)' },
  formatChipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST_SOFT },

  // ── Resultados ──────────────────────────────────────────────────────────
  resultsHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 6, marginBottom: 12,
  },
  resultsLabel: {
    fontFamily: ViveFonts.frauncesSerif, fontSize: 18, color: FOREST, flexShrink: 1,
  },
  resultsCount: {
    fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT, marginLeft: 10,
  },

  emptyWrap: { alignItems: 'center', gap: 12, paddingTop: 44, paddingHorizontal: 40 },
  emptyText: {
    fontFamily: ViveFonts.regular, fontSize: 13.5,
    color: 'rgba(107,122,86,0.90)', textAlign: 'center', lineHeight: 20,
  },
  emptyReset: {
    fontFamily: ViveFonts.semibold, fontSize: 13, color: ViveColors.primary, marginTop: 2,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: GLASS_BG,
    borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 13, marginHorizontal: 20, marginBottom: 10,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardText: { flex: 1, gap: 6, minWidth: 0 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: TEXT, lineHeight: 19 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeTag: {
    backgroundColor: 'rgba(107,122,86,0.14)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2.5, flexShrink: 0,
  },
  typeTagText: { fontFamily: ViveFonts.medium, fontSize: 10, color: FOREST_SOFT },
  cardMeta: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 11.5, color: 'rgba(135,131,92,0.90)' },
  bookmarkBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
