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
  AccessibilityInfo,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Calendar from 'expo-calendar';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import { sendPushNotification } from '@/lib/notifications';
import { isCancelLate } from '@/lib/bookingHelpers';
import { logError } from '@/lib/logging';
import { createOrGetMeetingUrl } from '@/lib/meetingRoom';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'coach';
  sender_type: 'user' | 'coach' | 'system' | 'system_confirmed' | 'system_cancelled';
  time: string;
};

type ActiveBooking = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pendiente' | 'confirmada' | 'completada';
  user_message: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
} | null;

type RecipientProfile = {
  name: string;
  specialty?: string;
  initials: string;
  avatarUrl: string | null;
};

type SessionState = 'none' | 'pendiente' | 'confirmada' | 'live' | 'finalizada';

function getSessionState(booking: ActiveBooking): SessionState {
  if (!booking) return 'none';
  if (booking.status === 'pendiente') return 'pendiente';
  if (booking.status === 'completada') {
    const [y, mo, d] = booking.scheduled_date.split('-').map(Number);
    const [h, mi] = booking.scheduled_time.split(':').map(Number);
    const endMs = new Date(y, mo - 1, d, h, mi).getTime() + ((booking.duration_minutes ?? 60) * 60_000);
    return Date.now() < endMs + 24 * 60 * 60_000 ? 'finalizada' : 'none';
  }
  if (booking.status === 'confirmada') {
    const [y, mo, d] = booking.scheduled_date.split('-').map(Number);
    const [h, mi] = booking.scheduled_time.split(':').map(Number);
    const startMs = new Date(y, mo - 1, d, h, mi).getTime();
    const endMs = startMs + ((booking.duration_minutes ?? 60) * 60_000);
    const now = Date.now();
    if (now >= startMs - 10 * 60_000 && now <= endMs + 15 * 60_000) return 'live';
    return 'confirmada';
  }
  return 'none';
}

function canCancelConfirmed(booking: ActiveBooking): boolean {
  if (!booking) return false;
  const [y, mo, d] = booking.scheduled_date.split('-').map(Number);
  const [h, mi] = booking.scheduled_time.split(':').map(Number);
  return Date.now() < new Date(y, mo - 1, d, h, mi).getTime() - 24 * 60 * 60_000;
}

function formatSalaDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${DAY[d.getDay()]} ${day} ${MON[month - 1]}`;
}

function countdownText(dateStr: string, timeStr: string, durationMins: number | null): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const target = new Date(y, mo - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let dayText = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
  const dur = durationMins ? `${durationMins} min` : '60 min';
  return `${dayText} · ${dur} · videollamada`;
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
    sender_type: senderType as Message['sender_type'],
    time: new Date(row.created_at as string).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function buildInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
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
  const [activeBooking, setActiveBooking] = useState<ActiveBooking>(null);
  const [hasSessionHistory, setHasSessionHistory] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('none');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
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
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(inputAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Pulse animation for live state
  useEffect(() => {
    if (sessionState !== 'live' || reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sessionState, reduceMotion]);

  // Load sala data
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (!salaIdParam && !coach_id) { setLoading(false); return; }

    let mounted = true;

    async function init() {
      let id: string | null = null;
      let salaUserId: string | null = null;
      let salaCoachId: string | null = null;

      if (salaIdParam) {
        const { data: sala } = await supabase
          .from('salas')
          .select('id, user_id, coach_id')
          .eq('id', salaIdParam)
          .single();
        if (sala) {
          id = sala.id as string;
          salaUserId = sala.user_id as string;
          salaCoachId = sala.coach_id as string;
        }
      } else {
        const { data: existing } = await supabase
          .from('salas')
          .select('id, user_id, coach_id')
          .eq('user_id', user!.id)
          .eq('coach_id', coach_id!)
          .maybeSingle();

        if (existing) {
          id = existing.id as string;
          salaUserId = existing.user_id as string;
          salaCoachId = existing.coach_id as string;
        } else {
          const { data: created, error } = await supabase
            .from('salas')
            .insert({ user_id: user!.id, coach_id: coach_id! })
            .select('id, user_id, coach_id')
            .single();
          if (error) await logError('SalaScreen: crear sala failed', error);
          if (created) {
            id = (created as any).id;
            salaUserId = (created as any).user_id;
            salaCoachId = (created as any).coach_id;
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
      setRecipientId(resolvedRecipientId);
      setRecipientIsCoach(isRecipientCoach);

      const readField = isRecipientCoach ? 'user_last_read_at' : 'coach_last_read_at';
      supabase
        .from('salas')
        .update({ [readField]: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[SalaScreen] Error actualizando', readField, ':', error);
          }
        });

      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      })();

      const [profileResult, activeBookingRes, recentCompletedRes, sessionHistoryRes, msgsResult] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', resolvedRecipientId).single(),
        supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time, status, user_message, duration_minutes, meeting_url')
          .eq('sala_id', id)
          .in('status', ['pendiente', 'confirmada'])
          .gte('scheduled_date', todayStr)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
          .limit(1),
        supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time, status, user_message, duration_minutes, meeting_url')
          .eq('sala_id', id)
          .eq('status', 'completada')
          .gte('scheduled_date', yesterdayStr)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false })
          .limit(1),
        // ¿ya hubo alguna sesión completada en esta sala? El chat solo se congela
        // antes de la primera sesión, no en cada solicitud nueva de un cliente recurrente.
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('sala_id', id)
          .eq('status', 'completada'),
        supabase
          .from('messages')
          .select('*')
          .eq('sala_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (!mounted) return;

      setHasSessionHistory((sessionHistoryRes.count ?? 0) > 0);

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

        const booking: ActiveBooking = (activeBookingRes.data?.[0] ?? recentCompletedRes.data?.[0] ?? null) as ActiveBooking;
        setActiveBooking(booking);
        setSessionState(getSessionState(booking));

        // Si la sesión está confirmada pero no tiene meeting_url, crear la sala en segundo plano
        if (booking?.status === 'confirmada' && !booking.meeting_url) {
          setIsCreatingRoom(true);
          createOrGetMeetingUrl(booking.id).then(url => {
            if (url && mounted) {
              setActiveBooking(prev => prev ? { ...prev, meeting_url: url } : null);
            }
            if (mounted) setIsCreatingRoom(false);
          });
        }
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

  // Realtime: mensajes nuevos
  useEffect(() => {
    if (!salaId || !user) return;

    // supabase.channel() devuelve el canal existente si ya hay uno con el mismo
    // topic (p.ej. si el cleanup de un montaje previo todavía no terminó de
    // sacarlo). Si ya está subscripto, .on() más abajo tira "cannot add
    // postgres_changes callbacks... after subscribe()". Lo sacamos antes de crear el nuevo.
    const topic = `realtime:sala:${salaId}`;
    const stale = supabase.getChannels().find(c => c.topic === topic);
    if (stale) supabase.removeChannel(stale);

    const channel = supabase
      .channel(`sala:${salaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sala_id=eq.${salaId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const senderType = (row.sender_type as string) ?? 'user';
          const isSystem = senderType === 'system_confirmed' || senderType === 'system_cancelled' || senderType === 'system';
          if (!isSystem && (row.sender_id as string) === user.id) return;

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

  // Timer: recomputar sessionState cada 30s
  useEffect(() => {
    setSessionState(getSessionState(activeBooking));
    if (!activeBooking) return;
    const interval = setInterval(() => {
      setSessionState(getSessionState(activeBooking));
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeBooking]);

  // — Handlers —

  async function handleJoin() {
    if (!activeBooking) return;
    let url = activeBooking.meeting_url;

    if (!url) {
      setIsCreatingRoom(true);
      url = await createOrGetMeetingUrl(activeBooking.id);
      if (url) setActiveBooking(prev => prev ? { ...prev, meeting_url: url } : null);
      setIsCreatingRoom(false);
    }

    if (url) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert('Error', 'No se pudo preparar la sala. Intentalo de nuevo en unos segundos.');
    }
  }

  function handleReschedule() {
    if (!recipientId || !recipientProfile) return;
    router.push({
      pathname: '/booking-calendar',
      params: {
        name: recipientProfile.name,
        specialty: recipientProfile.specialty ?? '',
        priceFrom: '',
        coachId: recipientId,
      },
    });
  }

  async function handleAddToCalendar() {
    if (!activeBooking) return;
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sin permiso', 'Necesitamos acceso al calendario para agregar la sesión.');
      return;
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.find(c => c.allowsModifications);
    if (!writable) return;
    const [y, mo, d] = activeBooking.scheduled_date.split('-').map(Number);
    const [h, mi] = activeBooking.scheduled_time.split(':').map(Number);
    const startDate = new Date(y, mo - 1, d, h, mi, 0);
    const dur = activeBooking.duration_minutes ?? 60;
    const endDate = new Date(startDate.getTime() + dur * 60_000);
    await Calendar.createEventAsync(writable.id, {
      title: `Sesión con ${recipientProfile?.name ?? 'coach'} — Vive`,
      startDate,
      endDate,
      notes: activeBooking.meeting_url ? `Videollamada: ${activeBooking.meeting_url}` : undefined,
      location: activeBooking.meeting_url ?? undefined,
    });
    Alert.alert('Listo ✓', 'La sesión fue agregada a tu calendario.');
  }

  async function handleCancelBooking() {
    if (!activeBooking || !salaId || !user) return;

    const isCurrentUserCoach = !recipientIsCoach;

    if (!isCurrentUserCoach && activeBooking.status === 'confirmada' && !canCancelConfirmed(activeBooking)) {
      Alert.alert('No se puede cancelar', 'Las sesiones confirmadas solo se pueden cancelar con al menos 24hs de anticipación.');
      return;
    }

    const isPending = activeBooking.status === 'pendiente';
    Alert.alert(
      isPending ? '¿Cancelar solicitud?' : '¿Cancelar sesión?',
      isPending ? '¿Querés cancelar tu solicitud de sesión?' : '¿Querés cancelar esta sesión confirmada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            const bookingId = activeBooking.id;
            const cancelDateStr = formatSalaDate(activeBooking.scheduled_date);
            const cancelTimeStr = activeBooking.scheduled_time.slice(0, 5);

            try {
              if (isCurrentUserCoach) {
                await supabase
                  .from('bookings')
                  .update({
                    status: 'cancelada',
                    cancelled_by: 'coach',
                    cancelled_late: isCancelLate(activeBooking.scheduled_date, activeBooking.scheduled_time),
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
                    .from('profiles').select('push_token').eq('id', recipientId).maybeSingle();
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
                    .from('profiles').select('push_token').eq('id', recipientId).maybeSingle();
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

              setActiveBooking(null);
              setSessionState('none');
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
    if (activeBooking?.status === 'pendiente') return;

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
      .insert({
        sala_id: salaId,
        sender_id: user.id,
        content: encrypted,
        sender_type: isCurrentUserCoach ? 'coach' : 'user',
      });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
      return;
    }

    if (recipientId) {
      const { data: recipientPushData } = await supabase
        .from('profiles').select('push_token').eq('id', recipientId).maybeSingle();
      if (recipientPushData?.push_token) {
        await sendPushNotification(recipientPushData.push_token, 'Nuevo mensaje', text.slice(0, 50));
      }
    }
  }

  const isCurrentUserCoach = !recipientIsCoach;
  const isChatFrozen = activeBooking?.status === 'pendiente' && !hasSessionHistory;
  const canSend = inputText.trim().length > 0 && !!salaId && !!user && !isChatFrozen;
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
      </Animated.View>

      <View style={styles.headerDivider} />

      {/* Session card */}
      {sessionState === 'live' ? (
        <LinearGradient colors={['#42542F', '#354526']} style={styles.sessionCardLive}>
          <Text style={styles.liveTitle}>
            {(() => {
              const [y, mo, d] = activeBooking!.scheduled_date.split('-').map(Number);
              const [h, mi] = activeBooking!.scheduled_time.split(':').map(Number);
              const startMs = new Date(y, mo - 1, d, h, mi).getTime();
              return Date.now() < startMs ? 'Tu sesión está por comenzar' : 'Tu sesión está en curso';
            })()}
          </Text>
          <Text style={styles.liveSub}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs
          </Text>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 12 }}>
            <TouchableOpacity
              style={styles.liveJoinBtn}
              onPress={handleJoin}
              disabled={isCreatingRoom}
              activeOpacity={0.85}
            >
              {isCreatingRoom
                ? <ActivityIndicator size="small" color="#F3EEDF" />
                : <MaterialCommunityIcons name="video" size={17} color="#F3EEDF" />
              }
              <Text style={styles.liveJoinText}>
                {isCreatingRoom ? 'Preparando sala…' : 'Unirse ahora'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      ) : sessionState === 'pendiente' ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color="#87835C" />
            <Text style={styles.sessionCardLabel}>Solicitud enviada</Text>
          </View>
          <Text style={styles.sessionCardDate}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs
          </Text>
          <Text style={styles.sessionCardSub}>
            Esperando confirmación de {recipientProfile?.name ?? 'tu coach'}
          </Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelBooking}
            disabled={isCancelling}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelBtnText, isCancelling && styles.cancelBtnTextDisabled]}>
              {isCancelling ? 'Cancelando…' : 'Cancelar solicitud'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : sessionState === 'confirmada' ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <MaterialCommunityIcons name="calendar-check" size={14} color="#2D4A3E" />
            <Text style={styles.sessionCardLabel}>Próxima sesión</Text>
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedBadgeText}>Confirmada</Text>
            </View>
          </View>
          <Text style={styles.sessionCardDate}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs
          </Text>
          <Text style={styles.sessionCardSub}>
            {countdownText(activeBooking!.scheduled_date, activeBooking!.scheduled_time, activeBooking!.duration_minutes)}
          </Text>
          <View style={styles.sessionCardActions}>
            <TouchableOpacity
              style={[styles.joinBtn, styles.joinBtnDisabled]}
              disabled
              activeOpacity={0.5}
            >
              {isCreatingRoom
                ? <ActivityIndicator size="small" color="rgba(86,94,50,0.5)" />
                : <MaterialCommunityIcons name="video-outline" size={14} color="rgba(86,94,50,0.5)" />
              }
              <Text style={styles.joinBtnTextDisabled}>
                {isCreatingRoom ? 'Preparando sala…' : 'Unirse a la llamada'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subBtn} onPress={handleAddToCalendar} activeOpacity={0.75}>
              <Text style={styles.subBtnText}>Agendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subBtn} onPress={handleReschedule} activeOpacity={0.75}>
              <Text style={styles.subBtnText}>Reprogramar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sessionCardHint}>Disponible 10 min antes de la sesión</Text>
        </View>
      ) : sessionState === 'finalizada' ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#87835C" />
            <Text style={styles.sessionCardLabel}>
              Sesión del {formatSalaDate(activeBooking!.scheduled_date)} completada
            </Text>
          </View>
          <TouchableOpacity style={styles.reserveBtn} onPress={handleReschedule} activeOpacity={0.8}>
            <Text style={styles.reserveBtnText}>Reservar próxima sesión</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
          {!loading && messages.length === 0 && !isChatFrozen && (
            <Text style={styles.emptyText}>¡Empezá la conversación!</Text>
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
          {isChatFrozen ? (
            <View style={styles.frozenNotice}>
              <MaterialCommunityIcons name="lock-outline" size={16} color="rgba(135,131,92,0.70)" />
              <Text style={styles.frozenNoticeText}>
                {isCurrentUserCoach
                  ? 'Aceptá o rechazá la solicitud desde Reservas para habilitar el chat.'
                  : `El chat se habilita cuando ${recipientProfile?.name ?? 'el coach'} acepte tu solicitud.`}
              </Text>
            </View>
          ) : (
            <>
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
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(247,239,228,0.92)',
    gap: 12,
  },
  backBtn: { padding: 4 },
  coachInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
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
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  skeletonName: {
    width: 110, height: 13, borderRadius: 6,
    backgroundColor: 'rgba(86,94,50,0.12)', marginBottom: 5,
  },
  skeletonSpecialty: {
    width: 70, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,248,240,0.32)',
  },
  coachName: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32', lineHeight: 20 },
  coachSpecialty: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.80)', marginTop: 1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(255,248,240,0.48)' },

  // Session card — confirmada / pendiente / finalizada
  sessionCard: {
    backgroundColor: 'rgba(255,248,240,0.60)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sessionCardLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#87835C',
    textTransform: 'uppercase',
    flex: 1,
  },
  sessionCardDate: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 18,
    color: '#565E32',
    lineHeight: 24,
  },
  sessionCardSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 2,
  },
  sessionCardHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.65)',
    marginTop: 2,
    textAlign: 'center',
  },
  sessionCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  confirmedBadge: {
    backgroundColor: 'rgba(220,229,203,0.60)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confirmedBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#42542F',
  },

  joinBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D4A3E',
    borderRadius: 13,
    paddingVertical: 10,
  },
  joinBtnDisabled: { backgroundColor: 'rgba(86,94,50,0.12)' },
  joinBtnText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#F3EEDF' },
  joinBtnTextDisabled: { fontFamily: ViveFonts.semibold, fontSize: 13, color: 'rgba(86,94,50,0.50)' },

  subBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.18)',
    borderRadius: 13,
    paddingVertical: 10,
  },
  subBtnText: { fontFamily: ViveFonts.medium, fontSize: 12, color: '#565E32' },

  cancelBtn: { alignSelf: 'flex-start', marginTop: 8 },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#E05252' },
  cancelBtnTextDisabled: { color: 'rgba(135,131,92,0.45)' },

  reserveBtn: {
    marginTop: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  reserveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#FFF6EC' },

  // Live card
  sessionCardLive: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  liveTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF', lineHeight: 20 },
  liveSub: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#C9CFAF', marginTop: 2 },
  liveJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  liveJoinText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF' },

  // Messages
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  emptyText: {
    fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.80)',
    textAlign: 'center', marginTop: 60, lineHeight: 22,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowCoach: { justifyContent: 'flex-start' },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ViveColors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginBottom: 2,
  },
  avatarSmallText: { fontFamily: ViveFonts.bold, fontSize: 9, color: '#565E32', letterSpacing: 0.3 },
  avatarSmallImage: { width: 28, height: 28, borderRadius: 14, flexShrink: 0, marginBottom: 2 },
  bubble: { maxWidth: '74%', paddingVertical: 10, paddingHorizontal: 14, gap: 4 },
  bubbleUser: {
    backgroundColor: ViveColors.primary, borderRadius: 18, borderBottomRightRadius: 4,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  bubbleCoach: {
    backgroundColor: 'rgba(255,248,240,0.62)', borderRadius: 18, borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: { shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  bubbleText: { fontFamily: ViveFonts.regular, fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#565E32' },
  bubbleTextCoach: { color: '#565E32' },
  bubbleTime: { fontFamily: ViveFonts.regular, fontSize: 10, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: '#87835C' },
  bubbleTimeCoach: { color: 'rgba(135,131,92,0.80)' },

  systemRow: { alignItems: 'center', paddingVertical: 4 },
  systemText: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.80)', fontStyle: 'italic', textAlign: 'center' },
  systemPill: { maxWidth: '88%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  systemPillConfirmed: { backgroundColor: 'rgba(100,200,150,0.22)' },
  systemPillCancelled: { backgroundColor: '#E0525218' },
  systemPillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  systemPillContent: { flexShrink: 1, gap: 2 },
  systemPillLine1: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', lineHeight: 18 },
  systemPillLine2: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#87835C', lineHeight: 17 },

  // Composer
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(86,94,50,0.12)',
    gap: 10,
  },
  input: {
    flex: 1, fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32',
    backgroundColor: 'rgba(255,248,240,0.48)', borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, maxHeight: 120, lineHeight: 21,
  },
  frozenNotice: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,248,240,0.48)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  frozenNoticeText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', lineHeight: 18 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: ViveColors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,248,240,0.62)', shadowOpacity: 0, elevation: 0 },
});
