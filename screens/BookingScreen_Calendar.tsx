import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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

// `sugerida` (M6): el día que el profesional sugirió al terminar la sesión
// anterior. Abre el calendario en ese mes y lo marca. No reserva nada: si ese
// día no tiene horario libre, se elige otro.
//
// `reagendar` (M15): el id de una sesión que ya existe y se está MOVIENDO. El
// calendario y el horario se eligen igual que para una reserva nueva; lo único
// que cambia es el final del camino, que en vez de ir a pagar llama a
// `pedir_reagendado`. Va como parámetro y no como pantalla aparte porque elegir
// día y hora es exactamente el mismo trabajo, y duplicar el calendario sería
// duplicar los horarios ocupados, la zona horaria y el "no tiene lugar".
type Params = { name?: string; specialty?: string; priceFrom?: string; coachId?: string; tema?: string; sugerida?: string; reagendar?: string };

export default function BookingScreen_Calendar() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<Params>();

  const today = new Date();
  const hoyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // Una sugerencia vieja o mal formada no tiene que dejar el calendario en un
  // mes del pasado, del que después no se puede volver (`prevMonth` se frena en
  // el mes actual).
  const sugerida = /^\d{4}-\d{2}-\d{2}$/.test(params.sugerida ?? '') && (params.sugerida as string) >= hoyStr
    ? (params.sugerida as string)
    : null;
  const [year, setYear] = useState(sugerida ? Number(sugerida.slice(0, 4)) : today.getFullYear());
  const [month, setMonth] = useState(sugerida ? Number(sugerida.slice(5, 7)) - 1 : today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);
  // M3 (docs/problemas-abiertos.md): "Avisame cuando tenga horarios".
  const [coachRowId, setCoachRowId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<'nada' | 'pendiente' | 'guardando'>('nada');
  const [avisoError, setAvisoError] = useState(false);

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
      setCoachRowId(coachesId);

      if (user?.id) {
        const { data: pedido } = await supabase
          .from('availability_waitlist')
          .select('id')
          .eq('coach_id', coachesId)
          .is('resuelta_at', null)
          .maybeSingle();
        if (pedido) setAviso('pendiente');
      }

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
          .select('scheduled_date, scheduled_time, user_id, status')
          .eq('coach_id', coachesId)
          .in('status', ['pendiente', 'confirmada'])
          .gte('scheduled_date', todayStr),
      ]);

      // Mismo criterio que BookingScreen_Time: 'confirmada' ocupa el slot
      // para todos, 'pendiente' propia ocupa el slot solo para vos — evita
      // que mandes 2 solicitudes al mismo horario sin bloquear que otros
      // usuarios compitan por él.
      const bookedSet = new Set(
        (booked ?? [])
          .filter(b => b.status === 'confirmada' || b.user_id === user?.id)
          .map(b => `${b.scheduled_date}|${b.scheduled_time}`)
      );

      const slotsByDate = new Map<string, string[]>();
      avail?.forEach(({ date, time }) => {
        slotsByDate.set(date, [...(slotsByDate.get(date) ?? []), time]);
      });

      const nowMinutes = today.getHours() * 60 + today.getMinutes();

      const available = new Set<string>();
      slotsByDate.forEach((times, date) => {
        const isToday = date === todayStr;
        const hasFreeSlot = times.some(t => {
          if (bookedSet.has(`${date}|${t}`)) return false;
          if (isToday) {
            const [th, tm = 0] = t.split(':').map(Number);
            if (th * 60 + tm <= nowMinutes) return false;
          }
          return true;
        });
        if (hasFreeSlot) available.add(date);
      });

      setAvailableDates(available);
      // M6: el día sugerido queda elegido solo si el profesional tiene lugar
      // ese día. Si no, se marca igual en el calendario pero el cliente elige.
      if (sugerida && available.has(sugerida)) setSelectedDate(sugerida);
      setLoadingDates(false);
    })();
  }, [params.coachId, user?.id]);

  async function pedirAviso() {
    if (!coachRowId) return;
    if (!user) { router.push('/login'); return; }
    setAvisoError(false);
    setAviso('guardando');
    const { error } = await supabase.from('availability_waitlist').insert({ coach_id: coachRowId });
    // 23505 = ya había un pedido pendiente (índice único parcial): es lo mismo que haberlo pedido.
    if (error && error.code !== '23505') {
      console.warn('[calendario] no se pudo guardar el pedido:', error.message);
      setAviso('nada');
      setAvisoError(true);
      return;
    }
    setAviso('pendiente');
  }

  async function cancelarAviso() {
    if (!coachRowId || !user) return;
    setAviso('guardando');
    const { error } = await supabase
      .from('availability_waitlist')
      .update({ resultado: 'cancelada', resuelta_at: new Date().toISOString() })
      .eq('coach_id', coachRowId)
      .is('resuelta_at', null);
    setAviso(error ? 'pendiente' : 'nada');
  }

  const sinHorarios = !loadingDates && !!coachRowId && availableDates.size === 0;
  const nombre = (params.name ?? '').trim().split(' ')[0] || 'Este profesional';

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
        ...(params.tema && { tema: params.tema }),
        ...(params.reagendar && { reagendar: params.reagendar }),
        date: selectedDate,
      },
    });
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safeTop} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
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
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            accessibilityState={{ disabled: isCurrentMonth }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={isCurrentMonth ? "rgba(135,131,92,0.30)" : "#FFFFFF"}
            />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={s.navBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="chevron-right" size={28} color="#565E32" />
          </TouchableOpacity>
        </View>

        {loadingDates && (
          <ActivityIndicator
            size="small"
            color="#565E32"
            style={{ marginBottom: 12 }}
          />
        )}

        {sinHorarios && (
          <View style={s.waitCard}>
            <Text style={s.waitTitle}>{nombre} no tiene horarios libres por ahora</Text>
            {aviso === 'pendiente' ? (
              <>
                <Text style={s.waitText}>
                  Listo. Te avisamos apenas abra horarios nuevos.
                </Text>
                <TouchableOpacity onPress={cancelarAviso} style={s.waitLink} accessibilityRole="button">
                  <Text style={s.waitLinkText}>Ya no me interesa</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.waitText}>
                  Si querés, te avisamos cuando abra horarios nuevos. No te compromete a nada.
                </Text>
                <TouchableOpacity
                  style={[s.waitBtn, aviso === 'guardando' && s.btnDisabled]}
                  onPress={pedirAviso}
                  disabled={aviso === 'guardando'}
                  activeOpacity={0.85}
                  accessibilityRole="button">
                  {aviso === 'guardando'
                    ? <ActivityIndicator size="small" color="#F7EFE4" />
                    : <Text style={s.waitBtnText}>Avisame cuando tenga horarios</Text>}
                </TouchableOpacity>
                {avisoError && (
                  <Text style={s.waitError}>No pudimos guardarlo. Probá de nuevo en un rato.</Text>
                )}
              </>
            )}
          </View>
        )}

        {sugerida && !loadingDates && !sinHorarios && (
          <Text style={s.sugeridaHint}>
            {availableDates.has(sugerida)
              ? `${nombre} sugirió este día. Podés elegir otro.`
              : `${nombre} sugirió este día, pero no tiene horarios libres. Elegí el que te sirva.`}
          </Text>
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
              const esSugerida = sugerida === ds && !isSelected;

              return (
                <View key={di} style={s.dayCell}>
                  <TouchableOpacity
                    style={[
                      s.dayCircle,
                      available && !isSelected && s.dayCircleAvailable,
                      esSugerida && s.dayCircleSugerida,
                      isSelected && s.dayCircleSelected,
                    ]}
                    onPress={() => selectDay(day)}
                    activeOpacity={available ? 0.75 : 1}
                    // Sin esto el lector de pantalla lee "15" a secas: ni de qué
                    // mes, ni si se puede reservar. Los días sin turno ya van
                    // `disabled`, así que el foco ni se para en ellos.
                    accessibilityRole="button"
                    accessibilityLabel={
                      sugerida === ds
                        ? `${day} de ${MONTH_NAMES[month]}, el día que sugirió ${nombre}`
                        : `${day} de ${MONTH_NAMES[month]}`
                    }
                    accessibilityState={{ selected: isSelected, disabled: !available }}
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

    </AppBg>
  );
}

const dayShadow = Platform.select({
  ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safeTop: { backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
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
    color: '#565E32', letterSpacing: -0.2,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayHeader: {
    fontFamily: ViveFonts.medium, fontSize: 12,
    color: 'rgba(135,131,92,0.80)', paddingBottom: 8,
  },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayCircleAvailable: { backgroundColor: 'rgba(255,248,240,0.68)', ...dayShadow },
  dayCircleSelected: { backgroundColor: ViveColors.primary },
  // M6: el día que sugirió el profesional, todavía sin elegir. Borde y no
  // relleno, para que no se confunda con el día ya seleccionado.
  dayCircleSugerida: { borderWidth: 1.5, borderColor: ViveColors.primary },
  dayText: { fontFamily: ViveFonts.regular, fontSize: 14, color: '#CBCBCB' },
  dayTextAvailable: { fontFamily: ViveFonts.medium, color: '#565E32' },
  dayTextSelected: { fontFamily: ViveFonts.semibold, color: '#F7EFE4' },
  dayTextUnavailable: { color: '#CBCBCB' },
  waitCard: {
    backgroundColor: 'rgba(255,248,240,0.72)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    padding: 16, marginBottom: 18, gap: 8,
  },
  waitTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32' },
  waitText: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: '#566245', lineHeight: 20 },
  waitBtn: {
    backgroundColor: '#565E32', borderRadius: 14, marginTop: 4,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 46,
  },
  waitBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#F7EFE4' },
  waitLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  waitLinkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#565E32', textDecorationLine: 'underline' },
  waitError: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#B04A3A' },
  sugeridaHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  btn: {
    backgroundColor: '#565E32', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#F7EFE4', letterSpacing: 0.2 },
});
