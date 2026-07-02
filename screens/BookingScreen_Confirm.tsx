import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';
import { logError } from '@/lib/logging';
import { encryptMessage } from '@/lib/encryption';
import { createOrGetMeetingUrl } from '@/lib/meetingRoom';

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
  const [instantBooking, setInstantBooking] = useState(false);

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const priceFrom = params.priceFrom ? parseInt(params.priceFrom, 10) : 4500;
  const dateStr = params.date ?? '';
  const time = params.time ?? '';
  // coachId que llega por params es profiles.id (= coaches.profile_id), NO coaches.id
  const coachProfileIdParam = Array.isArray(params.coachId) ? params.coachId[0] : params.coachId;

  // Solo para mostrar el copy correcto antes de confirmar — onConfirm vuelve
  // a leer el flag al momento de reservar, por si cambió mientras tanto.
  useEffect(() => {
    if (!coachProfileIdParam) return;
    (async () => {
      const { data } = await supabase
        .from('coaches')
        .select('instant_booking')
        .eq('profile_id', coachProfileIdParam)
        .maybeSingle();
      setInstantBooking(!!data?.instant_booking);
    })();
  }, [coachProfileIdParam]);

  async function onConfirm() {
    if (!isLoggedIn || !user) { requestAuth(); return; }
    if (!coachProfileIdParam) {
      setError('No encontramos el profesional. Volvé y elegí de nuevo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Buscar el coach por su profile_id real (no por specialty — evita reservar con el coach equivocado)
      //    salas.coach_id    → coaches.profile_id (FK a profiles.id)
      //    bookings.coach_id → coaches.id          (FK a coaches.id)
      const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, profile_id, instant_booking')
        .eq('profile_id', coachProfileIdParam)
        .maybeSingle();

      // Leer duración del patrón semanal para guardarla en el booking
      let durationMinutes: number | null = null;
      if (coachRow?.id) {
        const { data: patternRow } = await supabase
          .from('coach_weekly_pattern')
          .select('slot_duration_minutes')
          .eq('coach_id', coachRow.id)
          .limit(1)
          .maybeSingle();
        durationMinutes = (patternRow as any)?.slot_duration_minutes ?? null;
      }

      if (coachErr || !coachRow) {
        throw new Error('No encontramos el profesional. Volvé y elegí de nuevo.');
      }

      const coachId = coachRow.id;              // coaches.id — para bookings.coach_id
      const coachProfileId = coachRow.profile_id; // profiles.id — para salas.coach_id
      const isInstant = !!coachRow.instant_booking;

      await registrarEvento('reserva_iniciada', {
        professional_id: coachId,
        user_id: user.id,
      });

      // 2. Buscar sala existente o crear una nueva
      let salaId: string;
      let roomUrl = '';

      const { data: existingSala } = await supabase
        .from('salas')
        .select('id, room_url')
        .eq('user_id', user.id)
        .eq('coach_id', coachProfileId)
        .maybeSingle();

      if (existingSala) {
        salaId = existingSala.id;
        roomUrl = existingSala.room_url ?? '';
      } else {
        const { data: newSala, error: salaErr } = await supabase
          .from('salas')
          .insert({ user_id: user.id, coach_id: coachProfileId })
          .select('id, room_url')
          .single();
        if (salaErr || !newSala) throw new Error('No se pudo crear la sala de comunicación.');
        salaId = newSala.id;
        roomUrl = newSala.room_url ?? ''; // null hasta que corra el trigger / si la columna recién se agregó
      }

      // 3. Insertar booking — columnas reales verificadas en la base (SCHEMA.md)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          coach_id: coachId,
          sala_id: salaId,
          coach_name: coachName,
          coach_specialty: specialty,
          scheduled_date: dateStr,
          scheduled_time: time,
          amount: priceFrom,
          status: isInstant ? 'confirmada' : 'pendiente',
          ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
          ...(userMessage.trim() ? { user_message: userMessage.trim() } : {}),
        })
        .select('id')
        .single();

      if (bookingError || !booking) {
        await logError('BookingConfirm: insert booking failed', bookingError);
        throw new Error('No se pudo guardar la reserva. Intentalo de nuevo.');
      }

      await registrarEvento('reserva_confirmada', {
        professional_id: coachId,
        booking_id: booking.id,
        sala_id: salaId,
        user_id: user.id,
      });

      // Notificar al coach (push token vive en profiles, vía coachProfileId)
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('push_token, name')
        .eq('id', coachProfileId)
        .maybeSingle();

      const userName = user.user_metadata?.name ?? 'Un usuario';

      if (coachProfile?.push_token) {
        await sendPushNotification(
          coachProfile.push_token,
          isInstant ? 'Nueva reserva confirmada 📅' : 'Nueva solicitud de sesión 📅',
          isInstant
            ? `${userName} reservó una sesión el ${formatDate(dateStr)} a las ${time} hs. Ya está confirmada.`
            : `${userName} quiere reservar una sesión el ${formatDate(dateStr)} a las ${time} hs`,
        );
      }

      if (isInstant) {
        // Crear sala de videollamada en Daily.co en segundo plano (no bloquea al usuario)
        createOrGetMeetingUrl(booking.id).catch(() => {});

        // Reserva instantánea: mismos efectos que cuando el coach acepta
        // manualmente en CoachReservasScreen — notificación al usuario,
        // mensaje de sistema en la sala, y cancelación de otras solicitudes
        // 'pendiente' que hayan quedado compitiendo por el mismo horario.
        const notifTitle = '¡Tu sesión fue confirmada! ✅';
        const notifBody = `Tu sesión con ${coachName} el ${formatDate(dateStr)} está confirmada`;

        await supabase.from('notifications').insert({
          recipient_id: user.id,
          type: 'reserva_confirmada',
          booking_id: booking.id,
          title: notifTitle,
          body: notifBody,
        });

        const confirmLine1 = `Sesión reservada · ${formatDate(dateStr)} · ${time} hs`;
        const confirmMsg = userMessage.trim()
          ? `${confirmLine1}\n${userMessage.trim()}`
          : confirmLine1;
        await supabase.from('messages').insert({
          sala_id: salaId,
          sender_id: user.id,
          sender_type: 'system_confirmed',
          content: encryptMessage(confirmMsg),
        });

        const { data: conflicting } = await supabase
          .from('bookings')
          .select('id, user_id, sala_id')
          .eq('coach_id', coachId)
          .eq('scheduled_date', dateStr)
          .eq('scheduled_time', time)
          .eq('status', 'pendiente')
          .neq('id', booking.id);

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
          const cancelSystemMsg = `Solicitud cancelada automáticamente\n${formatDate(dateStr)} · ${time} hs`;

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

      router.replace({
        pathname: '/booking-success',
        params: {
          name: coachName,
          specialty,
          date: dateStr,
          time,
          bookingId: booking.id,
          roomUrl,
          salaId,
          instant: isInstant ? '1' : '0',
        },
      });
    } catch (e: any) {
      await logError('BookingConfirm: onConfirm failed', e);
      setError(e.message ?? 'Algo salió mal. Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
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
              <MaterialIcons name="person" size={34} color="rgba(135,131,92,0.80)" />
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
            <MaterialIcons name="info-outline" size={15} color="rgba(135,131,92,0.80)" />
            <Text style={s.modalityText}>
              {instantBooking
                ? 'Reserva instantánea — tu sesión queda confirmada al instante'
                : 'Reserva con confirmación — el coach tiene 24hs para aceptar'}
            </Text>
          </View>
        </View>

        {/* Aviso no cobro */}
        <View style={s.noticeRow}>
          <MaterialIcons name="shield" size={15} color={ViveColors.accent} />
          <Text style={s.noticeText}>
            {instantBooking
              ? 'Tu sesión ya queda confirmada al reservar'
              : 'No se te cobra hasta que el coach acepte'}
          </Text>
        </View>

        {/* Mensaje opcional */}
        <View style={s.messageSection}>
          <Text style={s.messageTitle}>
            {instantBooking ? '¿Querés contarle algo al coach?' : '¿Querés contarle algo antes de que acepte?'}
          </Text>
          <Text style={s.messageSubtitle}>Es opcional. Le ayuda al coach a entender mejor tu situación.</Text>
          <View style={s.messageInputWrap}>
            <TextInput
              style={s.messageInput}
              value={userMessage}
              onChangeText={t => t.length <= 300 && setUserMessage(t)}
              placeholder="Contame brevemente qué te trajo acá..."
              placeholderTextColor="rgba(135,131,92,0.45)"
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
            <MaterialIcons name="credit-card" size={22} color="#565E32" />
            <Text style={s.paymentCardText}>Tarjeta de crédito / débito</Text>
            <MaterialIcons name="chevron-right" size={20} color="rgba(135,131,92,0.65)" />
          </TouchableOpacity>

          <TouchableOpacity style={s.paymentCard} activeOpacity={0.75}>
            <MaterialIcons name="account-balance-wallet" size={22} color="#009EE3" />
            <Text style={s.paymentCardText}>Mercado Pago</Text>
            <MaterialIcons name="chevron-right" size={20} color="rgba(135,131,92,0.65)" />
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
              <ActivityIndicator color="#565E32" size="small" />
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

    </AppBg>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeTop: {
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#565E32',
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
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
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
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    marginBottom: 3,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.48)',
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
    color: 'rgba(135,131,92,0.80)',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    lineHeight: 21,
  },

  modalityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,248,240,0.32)',
    borderRadius: 10,
    padding: 12,
  },
  modalityText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
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
    color: '#565E32',
    marginBottom: 4,
    lineHeight: 20,
  },
  messageSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 10,
    lineHeight: 17,
  },
  messageInputWrap: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  messageInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    minHeight: 90,
    lineHeight: 20,
  },
  messageCounter: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.52)',
    textAlign: 'right',
    marginTop: 6,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,80,80,0.18)',
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
    color: '#565E32',
    marginBottom: 4,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    padding: 14,
    gap: 12,
    ...cardShadow,
  },
  paymentCardText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#565E32',
  },

  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  btn: {
    backgroundColor: '#565E32',
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
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,80,80,0.18)',
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
    color: '#87835C',
    lineHeight: 18,
  },
});