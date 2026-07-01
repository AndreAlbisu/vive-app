import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
  StatusBar,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import { sendPushNotification } from '@/lib/notifications';
import { isCancelLate } from '@/lib/bookingHelpers';
import { logError } from '@/lib/logging';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'coach';
  sender_type: 'user' | 'coach' | 'system' | 'system_confirmed' | 'system_cancelled';
  time: string;
};

type ConfirmedBooking = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pendiente' | 'confirmada';
  user_message: string | null;
} | null;

type RecipientProfile = {
  name: string;
  specialty?: string;
  initials: string;
  avatarUrl: string | null;
};

function calcVideoWindow(booking: ConfirmedBooking): boolean {
  if (!booking) return false;
  const [year, month, day] = booking.scheduled_date.split('-').map(Number);
  const [h, m] = booking.scheduled_time.split(':').map(Number);
  const sessionMs = new Date(year, month - 1, day, h, m, 0).getTime();
  return Date.now() >= sessionMs - 5 * 60 * 1000;
}

function canCancelConfirmed(booking: ConfirmedBooking): boolean {
  if (!booking) return false;
  const [year, month, day] = booking.scheduled_date.split('-').map(Number);
  const [h, m] = booking.scheduled_time.split(':').map(Number);
  const sessionMs = new Date(year, month - 1, day, h, m, 0).getTime();
  return Date.now() < sessionMs - 24 * 60 * 60 * 1000;
}

function formatSalaDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const monthName = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month - 1];
  return `${dayName} ${day} ${monthName}`;
}

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function rowToMessage(row: Record<string, unknown>, userId: string): Message {
  const senderType = (row.sender_type as string) ?? 'user';
  return {
    id: row.id as string,
    text: row.content as string,
    sender: (row.sender_id as string) === userId ? 'user' : 'coach',
    sender_type: senderType as 'user' | 'coach' | 'system' | 'system_confirmed' | 'system_cancelled',
    time: new Date(row.created_at as string).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function buildInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function SalaScreen() {
  const router = useRouter();
  const { sala_id: salaIdParam, coach_id } = useLocalSearchParams<{ sala_id?: string; coach_id?: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [salaId, setSalaId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientIsCoach, setRecipientIsCoach] = useState(false);
  const [recipientProfile, setRecipientProfile] = useState<RecipientProfile | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking>(null);
  const [isInVideoWindow, setIsInVideoWindow] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const messageAnims = useRef<Record<string, Animated.Value>>({});
  function getAnim(id: string, initialValue = 0): Animated.Value {
    if (!messageAnims.current[id]) {
      messageAnims.current[id] = new Animated.Value(initialValue);
    }
    return messageAnims.current[id];
  }

  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(inputAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (!salaIdParam && !coach_id) { setLoading(false); return; }

    let mounted = true;

    async function init() {
      let id: string | null = null;
      let salaUserId: string | null = null;
      let salaCoachId: string | null = null;
      let salaRoomUrl: string | null = null;

      if (salaIdParam) {
        const { data: sala } = await supabase
          .from('salas')
          .select('id, user_id, coach_id, room_url')
          .eq('id', salaIdParam)
          .single();
        if (sala) {
          id = sala.id as string;
          salaUserId = sala.user_id as string;
          salaCoachId = sala.coach_id as string;
          salaRoomUrl = sala.room_url as string | null;
        }
      } else {
        const { data: existing } = await supabase
          .from('salas')
          .select('id, user_id, coach_id, room_url')
          .eq('user_id', user!.id)
          .eq('coach_id', coach_id!)
          .maybeSingle();

        if (existing) {
          id = existing.id as string;
          salaUserId = existing.user_id as string;
          salaCoachId = existing.coach_id as string;
          salaRoomUrl = existing.room_url as string | null;
        } else {
          const { data: created, error } = await supabase
            .from('salas')
            .insert({ user_id: user!.id, coach_id: coach_id! })
            .select('id, user_id, coach_id, room_url')
            .single();
          if (error) await logError('SalaScreen: crear sala failed', error);
          if (created) {
            id = (created as any).id;
            salaUserId = (created as any).user_id;
            salaCoachId = (created as any).coach_id;
            salaRoomUrl = (created as any).room_url;
          }
        }
      }

      if (!mounted || !id || !salaUserId || !salaCoachId) {
        if (mounted) setLoading(false);
        return;
      }

      const resolvedRecipientId = user!.id === salaUserId ? salaCoachId : salaUserId;
      const isRecipientCoach = user!.id === salaUserId;

      setSalaId(id);
      setRoomUrl(salaRoomUrl);
      setRecipientId(resolvedRecipientId);
      setRecipientIsCoach(isRecipientCoach);

      // Marcar sala como leída para este rol — dispara el listener del tab dot
      const readField = isRecipientCoach ? 'user_last_read_at' : 'coach_last_read_at';
      supabase.from('salas').update({ [readField]: new Date().toISOString() }).eq('id', id);

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const [profileResult, bookingResult, msgsResult] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', resolvedRecipientId).single(),
        supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time, status, user_message')
          .eq('sala_id', id)
          .in('status', ['pendiente', 'confirmada'])
          .gte('scheduled_date', todayStr)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
          .limit(1),
        supabase
          .from('messages')
          .select('*')
          .eq('sala_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (!mounted) return;

      const recipientName = (profileResult.data as any)?.name ?? '';
      const recipientAvatarUrl = (profileResult.data as any)?.avatar_url ?? null;
      let specialty: string | undefined;
      if (isRecipientCoach) {
        const { data: coachRow } = await supabase
          .from('coaches')
          .select('specialty')
          .eq('profile_id', resolvedRecipientId)
          .single();
        specialty = (coachRow as any)?.specialty;
      }

      if (mounted) {
        setRecipientProfile({
          name: recipientName,
          specialty,
          initials: recipientName ? buildInitials(recipientName) : '?',
          avatarUrl: recipientAvatarUrl,
        });
        setConfirmedBooking(bookingResult.data?.[0] ?? null);
      }

      if (msgsResult.error) await logError('SalaScreen: cargar mensajes failed', msgsResult.error);

      if (!mounted) return;
      const msgs = msgsResult.data;
      if (msgs && msgs.length > 0) {
        const mapped = (msgs as Record<string, unknown>[]).map(row => rowToMessage(row, user!.id));
        mapped.forEach(m => getAnim(m.id, 0));
        setMessages(mapped);
        requestAnimationFrame(() => {
          const anims = mapped.map(m =>
            Animated.timing(getAnim(m.id), { toValue: 1, duration: 350, useNativeDriver: true })
          );
          Animated.stagger(60, anims).start();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
        });
      }

      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [user?.id, salaIdParam, coach_id]);

  useEffect(() => {
    if (!salaId || !user) return;

    const channel = supabase
      .channel(`sala:${salaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sala_id=eq.${salaId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const senderType = (row.sender_type as string) ?? 'user';
          const isSystemMsg = senderType === 'system_confirmed' || senderType === 'system_cancelled' || senderType === 'system';
          if (!isSystemMsg && (row.sender_id as string) === user.id) return;

          const msg = rowToMessage(row, user.id);
          getAnim(msg.id, 0);
          setMessages(prev => [...prev, msg]);
          Animated.timing(getAnim(msg.id), { toValue: 1, duration: 280, useNativeDriver: true }).start();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [salaId, user?.id]);

  useEffect(() => {
    setIsInVideoWindow(calcVideoWindow(confirmedBooking));
    if (!confirmedBooking) return;
    const interval = setInterval(() => {
      setIsInVideoWindow(calcVideoWindow(confirmedBooking));
    }, 30_000);
    return () => clearInterval(interval);
  }, [confirmedBooking]);

  function handleVideoPress() {
    if (roomUrl) Linking.openURL(roomUrl);
  }

  async function handleCancelBooking() {
    if (!confirmedBooking || !salaId || !user) return;

    const isCurrentUserCoach = !recipientIsCoach;

    // Solo el usuario tiene restricción de 24hs; el coach siempre puede cancelar
    if (!isCurrentUserCoach && confirmedBooking.status === 'confirmada' && !canCancelConfirmed(confirmedBooking)) {
      Alert.alert(
        'No se puede cancelar',
        'Las sesiones confirmadas solo se pueden cancelar con al menos 24hs de anticipación.',
      );
      return;
    }

    const isPending = confirmedBooking.status === 'pendiente';
    Alert.alert(
      isPending ? '¿Cancelar solicitud?' : '¿Cancelar sesión?',
      isPending
        ? '¿Querés cancelar tu solicitud de sesión?'
        : '¿Querés cancelar esta sesión confirmada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            const bookingId = confirmedBooking.id;
            const cancelDateStr = formatSalaDate(confirmedBooking.scheduled_date);
            const cancelTimeStr = confirmedBooking.scheduled_time.slice(0, 5);
            try {
              if (isCurrentUserCoach) {
                await supabase
                  .from('bookings')
                  .update({
                    status: 'cancelada',
                    cancelled_by: 'coach',
                    cancelled_late: isCancelLate(confirmedBooking.scheduled_date, confirmedBooking.scheduled_time),
                  })
                  .eq('id', bookingId);

                await supabase.from('messages').insert({
                  sala_id: salaId,
                  sender_id: user.id,
                  sender_type: 'system_cancelled',
                  content: encryptMessage(`El coach canceló la sesión\n${cancelDateStr} · ${cancelTimeStr} hs`),
                });

                if (recipientId) {
                  const { data: userProfile } = await supabase
                    .from('profiles')
                    .select('push_token')
                    .eq('id', recipientId)
                    .maybeSingle();

                  const notifTitle = 'Sesión cancelada';
                  const notifBody = 'Tu coach canceló la sesión agendada.';

                  await Promise.all([
                    supabase.from('notifications').insert({
                      recipient_id: recipientId,
                      type: 'reserva_cancelada',
                      booking_id: bookingId,
                      title: notifTitle,
                      body: notifBody,
                    }),
                    userProfile?.push_token
                      ? sendPushNotification(userProfile.push_token, notifTitle, notifBody)
                      : Promise.resolve(),
                  ]);
                }
              } else {
                await supabase
                  .from('bookings')
                  .update({ status: 'cancelada', cancelled_by: 'usuario' })
                  .eq('id', bookingId);

                await supabase.from('messages').insert({
                  sala_id: salaId,
                  sender_id: user.id,
                  sender_type: 'system_cancelled',
                  content: encryptMessage(`El usuario canceló la sesión\n${cancelDateStr} · ${cancelTimeStr} hs`),
                });

                if (recipientId) {
                  const { data: coachProfile } = await supabase
                    .from('profiles')
                    .select('push_token')
                    .eq('id', recipientId)
                    .maybeSingle();

                  const notifTitle = 'Sesión cancelada';
                  const notifBody = 'El usuario canceló la sesión agendada.';

                  await Promise.all([
                    supabase.from('notifications').insert({
                      recipient_id: recipientId,
                      type: 'reserva_cancelada',
                      booking_id: bookingId,
                      title: notifTitle,
                      body: notifBody,
                    }),
                    coachProfile?.push_token
                      ? sendPushNotification(coachProfile.push_token, notifTitle, notifBody)
                      : Promise.resolve(),
                  ]);
                }
              }

              setConfirmedBooking(null);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  }

  function handleHeaderPress() {
    if (!recipientProfile) return;
    router.push({
      pathname: '/profesional',
      params: {
        profileId: recipientId ?? '',
        name: recipientProfile.name,
        specialty: recipientProfile.specialty ?? '',
        rating: '',
        reviewCount: '',
        priceFrom: '',
      },
    });
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !salaId || !user) return;

    const encrypted = encryptMessage(text);
    const optimisticId = `opt_${Date.now()}`;
    const optimistic: Message = { id: optimisticId, text: encrypted, sender: 'user', sender_type: 'user', time: nowTime() };

    getAnim(optimisticId, 0);
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    Animated.timing(getAnim(optimisticId), { toValue: 1, duration: 280, useNativeDriver: true }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

    const { error } = await supabase
      .from('messages')
      .insert({ sala_id: salaId, sender_id: user.id, content: encrypted });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
      return;
    }

    if (recipientId) {
      const { data: recipientPushData } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', recipientId)
        .maybeSingle();

      if (recipientPushData?.push_token) {
        await sendPushNotification(
          recipientPushData.push_token,
          'Nuevo mensaje',
          text.slice(0, 50),
        );
      }
    }
  }

  const isCurrentUserCoach = !recipientIsCoach;
  const canSend = inputText.trim().length > 0 && !!salaId && !!user;
  const displayInitials = recipientProfile?.initials ?? '···';

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_sala"
        icon="message-outline"
        iconColor="#87835C"
        title="La Sala"
        description="Tu espacio de comunicación. Escribí mensajes y coordiná tus sesiones."
        delay={1000}
      />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.coachInfo}
          activeOpacity={recipientIsCoach ? 0.7 : 1}
          onPress={recipientIsCoach ? handleHeaderPress : undefined}
        >
          <View style={styles.avatarWrap}>
            {recipientProfile?.avatarUrl ? (
              <Image source={{ uri: recipientProfile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayInitials}</Text>
              </View>
            )}
          </View>
          <View>
            {recipientProfile ? (
              <>
                <Text style={styles.coachName}>{recipientProfile.name}</Text>
                {!!recipientProfile.specialty && (
                  <Text style={styles.coachSpecialty}>{recipientProfile.specialty}</Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.skeletonName} />
                <View style={styles.skeletonSpecialty} />
              </>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.videoBtn, !(roomUrl && isInVideoWindow) && styles.videoBtnDisabled]}
          activeOpacity={roomUrl && isInVideoWindow ? 0.7 : 1}
          onPress={handleVideoPress}
          hitSlop={8}
          disabled={!(roomUrl && isInVideoWindow)}
        >
          <MaterialCommunityIcons
            name="video-outline"
            size={24}
            color={roomUrl && isInVideoWindow ? ViveColors.primary : "rgba(135,131,92,0.52)"}
          />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.headerDivider} />

      {/* Session Banner */}
      <View style={styles.bannerDefault}>
        {confirmedBooking ? (
          <>
            <View style={styles.bannerRow}>
              <Text style={[styles.bannerText, { flex: 1 }]}>
                {confirmedBooking.status === 'pendiente' ? 'Solicitud pendiente: ' : 'Próxima sesión: '}
                <Text style={styles.bannerBold}>
                  {formatSalaDate(confirmedBooking.scheduled_date)} · {confirmedBooking.scheduled_time.slice(0, 5)} hs
                </Text>
              </Text>
              <TouchableOpacity
                onPress={handleCancelBooking}
                disabled={isCancelling || (!isCurrentUserCoach && confirmedBooking.status === 'confirmada' && !canCancelConfirmed(confirmedBooking))}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cancelBtnText,
                  (isCancelling || (!isCurrentUserCoach && confirmedBooking.status === 'confirmada' && !canCancelConfirmed(confirmedBooking)))
                    && styles.cancelBtnTextDisabled,
                ]}>
                  {confirmedBooking.status === 'pendiente' ? 'Cancelar solicitud' : 'Cancelar sesión'}
                </Text>
              </TouchableOpacity>
            </View>
            {!isCurrentUserCoach && confirmedBooking.status === 'confirmada' && !canCancelConfirmed(confirmedBooking) && (
              <Text style={styles.bannerNote}>No se puede cancelar con menos de 24hs de anticipación</Text>
            )}
          </>
        ) : (
          <Text style={styles.bannerText}>Sin sesión programada</Text>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {loading && (
            <ActivityIndicator color={ViveColors.primary} style={{ marginTop: 40 }} />
          )}
          {!loading && messages.length === 0 && (
            <Text style={styles.emptyText}>
              Todavía no hay mensajes.{'\n'}¡Empezá la conversación!
            </Text>
          )}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const anim = getAnim(msg.id, 1);

            if (msg.sender_type === 'system_confirmed' || msg.sender_type === 'system_cancelled' || msg.sender_type === 'system') {
              const isConfirmed = msg.sender_type === 'system_confirmed';
              const isCancelled = msg.sender_type === 'system_cancelled';
              const decrypted = decryptMessage(msg.text);
              const [sysLine1, sysLine2] = decrypted.split('\n');
              return (
                <Animated.View
                  key={msg.id}
                  style={[
                    styles.systemRow,
                    {
                      opacity: anim,
                      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                    },
                  ]}
                >
                  {(isConfirmed || isCancelled) ? (
                    <View style={[styles.systemPill, isConfirmed ? styles.systemPillConfirmed : styles.systemPillCancelled]}>
                      <View style={styles.systemPillRow}>
                        <MaterialCommunityIcons
                          name={isConfirmed ? 'calendar-check' : 'calendar-remove'}
                          size={16}
                          color={isConfirmed ? ViveColors.accent : '#E05252'}
                          style={{ marginTop: 1 }}
                        />
                        <View style={styles.systemPillContent}>
                          <Text style={styles.systemPillLine1}>{sysLine1}</Text>
                          {!!sysLine2 && <Text style={styles.systemPillLine2}>{sysLine2}</Text>}
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.systemText}>{decrypted}</Text>
                  )}
                </Animated.View>
              );
            }

            return (
              <Animated.View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowCoach,
                  {
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                {!isUser && (
                  recipientProfile?.avatarUrl ? (
                    <Image source={{ uri: recipientProfile.avatarUrl }} style={styles.avatarSmallImage} />
                  ) : (
                    <View style={styles.avatarSmall}>
                      <Text style={styles.avatarSmallText}>{displayInitials}</Text>
                    </View>
                  )
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                    {decryptMessage(msg.text)}
                  </Text>
                  <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeCoach]}>
                    {msg.time}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Input bar */}
        <Animated.View
          style={[
            styles.inputArea,
            {
              opacity: inputAnim,
              transform: [{ translateY: inputAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribí un mensaje..."
            placeholderTextColor="rgba(135,131,92,0.55)"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="send" size={19} color="#565E32" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(247,239,228,0.92)',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  coachInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonName: {
    width: 110,
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(86,94,50,0.12)',
    marginBottom: 5,
  },
  skeletonSpecialty: {
    width: 70,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,248,240,0.32)',
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    lineHeight: 20,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
    marginTop: 1,
  },
  videoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,240,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBtnDisabled: {
    backgroundColor: 'rgba(255,248,240,0.32)',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.48)',
  },
  bannerDefault: {
    backgroundColor: 'rgba(255,248,240,0.40)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 18,
  },
  bannerBold: {
    fontFamily: ViveFonts.semibold,
  },
  bannerNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#87835C',
    marginTop: 3,
    fontStyle: 'italic',
  },
  cancelBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#E05252',
    flexShrink: 0,
  },
  cancelBtnTextDisabled: {
    color: 'rgba(135,131,92,0.45)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.80)',
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 22,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowCoach: {
    justifyContent: 'flex-start',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  avatarSmallText: {
    fontFamily: ViveFonts.bold,
    fontSize: 9,
    color: '#565E32',
    letterSpacing: 0.3,
  },
  avatarSmallImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '74%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: ViveColors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  bubbleCoach: {
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  bubbleText: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#565E32',
  },
  bubbleTextCoach: {
    color: '#565E32',
  },
  bubbleTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  bubbleTimeUser: {
    color: '#87835C',
  },
  bubbleTimeCoach: {
    color: 'rgba(135,131,92,0.80)',
  },
  systemRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  systemPill: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  systemPillConfirmed: {
    backgroundColor: 'rgba(100,200,150,0.22)',
  },
  systemPillCancelled: {
    backgroundColor: '#E0525218',
  },
  systemPillRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  systemPillContent: {
    flexShrink: 1,
    gap: 2,
  },
  systemPillLine1: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 18,
  },
  systemPillLine2: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 17,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 120,
    lineHeight: 21,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,248,240,0.62)',
    shadowOpacity: 0,
    elevation: 0,
  },
});
