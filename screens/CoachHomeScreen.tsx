import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
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
import { encryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';
import { useCoachPending } from '@/hooks/useCoachPending';
import { confirmBooking } from '@/lib/coachBookingActions';

// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const CREAM_DEEP = '#EAE2D0';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const TERRA_SOFT = '#EAD3C6';
const TERRA_INK = '#8F4A2E';
const AMBER_SOFT = '#F0E4C4';
const AMBER_INK = '#8A6A20';
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

  const pending = useCoachPending(coachId);

  useEffect(() => {
    if (!user) return;
    supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
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

    const [{ data: profile }, { data: confirmed }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, user_id, scheduled_date, scheduled_time, sala_id, duration_minutes')
        .eq('coach_id', coachId)
        .eq('status', 'confirmada')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true }),
    ]);

    if (profile?.name) setCoachName(profile.name.split(' ')[0]);

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

  useFocusEffect(useCallback(() => {
    loadData();
    pending.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), pending.refresh()]);
    setRefreshing(false);
  }, [loadData, pending]);

  async function onConfirmRequest(bookingId: string) {
    if (!user) return;
    const ok = await confirmBooking(bookingId, user.id);
    if (!ok) { Alert.alert('No se pudo confirmar', 'Probá de nuevo en unos segundos.'); return; }
    await Promise.all([loadData(), pending.refresh()]);
  }

  function onOtherTime() {
    Alert.alert(
      'Otro horario',
      'La propuesta de horario alternativo llega pronto. Por ahora, coordinás el nuevo horario con el usuario una vez confirmada la sesión.',
    );
  }

  async function onRemind(roomId: string | null, title: string) {
    if (!roomId || !user) { Alert.alert('Sin chat', 'Todavía no hay chat con este usuario.'); return; }
    const content = `Te dejé de nuevo el recurso: "${title}" 🙂`;
    await supabase.from('messages').insert({
      sala_id: roomId,
      sender_id: user.id,
      sender_type: 'coach',
      content: encryptMessage(content),
    });
    Alert.alert('Listo', 'Le enviamos un recordatorio suave por chat ✓');
  }

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

  const pendTotal = pending.counts.total;

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
            <TouchableOpacity onPress={() => router.push('/perfil')} activeOpacity={0.85} hitSlop={8}>
              <LinearGradient colors={[TERRA, '#A5583B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
                <Text style={s.avatarTxt}>{getInitials(coachName || '?')}</Text>
              </LinearGradient>
            </TouchableOpacity>
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
                          {!r.opened && (
                            <TouchableOpacity onPress={() => onRemind(r.roomId, r.title)} hitSlop={6}>
                              <Text style={s.prepRemind}>recordarle</Text>
                            </TouchableOpacity>
                          )}
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

          {/* Pendientes */}
          <View style={s.stitle}>
            <Text style={s.stitleB}>Pendientes</Text>
            {pendTotal > 0 && <Text style={s.stitleSpan}>{pendTotal} para resolver</Text>}
          </View>

          {pendTotal === 0 ? (
            <View style={s.aldia}>
              <Text style={s.aldiaTxt}>✓ Estás al día.{'\n'}Nada pendiente por ahora.</Text>
            </View>
          ) : (
            <>
              {pending.requests.map(r => (
                <View key={r.id} style={s.pend}>
                  <View style={[s.pendIc, s.pendIcT]}>
                    <Feather name="clock" size={17} color={TERRA_INK} />
                  </View>
                  <View style={s.pendText}>
                    <Text style={s.pendTitle}>{r.userName} pidió sesión · {nextDateLabel(r.scheduledDate)} · {r.scheduledTime.slice(0, 5)}</Text>
                    {r.userMessage ? <Text style={s.pquote}>{`"${r.userMessage}"`}</Text> : null}
                  </View>
                  <View style={s.pendActs}>
                    <TouchableOpacity style={[s.btnS, s.btnSolid]} activeOpacity={0.85} onPress={() => onConfirmRequest(r.id)}>
                      <Text style={s.btnSolidTxt}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btnS, s.btnGhost]} activeOpacity={0.85} onPress={onOtherTime}>
                      <Text style={s.btnGhostTxt}>Otro horario</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {pending.unopened.map(u => (
                <View key={u.id} style={s.pend}>
                  <View style={[s.pendIc, s.pendIcA]}>
                    <Feather name="book-open" size={17} color={AMBER_INK} />
                  </View>
                  <View style={s.pendText}>
                    <Text style={s.pendTitle} numberOfLines={2}>{u.userName} no abrió "{u.title}"</Text>
                    <Text style={s.pendSub}>Tienen sesión pronto</Text>
                  </View>
                  <View style={s.pendActs}>
                    <TouchableOpacity style={[s.btnS, s.btnGhost]} activeOpacity={0.85} onPress={() => onRemind(u.roomId, u.title)}>
                      <Text style={s.btnGhostTxt}>Recordarle</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
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
  hello: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST },
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
  prepRemind: { color: '#FFF6EC', fontSize: 11.5, fontFamily: ViveFonts.semibold, textDecorationLine: 'underline' },

  nextEmpty: {
    marginTop: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    padding: 18, alignItems: 'center', gap: 12,
  },
  nextEmptyTxt: { fontSize: 13.5, color: FOREST_SOFT, fontFamily: ViveFonts.medium },
  nextEmptyBtn: { backgroundColor: FOREST, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 22 },
  nextEmptyBtnTxt: { color: GREEN_TXT, fontSize: 12.5, fontFamily: ViveFonts.semibold },

  // Pendientes
  stitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  stitleB: { fontFamily: ViveFonts.frauncesSerif, fontSize: 17, color: FOREST },
  stitleSpan: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  aldia: { padding: 20, borderWidth: 1.5, borderColor: LINE, borderRadius: 20, borderStyle: 'dashed', alignItems: 'center' },
  aldiaTxt: { textAlign: 'center', fontSize: 12.5, color: FOREST_SOFT, lineHeight: 19, fontFamily: ViveFonts.regular },
  pend: {
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  pendIc: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pendIcT: { backgroundColor: TERRA_SOFT },
  pendIcA: { backgroundColor: AMBER_SOFT },
  pendText: { flex: 1, minWidth: 0 },
  pendTitle: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: FOREST, lineHeight: 17 },
  pendSub: { fontSize: 10.5, color: FOREST_SOFT, fontFamily: ViveFonts.regular, marginTop: 2 },
  pquote: {
    fontFamily: ViveFonts.frauncesSerif, fontStyle: 'italic', fontSize: 11.5, color: '#2E3624',
    backgroundColor: '#F2ECDF', borderRadius: 11, paddingVertical: 6, paddingHorizontal: 10, marginTop: 7, lineHeight: 16,
  },
  pendActs: { gap: 6, flexShrink: 0 },
  btnS: { borderRadius: 13, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  btnSolid: { backgroundColor: FOREST },
  btnSolidTxt: { fontSize: 11, fontFamily: ViveFonts.semibold, color: '#F3EEDF' },
  btnGhost: { borderWidth: 1.5, borderColor: LINE, backgroundColor: '#F2ECDF' },
  btnGhostTxt: { fontSize: 11, fontFamily: ViveFonts.semibold, color: FOREST_SOFT },
});
