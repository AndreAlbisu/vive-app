import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function buildCalendar(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

type Params = { name?: string; specialty?: string; priceFrom?: string; coachId?: string };

export default function BookingScreen_Calendar() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);

  const weeks = buildCalendar(year, month);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  useEffect(() => {
    if (!params.coachId) { setLoadingDates(false); return; }
    (async () => {
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', params.coachId)
        .maybeSingle();

      if (!coachRow?.id) { setLoadingDates(false); return; }
      const coachesId = coachRow.id;

      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const [{ data: avail }, { data: booked }] = await Promise.all([
        supabase
          .from('coach_availability')
          .select('date, time')
          .eq('coach_id', coachesId)
          .eq('blocked', false)
          .gte('date', todayStr),
        supabase
          .from('bookings')
          .select('scheduled_date, scheduled_time')
          .eq('coach_id', coachesId)
          .eq('status', 'confirmada')
          .gte('scheduled_date', todayStr),
      ]);

      const bookedSet = new Set(
        booked?.map(b => `${b.scheduled_date}|${b.scheduled_time}`) ?? []
      );

      const slotsByDate = new Map<string, string[]>();
      avail?.forEach(({ date, time }) => {
        slotsByDate.set(date, [...(slotsByDate.get(date) ?? []), time]);
      });

      const available = new Set<string>();
      slotsByDate.forEach((times, date) => {
        if (times.some(t => !bookedSet.has(`${date}|${t}`))) available.add(date);
      });

      setAvailableDates(available);
      setLoadingDates(false);
    })();
  }, [params.coachId]);

  function prevMonth() {
    if (isCurrentMonth) return;
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!availableDates.has(ds)) return;
    setSelectedDate(ds);
  }

  function onSeguimos() {
    if (!selectedDate) return;
    router.push({
      pathname: '/booking-time',
      params: {
        ...(params.name && { name: params.name }),
        ...(params.specialty && { specialty: params.specialty }),
        ...(params.priceFrom && { priceFrom: params.priceFrom }),
        ...(params.coachId && { coachId: params.coachId }),
        date: selectedDate,
      },
    });
  }

  return (
    <View style={s.root}>

      <SafeAreaView style={s.safeTop} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color={ViveColors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Elegí una fecha</Text>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '33%' }]} />
        </View>
      </SafeAreaView>

      <View style={s.content}>
        <View style={s.monthNav}>
          <TouchableOpacity
            onPress={prevMonth}
            style={s.navBtn}
            activeOpacity={isCurrentMonth ? 1 : 0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={isCurrentMonth ? `${ViveColors.text}28` : ViveColors.text}
            />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={s.navBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="chevron-right" size={28} color={ViveColors.text} />
          </TouchableOpacity>
        </View>

        {loadingDates && (
          <ActivityIndicator
            size="small"
            color={ViveColors.primary}
            style={{ marginBottom: 12 }}
          />
        )}

        <View style={s.weekRow}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={s.dayCell}>
              <Text style={s.dayHeader}>{label}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={s.weekRow}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={s.dayCell} />;

              const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const available = !loadingDates && availableDates.has(ds);
              const isSelected = selectedDate === ds;

              return (
                <View key={di} style={s.dayCell}>
                  <TouchableOpacity
                    style={[
                      s.dayCircle,
                      available && !isSelected && s.dayCircleAvailable,
                      isSelected && s.dayCircleSelected,
                    ]}
                    onPress={() => selectDay(day)}
                    activeOpacity={available ? 0.75 : 1}
                    disabled={!available}>
                    <Text style={[
                      s.dayText,
                      available && !isSelected && s.dayTextAvailable,
                      isSelected && s.dayTextSelected,
                      !available && s.dayTextUnavailable,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btn, !selectedDate && s.btnDisabled]}
            onPress={onSeguimos}
            disabled={!selectedDate}
            activeOpacity={0.85}>
            <Text style={s.btnText}>Seguimos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

    </View>
  );
}

const dayShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ViveColors.background },
  safeTop: { backgroundColor: ViveColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: ViveColors.text, textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  progressTrack: {
    height: 4, backgroundColor: `${ViveColors.primary}22`,
    marginHorizontal: 20, borderRadius: 2, marginBottom: 6, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: ViveColors.primary, borderRadius: 2 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthLabel: {
    fontFamily: ViveFonts.semibold, fontSize: 17,
    color: ViveColors.text, letterSpacing: -0.2,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayHeader: {
    fontFamily: ViveFonts.medium, fontSize: 12,
    color: `${ViveColors.text}55`, paddingBottom: 8,
  },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayCircleAvailable: { backgroundColor: '#FFFFFF', ...dayShadow },
  dayCircleSelected: { backgroundColor: ViveColors.primary },
  dayText: { fontFamily: ViveFonts.regular, fontSize: 14, color: '#CBCBCB' },
  dayTextAvailable: { fontFamily: ViveFonts.medium, color: ViveColors.text },
  dayTextSelected: { fontFamily: ViveFonts.semibold, color: '#FFFFFF' },
  dayTextUnavailable: { color: '#CBCBCB' },
  footerSafe: {
    backgroundColor: ViveColors.background,
    borderTopWidth: 1, borderTopColor: `${ViveColors.text}10`,
  },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  btn: {
    backgroundColor: ViveColors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },
});
