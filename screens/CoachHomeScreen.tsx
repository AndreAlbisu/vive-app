import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import { visibilityTeaser, type VisibilityTeaser } from '@/lib/coachVisibility';

// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const CREAM_DEEP = '#EAE2D0';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const TERRA_SOFT = '#EAD3C6';
const OK_BG = '#DCE5CB';
const OK_INK = '#42542F';
const LINE = 'rgba(63,81,47,0.14)';
const GREEN_TXT = '#F3EEDF';
const GREEN_EYEBROW = '#C9CFAF';

const WEEK_ABBRS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Session = { userId: string; time: string; date: string };
type DayEntry = { abbr: string; count: number; isToday: boolean };

type NextSession = {
  bookingId: string;
  userId: string;
  userName: string;
  initials: string;
  avatarUrl: string | null;
  dateLabel: string;
  timeStr: string;
  ordinal: string;
  salaId: string | null;
  startMs: number;
};

type PrepResource = { id: string; title: string; opened: boolean; roomId: string | null };
type Prep = { lastDaysAgo: number | null; resources: PrepResource[] };

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}
function ordinalLabel(n: number): string {
  return `${n}.ª sesión`;
}
function bookingStartMs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0).getTime();
}
function nextDateLabel(date: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][target.getDay()];
  return `${dayName} ${d} ${MONTHS[m - 1]}`;
}

