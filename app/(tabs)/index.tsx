import { useRef, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';

const dailyPhrase = 'Todas las respuestas están en vos.';

const pinnedResources = [
  { id: '1', title: 'Respiración\n4-7-8', icon: 'weather-windy', route: undefined as string | undefined },
  { id: '2', title: 'Diario de\ngratitud', icon: 'notebook-outline', route: '/gratitud' as string | undefined },
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

const GLASS = 'rgba(255,255,255,0.14)';
const GLASS_BORDER = 'rgba(255,255,255,0.28)';
const RESOURCE_ICON_COLOR = [ViveColors.primary, ViveColors.accent];
const RESOURCE_BUBBLE_BG  = ['rgba(232,116,59,0.18)', 'rgba(107,191,138,0.18)'];

const WEEKS_ON_STREAK = 12;

const SOBRE_TI_TEXT =
  'Vas por buen camino tomando acciones que te hacen cada vez más efectivo. Los retos y la constancia construyen más balance en tu vida.';

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
  const { user } = useAuth();
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [progressTab, setProgressTab] = useState<'hoy' | 'mes'>('hoy');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const a4 = useRef(new Animated.Value(0)).current;
  const a5 = useRef(new Animated.Value(0)).current;
  const a6 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(a1, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a2, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a3, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a4, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a5, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a6, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [a1, a2, a3, a4, a5, a6]);

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
      .channel(`notif-bell-${user.id}`)
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
      <StatusBar barStyle="light-content" />
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
                  color="#FFFFFF"
                />
                {unreadNotifCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/profile-own')}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF9A52', ViveColors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.avatarCircle}
                >
                  <Text style={s.avatarInitial}>{(displayName.charAt(0) || '?').toUpperCase()}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── 2. SALUDO ── */}
          <Animated.View style={[s.greetingBlock, fadeUp(a1)]}>
            <Text style={s.greetingLine1}>{getGreeting()}</Text>
            <Text style={s.greetingLine2}>¿cómo estás hoy?</Text>
          </Animated.View>

          {/* ── 3. TU PROGRESO + TOGGLE ── */}
          <Animated.View style={[s.progressRow, fadeUp(a2)]}>
            <Text style={s.progressLabel}>Tu progreso</Text>
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, progressTab === 'hoy' && s.toggleBtnActive]}
                onPress={() => setProgressTab('hoy')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleBtnText, progressTab === 'hoy' && s.toggleBtnTextActive]}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, progressTab === 'mes' && s.toggleBtnActive]}
                onPress={() => setProgressTab('mes')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleBtnText, progressTab === 'mes' && s.toggleBtnTextActive]}>Mes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── 4. SOBRE TI (tarjeta grande) ── */}
          <Animated.View style={fadeUp(a2)}>
            <TouchableOpacity
              style={s.sobreTiCard}
              onPress={() => router.push('/progreso')}
              activeOpacity={0.82}
            >
              <View style={s.sobreTiLeft}>
                <Text style={s.sobreTiNumber}>{WEEKS_ON_STREAK}</Text>
                <Text style={s.sobreTiUnit}>Semanas</Text>
              </View>
              <View style={s.sobreTiRight}>
                <View style={s.sobreTiTitleRow}>
                  <Text style={s.sobreTiTitle}>Sobre ti</Text>
                  <MaterialCommunityIcons name="information-outline" size={16} color="rgba(255,255,255,0.45)" />
                </View>
                <Text style={s.sobreTiText}>{SOBRE_TI_TEXT}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── 5. FRASE DEL DÍA ── */}
          <Animated.View style={fadeUp(a3)}>
            <View style={s.phraseCard}>
              <View style={s.phraseInner}>
                <Text style={s.phraseLabel}>Frase del día</Text>
                <Text style={s.phraseText}>{dailyPhrase}</Text>
              </View>
              <MaterialCommunityIcons name="shimmer" size={26} color="rgba(255,255,255,0.65)" style={s.phraseIcon} />
            </View>
          </Animated.View>

          {/* ── 6. RECURSOS ÚTILES ── */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={s.sectionTitle}>Recursos útiles</Text>
            <View style={s.resourcesRow}>
              {pinnedResources.map((r, i) => (
                <ScaleCard
                  key={r.id}
                  style={s.resourceCard}
                  onPress={r.route ? () => router.push(r.route as any) : undefined}
                >
                  <View style={[s.resourceIconCircle, { backgroundColor: RESOURCE_BUBBLE_BG[i] }]}>
                    <MaterialCommunityIcons name={r.icon as any} size={22} color={RESOURCE_ICON_COLOR[i]} />
                  </View>
                  <Text style={s.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  <View style={s.resourcePlusBtn}>
                    <MaterialCommunityIcons name="plus" size={14} color="rgba(255,255,255,0.6)" />
                  </View>
                </ScaleCard>
              ))}
            </View>
          </Animated.View>

          {/* ── 7. TU PRÓXIMA SESIÓN ── */}
          <Animated.View style={fadeUp(a5)}>
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
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.30)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── 8. PARA VOS HOY ── */}
          <Animated.View style={fadeUp(a6)}>
            <Text style={[s.sectionTitle, { marginTop: 22 }]}>Para vos hoy</Text>
            <View style={s.recCard}>
              <View style={s.recInfo}>
                <Text style={s.recLabel}>RECOMENDACIÓN</Text>
                <Text style={s.recTitle}>{mockRecommendation.title}</Text>
                <Text style={s.recType}>{mockRecommendation.type}</Text>
              </View>
              <View style={s.recArrowBtn}>
                <MaterialCommunityIcons name="arrow-right" size={18} color="rgba(255,255,255,0.75)" />
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    lineHeight: 38,
  },
  greetingLine2: {
    fontFamily: ViveFonts.regular,
    fontSize: 28,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 36,
  },

  // ── 3. Progreso + toggle ───────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 17,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  toggleBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  toggleBtnTextActive: {
    color: '#1A0A26',
  },

  // ── 4. Sobre ti ────────────────────────────────────────────────────────────
  sobreTiCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: GLASS,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    minHeight: 130,
  },
  sobreTiLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    flexShrink: 0,
  },
  sobreTiNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 56,
    color: '#FFFFFF',
    lineHeight: 60,
  },
  sobreTiUnit: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  sobreTiRight: {
    flex: 1,
  },
  sobreTiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sobreTiTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sobreTiText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },

  // ── 5. Frase del día ───────────────────────────────────────────────────────
  phraseCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phraseInner: { flex: 1 },
  phraseLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phraseText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  phraseIcon: {
    flexShrink: 0,
  },

  // ── 6. Recursos útiles ─────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 17,
  },
  resourcePlusBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
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
    color: '#FFFFFF',
    lineHeight: 20,
  },
  sessionRole: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 17,
    marginTop: 1,
  },
  sessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 17,
    marginTop: 1,
  },
  verSalaButton: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 2,
  },
  noSessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
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
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 4,
  },
  recType: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  recArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
