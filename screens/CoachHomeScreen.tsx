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
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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

const cardShadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

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
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="small" color={ViveColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={s.greetingRow}>
          <Text style={s.greeting}>Hola, {coachName} 👋</Text>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push('/coach-notifications')}
            hitSlop={8}
            activeOpacity={0.7}>
            <Feather name="bell" size={22} color={ViveColors.text} />
            {unreadCount > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
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
              {' '}— tenés 48hs para responder
            </Text>
            <Feather name="chevron-right" size={15} color={ViveColors.primary} />
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
                <Feather name="message-circle" size={20} color={ViveColors.primary} />
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  greeting: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
  },
  bellBtn: {
    padding: 4,
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ViveColors.primary,
    borderWidth: 1.5,
    borderColor: ViveColors.background,
  },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF0E8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: `${ViveColors.primary}30`,
    gap: 8,
  },
  alertIcon: { flexShrink: 0 },
  alertText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 19,
  },
  alertBold: {
    fontFamily: ViveFonts.semibold,
    color: ViveColors.primary,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 28 },

  // Session Card
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  timeTag: {
    backgroundColor: `${ViveColors.primary}15`,
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
    color: ViveColors.text,
    marginBottom: 2,
  },
  sessionType: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}70`,
  },
  chatBtn: {
    padding: 4,
    flexShrink: 0,
  },

  // Empty today
  emptyToday: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
    ...cardShadow,
  },
  emptyTodayText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}70`,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Week grid
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...cardShadow,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayAbbr: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: `${ViveColors.text}80`,
  },
  dayDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${ViveColors.text}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: {
    backgroundColor: ViveColors.primary,
  },
  dayCount: {
    fontFamily: ViveFonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  dayTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 9,
    color: ViveColors.primary,
    textAlign: 'center',
  },
});
