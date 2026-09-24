import { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { generateWeeklySlots } from '@/lib/availabilityGenerator';
import { AppBg } from '@/components/ui/AppBg';
import CampoHora, { horaVisible } from '@/components/ui/CampoHora';

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
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Los horarios que va a ofrecer el bloque. Misma cuenta que
 *  `generateWeeklySlots`: arranca en el inicio y avanza de a un turno mientras
 *  no llegue al fin. */
function turnosDelBloque(start: Date, end: Date, duration: number): string[] {
  const out: string[] = [];
  for (let t = new Date(start); t.getTime() < end.getTime(); t = new Date(t.getTime() + duration * 60_000)) {
    out.push(horaVisible(t));
  }
  return out;
}

function listaDeHoras(horas: string[]): string {
  if (horas.length <= 1) return horas.join('');
  return `${horas.slice(0, -1).join(', ')} y ${horas[horas.length - 1]}`;
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
  }

  function cancelAdd() {
    setAddingFor(null);
  }

  // Al elegir el inicio, el fin se propone una hora después si todavía no hay
  // uno que sirva: el caso común es un bloque corto, y ahorra abrir la rueda.
  function elegirInicio(d: Date) {
    setStartTime(d);
    if (!endTime || endTime.getTime() <= d.getTime()) setEndTime(makeDefaultEnd(d));
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
      Alert.alert('Error', 'No se pudo guardar el bloque');
      setSaving(false);
      return;
    }
    await loadBlocks();
    setGenerating(true);
    await generateWeeklySlots(coachId, supabase);
    setGenerating(false);
    setAddingFor(null);
    setSaving(false);
  }

  function confirmDeleteBlock(id: string) {
    Alert.alert(
      'Eliminar bloque',
      'Los slots ya generados en disponibilidad no se borran. Solo se deja de generar a futuro',
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
      <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Horario semanal</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.divider} />
        <ActivityIndicator color={ViveColors.primary} style={{ marginTop: 48 }} />
      </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
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
                          color="rgba(135,131,92,0.52)"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {isAdding ? (
                <View style={s.addForm}>
                  <View style={s.timeRow}>
                    <CampoHora
                      label="Desde"
                      titulo="Empieza a las"
                      value={startTime}
                      porDefecto={makeDefaultStart()}
                      onChange={elegirInicio}
                    />
                    <MaterialCommunityIcons name="arrow-right" size={18} color="rgba(135,131,92,0.6)" />
                    <CampoHora
                      label="Hasta"
                      titulo="Termina a las"
                      value={endTime}
                      porDefecto={makeDefaultEnd(startTime)}
                      onChange={setEndTime}
                    />
                  </View>

                  {startTime !== null && endTime !== null && !canSave && (
                    <Text style={s.validationHint}>El fin tiene que ser después del inicio</Text>
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

                  {canSave && (
                    <Text style={s.turnosHint}>
                      {(() => {
                        const t = turnosDelBloque(startTime!, endTime!, duration);
                        return t.length === 1 ? `Un turno, a las ${t[0]}` : `${t.length} turnos: ${listaDeHoras(t)}`;
                      })()}
                    </Text>
                  )}

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
                        <ActivityIndicator size="small" color={ViveColors.onPrimaryInk} />
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

    </SafeAreaView>
    </AppBg>
  );
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const s = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
    marginRight: 36,
  },
  divider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

  generatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(232,116,59,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232,116,59,0.2)',
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
    color: '#87835C',
    lineHeight: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },

  dayCard: {
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
  },
  dayName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
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
  blockTime: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#565E32' },
  blockDuration: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.72)' },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  addBtnText: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.primary },

  addForm: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.10)',
    marginTop: 4,
    paddingTop: 12,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

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
    color: '#565E32',
    marginTop: 14,
    marginBottom: 8,
  },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  turnosHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: '#87835C',
    marginTop: 12,
  },
  durationChipActive: { backgroundColor: ViveColors.primaryInk, borderColor: ViveColors.primaryInk },
  durationChipText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C' },
  // 🔴 Se escapó de la primera barrida: era oliva sobre la terracota clara
  // (1.78:1), o sea que ELEGIR una duración volvía a ese chip el más difícil de
  // leer de la fila — el estado seleccionado señalaba al revés. La auditoría no
  // lo encontró porque solo emparejaba estilos `<nombre>Text`, y este se llama
  // `durationChipTextActive`.
  durationChipTextActive: { color: ViveColors.onPrimaryInk },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#87835C' },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ViveColors.primaryInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 🔴 Atenúa el botón ENTERO en vez de lavarle el fondo. Lavándolo, el fondo
  // se aclaraba hasta ~#D7B8AA y el texto crema quedaba en 1.63:1 — invisible
  // justo cuando hay que leer qué falta completar. Con `opacity`, el texto y su
  // fondo bajan juntos y conservan sus 4.59:1; el control se apaga contra la
  // página, que es lo que "deshabilitado" tiene que comunicar.
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#F7EFE4' },
});
