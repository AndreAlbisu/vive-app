import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';
import { encryptMessage } from '@/lib/encryption';
import { isCancelLate } from '@/lib/bookingHelpers';
import { confirmBooking, rejectBooking } from '@/lib/coachBookingActions';
import { AppBg } from '@/components/ui/AppBg';

// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const TERRA_LINE = 'rgba(192,107,74,0.30)';
const LINE = 'rgba(63,81,47,0.14)';
const CREAM = '#F2ECDF';

type ReservationStatus = 'pendiente' | 'confirmada' | 'cancelada';

interface Booking {
  id: string;
  user_id: string;
  coach_id: string;
  sala_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  status: ReservationStatus;
  created_at: string;
  user_message: string | null;
  userName: string;
  initials: string;
  avatarUrl: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fullDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

function dayGroupLabel(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const full = fullDate(dateStr);
  if (diff === 0) return `Hoy · ${full}`;
  if (diff === 1) return `Mañana · ${full}`;
  return full;
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'hace unos minutos';
  if (diffH < 24) return `hace ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;
}

function ordinalLabel(n: number): string {
  return `${n}.ª sesión`;
}

function startMs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0).getTime();
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CoachReservasScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isInTab = segments[0] === '(coach)';
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [completedByUser, setCompletedByUser] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });
  const [rejectReason, setRejectReason] = useState('');
  const [coachId, setCoachId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  /** Se inició un cobro y todavía no se acreditó. */
  const esperandoPago = (b: any) =>
    b.payment_status === 'pendiente' && (b.preference_id != null || b.usdt_amount != null);

  // 🔴 Las que esperan pago se MUESTRAN pero no se pueden CONFIRMAR. Confirmar
  // compromete el horario, le avisa al usuario y cancela a los competidores del
  // slot — todo eso sin que haya entrado un peso. Con Mercado Pago casi no se
  // notaba porque el checkout se paga en el acto y lo impago se cancela a los
  // 30 minutos; con USDT la ventana es real y puede no pagarse nunca.
  //
  // ⚠️ RECHAZAR sí se puede, y es importante: rechazar no compromete nada, libera
  // el turno. Al sacarlas de la lista por completo, el coach que no podía atender
  // a esa hora se quedaba sin forma de decirlo hasta que el pago entrara o
  // expirara. Se restringe la acción peligrosa, no la pantalla entera.
  //
  // Las reservas sin cobro iniciado (coach sin MP conectado) no se restringen:
  // ahí no hay nada que esperar, y son las que ya funcionaban así.
  const pending = bookings.filter(b => b.status === 'pendiente');

  const todayStr = toDateStr(new Date());
  // Confirmadas próximas (de hoy en adelante), ordenadas cronológicamente.
  const confirmedUpcoming = useMemo(() => bookings
    .filter(b => b.status === 'confirmada' && b.scheduled_date >= todayStr)
    .sort((a, b) => startMs(a.scheduled_date, a.scheduled_time) - startMs(b.scheduled_date, b.scheduled_time)),
    [bookings, todayStr]);

  // Ordinal por reserva: sesiones completadas del par + rank entre las confirmadas
  // futuras de ese usuario (así dos turnos del mismo usuario dan N y N+1).
  const ordinals = useMemo(() => {
    const rankByUser: Record<string, number> = {};
    const map: Record<string, string> = {};
    for (const b of confirmedUpcoming) {
      rankByUser[b.user_id] = (rankByUser[b.user_id] ?? 0) + 1;
      map[b.id] = ordinalLabel((completedByUser[b.user_id] ?? 0) + rankByUser[b.user_id]);
    }
    return map;
  }, [confirmedUpcoming, completedByUser]);

  // Agrupadas por día para el render.
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: Booking[] }[] = [];
    for (const b of confirmedUpcoming) {
      let g = groups.find(x => x.key === b.scheduled_date);
      if (!g) { g = { key: b.scheduled_date, label: dayGroupLabel(b.scheduled_date), items: [] }; groups.push(g); }
      g.items.push(b);
    }
    return groups;
  }, [confirmedUpcoming]);

  // La próxima sesión (para el botón "Preparar" si está a <24hs).
  const nextId = confirmedUpcoming[0]?.id ?? null;
  const nextWithin24h = confirmedUpcoming[0]
    ? startMs(confirmedUpcoming[0].scheduled_date, confirmedUpcoming[0].scheduled_time) - Date.now() < 24 * 60 * 60 * 1000
    : false;

  const loadBookings = useCallback(async () => {
    if (!user || !coachId) return;

    const [{ data: rows, error }, { data: completed }] = await Promise.all([
      supabase.from('bookings').select('*').eq('coach_id', coachId)
        .in('status', ['pendiente', 'confirmada']).order('created_at', { ascending: false }),
      supabase.from('bookings').select('user_id').eq('coach_id', coachId).eq('status', 'completada'),
    ]);

    if (error || !rows) { setLoading(false); return; }

    const completedMap: Record<string, number> = {};
    (completed ?? []).forEach(c => { completedMap[c.user_id as string] = (completedMap[c.user_id as string] ?? 0) + 1; });
    setCompletedByUser(completedMap);

    const userIds = [...new Set(rows.map(r => r.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const merged: Booking[] = rows.map(r => {
      const name = profileMap[r.user_id]?.name ?? 'Usuario';
      return {
        id: r.id, user_id: r.user_id, coach_id: r.coach_id, sala_id: r.sala_id,
        scheduled_date: r.scheduled_date, scheduled_time: r.scheduled_time, status: r.status,
        created_at: r.created_at, user_message: r.user_message ?? null,
        userName: name, initials: getInitials(name), avatarUrl: profileMap[r.user_id]?.avatarUrl ?? null,
      };
    });

    setBookings(merged);
    setLoading(false);
  }, [user, coachId]);

  useEffect(() => {
    if (!user) return;
    supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
  }, [user]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    if (!user || !coachId) return;
    const channel = supabase.channel(`coach-reservas-${coachId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `coach_id=eq.${coachId}` },
        () => loadBookings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, coachId, loadBookings]);

  // ── Acciones (lógica reusada, sin cambios) ─────────────────────────────────
  async function accept(id: string) {
    if (!user) return;
    await confirmBooking(id, user.id);
    await loadBookings();
  }

  function openReject(id: string) {
    setRejectModal({ visible: true, id });
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectModal.id || !user) { setRejectModal({ visible: false, id: null }); return; }
    const id = rejectModal.id;
    setRejectModal({ visible: false, id: null });
    await rejectBooking(id, user.id);
    await loadBookings();
  }

  function cancelConfirmed(booking: Booking) {
    Alert.alert(
      '¿Cancelar sesión confirmada?',
      '¿Seguro que querés cancelar esta sesión confirmada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.id);
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelada', cancelled_by: 'coach', cancelled_late: isCancelLate(booking.scheduled_date, booking.scheduled_time) })
                .eq('id', booking.id);
              if (error) return;

              if (booking.sala_id && user) {
                const cancelDateStr = fullDate(booking.scheduled_date);
                const cancelTimeStr = booking.scheduled_time.slice(0, 5);
                await supabase.from('messages').insert({
                  sala_id: booking.sala_id, sender_id: user.id, sender_type: 'system_cancelled',
                  content: encryptMessage(`El coach canceló la sesión\n${cancelDateStr} · ${cancelTimeStr} hs`),
                });
              }

              const [{ data: userProfile }, { data: coachProfile }] = await Promise.all([
                supabase.from('profiles').select('push_token').eq('id', booking.user_id).maybeSingle(),
                supabase.from('profiles').select('name').eq('id', user!.id).maybeSingle(),
              ]);
              const notifTitle = 'Sesión cancelada';
              const notifBody = `${coachProfile?.name ?? 'Tu profesional'} canceló la sesión del ${fullDate(booking.scheduled_date)}`;
              await Promise.all([
                supabase.from('notifications').insert({
                  recipient_id: booking.user_id, type: 'reserva_cancelada', booking_id: booking.id,
                  title: notifTitle, body: notifBody,
                }),
                userProfile?.push_token ? sendPushNotification(userProfile.push_token, notifTitle, notifBody) : Promise.resolve(),
              ]);

              await loadBookings();
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  }

  // Menú "⋯" de una sesión confirmada.
  function openMenu(booking: Booking) {
    Alert.alert(booking.userName, undefined, [
      {
        text: 'Ver chat',
        onPress: () => router.push(booking.sala_id
          ? { pathname: '/sala', params: { sala_id: booking.sala_id } }
          : '/sala'),
      },
      { text: 'Reprogramar', onPress: () => Alert.alert('Reprogramar', 'La reprogramación llega pronto. Por ahora podés cancelar y coordinar un nuevo horario por chat') },
      { text: 'Cancelar sesión', style: 'destructive', onPress: () => cancelConfirmed(booking) },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          {!isInTab && (
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={FOREST} />
            </TouchableOpacity>
          )}
          <Text style={s.title}>Reservas</Text>
        </View>

        {loading ? (
          <View style={s.loadingState}><ActivityIndicator size="large" color={FOREST} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={s.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={FOREST} colors={[FOREST]} />}>

            {/* Por confirmar */}
            <View style={s.stitle}>
              <Text style={s.stitleB}>Por confirmar</Text>
              {pending.length > 0 && <Text style={s.stitleSpan}>{pending.length} esperando</Text>}
            </View>

            {pending.length === 0 ? (
              <View style={s.aldia}><Text style={s.aldiaTxt}>✓ Sin solicitudes pendientes. Estás al día</Text></View>
            ) : (
              pending.map(b => (
                <View key={b.id} style={s.req}>
                  <View style={s.reqTop}>
                    {b.avatarUrl ? (
                      <Image source={{ uri: b.avatarUrl }} style={s.avSm} />
                    ) : (
                      <View style={[s.avSm, s.avFallback]}><Text style={s.avSmTxt}>{b.initials}</Text></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.reqName}>{b.userName}</Text>
                      <Text style={s.reqSub}>{fullDate(b.scheduled_date)} · {b.scheduled_time.slice(0, 5)} hs · {formatTimeAgo(b.created_at)}</Text>
                    </View>
                  </View>
                  {!!b.user_message && <Text style={s.pquote}>{`"${b.user_message}"`}</Text>}
                  {esperandoPago(b) && (
                    <Text style={s.esperandoPagoTxt}>
                      Esperando el pago. Vas a poder confirmarla apenas se acredite.
                    </Text>
                  )}
                  <View style={s.reqActs}>
                    <TouchableOpacity
                      style={[s.btnS, s.btnSolid, esperandoPago(b) && s.btnOff]}
                      activeOpacity={0.85}
                      disabled={esperandoPago(b)}
                      onPress={() => accept(b.id)}>
                      <Text style={s.btnSolidTxt}>Confirmar</Text>
                    </TouchableOpacity>
                    {/* Rechazar queda SIEMPRE habilitado: libera el turno, no lo compromete. */}
                    <TouchableOpacity style={[s.btnS, s.btnGhost]} activeOpacity={0.85} onPress={() => openReject(b.id)}>
                      <Text style={s.btnGhostTxt}>Otro horario</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Confirmadas */}
            <View style={s.stitle}>
              <Text style={s.stitleB}>Confirmadas</Text>
              {grouped.length > 0 && <Text style={s.stitleSpan}>ordenadas por día</Text>}
            </View>

            {grouped.length === 0 ? (
              <View style={s.aldia}><Text style={s.aldiaTxt}>No tenés sesiones confirmadas próximas</Text></View>
            ) : (
              grouped.map(g => (
                <View key={g.key} style={s.dayg}>
                  <Text style={s.daygHead}>{g.label}</Text>
                  {g.items.map(b => (
                    <View key={b.id} style={s.bk}>
                      <Text style={s.hora}>{b.scheduled_time.slice(0, 5)}</Text>
                      {b.avatarUrl ? (
                        <Image source={{ uri: b.avatarUrl }} style={s.avXs} />
                      ) : (
                        <View style={[s.avXs, s.avFallback]}><Text style={s.avXsTxt}>{b.initials}</Text></View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.bkName} numberOfLines={1}>{b.userName}</Text>
                        <Text style={s.bkSub}>{ordinals[b.id]} · videollamada</Text>
                      </View>
                      {b.id === nextId && nextWithin24h ? (
                        <TouchableOpacity style={[s.btnS, s.btnGhost]} activeOpacity={0.85} onPress={() => router.navigate('/(coach)')}>
                          <Text style={s.btnGhostTxt}>Preparar</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => openMenu(b)} hitSlop={8} activeOpacity={0.6} disabled={cancellingId === b.id}>
                          <Feather name="more-horizontal" size={20} color={FOREST_SOFT} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ))
            )}

            <TouchableOpacity style={s.histLink} activeOpacity={0.7} onPress={() => router.push('/coach-agenda')}>
              <Text style={s.histLinkTxt}>Ver historial de sesiones →</Text>
            </TouchableOpacity>

            <View style={{ height: TAB_BAR_CLEARANCE }} />
          </ScrollView>
        )}

        {/* Modal "Otro horario" (reusa el flujo de rechazo) */}
        <Modal
          visible={rejectModal.visible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setRejectModal({ visible: false, id: null })}>
          <SafeAreaView style={rm.safe} edges={['top']}>
            <View style={rm.header}>
              <Text style={rm.title}>Ese horario no me sirve</Text>
              <TouchableOpacity onPress={() => setRejectModal({ visible: false, id: null })} hitSlop={8} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={22} color={FOREST} />
              </TouchableOpacity>
            </View>
            <View style={rm.body}>
              <Text style={rm.helper}>El usuario recibe un aviso para elegir otro horario disponible u otro profesional</Text>
              <Text style={rm.label}>Motivo (opcional)</Text>
              <TextInput
                style={rm.input}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Ej: No tengo disponibilidad ese horario"
                placeholderTextColor="rgba(107,122,86,0.5)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity style={rm.confirmBtn} onPress={confirmReject} activeOpacity={0.85}>
                <Text style={rm.confirmBtnTxt}>Avisar al usuario</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rm.cancelBtn} onPress={() => setRejectModal({ visible: false, id: null })} activeOpacity={0.7}>
                <Text style={rm.cancelBtnTxt}>Volver</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  btnOff: { opacity: 0.4 },
  esperandoPagoTxt: {
    fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 17,
    color: 'rgba(135,131,92,0.85)', marginTop: 8,
  },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 10 },
  backBtn: { padding: 2 },
  title: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20, paddingTop: 4 },

  stitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  stitleB: { fontFamily: ViveFonts.frauncesSerif, fontSize: 17, color: FOREST },
  stitleSpan: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular },

  aldia: { padding: 18, borderWidth: 1.5, borderColor: LINE, borderRadius: 20, borderStyle: 'dashed', alignItems: 'center' },
  aldiaTxt: { textAlign: 'center', fontSize: 12.5, color: FOREST_SOFT, lineHeight: 18, fontFamily: ViveFonts.regular },

  // Avatares
  avSm: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(63,81,47,0.1)' },
  avXs: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(63,81,47,0.1)' },
  avFallback: { alignItems: 'center', justifyContent: 'center' },
  avSmTxt: { fontFamily: ViveFonts.frauncesSerif, fontSize: 13, color: FOREST },
  avXsTxt: { fontFamily: ViveFonts.frauncesSerif, fontSize: 11, color: FOREST },

  // Por confirmar
  req: { backgroundColor: CARD, borderWidth: 1, borderColor: TERRA_LINE, borderRadius: 20, padding: 14, marginBottom: 9 },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reqName: { fontSize: 13, fontFamily: ViveFonts.semibold, color: FOREST },
  reqSub: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular, marginTop: 1 },
  pquote: {
    fontFamily: ViveFonts.frauncesSerif, fontStyle: 'italic', fontSize: 11.5, color: '#2E3624',
    backgroundColor: CREAM, borderRadius: 11, paddingVertical: 6, paddingHorizontal: 10, marginTop: 9, lineHeight: 16,
  },
  reqActs: { flexDirection: 'row', gap: 8, marginTop: 11 },

  btnS: { borderRadius: 13, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center' },
  btnSolid: { backgroundColor: FOREST, flex: 1 },
  btnSolidTxt: { fontSize: 11.5, fontFamily: ViveFonts.semibold, color: '#F3EEDF' },
  btnGhost: { borderWidth: 1.5, borderColor: LINE, backgroundColor: CREAM },
  btnGhostTxt: { fontSize: 11.5, fontFamily: ViveFonts.semibold, color: FOREST_SOFT },

  // Confirmadas
  dayg: { marginBottom: 2 },
  daygHead: {
    fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: FOREST_SOFT,
    fontFamily: ViveFonts.semibold, marginTop: 6, marginBottom: 8,
  },
  bk: {
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 18,
    paddingVertical: 11, paddingHorizontal: 13, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  hora: { fontFamily: ViveFonts.frauncesSerif, fontSize: 16, color: FOREST, width: 52 },
  bkName: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: FOREST },
  bkSub: { fontSize: 10, color: FOREST_SOFT, fontFamily: ViveFonts.regular, marginTop: 1 },

  histLink: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  histLinkTxt: { fontSize: 12.5, fontFamily: ViveFonts.medium, color: TERRA },
});

const rm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: LINE,
  },
  title: { fontFamily: ViveFonts.frauncesSerif, fontSize: 20, color: FOREST },
  body: { padding: 20 },
  helper: { fontSize: 13, color: FOREST_SOFT, fontFamily: ViveFonts.regular, lineHeight: 19, marginBottom: 18 },
  label: { fontSize: 13, fontFamily: ViveFonts.semibold, color: FOREST, marginBottom: 8 },
  input: {
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 14,
    padding: 14, fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST, minHeight: 96,
  },
  confirmBtn: { backgroundColor: TERRA, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnTxt: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#FFF6EC' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelBtnTxt: { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
});
