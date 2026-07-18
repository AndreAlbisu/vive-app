import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { DOORS } from '@/constants/conexionesDoors';

// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const LINE = 'rgba(63,81,47,0.14)';
const GREEN_TXT = '#F3EEDF';
const GREEN_EYEBROW = '#C9CFAF';

const FMT: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  audio:   { label: 'Audio',   color: '#C06B4A', icon: 'mic' },
  podcast: { label: 'Podcast', color: '#3B7FC4', icon: 'headphones' },
  video:   { label: 'Video',   color: '#7B5EA7', icon: 'video' },
  lectura: { label: 'Lectura', color: '#6B7A56', icon: 'book-open' },
};

const STATUS: Record<string, { label: string; bg: string; ink: string }> = {
  published: { label: 'PUBLICADO', bg: '#DCE5CB', ink: '#42542F' },
  pending:   { label: 'EN REVISIÓN', bg: '#F0E4C4', ink: '#8A6A20' },
  rejected:  { label: 'RECHAZADO', bg: 'rgba(224,82,82,0.16)', ink: '#B53B3B' },
  archived:  { label: 'ARCHIVADO', bg: 'rgba(135,131,92,0.16)', ink: '#6B6A4E' },
};

const TOPIC_LABEL: Record<string, string> = Object.fromEntries(DOORS.map(d => [d.id, d.label]));

type CoachResource = {
  id: string; title: string; format: string; status: string;
  rejection_rule: number | null; duration_seconds: number | null; topic_id: string | null;
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return `${m} min`;
}

