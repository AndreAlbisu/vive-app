import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

const COACH_NAME = 'María';
const PENDING_COUNT = 2;

type Session = {
  id: string;
  userName: string;
  time: string;
  type: string;
};

const TODAY_SESSIONS: Session[] = [
  { id: '1', userName: 'Ana López',      time: '11:00 hs', type: 'Sesión individual'    },
  { id: '2', userName: 'Carlos Méndez',  time: '15:30 hs', type: 'Sesión de seguimiento' },
];

type DayEntry = { abbr: string; sessions: Session[] };

const WEEK: DayEntry[] = [
  { abbr: 'Lun', sessions: [{ id: 'l1', userName: 'Ana López',     time: '11:00', type: 'Individual'  }] },
  { abbr: 'Mar', sessions: []                                                                              },
  { abbr: 'Mié', sessions: [{ id: 'mi1', userName: 'Pedro Ríos',   time: '10:00', type: 'Seguimiento' }] },
  { abbr: 'Jue', sessions: [{ id: 'j1', userName: 'Carlos Méndez', time: '15:30', type: 'Individual'  }] },
  { abbr: 'Vie', sessions: []                                                                              },
  { abbr: 'Sáb', sessions: []                                                                              },
  { abbr: 'Dom', sessions: []                                                                              },
];

const cardShadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

export default function CoachHomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <Text style={s.greeting}>Hola, {COACH_NAME} 👋</Text>

        {/* Alert Banner */}
        {PENDING_COUNT > 0 && (
          <TouchableOpacity
            style={s.alertBanner}
            onPress={() => router.push('/coach-reservas')}
            activeOpacity={0.85}>
            <Feather name="bell" size={15} color={ViveColors.primary} style={s.alertIcon} />
            <Text style={s.alertText}>
              Tenés{' '}
              <Text style={s.alertBold}>{PENDING_COUNT} solicitudes pendientes</Text>
              {' '}— tenés 48hs para responder
            </Text>
            <Feather name="chevron-right" size={15} color={ViveColors.primary} />
          </TouchableOpacity>
        )}

        {/* Hoy */}
        <Text style={s.sectionTitle}>Hoy</Text>

        {TODAY_SESSIONS.length > 0 ? (
          TODAY_SESSIONS.map(session => (
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
                onPress={() => router.push('/sala')}
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
          {WEEK.map((day, idx) => {
            const active = day.sessions.length > 0;
            return (
              <View key={idx} style={s.dayCol}>
                <Text style={s.dayAbbr}>{day.abbr}</Text>
                <View style={[s.dayDot, active && s.dayDotActive]}>
                  {active && <Text style={s.dayCount}>{day.sessions.length}</Text>}
                </View>
                {active && (
                  <Text style={s.dayTime}>{day.sessions[0].time}</Text>
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

  greeting: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
    marginBottom: 18,
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
