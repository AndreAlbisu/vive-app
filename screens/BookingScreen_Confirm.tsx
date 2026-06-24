import React, { useState } from 'react';
import { logError } from '@/lib/logging';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase, registrarEvento } from '@/lib/supabase';

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH_NAMES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${DAY_NAMES[date.getDay()]}, ${day} de ${MONTH_NAMES[month - 1]}`;
}

type Params = {
  name?: string;
  specialty?: string;
  priceFrom?: string;
  date?: string;
  time?: string;
  coachId?: string;
  coachProfileId?: string;
};

export default function BookingScreen_Confirm() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const priceFrom = params.priceFrom ? parseInt(params.priceFrom, 10) : 4500;
  const dateStr = params.date ?? '';
  const time = params.time ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/login');
        return;
      }
      const userId = session.user.id;

      // 1. Resolver IDs del coach
      //    coachId        → coaches.id        (FK que usa bookings.coach_id)
      //    coachProfileId → coaches.profile_id (FK que usa salas.coach_id)
      //    Preferimos los IDs que vienen por params (pasados desde conexiones.tsx).
      //    Solo hacemos lookup por specialty si no llegaron (flujo sin IDs reales).
      let coachId: string | null = params.coachId ?? null;
      let coachProfileId: string | null = params.coachProfileId ?? null;

      if (!coachId || !coachProfileId) {
        const { data: coachRow } = await supabase
          .from('coaches')
          .select('id, profile_id')
          .eq('specialty', specialty)
          .limit(1)
          .maybeSingle();
        coachId = coachRow?.id ?? null;
        coachProfileId = coachRow?.profile_id ?? null;
      }

      await registrarEvento('reserva_iniciada', {
        professional_id: coachId ?? coachName,
        user_id: userId,
      });

      // 2. Buscar sala existente o crear una nueva
      //    salas.coach_id = coaches.profile_id (= profiles.id del coach)
      let salaId: string;
      let roomUrl = '';

      if (coachProfileId) {
        const { data: existingSala } = await supabase
          .from('salas')
          .select('id, room_url')
          .eq('user_id', userId)
          .eq('coach_id', coachProfileId)
          .maybeSingle();

        if (existingSala) {
          salaId = existingSala.id;
          roomUrl = existingSala.room_url ?? '';
        } else {
          const { data: newSala, error: salaErr } = await supabase
            .from('salas')
            .insert({ user_id: userId, coach_id: coachProfileId })
            .select('id, room_url')
            .single();
          if (salaErr) throw new Error(salaErr.message);
          salaId = newSala.id;
          roomUrl = newSala.room_url ?? ''; // null hasta que se corra add-salas-room-url.sql
        }
      } else {
        throw new Error('No encontramos el profesional. Volvé y elegí de nuevo.');
      }

      // 3. Insertar booking — columnas reales verificadas en la base
      const { data: booking, error: insertErr } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          coach_id: coachId,          // coaches.id (FK a coaches table)
          sala_id: salaId,
          coach_name: coachName,
          scheduled_date: dateStr,
          scheduled_time: time,
          amount: priceFrom,
          status: 'pendiente',
        })
        .select('id')
        .single();

      if (insertErr) throw new Error(insertErr.message);

      await registrarEvento('reserva_confirmada', {
        professional_id: coachId ?? coachName,
        booking_id: booking.id,
        sala_id: salaId,
        user_id: userId,
      });

      router.replace({
        pathname: '/booking-success',
        params: {
          name: coachName,
          specialty,
          date: dateStr,
          time,
          bookingId: booking.id,
          roomUrl,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar la reserva';
      await logError('BookingScreen_Confirm: failed to confirm booking', err);
      setError(msg);
      Alert.alert('No pudimos guardar tu reserva', msg + '\n\nReintentá en un momento.');
    } finally {
      setLoading(false);
    }
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
          <Text style={s.headerTitle}>Confirmá tu reserva</Text>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Tarjeta resumen */}
        <View style={s.card}>

          {/* Coach */}
          <View style={s.coachRow}>
            <View style={s.coachAvatar}>
              <MaterialIcons name="person" size={34} color="#C0BAB4" />
            </View>
            <View style={s.coachInfo}>
              <Text style={s.coachName}>{coachName}</Text>
              <Text style={s.coachSpecialty}>{specialty}</Text>
            </View>
            <MaterialIcons name="verified" size={18} color={ViveColors.accent} />
          </View>

          <View style={s.divider} />

          {/* Fecha */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="calendar-today" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>FECHA</Text>
              <Text style={s.detailValue}>{formatDate(dateStr)}</Text>
            </View>
          </View>

          {/* Hora */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="access-time" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>HORA</Text>
              <Text style={s.detailValue}>{time} hs (horario Argentina)</Text>
            </View>
          </View>

          {/* Precio */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="payments" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>PRECIO</Text>
              <Text style={s.detailValue}>${priceFrom.toLocaleString('es-AR')} por sesión</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Modalidad */}
          <View style={s.modalityBox}>
            <MaterialIcons name="info-outline" size={15} color={`${ViveColors.text}77`} />
            <Text style={s.modalityText}>
              Reserva con confirmación — el coach tiene 48hs para aceptar
            </Text>
          </View>
        </View>

        {/* Aviso no cobro */}
        <View style={s.noticeRow}>
          <MaterialIcons name="shield" size={15} color={ViveColors.accent} />
          <Text style={s.noticeText}>No se te cobra hasta que el coach acepte</Text>
        </View>

        {/* Método de pago */}
        <View style={s.paymentSection}>
          <Text style={s.paymentLabel}>Método de pago</Text>

          <TouchableOpacity style={s.paymentCard} activeOpacity={0.75}>
            <MaterialIcons name="credit-card" size={22} color={ViveColors.text} />
            <Text style={s.paymentCardText}>Tarjeta de crédito / débito</Text>
            <MaterialIcons name="chevron-right" size={20} color={`${ViveColors.text}55`} />
          </TouchableOpacity>

          <TouchableOpacity style={s.paymentCard} activeOpacity={0.75}>
            <MaterialIcons name="account-balance-wallet" size={22} color="#009EE3" />
            <Text style={s.paymentCardText}>Mercado Pago</Text>
            <MaterialIcons name="chevron-right" size={20} color={`${ViveColors.text}55`} />
          </TouchableOpacity>
        </View>

      </ScrollView>

      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          {error ? (
            <View style={s.errorBox}>
              <MaterialIcons name="error-outline" size={15} color="#D94F4F" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.btn, loading && s.btnLoading]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={s.btnText}>Confirmar reserva</Text>
            )}
          </TouchableOpacity>

          <View style={s.guaranteeRow}>
            <MaterialIcons name="verified-user" size={13} color={ViveColors.accent} />
            <Text style={s.guaranteeText}>
              Garantía de primera sesión — si no quedás conforme, te devolvemos el dinero
            </Text>
          </View>
        </View>
      </SafeAreaView>

    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  safeTop: {
    backgroundColor: ViveColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: ViveColors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  progressTrack: {
    height: 4,
    backgroundColor: `${ViveColors.primary}22`,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ViveColors.primary,
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    ...cardShadow,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  coachAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    marginBottom: 3,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
    marginVertical: 16,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  detailIcon: {
    width: 28,
    paddingTop: 2,
  },
  detailText: { flex: 1 },
  detailLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: `${ViveColors.text}66`,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 21,
  },

  modalityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: ViveColors.background,
    borderRadius: 10,
    padding: 12,
  },
  modalityText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}88`,
    lineHeight: 19,
  },

  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  noticeText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.accent,
  },

  paymentSection: {
    gap: 10,
  },
  paymentLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 4,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...cardShadow,
  },
  paymentCardText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.text,
  },

  footerSafe: {
    backgroundColor: ViveColors.background,
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}10`,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  btn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLoading: {
    opacity: 0.7,
  },
  btnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#D94F4F',
    lineHeight: 19,
  },

  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  guaranteeText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}77`,
    lineHeight: 18,
  },
});
