import React, { useState, useEffect, useCallback } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';
import { encryptMessage } from '@/lib/encryption';
import { createOrGetMeetingUrl } from '@/lib/meetingRoom';
import { isCancelLate } from '@/lib/bookingHelpers';
import { AppBg } from '@/components/ui/AppBg';

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function formatBookingDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  const monthName = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][month - 1];
  return `${dayName} ${day} ${monthName}`;
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'hace unos minutos';
  if (diffH < 24) return `hace ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;
}

function hoursLeftToRespond(createdAt: string): number {
  const deadline = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((deadline - Date.now()) / (1000 * 60 * 60)));
}

function urgencyColor(hoursLeft: number): string {
  if (hoursLeft <= 6) return '#E05252';
  if (hoursLeft <= 12) return ViveColors.primary;
  return '#87835C';
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CoachReservasScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isInTab = segments[0] === '(coach)';
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });
  const [rejectReason, setRejectReason] = useState('');
  const [coachId, setCoachId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pending   = bookings.filter(b => b.status === 'pendiente');
  const confirmed = bookings.filter(b => b.status === 'confirmada');

  const loadBookings = useCallback(async () => {
    if (!user || !coachId) return;

    console.log('[CoachReservas] ── DIAGNÓSTICO ──────────────────────────');
    console.log('[CoachReservas] profile_id (auth.uid):', user.id);
    console.log('[CoachReservas] coachId    (coaches.id):', coachId);

    const { data: rows, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('coach_id', coachId)
      .in('status', ['pendiente', 'confirmada'])
      .order('created_at', { ascending: false });

    console.log('[CoachReservas] query filtrada  → rows:', rows?.length ?? 'null', '| error:', error?.message ?? null);
    // Log completo del array crudo — si llega vacío acá el problema es RLS o coach_id; si llega pero no se ve en pantalla es un filtro de JS
    console.log('[CoachReservas] raw rows (array completo):', JSON.stringify(rows));

    // Sin filtro de coach_id, ordenado por fecha desc — si la reserva nueva tampoco aparece acá → RLS bloqueando
    const { data: allRows, error: allError } = await supabase
      .from('bookings')
      .select('id, coach_id, user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    console.log('[CoachReservas] todos los bookings (sin filtro, recientes primero) → count:', allRows?.length ?? 'null', '| error:', allError?.message ?? null);
    if (allRows && allRows.length > 0) {
      console.log('[CoachReservas] primeros 3 de allRows:', JSON.stringify(allRows.slice(0, 3)));
    }
    console.log('[CoachReservas] ─────────────────────────────────────────');

    if (error || !rows) { setLoading(false); return; }

    // Cargar nombres de usuarios desde profiles
    const userIds = [...new Set(rows.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const merged: Booking[] = rows.map(r => {
      const name = profileMap[r.user_id]?.name ?? 'Usuario';
      return {
        id: r.id,
        user_id: r.user_id,
        coach_id: r.coach_id,
        sala_id: r.sala_id,
        scheduled_date: r.scheduled_date,
        scheduled_time: r.scheduled_time,
        status: r.status,
        created_at: r.created_at,
        user_message: r.user_message ?? null,
        userName: name,
        initials: getInitials(name),
        avatarUrl: profileMap[r.user_id]?.avatarUrl ?? null,
      };
    });

    setBookings(merged);
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
    loadBookings();
  }, [loadBookings]);

  // Realtime: recargar cuando cambia cualquier booking de este coach
  useEffect(() => {
    if (!user || !coachId) return;
    const channel = supabase.channel('coach-reservas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `coach_id=eq.${coachId}` },
        () => loadBookings(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, coachId, loadBookings]);

  async function accept(id: string) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'confirmada' })
      .eq('id', id)
      .select('id, user_id, coach_id, sala_id, scheduled_date, scheduled_time, user_message');
    console.log('[CoachReservas] accept update → data:', data, '| error:', error);

    if (error || !data?.[0]) return;

    const booking = data[0];
    if (booking && user) {
      const [{ data: userProfile }, { data: coachProfile }, { data: conflicting }] = await Promise.all([
        supabase.from('profiles').select('push_token').eq('id', booking.user_id).maybeSingle(),
        supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
        supabase
          .from('bookings')
          .select('id, user_id, sala_id')
          .eq('coach_id', booking.coach_id)
          .eq('scheduled_date', booking.scheduled_date)
          .eq('scheduled_time', booking.scheduled_time)
          .eq('status', 'pendiente')
          .neq('id', id),
      ]);

      const notifTitle = '¡Tu sesión fue confirmada! ✅';
      const notifBody = `Tu sesión con ${coachProfile?.name ?? 'tu coach'} el ${formatBookingDate(booking.scheduled_date)} está confirmada`;

      await Promise.all([
        supabase.from('notifications').insert({
          recipient_id: booking.user_id,
          type: 'reserva_confirmada',
          booking_id: id,
          title: notifTitle,
          body: notifBody,
        }),
        userProfile?.push_token
          ? sendPushNotification(userProfile.push_token, notifTitle, notifBody)
          : Promise.resolve(),
      ]);

      console.log('[accept] booking.sala_id:', booking.sala_id);
      if (booking.sala_id) {
        const confirmDateStr = formatBookingDate(booking.scheduled_date);
        const confirmTimeStr = booking.scheduled_time.slice(0, 5);
        const confirmLine1 = `Sesión reservada · ${confirmDateStr} · ${confirmTimeStr} hs`;
        const confirmMsg = booking.user_message
          ? `${confirmLine1}\n${booking.user_message}`
          : confirmLine1;
        const { error: msgError } = await supabase.from('messages').insert({
          sala_id: booking.sala_id,
          sender_id: user.id,
          sender_type: 'system_confirmed',
          content: encryptMessage(confirmMsg),
        });
        console.log('[accept] message insert error:', msgError ?? 'none');
      }

      if (conflicting && conflicting.length > 0) {
        const conflictUserIds = conflicting.map(b => b.user_id);
        const { data: conflictProfiles } = await supabase
          .from('profiles')
          .select('id, push_token')
          .in('id', conflictUserIds);

        const tokenMap: Record<string, string | null> = {};
        conflictProfiles?.forEach(p => { tokenMap[p.id] = p.push_token ?? null; });

        const cancelTitle = 'Horario no disponible';
        const cancelBody = 'Ese horario ya no está disponible. Podés elegir otro horario con tu coach.';
        const cancelDateStr = formatBookingDate(booking.scheduled_date);
        const cancelTimeStr = booking.scheduled_time.slice(0, 5);
        const cancelSystemMsg = `Solicitud cancelada automáticamente\n${cancelDateStr} · ${cancelTimeStr} hs`;

        await Promise.all(
          conflicting.map((cb) => {
            const ops: PromiseLike<unknown>[] = [
              supabase.from('bookings').update({ status: 'cancelada' }).eq('id', cb.id),
              supabase.from('notifications').insert({
                recipient_id: cb.user_id,
                type: 'reserva_cancelada',
                booking_id: cb.id,
                title: cancelTitle,
                body: cancelBody,
              }),
            ];
            if (cb.sala_id) {
              ops.push(
                supabase.from('messages').insert({
                  sala_id: cb.sala_id,
                  sender_id: user.id,
                  sender_type: 'system_cancelled',
                  content: encryptMessage(cancelSystemMsg),
                })
              );
            }
            const token = tokenMap[cb.user_id];
            if (token) ops.push(sendPushNotification(token, cancelTitle, cancelBody));
            return Promise.all(ops);
          })
        );
      }
    }

    // Crear sala de videollamada en Daily.co en segundo plano
    createOrGetMeetingUrl(id).catch(() => {});

    await loadBookings();
  }

  function openReject(id: string) {
    setRejectModal({ visible: true, id });
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectModal.id) return;

    const booking = bookings.find(b => b.id === rejectModal.id);

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelada' })
      .eq('id', rejectModal.id)
      .select();
    console.log('[CoachReservas] reject update → data:', data, '| error:', error);

    if (error) { setRejectModal({ visible: false, id: null }); return; }

    setRejectModal({ visible: false, id: null });
    await loadBookings();

    if (booking && user) {
      const [{ data: userProfile }, { data: coachProfile }] = await Promise.all([
        supabase.from('profiles').select('push_token').eq('id', booking.user_id).maybeSingle(),
        supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      ]);

      const notifTitle = 'Sesión no disponible';
      const notifBody = `${coachProfile?.name ?? 'Tu coach'} no pudo aceptar tu sesión. Buscá otro profesional.`;

      await Promise.all([
        supabase.from('notifications').insert({
          recipient_id: booking.user_id,
          type: 'reserva_rechazada',
          booking_id: rejectModal.id,
          title: notifTitle,
          body: notifBody,
        }),
        userProfile?.push_token
          ? sendPushNotification(userProfile.push_token, notifTitle, notifBody)
          : Promise.resolve(),
      ]);
    }
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
                const cancelDateStr = formatBookingDate(booking.scheduled_date);
                const cancelTimeStr = booking.scheduled_time.slice(0, 5);
                await supabase.from('messages').insert({
                  sala_id: booking.sala_id,
                  sender_id: user.id,
                  sender_type: 'system_cancelled',
                  content: encryptMessage(`El coach canceló la sesión\n${cancelDateStr} · ${cancelTimeStr} hs`),
                });
              }

              const [{ data: userProfile }, { data: coachProfile }] = await Promise.all([
                supabase.from('profiles').select('push_token').eq('id', booking.user_id).maybeSingle(),
                supabase.from('profiles').select('name').eq('id', user!.id).maybeSingle(),
              ]);

              const notifTitle = 'Sesión cancelada';
              const notifBody = `${coachProfile?.name ?? 'Tu coach'} canceló la sesión del ${formatBookingDate(booking.scheduled_date)}.`;

              await Promise.all([
                supabase.from('notifications').insert({
                  recipient_id: booking.user_id,
                  type: 'reserva_cancelada',
                  booking_id: booking.id,
                  title: notifTitle,
                  body: notifBody,
                }),
                userProfile?.push_token
                  ? sendPushNotification(userProfile.push_token, notifTitle, notifBody)
                  : Promise.resolve(),
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  console.log('[CoachReservas] render bookings:', bookings);

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        {!isInTab && (
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
          </TouchableOpacity>
        )}
        <Text style={[s.headerTitle, isInTab && s.headerTitleTab]}>Reservas</Text>
        {!isInTab && <View style={s.headerSpacer} />}
      </View>
      <View style={s.divider} />

      {loading ? (
        <View style={s.loadingState}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={ViveColors.primary}
              colors={[ViveColors.primary]}
            />
          }
        >

          {/* Pending */}
          <Text style={s.sectionTitle}>
            Pendientes de respuesta
            {pending.length > 0 && (
              <Text style={s.pendingCount}> ({pending.length})</Text>
            )}
          </Text>

          {pending.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="check-circle-outline" size={36} color={ViveColors.accent} />
              <Text style={s.emptyText}>Sin solicitudes pendientes. Estás al día 🙌</Text>
            </View>
          ) : (
            pending.map(b => {
              const hoursLeft = hoursLeftToRespond(b.created_at);
              return (
                <View key={b.id} style={s.pendingCard}>
                  <View style={s.cardHeader}>
                    {b.avatarUrl ? (
                      <Image source={{ uri: b.avatarUrl }} style={s.avatarImage} />
                    ) : (
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{b.initials}</Text>
                      </View>
                    )}
                    <View style={s.cardInfo}>
                      <Text style={s.cardName}>{b.userName}</Text>
                      <Text style={s.cardDate}>{formatBookingDate(b.scheduled_date)} · {b.scheduled_time} hs</Text>
                      <Text style={s.cardRequested}>Solicitado {formatTimeAgo(b.created_at)}</Text>
                    </View>
                  </View>

                  <View style={s.countdownRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={urgencyColor(hoursLeft)} />
                    <Text style={[s.countdownText, { color: urgencyColor(hoursLeft) }]}>
                      {hoursLeft}hs para responder
                    </Text>
                  </View>

                  {!!b.user_message && (
                    <View style={s.userMessageBox}>
                      <MaterialCommunityIcons name="format-quote-open" size={16} color="rgba(135,131,92,0.58)" />
                      <Text style={s.userMessageText}>{b.user_message}</Text>
                    </View>
                  )}

                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => openReject(b.id)}
                      activeOpacity={0.8}>
                      <Text style={s.rejectBtnText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.acceptBtn}
                      onPress={() => accept(b.id)}
                      activeOpacity={0.8}>
                      <Text style={s.acceptBtnText}>Aceptar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Confirmed */}
          <Text style={[s.sectionTitle, s.sectionSpaced]}>Confirmadas</Text>

          {confirmed.length === 0 ? (
            <View style={[s.emptyState, { marginBottom: 0 }]}>
              <Text style={s.emptyText}>No hay reservas confirmadas todavía.</Text>
            </View>
          ) : (
            confirmed.map(b => (
              <View key={b.id} style={s.confirmedCard}>
                {b.avatarUrl ? (
                  <Image source={{ uri: b.avatarUrl }} style={s.avatarImage} />
                ) : (
                  <View style={[s.avatar, s.avatarConfirmed]}>
                    <Text style={s.avatarText}>{b.initials}</Text>
                  </View>
                )}
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{b.userName}</Text>
                  <Text style={s.cardDate}>{formatBookingDate(b.scheduled_date)} · {b.scheduled_time} hs</Text>
                </View>
                <View style={s.confirmedCardRight}>
                  <View style={s.confirmedBadge}>
                    <MaterialCommunityIcons name="check" size={13} color={ViveColors.accent} />
                    <Text style={s.confirmedBadgeText}>Confirmada</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => cancelConfirmed(b)}
                    disabled={cancellingId === b.id}
                    activeOpacity={0.7}>
                    <Text style={[s.cancelConfirmedText, cancellingId === b.id && { opacity: 0.4 }]}>
                      {cancellingId === b.id ? 'Cancelando...' : 'Cancelar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRejectModal({ visible: false, id: null })}>
        <SafeAreaView style={rm.safe} edges={['top']}>
          <View style={rm.header}>
            <Text style={rm.title}>Rechazar solicitud</Text>
            <TouchableOpacity
              onPress={() => setRejectModal({ visible: false, id: null })}
              hitSlop={8}
              activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="#565E32" />
            </TouchableOpacity>
          </View>

          <View style={rm.body}>
            <Text style={rm.label}>Motivo (opcional)</Text>
            <TextInput
              style={rm.input}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ej: No tengo disponibilidad ese horario."
              placeholderTextColor="rgba(135,131,92,0.45)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity style={rm.rejectBtn} onPress={confirmReject} activeOpacity={0.85}>
              <Text style={rm.rejectBtnText}>Confirmar rechazo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={rm.cancelBtn}
              onPress={() => setRejectModal({ visible: false, id: null })}
              activeOpacity={0.7}>
              <Text style={rm.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    marginRight: 30,
  },
  headerTitleTab: {
    marginRight: 0,
  },
  headerSpacer: { width: 30 },
  divider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  container: { paddingHorizontal: 20, paddingTop: 24 },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 14,
  },
  pendingCount: { color: ViveColors.primary },
  sectionSpaced: { marginTop: 32 },

  // Pending card
  pendingCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${ViveColors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarConfirmed: {
    backgroundColor: `${ViveColors.accent}20`,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 3,
  },
  cardDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
    marginBottom: 2,
  },
  cardRequested: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.72)',
  },

  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  countdownText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
  },

  userMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,248,240,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  userMessageText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 19,
  },

  actionRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E05252',
  },
  rejectBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#E05252',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: ViveColors.accent,
  },
  acceptBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },

  // Confirmed card
  confirmedCard: {
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
  confirmedCardRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  cancelConfirmedText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#E05252',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${ViveColors.accent}18`,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    flexShrink: 0,
  },
  confirmedBadgeText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.accent,
  },

  // Empty state
  emptyState: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#87835C',
    textAlign: 'center',
    lineHeight: 22,
  },
});

const rm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A0A26' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,248,240,0.48)',
    backgroundColor: 'rgba(255,248,240,0.32)',
  },
  title: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32' },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', marginBottom: 10 },
  input: {
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    height: 110,
  },
  rejectBtn: {
    backgroundColor: '#E05252',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  rejectBtnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32' },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#87835C' },
});
