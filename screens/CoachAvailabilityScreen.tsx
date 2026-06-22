import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
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

function formatDate(ds: string): string {
  const [, m, d] = ds.split('-').map(Number);
  return `${d} de ${MONTHS_SHORT[m - 1]}`;
}

function dateToTimeStr(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function makeDefaultPickerTime(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

type Slot = { id: string; time: string; isBooked: boolean; blocked: boolean };

export default function CoachAvailabilityScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState<Date>(makeDefaultPickerTime());

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCoachId(data?.id ?? null));
  }, [user]);

  const loadSlots = useCallback(async (date: string) => {
    if (!coachId) return;
    setLoadingSlots(true);
    const [{ data: availRows }, { data: bookedRows }] = await Promise.all([
      supabase
        .from('coach_availability')
        .select('id, time, blocked')
        .eq('coach_id', coachId)
        .eq('date', date),
      supabase
        .from('bookings')
        .select('scheduled_time')
        .eq('coach_id', coachId)
        .eq('scheduled_date', date)
        .eq('status', 'confirmada'),
    ]);
    const bookedTimes = new Set(bookedRows?.map(b => b.scheduled_time) ?? []);
    const loaded: Slot[] = (availRows ?? []).map(r => ({
      id: r.id,
      time: r.time,
      isBooked: bookedTimes.has(r.time),
      blocked: r.blocked ?? false,
    }));
    loaded.sort((a, b) => {
      const [ah, am = 0] = a.time.split(':').map(Number);
      const [bh, bm = 0] = b.time.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
    setSlots(loaded);
    setLoadingSlots(false);
  }, [coachId]);

  function selectDate(day: number) {
    if (!coachId) return;
    const date = new Date(year, month, day);
    if (date < today) return;
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(ds);
    setShowPicker(false);
    loadSlots(ds);
  }

  async function addSlot(time: string) {
    if (!coachId || !selectedDate || saving) return;
    if (slots.some(sl => sl.time === time)) return;
    setSaving(true);
    const { error } = await supabase.from('coach_availability').insert({
      coach_id: coachId,
      date: selectedDate,
      time,
    });
    if (error) Alert.alert('Error', 'No se pudo agregar el horario.');
    else await loadSlots(selectedDate);
    setSaving(false);
  }

  async function removeSlot(slotId: string) {
    if (!selectedDate || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('coach_availability')
      .update({ blocked: true })
      .eq('id', slotId);
    if (error) Alert.alert('Error', 'No se pudo bloquear el horario.');
    else await loadSlots(selectedDate);
    setSaving(false);
  }

  async function reactivateSlot(slotId: string) {
    if (!selectedDate || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('coach_availability')
      .update({ blocked: false })
      .eq('id', slotId);
    if (error) Alert.alert('Error', 'No se pudo reactivar el horario.');
    else await loadSlots(selectedDate);
    setSaving(false);
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setPickerValue(selected);
    const time = dateToTimeStr(selected);
    if (slots.some(sl => sl.time === time)) {
      Alert.alert('Horario duplicado', 'Ese horario ya está agregado.');
      return;
    }
    addSlot(time);
  }

  function prevMonth() {
    if (isCurrentMonth) return;
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const weeks = buildCalendar(year, month);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Disponibilidad</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.divider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <TouchableOpacity
          style={s.weeklyLink}
          onPress={() => router.push('/coach-weekly-pattern')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="calendar-clock" size={16} color={ViveColors.primary} />
          <Text style={s.weeklyLinkText}>Configurar horario semanal habitual</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={ViveColors.primary} />
        </TouchableOpacity>

        <View style={s.calSection}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={8} activeOpacity={isCurrentMonth ? 1 : 0.7}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={isCurrentMonth ? `${ViveColors.text}28` : ViveColors.text}
              />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={8} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chevron-right" size={28} color={ViveColors.text} />
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {DAY_LABELS.map((l, i) => (
              <View key={i} style={s.dayCell}>
                <Text style={s.dayHeader}>{l}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={s.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={s.dayCell} />;
                const isPast = new Date(year, month, day) < today;
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDate === ds;
                return (
                  <View key={di} style={s.dayCell}>
                    <TouchableOpacity
                      style={[
                        s.dayCircle,
                        !isPast && !isSelected && s.dayCircleSelectable,
                        isSelected && s.dayCircleSelected,
                      ]}
                      onPress={() => selectDate(day)}
                      activeOpacity={isPast ? 1 : 0.75}
                      disabled={isPast}
                    >
                      <Text style={[
                        s.dayText,
                        isSelected && s.dayTextSelected,
                        isPast && s.dayTextPast,
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

        {selectedDate ? (
          <View style={s.slotsCard}>
            <Text style={s.slotsTitle}>
              Horarios —{' '}
              <Text style={s.slotsTitleDate}>{formatDate(selectedDate)}</Text>
            </Text>

            {loadingSlots ? (
              <ActivityIndicator color={ViveColors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <>
                {slots.length === 0 ? (
                  <Text style={s.noSlotsText}>Sin horarios para este día.</Text>
                ) : (
                  <View style={s.slotList}>
                    {slots.map((slot) => {
                      if (slot.isBooked) {
                        return (
                          <View key={slot.id} style={[s.slotRow, s.slotRowBooked]}>
                            <MaterialCommunityIcons name="lock-outline" size={14} color={`${ViveColors.text}44`} />
                            <Text style={[s.slotTime, s.slotTimeBooked]}>{slot.time}</Text>
                          </View>
                        );
                      }
                      if (slot.blocked) {
                        return (
                          <TouchableOpacity
                            key={slot.id}
                            style={[s.slotRow, s.slotRowBlocked]}
                            onPress={() => reactivateSlot(slot.id)}
                            activeOpacity={0.75}
                            disabled={saving}
                          >
                            <MaterialCommunityIcons name="lock" size={14} color={ViveColors.primary} />
                            <Text style={[s.slotTime, s.slotTimeBlocked]}>{slot.time}</Text>
                            <MaterialCommunityIcons name="lock-open-variant-outline" size={14} color={`${ViveColors.primary}88`} />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={slot.id}
                          style={[s.slotRow, s.slotRowFree]}
                          onPress={() => removeSlot(slot.id)}
                          activeOpacity={0.75}
                          disabled={saving}
                        >
                          <MaterialCommunityIcons name="lock-open-variant-outline" size={14} color={ViveColors.accent} />
                          <Text style={[s.slotTime, s.slotTimeFree]}>{slot.time}</Text>
                          <MaterialCommunityIcons name="close" size={14} color={`${ViveColors.text}55`} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={s.addSlotBtn}
                  onPress={() => setShowPicker(p => !p)}
                  activeOpacity={0.75}
                  disabled={saving}
                >
                  <MaterialCommunityIcons name="plus" size={15} color={ViveColors.primary} />
                  <Text style={s.addSlotBtnText}>Agregar horario</Text>
                </TouchableOpacity>

                {showPicker && Platform.OS === 'ios' && (
                  <DateTimePicker
                    mode="time"
                    display="compact"
                    value={pickerValue}
                    onChange={onPickerChange}
                    locale="es"
                  />
                )}
              </>
            )}
          </View>
        ) : (
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={44} color={`${ViveColors.text}22`} />
            <Text style={s.emptyText}>Tocá una fecha para ver o editar sus horarios</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          mode="time"
          value={pickerValue}
          onChange={onPickerChange}
        />
      )}
    </SafeAreaView>
  );
}

const dayShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  android: { elevation: 1 },
});
const cardShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  android: { elevation: 2 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ViveColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
    marginRight: 36,
  },
  divider: { height: 1, backgroundColor: `${ViveColors.text}0D` },
  scroll: { paddingTop: 20 },
  calSection: { paddingHorizontal: 16, marginBottom: 8 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    letterSpacing: -0.2,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayHeader: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: `${ViveColors.text}55`,
    paddingBottom: 8,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelectable: { backgroundColor: '#FFFFFF', ...dayShadow },
  dayCircleSelected: { backgroundColor: ViveColors.primary },
  dayText: { fontFamily: ViveFonts.medium, fontSize: 14, color: ViveColors.text },
  dayTextSelected: { fontFamily: ViveFonts.semibold, color: '#FFFFFF' },
  dayTextPast: { color: '#CBCBCB', fontFamily: ViveFonts.regular },
  slotsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    ...cardShadow,
  },
  slotsTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 16,
  },
  slotsTitleDate: { color: ViveColors.primary },
  noSlotsText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}55`,
    marginBottom: 14,
  },
  slotList: { gap: 8, marginBottom: 14 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  slotRowFree: {
    backgroundColor: `${ViveColors.accent}18`,
    borderColor: `${ViveColors.accent}44`,
  },
  slotRowBooked: {
    backgroundColor: `${ViveColors.text}0A`,
    borderColor: 'transparent',
  },
  slotRowBlocked: {
    backgroundColor: `${ViveColors.primary}10`,
    borderColor: `${ViveColors.primary}44`,
  },
  slotTimeBlocked: { color: ViveColors.primary },
  slotTime: { fontFamily: ViveFonts.medium, fontSize: 14, flex: 1 },
  slotTimeFree: { color: ViveColors.text },
  slotTimeBooked: { color: `${ViveColors.text}44` },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${ViveColors.primary}44`,
    backgroundColor: `${ViveColors.primary}08`,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  addSlotBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}55`,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  weeklyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: `${ViveColors.primary}0D`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ViveColors.primary}22`,
  },
  weeklyLinkText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },
});
