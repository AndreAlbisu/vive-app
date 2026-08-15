import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts, ViveColors } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRACOTTA = '#C06B4A';
const CREAM_DEEP = '#EAE2D0';
const CARD = '#F7F2E7';
const LINE = 'rgba(63,81,47,0.14)';

const FORMAT_COLOR: Record<string, string> = { audio: '#C06B4A', podcast: '#7E8CA8', video: '#8A6FA8', lectura: '#6B7A56' };
const FORMAT_LABEL: Record<string, string> = { audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura' };
const FORMAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'mic-outline', podcast: 'musical-notes-outline', video: 'videocam-outline', lectura: 'book-outline',
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)}h`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function displayTitle(title: string): string {
  return title.replace(/^\[SEED\]\s*/, '');
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  const monthName = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  return `${d.getDate()} ${monthName}`;
}

type Reco = {
  id: string;
  resource_id: string;
  note: string | null;
  opened_at: string | null;
  created_at: string;
  coach_resources: { id: string; title: string; format: string; duration_seconds: number | null };
  coaches: { profiles: { name: string } };
};

export default function MisRecomendacionesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [recos, setRecos] = useState<Reco[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) { setRecos([]); setLoading(false); return; }
    supabase
      .from('resource_recommendations')
      .select('id, resource_id, note, opened_at, created_at, coach_resources!inner(id, title, format, duration_seconds), coaches!inner(profiles!inner(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRecos((data as any) ?? []); setLoading(false); });
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openReco(item: Reco) {
    if (!item.opened_at) {
      await supabase.from('resource_recommendations').update({ opened_at: new Date().toISOString() }).eq('id', item.id).is('opened_at', null);
      setRecos(prev => prev.map(r => r.id === item.id ? { ...r, opened_at: new Date().toISOString() } : r));
    }
    router.push({
      pathname: '/coach-recurso',
      params: { id: item.resource_id, note: item.note ?? '', fromCoachName: item.coaches?.profiles?.name ?? '' },
    } as any);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Recomendado por tu profesional</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {recos.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="chatbubble-outline" size={38} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyText}>Todavía no tenés recomendaciones</Text>
              </View>
            ) : (
              recos.map(item => {
                const res = item.coach_resources;
                const color = FORMAT_COLOR[res.format] ?? TERRACOTTA;
                const isNew = !item.opened_at;
                const coachName = item.coaches?.profiles?.name ?? 'Tu profesional';
                return (
                  <View key={item.id} style={s.recbox}>
                    <View style={s.recHead}>
                      <LinearGradient
                        colors={['#C06B4A', '#A5583B']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={s.recAvatar}>
                        <Text style={s.recAvatarText}>{initials(coachName)}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.recHeadName} numberOfLines={1}>{coachName}</Text>
                        <Text style={s.recHeadSub}>te recomendó esto · {relativeDay(item.created_at)}</Text>
                      </View>
                      {isNew && <View style={s.recDot} />}
                    </View>
                    {item.note ? <Text style={s.recNote} numberOfLines={4}>“{item.note}”</Text> : null}
                    <ScaleCard style={s.recAttach} onPress={() => openReco(item)} activeOpacity={0.92}>
                      <View style={[s.recAttachIcon, { backgroundColor: color }]}>
                        <Ionicons name={FORMAT_ICON[res.format] ?? 'book-outline'} size={16} color="#fff" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.recAttachTitle} numberOfLines={1}>{displayTitle(res.title)}</Text>
                        <Text style={s.recAttachMeta}>
                          {FORMAT_LABEL[res.format] ?? res.format}{res.duration_seconds ? ` · ${fmtDuration(res.duration_seconds)}` : ''}
                        </Text>
                      </View>
                      <View style={s.recAttachPlay}><Ionicons name="play" size={13} color={FOREST} /></View>
                    </ScaleCard>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 16,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', textAlign: 'center' },

  recbox: { backgroundColor: CREAM_DEEP, borderRadius: 22, padding: 15 },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: TERRACOTTA,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  recAvatarText: { fontFamily: ViveFonts.frauncesSerif, fontSize: 12, color: '#FFF3E8' },
  recHeadName: { fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST },
  recHeadSub: { fontFamily: ViveFonts.regular, fontSize: 10, color: FOREST_SOFT },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TERRACOTTA, flexShrink: 0 },
  recNote: {
    fontFamily: ViveFonts.frauncesSerif, fontStyle: 'italic', fontSize: 13.5,
    color: '#2E3624', lineHeight: 19, marginTop: 10, marginBottom: 11,
  },
  recAttach: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE,
    borderRadius: 16, padding: 10, marginTop: 10,
  },
  recAttachIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recAttachTitle: { fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST },
  recAttachMeta: { fontFamily: ViveFonts.regular, fontSize: 10, color: FOREST_SOFT, marginTop: 1 },
  recAttachPlay: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: CREAM_DEEP,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
