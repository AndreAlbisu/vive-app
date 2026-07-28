import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type Booking = {
  id: string;
  coachName: string;
  time: string;        // HH:MM
  status: string;      // 'confirmada' | 'pendiente' | 'completada'
  sala_id: string | null;
  date: string;        // YYYY-MM-DD
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  confirmada: { label: 'Confirmada', color: '#3F7D4F', bg: 'rgba(63,125,79,0.14)' },
  pendiente:  { label: 'Pendiente',  color: '#C1694F', bg: 'rgba(193,105,79,0.14)' },
  completada: { label: 'Completada', color: '#87835C', bg: 'rgba(135,131,92,0.14)' },
};

function buildCalendar(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7; // semana arranca en lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const TODAY = new Date();
const TODAY_STR = dateStr(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

export default function UserAgendaScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth());
  const [selected, setSelected] = useState<string | null>(TODAY_STR);
  const [byDate, setByDate] = useState<Record<string, Booking[]>>({});
  const [loading, setLoading] = useState(true);

  const weeks = buildCalendar(year, month);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const from = dateStr(year, month, 1);
    const to = dateStr(year, month, new Date(year, month + 1, 0).getDate());

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, coach_id, coach_name, scheduled_date, scheduled_time, sala_id, status')
      .eq('user_id', user.id)
      .in('status', ['confirmada', 'pendiente', 'completada'])
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_time', { ascending: true });

    const rows = bookings ?? [];

    // bookings.coach_id → coaches.id (NO profiles.id — ver SCHEMA regla 2).
    // Join de dos pasos: coaches.id → coaches.profile_id → profiles.name.
    const coachIds = [...new Set(rows.map(b => b.coach_id))];
    let profileIdByCoach: Record<string, string> = {};
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase
        .from('coaches')
        .select('id, profile_id')
        .in('id', coachIds);
      profileIdByCoach = Object.fromEntries((coaches ?? []).map(c => [c.id, c.profile_id]));
    }
    const profileIds = [...new Set(Object.values(profileIdByCoach))];
    let nameByProfile: Record<string, string> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', profileIds);
      nameByProfile = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name ?? 'Profesional']));
    }

    const grouped: Record<string, Booking[]> = {};
    for (const b of rows) {
      const item: Booking = {
        id: b.id,
        coachName: nameByProfile[profileIdByCoach[b.coach_id]] ?? b.coach_name ?? 'Profesional',
        time: (b.scheduled_time as string).slice(0, 5),
        status: b.status,
        sala_id: b.sala_id,
        date: b.scheduled_date,
      };
      (grouped[b.scheduled_date] ??= []).push(item);
    }
    setByDate(grouped);
    setLoading(false);
  }, [user, year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
    setSelected(null);
  }

  const selectedBookings = selected ? (byDate[selected] ?? []) : [];

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Mis reservas</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={8} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={28} color="#565E32" />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={8} activeOpacity={0.7}>
              <MaterialIcons name="chevron-right" size={28} color="#565E32" />
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {DAY_LABELS.map((label, i) => (
              <View key={i} style={s.dayCell}><Text style={s.dayHeader}>{label}</Text></View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={s.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={s.dayCell} />;
                const ds = dateStr(year, month, day);
                const count = byDate[ds]?.length ?? 0;
                const isSelected = selected === ds;
                const isToday = ds === TODAY_STR;
                return (
                  <View key={di} style={s.dayCell}>
                    <TouchableOpacity
                      style={[s.dayCircle, isToday && s.dayCircleToday, isSelected && s.dayCircleSelected]}
                      onPress={() => setSelected(ds)}
                      activeOpacity={0.75}>
                      <Text style={[s.dayText, isSelected && s.dayTextSelected]}>{day}</Text>
                      {count > 0 && (
                        <View style={[s.dot, isSelected && s.dotSelected]} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          {loading && <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 20 }} />}

          {/* Detalle del día seleccionado */}
          {!loading && selected && (
            <View style={s.detail}>
              <Text style={s.detailTitle}>
                {(() => {
                  const [y, m, d] = selected.split('-').map(Number);
                  return `${d} de ${MONTH_NAMES[m - 1]}`;
                })()}
              </Text>

              {selectedBookings.length === 0 ? (
                <Text style={s.emptyDay}>No tenés reservas este día</Text>
              ) : (
                selectedBookings.map(b => {
                  const meta = STATUS_META[b.status] ?? { label: b.status, color: '#87835C', bg: 'rgba(135,131,92,0.14)' };
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={s.bookingCard}
                      activeOpacity={b.sala_id ? 0.85 : 1}
                      onPress={() => { if (b.sala_id) router.push({ pathname: '/sala', params: { sala_id: b.sala_id } }); }}
                    >
                      <View style={s.timeTag}><Text style={s.timeTagText}>{b.time}</Text></View>
                      <View style={s.bookingInfo}>
                        <Text style={s.bookingUser}>{b.coachName}</Text>
                        <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                      {b.sala_id && <MaterialIcons name="chevron-right" size={20} color="rgba(135,131,92,0.5)" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
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
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
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

  content: { paddingHorizontal: 16, paddingTop: 12 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 18, paddingHorizontal: 4,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32', letterSpacing: -0.2 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayHeader: { fontFamily: ViveFonts.medium, fontSize: 12, color: 'rgba(135,131,92,0.80)', paddingBottom: 8 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { backgroundColor: 'rgba(255,248,240,0.68)' },
  dayCircleSelected: { backgroundColor: ViveColors.primary },
  dayText: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#565E32' },
  dayTextSelected: { fontFamily: ViveFonts.semibold, color: '#F7EFE4' },
  dot: {
    position: 'absolute', bottom: 5,
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: ViveColors.primary,
  },
  dotSelected: { backgroundColor: '#F7EFE4' },

  detail: { marginTop: 20 },
  detailTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32', marginBottom: 12 },
  emptyDay: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', paddingVertical: 8 },

  bookingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
    padding: 12, marginBottom: 10,
  },
  timeTag: {
    backgroundColor: 'rgba(86,94,50,0.10)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  timeTagText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32' },
  bookingInfo: { flex: 1, gap: 4 },
  bookingUser: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontFamily: ViveFonts.medium, fontSize: 11 },
});
