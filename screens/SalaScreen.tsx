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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'coach';
  time: string;
};

type ConfirmedBooking = {
  id: string;
  date: string;
  time: string;
  user_message: string | null;
} | null;

const COACH = {
  name: 'María González',
  specialty: 'Psicóloga',
  isOnline: true,
  initials: 'MG',
  rating: 4.9,
  reviewCount: 134,
  priceFrom: 5500,
};

function calcVideoWindow(booking: ConfirmedBooking): boolean {
  if (!booking) return false;
  const [year, month, day] = booking.date.split('-').map(Number);
  const [h, m] = booking.time.split(':').map(Number);
  const sessionMs = new Date(year, month - 1, day, h, m, 0).getTime();
  return Date.now() >= sessionMs - 5 * 60 * 1000;
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
  return {
    id: row.id as string,
    text: row.content as string,
    sender: (row.sender_id as string) === userId ? 'user' : 'coach',
    time: new Date(row.created_at as string).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export default function SalaScreen() {
  const router = useRouter();
  // sala_id: preferred — skip find-or-create entirely.
  // coach_id: fallback for first contact from a coach profile (user side only).
  const { sala_id: salaIdParam, coach_id } = useLocalSearchParams<{ sala_id?: string; coach_id?: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [salaId, setSalaId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking>(null);
  const [isInVideoWindow, setIsInVideoWindow] = useState(false);
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

  // Resolve sala: use sala_id param directly, or find-or-create via coach_id (user→coach first contact)
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
        // Fast path: sala already known — just load its user_id/coach_id for recipient resolution
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
        // Fallback: first contact from coach profile page — current user is always the patient
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
          if (error) console.error('[Sala] Error creando sala:', error.message);
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

      setSalaId(id);
      setRoomUrl(salaRoomUrl);
      setRecipientId(user!.id === salaUserId ? salaCoachId : salaUserId);

      // Fetch closest upcoming confirmed booking for this sala
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data: bkRows } = await supabase
        .from('bookings')
        .select('id, date, time, user_message')
        .eq('sala_id', id)
        .eq('status', 'confirmed')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1);
      if (mounted) setConfirmedBooking(bkRows?.[0] ?? null);

      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .eq('sala_id', id)
        .order('created_at', { ascending: true });

      if (!mounted) return;
      if (msgsError) console.error('[Sala] Error cargando mensajes:', msgsError.message);

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

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!salaId || !user) return;

    const channel = supabase
      .channel(`sala:${salaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sala_id=eq.${salaId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Skip own messages — already shown optimistically
          if ((row.sender_id as string) === user.id) return;

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

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !salaId || !user) return;

    const encrypted = encryptMessage(text);
    const optimisticId = `opt_${Date.now()}`;
    const optimistic: Message = { id: optimisticId, text: encrypted, sender: 'user', time: nowTime() };

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
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', recipientId)
        .maybeSingle();

      if (recipientProfile?.push_token) {
        await sendPushNotification(
          recipientProfile.push_token,
          'Nuevo mensaje',
          text.slice(0, 50),
        );
      }
    }
  }

  const canSend = inputText.trim().length > 0 && !!salaId && !!user;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_sala"
        icon="message-outline"
        iconColor={ViveColors.calm}
        title="La Sala"
        description="Tu espacio de comunicación con el coach. Escribí mensajes, compartí cómo te sentís e iniciá videollamadas."
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
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.coachInfo}
          activeOpacity={0.7}
          onPress={() => router.push({
            pathname: '/profesional',
            params: {
              name: COACH.name,
              specialty: COACH.specialty,
              rating: String(COACH.rating),
              reviewCount: String(COACH.reviewCount),
              priceFrom: String(COACH.priceFrom),
            },
          })}
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{COACH.initials}</Text>
            </View>
            {COACH.isOnline && <View style={styles.onlineDot} />}
          </View>
          <View>
            <Text style={styles.coachName}>{COACH.name}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.coachSpecialty}>{COACH.specialty}</Text>
              {COACH.isOnline && <Text style={styles.statusOnline}> · En línea</Text>}
            </View>
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
            color={roomUrl && isInVideoWindow ? ViveColors.primary : `${ViveColors.text}44`}
          />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.headerDivider} />

      {/* Session Banner */}
      <View style={styles.bannerDefault}>
        {confirmedBooking ? (
          <>
            <Text style={styles.bannerText}>
              Próxima sesión:{' '}
              <Text style={styles.bannerBold}>
                {formatSalaDate(confirmedBooking.date)} · {confirmedBooking.time.slice(0, 5)} hs
              </Text>
            </Text>
            {!!confirmedBooking.user_message && (
              <Text style={styles.bannerNote}>"{confirmedBooking.user_message}"</Text>
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
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{COACH.initials}</Text>
                  </View>
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
            placeholderTextColor={`${ViveColors.text}66`}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="send" size={19} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4CAF7D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 20,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.55,
  },
  statusOnline: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#4CAF7D',
  },
  videoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${ViveColors.text}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBtnDisabled: {
    backgroundColor: `${ViveColors.text}0A`,
  },
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },
  bannerDefault: {
    backgroundColor: `${ViveColors.accent}28`,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 18,
  },
  bannerBold: {
    fontFamily: ViveFonts.semibold,
  },
  bannerNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}70`,
    marginTop: 3,
    fontStyle: 'italic',
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
    color: `${ViveColors.text}55`,
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
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#1F4A43',
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
    color: '#FFFFFF',
  },
  bubbleTextCoach: {
    color: ViveColors.text,
  },
  bubbleTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.65)',
  },
  bubbleTimeCoach: {
    color: `${ViveColors.text}55`,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}0D`,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    backgroundColor: ViveColors.background,
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
    backgroundColor: `${ViveColors.text}22`,
    shadowOpacity: 0,
    elevation: 0,
  },
});