export default function CoachHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState('');
  const [weekData, setWeekData] = useState<DayEntry[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekClients, setWeekClients] = useState(0);
  const [next, setNext] = useState<NextSession | null>(null);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibility, setVisibility] = useState<VisibilityTeaser | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
  }, [user]);

  // Badge de notificaciones (campana del header).
  useEffect(() => {
    if (!user) return;
    const loadUnread = () => supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
    loadUnread();
    const channel = supabase
      .channel(`coach-home-notif-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, loadUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user || !coachId) { setLoading(false); return; }

    const now = new Date();
    const todayStr = toDateStr(now);

    // Semana Lun-Dom
    const dow = now.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(now); monday.setDate(now.getDate() - daysFromMonday); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

    const [{ data: profile }, { data: confirmed }, { data: coachRow }, { data: topicRows }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, user_id, scheduled_date, scheduled_time, sala_id, duration_minutes')
        .eq('coach_id', coachId)
        .eq('status', 'confirmada')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true }),
      supabase.from('coaches').select('verified, availability_status, price_per_session').eq('id', coachId).maybeSingle(),
      supabase.from('coach_topics').select('topic').eq('coach_id', coachId),
    ]);

    if (profile?.name) setCoachName(profile.name.split(' ')[0]);

    setVisibility(visibilityTeaser({
      verified: !!coachRow?.verified,
      availabilityStatus: (coachRow?.availability_status ?? 'activo') as 'activo' | 'en_pausa',
      topics: (topicRows ?? []).map(t => t.topic as string),
      price: (coachRow?.price_per_session ?? null) as number | null,
    }));

    const rows = confirmed ?? [];
    const sessions: Session[] = rows.map(b => ({
      userId: b.user_id as string,
      time: (b.scheduled_time as string).slice(0, 5),
      date: b.scheduled_date as string,
    }));

    // Franja semanal (conteo por día + hoy)
    const week: DayEntry[] = WEEK_ABBRS.map((abbr, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dateStr = toDateStr(d);
      return { abbr, count: sessions.filter(s => s.date === dateStr).length, isToday: dateStr === todayStr };
    });
    setWeekData(week);
    const inWeek = sessions.filter(s => s.date >= toDateStr(monday) && s.date <= toDateStr(sunday));
    setWeekTotal(inWeek.length);
    setWeekClients(new Set(inWeek.map(s => s.userId)).size);

    // Próxima sesión = primera confirmada con inicio >= ahora
    const nowMs = now.getTime();
    const upcoming = rows
      .map(b => ({ b, startMs: bookingStartMs(b.scheduled_date as string, b.scheduled_time as string) }))
      .filter(x => x.startMs >= nowMs - 90 * 60 * 1000) // incluye una en curso (hasta 90')
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (upcoming) {
      const b = upcoming.b;
      const [{ data: prof }, { count: completedCount }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', b.user_id).maybeSingle(),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachId).eq('user_id', b.user_id).eq('status', 'completada'),
      ]);
      const name = (prof?.name as string) ?? 'Usuario';
      setNext({
        bookingId: b.id as string,
        userId: b.user_id as string,
        userName: name,
        initials: getInitials(name),
        avatarUrl: (prof?.avatar_url as string) ?? null,
        dateLabel: nextDateLabel(b.scheduled_date as string),
        timeStr: (b.scheduled_time as string).slice(0, 5),
        ordinal: ordinalLabel((completedCount ?? 0) + 1),
        salaId: (b.sala_id as string) ?? null,
        startMs: upcoming.startMs,
      });

      // Preparar sesión: última completada + recursos recomendados (Recursos v2)
      const [{ data: lastDone }, { data: recs }] = await Promise.all([
        supabase.from('bookings').select('scheduled_date')
          .eq('coach_id', coachId).eq('user_id', b.user_id).eq('status', 'completada')
          .order('scheduled_date', { ascending: false }).limit(1),
        supabase.from('resource_recommendations')
          .select('id, opened_at, room_id, coach_resources!inner(title)')
          .eq('coach_id', coachId).eq('user_id', b.user_id)
          .order('created_at', { ascending: false }).limit(6),
      ]);
      let lastDaysAgo: number | null = null;
      if (lastDone?.[0]?.scheduled_date) {
        const [ly, lm, ld] = (lastDone[0].scheduled_date as string).split('-').map(Number);
        const lastMs = new Date(ly, lm - 1, ld).getTime();
        lastDaysAgo = Math.max(0, Math.round((Date.now() - lastMs) / 86400000));
      }
      const resources: PrepResource[] = (recs ?? []).map(r => {
        const cr = r.coach_resources as { title?: string } | { title?: string }[] | null;
        const title = Array.isArray(cr) ? (cr[0]?.title ?? 'Recurso') : (cr?.title ?? 'Recurso');
        return { id: r.id as string, title, opened: !!r.opened_at, roomId: (r.room_id as string) ?? null };
      });
      setPrep({ lastDaysAgo, resources });
    } else {
      setNext(null);
      setPrep(null);
    }

    setLoading(false);
  }, [user, coachId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const canJoin = next ? Date.now() >= next.startMs - 10 * 60 * 1000 : false;

  if (loading) {
    return (
      <AppBg>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.loadingBox}><ActivityIndicator size="small" color={FOREST} /></View>
        </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={FOREST} colors={[FOREST]} />}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.hello}>Hola, {coachName || '—'}</Text>
            <View style={s.headerRight}>
              <TouchableOpacity onPress={() => router.push('/coach-notifications')} activeOpacity={0.7} hitSlop={8} style={s.bellBtn}>
                <Feather name="bell" size={22} color={FOREST} />
                {unreadCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/perfil')} activeOpacity={0.85} hitSlop={8}>
                <LinearGradient colors={[TERRA, '#A5583B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
                  <Text style={s.avatarTxt}>{getInitials(coachName || '?')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tu semana */}
          <TouchableOpacity style={s.week} activeOpacity={0.9} onPress={() => router.push('/coach-agenda')}>
            {weekData.map((d, i) => (
              <View key={i} style={[s.wd, d.isToday && s.wdToday]}>
                <Text style={[s.wdAbbr, d.isToday && s.wdAbbrToday]}>{d.abbr}</Text>
                <View style={[s.wdCircle, d.count > 0 && s.wdCircleHas, d.isToday && s.wdCircleToday]}>
                  {d.count > 0 && <Text style={s.wdCount}>{d.count}</Text>}
                </View>
              </View>
            ))}
          </TouchableOpacity>
          <Text style={s.weekCaption}>
            {weekTotal} {weekTotal === 1 ? 'sesión' : 'sesiones'} · {weekClients} {weekClients === 1 ? 'persona' : 'personas'} esta semana · <Text style={s.weekCaptionB}>disponibilidad calculada automáticamente</Text>
          </Text>

          {/* Tu próxima sesión */}
          {next ? (
            <View style={s.next}>
              <View style={s.nextGlow} pointerEvents="none" />
              <Text style={s.eyebrow}>Tu próxima sesión</Text>
              <View style={s.who}>
                {next.avatarUrl ? (
                  <Image source={{ uri: next.avatarUrl }} style={s.whoAv} />
                ) : (
                  <View style={[s.whoAv, s.whoAvFallback]}><Text style={s.whoAvTxt}>{next.initials}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.whoName}>{next.userName}</Text>
                  <Text style={s.whoSub}>{next.dateLabel} · {next.timeStr} hs · videollamada · {next.ordinal}</Text>
                </View>
              </View>
              <View style={s.acts}>
                <TouchableOpacity
                  style={[s.actBtn, s.actJoin, !canJoin && s.actDisabled]}
                  activeOpacity={0.85}
                  disabled={!canJoin}
                  onPress={() => next.salaId
                    ? router.push({ pathname: '/sala', params: { sala_id: next.salaId } })
                    : router.push('/sala')}>
                  <Text style={s.actJoinTxt}>{canJoin ? 'Unirse' : 'Se habilita 10 min antes'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, s.actPrep]} activeOpacity={0.85} onPress={() => setPrepOpen(o => !o)}>
                  <Text style={s.actPrepTxt}>Preparar sesión</Text>
                </TouchableOpacity>
              </View>

              {prepOpen && (
                <View style={s.prep}>
                  <Text style={s.prepLine}>
                    <Text style={s.prepB}>Última sesión: </Text>
                    {prep?.lastDaysAgo == null ? 'primera sesión juntos' : `hace ${prep.lastDaysAgo} ${prep.lastDaysAgo === 1 ? 'día' : 'días'}`}
                  </Text>
                  {prep && prep.resources.length > 0 && (
                    <>
                      <Text style={[s.prepB, { marginTop: 8 }]}>Recursos que le mandaste:</Text>
                      {prep.resources.map(r => (
                        <View key={r.id} style={s.prepRes}>
                          <Text style={r.opened ? s.prepOk : s.prepWarn} numberOfLines={1}>
                            {r.opened ? '✓' : '✗'} {r.title}{r.opened ? ' — abierto' : ' — sin abrir'}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={s.nextEmpty}>
              <Text style={s.nextEmptyTxt}>Sin sesiones programadas</Text>
              <TouchableOpacity style={s.nextEmptyBtn} activeOpacity={0.85} onPress={() => router.navigate('/reservas')}>
                <Text style={s.nextEmptyBtnTxt}>Ver reservas</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cómo aparecer en Conexiones */}
          {visibility && (
            <TouchableOpacity style={s.vis} activeOpacity={0.85} onPress={() => router.push('/coach-visibilidad')}>
              <View style={[s.visIcon, visibility.blocked && s.visIconWarn]}>
                <Feather name={visibility.blocked ? 'alert-circle' : 'compass'} size={16} color={visibility.blocked ? TERRA : FOREST} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.visTitle}>
                  {visibility.blocked
                    ? 'Hoy no aparecés en Conexiones'
                    : `Aparecés en ${visibility.doorCount} ${visibility.doorCount === 1 ? 'puerta' : 'puertas'}`}
                </Text>
                <Text style={s.visTxt} numberOfLines={2}>
                  {visibility.blocked
                    ? visibility.blocked.hint
                    : 'Mirá qué lugar ocupás en cada una y qué te falta para el siguiente.'}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={FOREST_SOFT} />
            </TouchableOpacity>
          )}

          <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 12 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  hello: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellBtn: { padding: 2 },
  bellDot: {
    position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5,
    backgroundColor: TERRA, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: ViveFonts.frauncesSerif, fontSize: 13, color: '#FFF3E8' },

  // Semana
  week: {
    marginTop: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  wd: { alignItems: 'center' },
  wdToday: {},
  wdAbbr: { fontSize: 10, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  wdAbbrToday: { color: FOREST, fontFamily: ViveFonts.semibold },
  wdCircle: {
    width: 26, height: 26, borderRadius: 13, marginTop: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM_DEEP,
  },
  wdCircleHas: { backgroundColor: TERRA },
  wdCircleToday: { borderWidth: 1.5, borderColor: FOREST },
  wdCount: { fontSize: 10.5, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },
  weekCaption: { textAlign: 'center', fontSize: 10.5, color: FOREST_SOFT, marginTop: 7, fontFamily: ViveFonts.regular },
  weekCaptionB: { color: FOREST, fontFamily: ViveFonts.semibold },

  // Próxima sesión (verde)
  next: { marginTop: 14, backgroundColor: '#3E4E2C', borderRadius: 24, padding: 17, overflow: 'hidden' },
  nextGlow: {
    position: 'absolute', right: -40, top: -46, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(234,211,198,0.10)',
  },
  eyebrow: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: GREEN_EYEBROW, fontFamily: ViveFonts.medium },
  who: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  whoAv: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#55663F' },
  whoAvFallback: { alignItems: 'center', justifyContent: 'center' },
  whoAvTxt: { fontFamily: ViveFonts.frauncesSerif, fontSize: 14, color: '#FFF3E8' },
  whoName: { fontFamily: ViveFonts.frauncesSerif, fontSize: 17, color: GREEN_TXT },
  whoSub: { fontSize: 11, color: GREEN_EYEBROW, fontFamily: ViveFonts.regular, marginTop: 2 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actBtn: { flex: 1, borderRadius: 15, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  actJoin: { backgroundColor: TERRA },
  actJoinTxt: { fontSize: 12, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },
  actDisabled: { backgroundColor: 'rgba(192,107,74,0.45)' },
  actPrep: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  actPrepTxt: { fontSize: 12, fontFamily: ViveFonts.semibold, color: GREEN_TXT },
  prep: { marginTop: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 13 },
  prepLine: { fontSize: 11.5, color: '#E9E4D2', lineHeight: 18, fontFamily: ViveFonts.regular },
  prepB: { color: GREEN_TXT, fontFamily: ViveFonts.semibold, fontSize: 11.5 },
  prepRes: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  prepOk: { color: '#C9DFA9', fontSize: 11.5, fontFamily: ViveFonts.regular, flexShrink: 1 },
  prepWarn: { color: TERRA_SOFT, fontSize: 11.5, fontFamily: ViveFonts.regular, flexShrink: 1 },

  nextEmpty: {
    marginTop: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    padding: 18, alignItems: 'center', gap: 12,
  },
  nextEmptyTxt: { fontSize: 13.5, color: FOREST_SOFT, fontFamily: ViveFonts.medium },
  nextEmptyBtn: { backgroundColor: FOREST, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 22 },
  nextEmptyBtnTxt: { color: GREEN_TXT, fontSize: 12.5, fontFamily: ViveFonts.semibold },

  // Cómo aparecer en Conexiones
  vis: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 15,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
  },
  visIcon: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: CREAM_DEEP,
  },
  visIconWarn: { backgroundColor: TERRA_SOFT },
  visTitle: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  visTxt: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17, marginTop: 3 },
});
