import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type ReservationStatus = 'pending' | 'confirmed' | 'rejected';

type Reservation = {
  id: string;
  userName: string;
  initials: string;
  date: string;
  time: string;
  requestedAt: string;
  hoursLeft: number;
  status: ReservationStatus;
};

const INITIAL_RESERVATIONS: Reservation[] = [
  { id: '1', userName: 'Pedro Ríos',       initials: 'PR', date: 'Mié 18 jun', time: '10:00 hs', requestedAt: 'hace 2 horas',   hoursLeft: 46, status: 'pending' },
  { id: '2', userName: 'Lucía Fernández',  initials: 'LF', date: 'Jue 19 jun', time: '14:00 hs', requestedAt: 'hace 6 horas',   hoursLeft: 42, status: 'pending' },
  { id: '3', userName: 'Ana López',        initials: 'AL', date: 'Lun 16 jun', time: '11:00 hs', requestedAt: 'hace 3 días',    hoursLeft: 0,  status: 'confirmed' },
  { id: '4', userName: 'Carlos Méndez',   initials: 'CM', date: 'Jue 19 jun', time: '15:30 hs', requestedAt: 'hace 1 día',     hoursLeft: 0,  status: 'confirmed' },
  { id: '5', userName: 'Tomás García',    initials: 'TG', date: 'Vie 20 jun', time: '09:00 hs', requestedAt: 'hace 5 días',    hoursLeft: 0,  status: 'confirmed' },
];

const cardShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
});

function urgencyColor(hoursLeft: number): string {
  if (hoursLeft <= 6) return '#E05252';
  if (hoursLeft <= 24) return ViveColors.primary;
  return `${ViveColors.text}70`;
}

export default function CoachReservasScreen() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });
  const [rejectReason, setRejectReason] = useState('');

  const pending   = reservations.filter(r => r.status === 'pending');
  const confirmed = reservations.filter(r => r.status === 'confirmed');

  function accept(id: string) {
    console.log('[Coach] aceptar reserva', id);
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
  }

  function openReject(id: string) {
    setRejectModal({ visible: true, id });
    setRejectReason('');
  }

  function confirmReject() {
    if (!rejectModal.id) return;
    console.log('[Coach] rechazar reserva', rejectModal.id, 'motivo:', rejectReason);
    setReservations(prev => prev.map(r => r.id === rejectModal.id ? { ...r, status: 'rejected' } : r));
    setRejectModal({ visible: false, id: null });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reservas</Text>
        <View style={s.headerSpacer} />
      </View>
      <View style={s.divider} />

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Pending */}
        <Text style={s.sectionTitle}>
          Solicitudes pendientes
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
          pending.map(r => (
            <View key={r.id} style={s.pendingCard}>
              {/* User info */}
              <View style={s.cardHeader}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{r.initials}</Text>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{r.userName}</Text>
                  <Text style={s.cardDate}>{r.date} · {r.time}</Text>
                  <Text style={s.cardRequested}>Solicitado {r.requestedAt}</Text>
                </View>
              </View>

              {/* Countdown */}
              <View style={s.countdownRow}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={urgencyColor(r.hoursLeft)} />
                <Text style={[s.countdownText, { color: urgencyColor(r.hoursLeft) }]}>
                  {r.hoursLeft}hs para responder
                </Text>
              </View>

              {/* Actions */}
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={s.rejectBtn}
                  onPress={() => openReject(r.id)}
                  activeOpacity={0.8}>
                  <Text style={s.rejectBtnText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.acceptBtn}
                  onPress={() => accept(r.id)}
                  activeOpacity={0.8}>
                  <Text style={s.acceptBtnText}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Confirmed */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Reservas confirmadas</Text>

        {confirmed.map(r => (
          <View key={r.id} style={s.confirmedCard}>
            <View style={[s.avatar, s.avatarConfirmed]}>
              <Text style={s.avatarText}>{r.initials}</Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{r.userName}</Text>
              <Text style={s.cardDate}>{r.date} · {r.time}</Text>
            </View>
            <View style={s.confirmedBadge}>
              <MaterialCommunityIcons name="check" size={13} color={ViveColors.accent} />
              <Text style={s.confirmedBadgeText}>Confirmada</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

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
              <MaterialCommunityIcons name="close" size={22} color={ViveColors.text} />
            </TouchableOpacity>
          </View>

          <View style={rm.body}>
            <Text style={rm.label}>Motivo (opcional)</Text>
            <TextInput
              style={rm.input}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ej: No tengo disponibilidad ese horario."
              placeholderTextColor={`${ViveColors.text}44`}
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
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ViveColors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    marginRight: 30,
  },
  headerSpacer: { width: 30 },
  divider: { height: 1, backgroundColor: `${ViveColors.text}0D` },

  container: { paddingHorizontal: 20, paddingTop: 24 },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 14,
  },
  pendingCount: { color: ViveColors.primary },
  sectionSpaced: { marginTop: 32 },

  // Pending card
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
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
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 14,
    color: ViveColors.text,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 3,
  },
  cardDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    marginBottom: 2,
  },
  cardRequested: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}60`,
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
    ...Platform.select({
      ios: { shadowColor: ViveColors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  acceptBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Confirmed card
  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    ...cardShadow,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}70`,
    textAlign: 'center',
    lineHeight: 22,
  },
});

const rm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}0D`,
  },
  title: { fontFamily: ViveFonts.semibold, fontSize: 17, color: ViveColors.text },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 13, color: ViveColors.text, marginBottom: 10 },
  input: {
    backgroundColor: ViveColors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    borderWidth: 1,
    borderColor: `${ViveColors.text}14`,
    height: 110,
  },
  rejectBtn: {
    backgroundColor: '#E05252',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    ...Platform.select({
      ios: { shadowColor: '#E05252', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  rejectBtnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFFFFF' },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: `${ViveColors.text}70` },
});
