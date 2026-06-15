import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView as RNScrollView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type SalaItem = {
  id: string;
  coach_id: string;
  otherName: string;
  otherInitials: string;
  lastMessage: string;
  lastMessageDate: string;
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function formatMessageDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function SessionsScreen() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const [salas, setSalas] = useState<SalaItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadSalas = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: salasData, error: salasError } = await supabase
      .from('salas')
      .select('id, user_id, coach_id')
      .or(`user_id.eq.${user.id},coach_id.eq.${user.id}`);

    if (salasError) console.error('[Sessions] Error cargando salas:', salasError.message);

    if (!salasData || salasData.length === 0) {
      setSalas([]);
      setLoading(false);
      return;
    }

    const otherIds = salasData.map(s => s.user_id === user.id ? s.coach_id : s.user_id);
    const uniqueOtherIds = [...new Set(otherIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', uniqueOtherIds);

    const profileMap: Record<string, string> = {};
    profiles?.forEach(p => { profileMap[p.id] = p.name ?? 'Usuario'; });

    const results: SalaItem[] = await Promise.all(
      salasData.map(async (sala) => {
        const otherId = sala.user_id === user.id ? sala.coach_id : sala.user_id;
        const otherName = profileMap[otherId] ?? 'Usuario';

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('sala_id', sala.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: sala.id,
          coach_id: sala.coach_id,
          otherName,
          otherInitials: getInitials(otherName),
          lastMessage: lastMsg?.content ?? 'Sin mensajes aún',
          lastMessageDate: lastMsg ? formatMessageDate(lastMsg.created_at) : '',
        };
      })
    );

    setSalas(results);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSalas();
  }, [loadSalas]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
        <Text style={styles.headerTitle}>Mis sesiones</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : salas.length > 0 ? (
        <RNScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: listAnim }}>
            {salas.map((sala, index) => (
              <SalaRow
                key={sala.id}
                sala={sala}
                onPress={() => router.push({ pathname: '/sala', params: { coach_id: sala.coach_id } })}
                delay={index * 60}
              />
            ))}
          </Animated.View>
        </RNScrollView>
      ) : (
        <Animated.View style={[styles.emptyState, { opacity: listAnim }]}>
          <MaterialCommunityIcons name="message-outline" size={52} color={`${ViveColors.text}30`} />
          <Text style={styles.emptyTitle}>Todavía no tenés conversaciones activas.</Text>
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

function SalaRow({
  sala,
  onPress,
  delay,
}: {
  sala: SalaItem;
  onPress: () => void;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 340, delay, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{sala.otherInitials}</Text>
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.sessionTopRow}>
            <Text style={styles.coachName} numberOfLines={1}>{sala.otherName}</Text>
            <Text style={styles.dateText}>{sala.lastMessageDate}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{sala.lastMessage}</Text>
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
  headerDivider: { height: 1, backgroundColor: `${ViveColors.text}0D` },

  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 32 },

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
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sessionInfo: { flex: 1, gap: 2 },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}99`,
    lineHeight: 18,
  },
  rowDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}08`,
    marginLeft: 84,
    marginRight: 20,
  },

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
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  emptyBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
