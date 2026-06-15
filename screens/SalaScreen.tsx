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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'coach';
  time: string;
};

// 'locked' = >5 min before | 'soon' = ≤5 min before | 'live' = session time
type SessionState = 'locked' | 'soon' | 'live';

const COACH = {
  name: 'María González',
  specialty: 'Psicóloga',
  isOnline: true,
  initials: 'MG',
  rating: 4.9,
  reviewCount: 134,
  priceFrom: 5500,
};

const SESSION_LABEL = 'Lunes 16 de junio · 11:00 hs';
const MEET_LINK = 'https://meet.google.com/xxx-xxxx-xxx';

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: '¡Hola Andre! ¿Cómo te sentís hoy?', sender: 'coach', time: '10:45' },
  { id: '2', text: 'Bien, un poco cansado pero bien. Quería contarte lo que pasó esta semana.', sender: 'user', time: '10:47' },
  { id: '3', text: 'Contame, estoy acá para escucharte 🙂', sender: 'coach', time: '10:48' },
];

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function SalaScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [mockState, setMockState] = useState<SessionState>('locked');
  const scrollRef = useRef<ScrollView>(null);

  const messageAnims = useRef<Record<string, Animated.Value>>({});
  function getAnim(id: string, initialValue = 0): Animated.Value {
    if (!messageAnims.current[id]) {
      messageAnims.current[id] = new Animated.Value(initialValue);
    }
    return messageAnims.current[id];
  }

  INITIAL_MESSAGES.forEach((m) => getAnim(m.id, 0));

  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(inputAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    const msgAnimations = INITIAL_MESSAGES.map((m) =>
      Animated.timing(getAnim(m.id), { toValue: 1, duration: 350, useNativeDriver: true })
    );
    Animated.stagger(110, msgAnimations).start();
  }, []);

  function handleVideoPress() {
    if (mockState === 'locked') {
      Alert.alert(
        'Videollamada no disponible',
        'La videollamada se habilita 5 minutos antes de tu sesión.',
        [{ text: 'Entendido' }]
      );
    } else {
      console.log('Abrir Google Meet:', MEET_LINK);
    }
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text) return;

    const id = Date.now().toString();
    const msg: Message = { id, text, sender: 'user', time: nowTime() };

    getAnim(id, 0);
    setMessages((prev) => [...prev, msg]);
    setInputText('');

    Animated.timing(getAnim(id), { toValue: 1, duration: 280, useNativeDriver: true }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }

  const canSend = inputText.trim().length > 0;
  const videoEnabled = mockState !== 'locked';

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
          style={[styles.videoBtn, videoEnabled && styles.videoBtnEnabled]}
          activeOpacity={videoEnabled ? 0.7 : 1}
          onPress={handleVideoPress}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="video-outline"
            size={24}
            color={videoEnabled ? ViveColors.primary : `${ViveColors.text}44`}
          />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.headerDivider} />

      {/* Session Banner */}
      <View style={[styles.banner, mockState !== 'locked' ? styles.bannerActive : styles.bannerDefault]}>
        {mockState === 'locked' ? (
          <Text style={styles.bannerText}>
            Tu próxima sesión:{' '}
            <Text style={styles.bannerBold}>{SESSION_LABEL}</Text>
          </Text>
        ) : (
          <View style={styles.bannerRow}>
            <Text style={styles.bannerTextActive}>
              {mockState === 'soon'
                ? '¡Tu sesión empieza en 5 minutos! ¿Entramos?'
                : '¡Tu sesión está en curso ahora!'}
            </Text>
            <TouchableOpacity style={styles.joinBtn} onPress={handleVideoPress} activeOpacity={0.8}>
              <Text style={styles.joinBtnText}>Unirse</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Mock state selector */}
      <View style={styles.mockSelector}>
        <Text style={styles.mockLabel}>Test:</Text>
        {(['locked', 'soon', 'live'] as SessionState[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.mockChip, mockState === s && styles.mockChipActive]}
            onPress={() => setMockState(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.mockChipText, mockState === s && styles.mockChipTextActive]}>
              {s === 'locked' ? '> 5 min' : s === 'soon' ? '5 min' : 'Ahora'}
            </Text>
          </TouchableOpacity>
        ))}
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
                    {msg.text}
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

  // ── Header ──────────────────────────────────────────────
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
  videoBtnEnabled: {
    backgroundColor: `${ViveColors.primary}18`,
  },
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },

  // ── Session Banner ───────────────────────────────────────
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerDefault: {
    backgroundColor: `${ViveColors.accent}28`,
  },
  bannerActive: {
    backgroundColor: `${ViveColors.primary}15`,
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
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerTextActive: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    flex: 1,
    lineHeight: 18,
  },
  joinBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  joinBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // ── Mock State Selector ──────────────────────────────────
  mockSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: ViveColors.background,
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}0D`,
  },
  mockLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: `${ViveColors.text}55`,
    marginRight: 2,
  },
  mockChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: `${ViveColors.text}10`,
  },
  mockChipActive: {
    backgroundColor: ViveColors.text,
  },
  mockChipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: ViveColors.text,
  },
  mockChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Messages ─────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
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

  // ── Input ────────────────────────────────────────────────
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
