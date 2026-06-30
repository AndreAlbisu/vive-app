import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';

type Session = {
  id: string;
  userName: string;
  time: string;
  type: string;
  sala_id: string | null;
  date: string;
};

type DayEntry = { abbr: string; sessions: Session[] };

const WEEK_ABBRS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const GLASS = 'rgba(255,255,255,0.14)';
const GLASS_BORDER = 'rgba(255,255,255,0.28)';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  return toDateStr(new Date());
}

function getWeekRange(): { mondayDate: Date } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return { mondayDate: monday };
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(':');
  return `${parts[0]}:${parts[1]} hs`;
}

export default function CoachHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachName, setCoachName] = useState('');
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [weekData, setWeekData] = useState<DayEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !coachId) { setLoading(false); return; }

    const todayStr = getTodayStr();
    const { mondayDate } = getWeekRange();

    const [profileRes, bookingsRes, pendingRes] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, user_id, date, time, sala_id')
        .eq('coach_id', coachId)
        .eq('status', 'confirmada')
        .order('date', { ascending: true })
        .order('time', { ascending: true }),
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'pendiente'),
    ]);

    if (profileRes.data?.name) {
      setCoachName(profileRes.data.name.split(' ')[0]);
    }

    const bookings = bookingsRes.data ?? [];

    // Fetch user names in a single query
    const userIds = [...new Set(bookings.map(b => b.user_id))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name ?? 'Usuario']));
    }

    const sessions: Session[] = bookings.map(b => ({
      id: b.id,
      userName: profileMap[b.user_id] ?? 'Usuario',
      time: formatTime(b.time),
      type: 'Sesión individual',
      sala_id: b.sala_id,
      date: b.date,
    }));

    setTodaySessions(sessions.filter(s => s.date === todayStr));

    const week: DayEntry[] = WEEK_ABBRS.map((abbr, i) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      const dateStr = toDateStr(d);
      return { abbr, sessions: sessions.filter(s => s.date === dateStr) };
    });
    setWeekData(week);

    setPendingCount(pendingRes.count ?? 0);
    setLoading(false);
  }, [user, coachId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('coach-notif-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => {
          supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', user.id)
            .eq('read', false)
            .then(({ count }) => setUnreadCount(count ?? 0));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="small" color={ViveColors.primary} />
        </View>
      </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={s.greetingRow}>
          <Text style={s.greeting}>Hola, {coachName} 👋</Text>
          <View style={s.topRight}>
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => router.push('/coach-notifications')}
              hitSlop={8}
              activeOpacity={0.7}>
              <Feather name="bell" size={22} color="rgba(255,255,255,0.8)" />
              {unreadCount > 0 && <View style={s.bellDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/perfil')}
              hitSlop={8}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#FF9A52', ViveColors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarCircle}>
                <Text style={s.avatarInitial}>{(coachName.charAt(0) || '?').toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alert Banner */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={s.alertBanner}
            onPress={() => router.navigate('/reservas')}
            activeOpacity={0.85}>
            <Feather name="bell" size={15} color={ViveColors.primary} style={s.alertIcon} />
            <Text style={s.alertText}>
              Tenés{' '}
              <Text style={s.alertBold}>{pendingCount} solicitudes pendientes</Text>
              {' '}— tenés 24hs para responder
            </Text>
            <Feather name="chevron-right" size={15} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* Hoy */}
        <Text style={s.sectionTitle}>Hoy</Text>

        {todaySessions.length > 0 ? (
          todaySessions.map(session => (
            <View key={session.id} style={s.sessionCard}>
              <View style={s.timeTag}>
                <Text style={s.timeTagText}>{session.time}</Text>
              </View>
              <View style={s.sessionInfo}>
                <Text style={s.sessionUser}>{session.userName}</Text>
                <Text style={s.sessionType}>{session.type}</Text>
              </View>
              <TouchableOpacity
                style={s.chatBtn}
                onPress={() =>
                  router.push(
                    session.sala_id
                      ? { pathname: '/sala', params: { sala_id: session.sala_id } }
                      : '/sala'
                  )
                }
                activeOpacity={0.75}
                hitSlop={6}>
                <Feather name="message-circle" size={20} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={s.emptyToday}>
            <Text style={s.emptyTodayText}>No tenés sesiones hoy. Disfrutá el día 🌿</Text>
          </View>
        )}

        {/* Esta semana */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Esta semana</Text>
        <View style={s.weekCard}>
          {weekData.map((day, idx) => {
            const active = day.sessions.length > 0;
            return (
              <View key={idx} style={s.dayCol}>
                <Text style={s.dayAbbr}>{day.abbr}</Text>
                <View style={[s.dayDot, active && s.dayDotActive]}>
                  {active && <Text style={s.dayCount}>{day.sessions.length}</Text>}
                </View>
                {active && (
                  <Text style={s.dayTime}>{day.sessions[0].time.replace(' hs', '')}</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: TAB_BAR_CLEARANCE }} />
      </ScrollView>
    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 22 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  greeting: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#FFFFFF',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellBtn: { padding: 4 },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ViveColors.primary,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232,116,59,0.18)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(232,116,59,0.4)',
    gap: 8,
  },
  alertIcon: { flexShrink: 0 },
  alertText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 19,
  },
  alertBold: {
    fontFamily: ViveFonts.semibold,
    color: ViveColors.primary,
  },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 28 },

  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  timeTag: {
    backgroundColor: 'rgba(232,116,59,0.22)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  timeTagText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.primary,
  },
  sessionInfo: { flex: 1 },
  sessionUser: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sessionType: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  chatBtn: { padding: 4, flexShrink: 0 },

  emptyToday: {
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTodayText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
  },

  weekCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  dayAbbr: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  dayDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: { backgroundColor: ViveColors.primary },
  dayCount: { fontFamily: ViveFonts.bold, fontSize: 11, color: '#FFFFFF' },
  dayTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 9,
    color: ViveColors.primary,
    textAlign: 'center',
  },
});