export default function CoachResourcesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [resources, setResources] = useState<CoachResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthStats, setMonthStats] = useState({ plays: 0, saves: 0, profile_visits: 0 });
  const [counts, setCounts] = useState<Record<string, { plays: number; saves: number }>>({});

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: coach } = await supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle();
    const cid = (coach?.id as string) ?? null;
    setCoachId(cid);
    if (!cid) { setResources([]); setLoading(false); return; }

    const [{ data }, { data: monthData }, { data: countsData }] = await Promise.all([
      supabase
        .from('coach_resources')
        .select('id, title, format, status, rejection_rule, duration_seconds, topic_id')
        .eq('coach_id', cid)
        .neq('status', 'archived')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_my_resource_stats_month').maybeSingle(),
      supabase.rpc('get_my_resource_counts'),
    ]);
    setResources((data as CoachResource[]) ?? []);
    if (monthData) {
      setMonthStats({
        plays: Number((monthData as any).plays ?? 0),
        saves: Number((monthData as any).saves ?? 0),
        profile_visits: Number((monthData as any).profile_visits ?? 0),
      });
    }
    const countsMap: Record<string, { plays: number; saves: number }> = {};
    ((countsData as any[]) ?? []).forEach(c => {
      countsMap[c.resource_id] = { plays: Number(c.plays ?? 0), saves: Number(c.saves ?? 0) };
    });
    setCounts(countsMap);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const publishedCount = resources.filter(r => r.status === 'published').length;

  function openUpload(format?: string) {
    if (!coachId) { Alert.alert('Perfil de coach', 'Completá tu perfil de coach antes de subir recursos.'); return; }
    router.push({ pathname: '/coach-recurso-nuevo', params: { coach_id: coachId, ...(format ? { format } : {}) } } as any);
  }

  function recommend(r: CoachResource) {
    Alert.alert(
      'Recomendar',
      `Abrí el chat con la persona y tocá + para enviarle "${r.title}".`,
      [
        { text: 'Ir a Chats', onPress: () => router.navigate('/chats') },
        { text: 'Cerrar', style: 'cancel' },
      ],
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Tus recursos</Text>
            <View style={s.chip}><Text style={s.chipTxt}>{publishedCount}/10 publicados</Text></View>
          </View>

          {/* Stats del mes (resource_events instrumentado — ver get_my_resource_stats_month) */}
          <LinearGradient colors={['#42542F', '#354526']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.stats}>
            <View style={s.statsGlow} pointerEvents="none" />
            <Text style={s.eyebrow}>Este mes</Text>
            <View style={s.statsRow}>
              {[
                [String(monthStats.plays), 'reproducciones'],
                [String(monthStats.saves), 'guardados'],
                [String(monthStats.profile_visits), 'visitas a tu perfil'],
              ].map(([n, l]) => (
                <View key={l} style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
              ))}
            </View>
            {publishedCount === 0 && (
              <Text style={s.statsFoot}>Tus recursos empiezan a contar su historia cuando se publican.</Text>
            )}
          </LinearGradient>

          {/* CTAs */}
          <View style={s.ctaRow}>
            <TouchableOpacity style={[s.cta, s.ctaUp]} activeOpacity={0.88} onPress={() => openUpload()}>
              <Feather name="plus" size={15} color="#FFF6EC" />
              <Text style={s.ctaUpTxt}>Subir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.cta, s.ctaRec]} activeOpacity={0.88} onPress={() => openUpload('audio')}>
              <Feather name="mic" size={15} color={TERRA} />
              <Text style={s.ctaRecTxt}>Grabar audio</Text>
            </TouchableOpacity>
          </View>

          {/* Mis recursos */}
          <View style={s.stitle}>
            <Text style={s.stitleB}>Mis recursos</Text>
            {resources.length > 0 && <Text style={s.stitleSpan}>{resources.length} en total</Text>}
          </View>

          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="small" color={FOREST} /></View>
          ) : resources.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Todavía no subiste recursos.{'\n'}Tus audios, videos, podcasts y lecturas aparecerán acá.</Text>
            </View>
          ) : (
            resources.map(r => {
              const fmt = FMT[r.format] ?? FMT.audio;
              const st = STATUS[r.status] ?? STATUS.pending;
              const metaLine = [fmt.label, fmtDuration(r.duration_seconds), r.topic_id ? TOPIC_LABEL[r.topic_id] : '']
                .filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  key={r.id}
                  style={s.res}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/coach-recurso', params: { id: r.id } } as any)}>
                  <View style={s.resTop}>
                    <View style={[s.cover, { backgroundColor: fmt.color }]}>
                      <Feather name={fmt.icon} size={16} color="#FFF6EC" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.resTitle} numberOfLines={2}>{r.title}</Text>
                      <Text style={s.resMeta}>{metaLine}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                      <Text style={[s.badgeTxt, { color: st.ink }]}>{st.label}</Text>
                    </View>
                  </View>
                  {r.status === 'published' && (
                    <View style={s.line2}>
                      <Text style={s.line2Stat}>▶ <Text style={s.line2StatN}>{counts[r.id]?.plays ?? 0}</Text></Text>
                      <Text style={s.line2Stat}>◈ <Text style={s.line2StatN}>{counts[r.id]?.saves ?? 0}</Text></Text>
                      <TouchableOpacity style={s.recBtn} activeOpacity={0.8} onPress={() => recommend(r)}>
                        <Text style={s.recBtnTxt}>Recomendar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {r.status === 'rejected' && r.rejection_rule ? (
                    <Text style={s.rejectNote}>Rechazado — regla {r.rejection_rule}. Editá y volvé a enviar.</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          {publishedCount >= 10 && (
            <Text style={s.limitNote}>Llegaste al límite de 10 publicados. Archivá uno para publicar otro.</Text>
          )}

          <TouchableOpacity style={s.viewas} activeOpacity={0.7} onPress={() => router.push('/explorar-recursos')}>
            <Text style={s.viewasTxt}>Ver cómo lo ven tus pacientes →</Text>
          </TouchableOpacity>

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 12 },

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
  title: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST },
  chip: { backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: LINE, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 3 },
  chipTxt: { fontSize: 11.5, fontFamily: ViveFonts.semibold, color: FOREST },

  // Stats verde
  stats: { marginTop: 12, borderRadius: 22, padding: 16, overflow: 'hidden' },
  statsGlow: { position: 'absolute', right: -40, top: -46, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(234,211,198,0.10)' },
  eyebrow: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: GREEN_EYEBROW, fontFamily: ViveFonts.medium },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 8, alignItems: 'center' },
  statN: { fontFamily: ViveFonts.frauncesSerif, fontSize: 18, color: GREEN_TXT },
  statL: { fontSize: 9, color: GREEN_EYEBROW, marginTop: 1, textAlign: 'center', fontFamily: ViveFonts.regular },
  statsFoot: { fontSize: 10.5, color: '#EAD3C6', marginTop: 9, fontFamily: ViveFonts.regular },

  // CTAs
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 18, paddingVertical: 13 },
  ctaUp: { backgroundColor: TERRA },
  ctaUpTxt: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },
  ctaRec: { backgroundColor: CARD, borderWidth: 1.5, borderColor: TERRA },
  ctaRecTxt: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: '#8F4A2E' },

  stitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  stitleB: { fontFamily: ViveFonts.frauncesSerif, fontSize: 17, color: FOREST },
  stitleSpan: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  loadingBox: { paddingVertical: 24, alignItems: 'center' },
  empty: { padding: 18, borderWidth: 1.5, borderColor: LINE, borderRadius: 20, borderStyle: 'dashed', alignItems: 'center' },
  emptyTxt: { textAlign: 'center', fontSize: 12.5, color: FOREST_SOFT, lineHeight: 18, fontFamily: ViveFonts.regular },

  res: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20, padding: 13, marginBottom: 8 },
  resTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cover: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resTitle: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: FOREST, lineHeight: 17 },
  resMeta: { fontSize: 10, color: FOREST_SOFT, marginTop: 1, fontFamily: ViveFonts.regular },
  badge: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 },
  badgeTxt: { fontSize: 9, fontFamily: ViveFonts.bold, letterSpacing: 0.4 },
  line2: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: LINE },
  line2Stat: { fontSize: 10, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  line2StatN: { color: FOREST, fontFamily: ViveFonts.semibold },
  recBtn: { marginLeft: 'auto', borderWidth: 1.5, borderColor: FOREST, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  recBtnTxt: { fontSize: 10.5, fontFamily: ViveFonts.semibold, color: FOREST },
  rejectNote: { fontSize: 10.5, color: '#B53B3B', marginTop: 8, fontFamily: ViveFonts.regular },
  limitNote: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular, marginTop: 4, textAlign: 'center' },

  viewas: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  viewasTxt: { fontSize: 12.5, fontFamily: ViveFonts.medium, color: TERRA },
});
