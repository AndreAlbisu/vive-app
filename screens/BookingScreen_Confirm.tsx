import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';

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
};

export default function BookingScreen_Confirm() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const params = useLocalSearchParams<Params>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState('');

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const priceFrom = params.priceFrom ? parseInt(params.priceFrom, 10) : 4500;
  const dateStr = params.date ?? '';
  const time = params.time ?? '';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawCoachId = params.coachId ?? '';
  console.log('[BookingConfirm] params.coachId:', params.coachId, '| rawCoachId:', rawCoachId);
  const coachId = UUID_RE.test(rawCoachId) ? rawCoachId : '8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c';

  async function onConfirm() {
    if (!isLoggedIn || !user) { requestAuth(); return; }

    setLoading(true);
    setError(null);

    try {
      // Buscar o crear sala para este par user + coach
      let salaId: string;

      const { data: existingSala } = await supabase
        .from('salas')
        .select('id')
        .eq('user_id', user.id)
        .eq('coach_id', coachId)
        .maybeSingle();

      if (existingSala) {
        salaId = existingSala.id;
      } else {
        const { data: newSala, error: salaError } = await supabase
          .from('salas')
          .insert({ user_id: user.id, coach_id: coachId })
          .select('id')
          .single();
        if (salaError || !newSala) throw new Error('No se pudo crear la sala de comunicación.');
        salaId = newSala.id;
      }

      // Insertar la reserva
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          coach_id: coachId,
          sala_id: salaId,
          date: dateStr,
          time,
          status: 'pending',
          ...(userMessage.trim() ? { user_message: userMessage.trim() } : {}),
        });

      if (bookingError) throw new Error('No se pudo guardar la reserva. Intentalo de nuevo.');

      // Notificar al coach
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('push_token, name')
        .eq('id', coachId)
        .maybeSingle();

      if (coachProfile?.push_token) {
        const userName = user.user_metadata?.name ?? 'Un usuario';
        await sendPushNotification(
          coachProfile.push_token,
          'Nueva solicitud de sesión 📅',
          `${userName} quiere reservar una sesión el ${formatDate(dateStr)} a las ${time} hs`,
        );
      }

      router.replace({
        pathname: '/booking-success',
        params: { name: coachName, specialty, date: dateStr, time, coachId },
      });
    } catch (e: any) {
      setError(e.message ?? 'Algo salió mal. Intentalo de nuevo.');
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

        {/* Mensaje opcional */}
        <View style={s.messageSection}>
          <Text style={s.messageTitle}>¿Querés contarle algo antes de que acepte?</Text>
          <Text style={s.messageSubtitle}>Es opcional. Le ayuda al coach a entender mejor tu situación.</Text>
          <View style={s.messageInputWrap}>
            <TextInput
              style={s.messageInput}
              value={userMessage}
              onChangeText={t => t.length <= 300 && setUserMessage(t)}
              placeholder="Contame brevemente qué te trajo acá..."
              placeholderTextColor={`${ViveColors.text}44`}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.messageCounter}>{userMessage.length}/300</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={s.errorRow}>
            <MaterialIcons name="error-outline" size={15} color="#E05252" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

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
    marginBottom: 14,
  },
  noticeText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.accent,
  },

  messageSection: {
    marginBottom: 20,
  },
  messageTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  messageSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}80`,
    marginBottom: 10,
    lineHeight: 17,
  },
  messageInputWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  messageInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    minHeight: 90,
    lineHeight: 20,
  },
  messageCounter: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}44`,
    textAlign: 'right',
    marginTop: 6,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#E05252',
    lineHeight: 19,
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
    minHeight: 52,
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