import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView as RNScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { decryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';

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
          lastMessage: lastMsg?.content ? decryptMessage(lastMsg.content) : 'Sin mensajes aún',
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
    <AppBg>
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
        <Text style={styles.headerTitle}>Mis salas</Text>
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
                onPress={() => router.push({ pathname: '/sala', params: { sala_id: sala.id } })}
                delay={index * 60}
              />
            ))}
          </Animated.View>
        </RNScrollView>
      ) : (
        <Animated.View style={[styles.emptyState, { opacity: listAnim }]}>
          <MaterialCommunityIcons name="message-outline" size={52} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>Todavía no armaste tu sala</Text>
          <Text style={styles.emptySubtitle}>
            Dale, animate a buscar la persona que te acompañe y arrancamos.{'\n'}
            Acá vas a tener todo: chat, sesiones, seguimiento.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(tabs)/conexiones')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBtnText}>Empezar a buscar</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
    </AppBg>
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
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: TAB_BAR_CLEARANCE },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
  },
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
