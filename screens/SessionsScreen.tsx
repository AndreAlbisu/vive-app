import { useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView as RNScrollView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type Session = {
  id: string;
  coachName: string;
  specialty: string;
  lastMessage: string;
  lastMessageDate: string;
  status: 'Confirmada' | 'Pendiente';
  initials: string;
};

const MOCK_SESSIONS: Session[] = [
  {
    id: '1',
    coachName: 'María González',
    specialty: 'Psicóloga',
    lastMessage: '¡Hola Andre! ¿Cómo te sentís hoy?',
    lastMessageDate: 'Hoy',
    status: 'Confirmada',
    initials: 'MG',
  },
  {
    id: '2',
    coachName: 'Carlos Méndez',
    specialty: 'Coach de vida',
    lastMessage: 'Nos vemos el lunes, cualquier cosa me escribís.',
    lastMessageDate: 'Ayer',
    status: 'Pendiente',
    initials: 'CM',
  },
  {
    id: '3',
    coachName: 'Laura Sánchez',
    specialty: 'Nutricionista',
    lastMessage: 'Recordá el plan de alimentación que acordamos.',
    lastMessageDate: 'Lun',
    status: 'Confirmada',
    initials: 'LS',
  },
];

const HAS_SESSIONS = MOCK_SESSIONS.length > 0;

export default function SessionsScreen() {
  const router = useRouter();
  const { isLoggedIn, requestAuth } = useAuth();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoggedIn) requestAuth();
  }, []);

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(listAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [
              { translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            ],
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis sesiones</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <View style={styles.headerDivider} />

      {HAS_SESSIONS ? (
        <RNScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: listAnim }}>
            {MOCK_SESSIONS.map((session, index) => (
              <SessionRow
                key={session.id}
                session={session}
                onPress={() => router.push('/sala')}
                delay={index * 60}
              />
            ))}
          </Animated.View>
        </RNScrollView>
      ) : (
        <Animated.View style={[styles.emptyState, { opacity: listAnim }]}>
          <MaterialCommunityIcons name="message-outline" size={52} color={`${ViveColors.text}30`} />
          <Text style={styles.emptyTitle}>Todavía no tenés sesiones activas.</Text>
          <Text style={styles.emptySubtitle}>¿Empezamos?</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(tabs)/conexiones')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBtnText}>Ver profesionales</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  onPress,
  delay,
}: {
  session: Session;
  onPress: () => void;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 340,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const isConfirmed = session.status === 'Confirmada';

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.75}>
        {/* Avatar circular */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{session.initials}</Text>
        </View>

        {/* Info */}
        <View style={styles.sessionInfo}>
          <View style={styles.sessionTopRow}>
            <Text style={styles.coachName} numberOfLines={1}>
              {session.coachName}
            </Text>
            <Text style={styles.dateText}>{session.lastMessageDate}</Text>
          </View>
          <Text style={styles.specialty} numberOfLines={1}>
            {session.specialty}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {session.lastMessage}
          </Text>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, isConfirmed ? styles.statusConfirmada : styles.statusPendiente]}>
          <Text style={[styles.statusText, isConfirmed ? styles.statusTextConfirmada : styles.statusTextPendiente]}>
            {session.status}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rowDivider} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
    marginRight: 30,
  },
  headerSpacer: {
    width: 30,
  },
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },

  // List
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },

  // Session row
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: ViveColors.background,
    gap: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}55`,
    flexShrink: 0,
  },
  specialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
    marginBottom: 3,
  },
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}99`,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
    flexShrink: 0,
    alignSelf: 'center',
  },
  statusConfirmada: {
    backgroundColor: `${ViveColors.accent}22`,
  },
  statusPendiente: {
    backgroundColor: `${ViveColors.primary}18`,
  },
  statusText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
  },
  statusTextConfirmada: {
    color: ViveColors.accent,
  },
  statusTextPendiente: {
    color: ViveColors.primary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}08`,
    marginLeft: 84,
    marginRight: 20,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: `${ViveColors.text}80`,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  emptyBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
