import { useRef, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { MoodCheckIn } from '@/components/MoodCheckIn';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { getSobreTiInsight } from '@/lib/moodInsights';
import Svg, { Circle } from 'react-native-svg';

const dailyPhrase = 'Todas las respuestas están en vos.';

type PinnedResource = { id: string; title: string; icon: string; route: string | undefined };

const RESOURCE_MAP: Record<string, PinnedResource> = {
  diario:      { id: 'diario',      title: 'Diario',             icon: 'notebook-outline',    route: '/diario'   },
  gratitud:    { id: 'gratitud',    title: 'Diario de\ngratitud', icon: 'heart-outline',       route: '/gratitud' },
  sueno:       { id: 'sueno',       title: 'Sueño',              icon: 'weather-night',        route: undefined   },
  respiracion: { id: 'respiracion', title: 'Respiración\n4-7-8', icon: 'weather-windy',        route: undefined   },
  meditacion:  { id: 'meditacion',  title: 'Meditación',         icon: 'leaf',                route: undefined   },
  escaner:     { id: 'escaner',     title: 'Escáner\ncorporal',  icon: 'human',               route: undefined   },
  relajacion:  { id: 'relajacion',  title: 'Relajación',         icon: 'music-note',          route: undefined   },
  ruido:       { id: 'ruido',       title: 'Ruido\nblanco',      icon: 'volume-high',         route: undefined   },
  lecturas:    { id: 'lecturas',    title: 'Lecturas\nbreves',   icon: 'book-open-variant',   route: undefined   },
};

const DEFAULT_RESOURCES: PinnedResource[] = [
  RESOURCE_MAP.respiracion,
  RESOURCE_MAP.gratitud,
];

const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  type: 'Artículo · 5 min',
};

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  return `${dayName} ${day} de ${MONTHS_ES[month - 1]}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '¡Buen día!';
  if (h < 20) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const RESOURCE_ICON_COLOR = [ViveColors.primary, ViveColors.accent];
const RESOURCE_BUBBLE_BG  = ['rgba(232,116,59,0.18)', 'rgba(107,191,138,0.18)'];

interface NextSession {
  id: string;
  coach_id: string;
  sala_id: string | null;
  date: string;
  time: string;
  coachName: string;
  coachSpecialty: string | null;
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
});

export default function InicioScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [displayResources, setDisplayResources] = useState<PinnedResource[]>(DEFAULT_RESOURCES);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { entries: moodEntries } = useMoodHistory(user?.id, 7);
  const today = new Date().toISOString().split('T')[0];
  const todayMoodEntry = moodEntries.find(e => e.entry_date === today);
  const sobreTiText = getSobreTiInsight(moodEntries);

  const a1   = useRef(new Animated.Value(0)).current;
  const aMood = useRef(new Animated.Value(0)).current;
  const a2   = useRef(new Animated.Value(0)).current;
  const a3   = useRef(new Animated.Value(0)).current;
  const a4   = useRef(new Animated.Value(0)).current;
  const a5   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(a1,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(aMood, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a2,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a3,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a4,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a5,    { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [a1, aMood, a2, a3, a4, a5]);

  useEffect(() => {
    if (!user) return;

    const fetchCount = () => {
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false)
        .then(({ count }) => setUnreadNotifCount(count ?? 0));
    };

    fetchCount();

    const channel = supabase
      .channel(`notif-bell-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        fetchCount,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const mapped = data
          .map(r => RESOURCE_MAP[r.resource_id as string])
          .filter(Boolean) as PinnedResource[];
        if (mapped.length > 0) setDisplayResources(mapped);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    supabase
      .from('bookings')
      .select('id, coach_id, sala_id, scheduled_date, scheduled_time')
      .eq('user_id', user.id)
      .eq('status', 'confirmada')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: booking }) => {
        if (!booking) { setNextSession(null); return; }

        const [{ data: profile }, { data: coachRow }] = await Promise.all([
          supabase.from('profiles').select('name').eq('id', booking.coach_id).maybeSingle(),
          supabase.from('coaches').select('specialty').eq('profile_id', booking.coach_id).maybeSingle(),
        ]);

        setNextSession({
          id: booking.id,
          coach_id: booking.coach_id,
          sala_id: booking.sala_id ?? null,
          date: booking.scheduled_date,
          time: booking.scheduled_time,
          coachName: profile?.name ?? 'Tu coach',
          coachSpecialty: coachRow?.specialty ?? null,
        });
      });
  }, [user]);

  const displayName = user?.user_metadata?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_inicio"
          icon="home-outline"
          title="Tu espacio de inicio"
          description="Acá encontrás tu próxima sesión, recursos guardados y la recomendación del día."
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. TOP BAR: logo + campana + avatar ── */}
          <Animated.View style={[s.topBar, fadeUp(a1)]}>
            <Text style={s.logo}>vita</Text>
            <View style={s.topRight}>
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                hitSlop={8}
                activeOpacity={0.8}
                style={s.bellBtn}
              >
                <MaterialCommunityIcons
                  name={unreadNotifCount > 0 ? 'bell' : 'bell-outline'}
                  size={24}
                  color="#565E32"
                />
                {unreadNotifCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/profile-own')}
                hitSlop={8}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarCircle} />
                ) : (
                  <LinearGradient
                    colors={['#FF9A52', ViveColors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.avatarCircle}
                  >
                    <Text style={s.avatarInitial}>{(displayName.charAt(0) || '?').toUpperCase()}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── 2. SALUDO + FRASE ── */}
          <Animated.View style={[s.greetingBlock, fadeUp(a1)]}>
            <Text style={s.greetingLine1}>{getGreeting()}</Text>
            <Text style={s.greetingLine2}>¿cómo estás hoy?</Text>
            <Text style={s.dailyPhrase}>{dailyPhrase}</Text>
          </Animated.View>

          {/* ── 3. MOOD CHECK-IN ── */}
          <Animated.View style={fadeUp(aMood)}>
            <MoodCheckIn
              userId={user?.id}
              todayEntry={todayMoodEntry}
              onRequestAuth={requestAuth}
            />
          </Animated.View>

          {/* ── 4. SOBRE TI ── */}
          <Animated.View style={fadeUp(a2)}>
            <TouchableOpacity
              style={s.sobreTiCard}
              onPress={() => router.push('/progreso')}
              activeOpacity={0.82}
            >
              <View style={s.sobreTiLeft}>
                <VennSvg />
              </View>
              <View style={s.sobreTiRight}>
                <Text style={s.sobreTiTitle}>Sobre ti</Text>
                <Text style={s.sobreTiText}>{sobreTiText}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── 5. TU PRÓXIMA SESIÓN ── */}
          <Animated.View style={fadeUp(a3)}>
            <Text style={s.sectionTitle}>Tu próxima sesión</Text>
            {nextSession ? (
              <View style={s.sessionCard}>
                <View style={s.sessionAvatar}>
                  <Text style={s.sessionAvatarText}>{nextSession.coachName[0]}</Text>
                </View>
                <View style={s.sessionInfo}>
                  <Text style={s.sessionName}>{nextSession.coachName}</Text>
                  {nextSession.coachSpecialty ? (
                    <Text style={s.sessionRole}>{nextSession.coachSpecialty}</Text>
                  ) : null}
                  <Text style={s.sessionSub}>
                    {formatSessionDate(nextSession.date)} · {nextSession.time.slice(0, 5)} hs
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.verSalaButton}
                  onPress={() => router.push({
                    pathname: '/sala',
                    params: nextSession.sala_id
                      ? { sala_id: nextSession.sala_id }
                      : { coach_id: nextSession.coach_id },
                  })}
                  activeOpacity={0.82}
                >
                  <Text style={s.verSalaButtonText}>Ver sala</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.noSessionCard}
                onPress={() => router.push('/(tabs)/conexiones')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-plus" size={22} color={ViveColors.primary} />
                <View style={s.noSessionInfo}>
                  <Text style={s.noSessionTitle}>Sin sesiones agendadas</Text>
                  <Text style={s.noSessionSub}>Reservá una sesión con tu coach</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.45)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── 6. RECURSOS ÚTILES ── */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Recursos útiles</Text>
            <View style={s.resourcesRow}>
              {displayResources.map((r, i) => (
                <ScaleCard
                  key={r.id}
                  style={s.resourceCard}
                  onPress={r.route ? () => router.push(r.route as any) : undefined}
                >
                  <View style={[s.resourceIconCircle, { backgroundColor: RESOURCE_BUBBLE_BG[i % 2] }]}>
                    <MaterialCommunityIcons name={r.icon as any} size={22} color={RESOURCE_ICON_COLOR[i % 2]} />
                  </View>
                  <Text style={s.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  <TouchableOpacity
                    style={s.resourcePlusBtn}
                    onPress={() => router.push('/(tabs)/recursos')}
                    hitSlop={6}>
                    <MaterialCommunityIcons name="plus" size={14} color="#87835C" />
                  </TouchableOpacity>
                </ScaleCard>
              ))}
            </View>
          </Animated.View>

          {/* ── 7. PARA VOS HOY ── */}
          <Animated.View style={fadeUp(a5)}>
            <Text style={[s.sectionTitle, { marginTop: 22 }]}>Para vos hoy</Text>
            <View style={s.recCard}>
              <View style={s.recInfo}>
                <Text style={s.recLabel}>RECOMENDACIÓN</Text>
                <Text style={s.recTitle}>{mockRecommendation.title}</Text>
                <Text style={s.recType}>{mockRecommendation.type}</Text>
              </View>
              <View style={s.recArrowBtn}>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#87835C" />
              </View>
            </View>
          </Animated.View>

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  container: {},

  // ── 1. Top bar ─────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  logo: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 22,
    color: '#565E32',
    letterSpacing: 4,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── 2. Saludo ──────────────────────────────────────────────────────────────
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  greetingLine1: {
    fontFamily: ViveFonts.semibold,
    fontSize: 30,
    color: '#565E32',
    lineHeight: 38,
  },
  greetingLine2: {
    fontFamily: ViveFonts.regular,
    fontSize: 28,
    color: '#565E32',
    lineHeight: 36,
  },
  dailyPhrase: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: 'rgba(135,131,92,0.80)',
    marginTop: 8,
    lineHeight: 22,
  },

  // ── 3. Sobre ti ────────────────────────────────────────────────────────────
  sobreTiCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sobreTiLeft: {
    width: 80,
    flexShrink: 0,
    alignItems: 'center',
    gap: 6,
  },
  vitaIaLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#87835C',
  },
  sobreTiRight: {
    flex: 1,
  },
  sobreTiTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    color: 'rgba(135,131,92,0.72)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sobreTiText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 18,
  },

  // ── 4. Recursos útiles ─────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resourcesRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 22,
  },
  resourceCard: {
    flex: 1,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    minHeight: 110,
    justifyContent: 'center',
  },
  resourceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#565E32',
    textAlign: 'center',
    lineHeight: 17,
  },
  resourcePlusBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 7. Próxima sesión ──────────────────────────────────────────────────────
  sessionCard: {
    marginHorizontal: 18,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  sessionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionAvatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 20,
  },
  sessionRole: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 17,
    marginTop: 1,
  },
  sessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.72)',
    lineHeight: 17,
    marginTop: 1,
  },
  verSalaButton: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#565E32',
  },

  // No session
  noSessionCard: {
    marginHorizontal: 18,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noSessionInfo: { flex: 1 },
  noSessionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    marginBottom: 2,
  },
  noSessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
  },

  // ── 8. Para vos hoy ────────────────────────────────────────────────────────
  recCard: {
    marginHorizontal: 18,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recInfo: { flex: 1 },
  recLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: ViveColors.primary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  recTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 20,
    marginBottom: 4,
  },
  recType: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
  },
  recArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

function VennSvg() {
  return (
    <Svg width={72} height={64} viewBox="-2 -2 72 66">
      <Circle cx={21} cy={21} r={20} fill="none" stroke="rgba(86,94,50,0.55)" strokeWidth={1.5} />
      <Circle cx={47} cy={21} r={20} fill="none" stroke="rgba(86,94,50,0.55)" strokeWidth={1.5} />
      <Circle cx={34} cy={40} r={20} fill="none" stroke="rgba(86,94,50,0.55)" strokeWidth={1.5} />
    </Svg>
  );
}
