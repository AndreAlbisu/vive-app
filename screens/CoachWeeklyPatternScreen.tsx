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
import { generateWeeklySlots } from '@/lib/availabilityGenerator';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DURATIONS = [30, 60, 90] as const;
type Duration = (typeof DURATIONS)[number];

type PatternBlock = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

function dateToTimeStr(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function makeDefaultStart(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function makeDefaultEnd(start: Date | null): Date {
  if (start) {
    const d = new Date(start);
    d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
    return d;
  }
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function CoachWeeklyPatternScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state — one open form at a time
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<Duration>(60);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCoachId(data?.id ?? null));
  }, [user]);

  const loadBlocks = useCallback(async () => {
    if (!coachId) return;
    const { data } = await supabase
      .from('coach_weekly_pattern')
      .select('*')
      .eq('coach_id', coachId)
      .order('day_of_week')
      .order('start_time');
    setBlocks(data ?? []);
  }, [coachId]);

  // On mount: load patterns + extend 8-week window
  useEffect(() => {
    if (!coachId) return;
    (async () => {
      setLoading(true);
      await loadBlocks();
      setGenerating(true);
      await generateWeeklySlots(coachId, supabase);
      setGenerating(false);
      setLoading(false);
    })();
  }, [coachId, loadBlocks]);

  function openAddForm(day: number) {
    setAddingFor(day);
    setStartTime(null);
    setEndTime(null);
    setDuration(60);
    setPickerTarget(null);
  }

  function cancelAdd() {
    setAddingFor(null);
    setPickerTarget(null);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setPickerTarget(null); // dialog closes after any selection
    }
    if (event.type === 'dismissed' || !selected) return;
    if (pickerTarget === 'start') setStartTime(selected);
    else if (pickerTarget === 'end') setEndTime(selected);
  }

  // Disabled until both times are set AND end is strictly after start
  const canSave =
    startTime !== null &&
    endTime !== null &&
    endTime.getTime() > startTime.getTime();

  async function saveBlock() {
    if (!coachId || !addingFor || !canSave || saving) return;
    setSaving(true);
    const { error } = await supabase.from('coach_weekly_pattern').insert({
      coach_id: coachId,
      day_of_week: addingFor,
      start_time: dateToTimeStr(startTime!),
      end_time: dateToTimeStr(endTime!),
      slot_duration_minutes: duration,
    });
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el bloque.');
      setSaving(false);
      return;
    }
    await loadBlocks();
    setGenerating(true);
    await generateWeeklySlots(coachId, supabase);
    setGenerating(false);
    setAddingFor(null);
    setPickerTarget(null);
    setSaving(false);
  }

  function confirmDeleteBlock(id: string) {
    Alert.alert(
      'Eliminar bloque',
      'Los slots ya generados en disponibilidad no se borran. Solo se deja de generar a futuro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await supabase.from('coach_weekly_pattern').delete().eq('id', id);
            await loadBlocks();
            setSaving(false);
          },
        },
      ],
    );
  }

  const blocksForDay = (day: number) => blocks.filter(b => b.day_of_week === day);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Horario semanal</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.divider} />
        <ActivityIndicator color={ViveColors.primary} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Horario semanal</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.divider} />

      {generating && (
        <View style={s.generatingBar}>
          <ActivityIndicator size="small" color={ViveColors.primary} />
          <Text style={s.generatingText}>Extendiendo disponibilidad…</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.subtitle}>
          Los bloques configurados acá se aplican automáticamente a los próximos 56 días.
        </Text>

        {DAY_NAMES.map((dayName, idx) => {
          const day = idx + 1; // 1=Lunes … 7=Domingo
          const dayBlocks = blocksForDay(day);
          const isAdding = addingFor === day;

          return (
            <View key={day} style={s.dayCard}>
              <Text style={s.dayName}>{dayName}</Text>

              {dayBlocks.length > 0 && (
                <View style={s.blockList}>
                  {dayBlocks.map(b => (
                    <View key={b.id} style={s.blockRow}>
                      <View style={s.blockInfo}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={ViveColors.accent} />
                        <Text style={s.blockTime}>{b.start_time} – {b.end_time}</Text>
                        <Text style={s.blockDuration}>· {b.slot_duration_minutes} min</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => confirmDeleteBlock(b.id)}
                        hitSlop={8}
                        activeOpacity={0.7}
                        disabled={saving}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color={`${ViveColors.text}44`}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {isAdding ? (
                <View style={s.addForm}>
                  {/* Start time */}
                  <View style={s.timeRow}>
                    <Text style={s.timeLabel}>Inicio</Text>
                    <TouchableOpacity
                      style={[s.timeBtn, startTime !== null && s.timeBtnSet]}
                      onPress={() => setPickerTarget(p => (p === 'start' ? null : 'start'))}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={15}
                        color={startTime !== null ? ViveColors.primary : `${ViveColors.text}55`}
                      />
                      <Text style={[s.timeBtnText, startTime !== null && s.timeBtnTextSet]}>
                        {startTime !== null ? dateToTimeStr(startTime) : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {pickerTarget === 'start' && Platform.OS === 'ios' && (
                    <DateTimePicker
                      mode="time"
                      display="compact"
                      value={startTime ?? makeDefaultStart()}
                      onChange={onTimeChange}
                      locale="es"
                    />
                  )}

                  {/* End time */}
                  <View style={s.timeRow}>
                    <Text style={s.timeLabel}>Fin</Text>
                    <TouchableOpacity
                      style={[s.timeBtn, endTime !== null && s.timeBtnSet]}
                      onPress={() => setPickerTarget(p => (p === 'end' ? null : 'end'))}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={15}
                        color={endTime !== null ? ViveColors.primary : `${ViveColors.text}55`}
                      />
                      <Text style={[s.timeBtnText, endTime !== null && s.timeBtnTextSet]}>
                        {endTime !== null ? dateToTimeStr(endTime) : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {pickerTarget === 'end' && Platform.OS === 'ios' && (
                    <DateTimePicker
                      mode="time"
                      display="compact"
                      value={endTime ?? makeDefaultEnd(startTime)}
                      onChange={onTimeChange}
                      locale="es"
                    />
                  )}

                  {startTime !== null && endTime !== null && !canSave && (
                    <Text style={s.validationHint}>El fin debe ser posterior al inicio.</Text>
                  )}

                  {/* Duration chips */}
                  <Text style={s.durationLabel}>Duración por turno</Text>
                  <View style={s.durationRow}>
                    {DURATIONS.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[s.durationChip, duration === d && s.durationChipActive]}
                        onPress={() => setDuration(d)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.durationChipText, duration === d && s.durationChipTextActive]}>
                          {d} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={s.formActions}>
                    <TouchableOpacity style={s.cancelBtn} onPress={cancelAdd} activeOpacity={0.7}>
                      <Text style={s.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
                      onPress={saveBlock}
                      activeOpacity={canSave ? 0.8 : 1}
                      disabled={!canSave || saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={s.saveBtnText}>Guardar bloque</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => openAddForm(day)}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <MaterialCommunityIcons name="plus" size={15} color={ViveColors.primary} />
                  <Text style={s.addBtnText}>Agregar bloque</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Android: render picker outside ScrollView — it opens as a native dialog */}
      {Platform.OS === 'android' && pickerTarget !== null && addingFor !== null && (
        <DateTimePicker
          mode="time"
          value={
            pickerTarget === 'start'
              ? (startTime ?? makeDefaultStart())
              : (endTime ?? makeDefaultEnd(startTime))
          }
          onChange={onTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

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

  generatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: `${ViveColors.primary}0D`,
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.primary}1A`,
  },
  generatingText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.primary,
  },

  scroll: { paddingTop: 20 },

  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}88`,
    lineHeight: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },

  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    ...cardShadow,
  },
  dayName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 10,
  },

  blockList: { gap: 8, marginBottom: 8 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${ViveColors.accent}18`,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  blockInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockTime: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.text },
  blockDuration: { fontFamily: ViveFonts.regular, fontSize: 12, color: `${ViveColors.text}66` },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  addBtnText: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.primary },

  addForm: {
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}0D`,
    marginTop: 4,
    paddingTop: 12,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  timeLabel: { fontFamily: ViveFonts.medium, fontSize: 14, color: ViveColors.text },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}28`,
  },
  timeBtnSet: {
    borderColor: `${ViveColors.primary}55`,
    backgroundColor: `${ViveColors.primary}0D`,
  },
  timeBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: `${ViveColors.text}66` },
  timeBtnTextSet: { color: ViveColors.primary },

  validationHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#C0392B',
    marginTop: 4,
    marginBottom: 4,
  },

  durationLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}28`,
  },
  durationChipActive: { backgroundColor: ViveColors.primary, borderColor: ViveColors.primary },
  durationChipText: { fontFamily: ViveFonts.medium, fontSize: 13, color: `${ViveColors.text}88` },
  durationChipTextActive: { color: '#FFFFFF' },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}28`,
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: `${ViveColors.text}88` },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: `${ViveColors.primary}55` },
  saveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#FFFFFF' },
});
