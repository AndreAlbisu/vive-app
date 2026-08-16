import { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';

import { ViveColors, ViveFonts, ViveMoodColors, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { VITA_TOOL_MAP } from '@/constants/vitaTools';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { MoodCheckIn } from '@/components/MoodCheckIn';
import { CoachSuggestionCard } from '@/components/CoachSuggestionCard';
import { VitaWordmark } from '@/components/VitaWordmark';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import type { MoodEntry } from '@/hooks/useMoodHistory';
import { useProgressStats } from '@/hooks/useProgressStats';
import { computeMoodStreak, detectMoodDrop } from '@/lib/moodStats';
import { buildReflection, type Reflection } from '@/lib/weeklyReflection';
import { localDayKey, localDayKeyMinus } from '@/lib/dates';
import { useWeeklySignals } from '@/hooks/useWeeklySignals';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  return `${dayName} ${day} de ${MONTHS_ES[month - 1]}`;
}

function getGreeting(firstName: string | undefined): string {
  return firstName ? `¡Hola ${firstName}!` : '¡Hola!';
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const RESOURCE_ICON_COLOR = [ViveColors.primary, ViveColors.accent];
const RESOURCE_BUBBLE_BG  = ['rgba(232,116,59,0.18)', 'rgba(107,191,138,0.18)'];

type PinnedResource = { id: string; title: string; icon: string; route: string | undefined };

const PINNED_TYPE_ICON: Record<string, string> = {
  audio: 'volume-high',
  guia_pasos: 'format-list-numbered',
  lectura_breve: 'book-open-variant',
};

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
  const [displayResources, setDisplayResources] = useState<PinnedResource[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 37 días: los últimos 7 alimentan el sparkline + el titular ("reciente"),
  // los 30 anteriores son la base "histórica" contra la que se compara.
  const { entries: moodEntries } = useMoodHistory(user?.id, 37);
  // Fecha LOCAL, no UTC: con `toISOString()` el día saltaba a las 21:00, así
  // que después de esa hora `todayMoodEntry` buscaba la entrada de MAÑANA, no
  // la encontraba, y el check-in de hoy se veía como no hecho.
  const today = localDayKey();
  const todayMoodEntry = moodEntries.find(e => e.entry_date === today);
  const { semanasActivas, areasCount, sessionCount } = useProgressStats(user?.id);
  const weekly = useWeeklySignals(user?.id);

  const recentCutoff = localDayKeyMinus(6);
  const recentMoodEntries = moodEntries.filter(e => e.entry_date >= recentCutoff);
  const historicMoodEntries = moodEntries.filter(e => e.entry_date < recentCutoff);
  const moodStreak = computeMoodStreak(moodEntries);

  // `sharpDrop` se calcula acá y no adentro de la card porque son DOS tarjetas
  // que tienen que coordinarse: `CoachSuggestionCard` aparece arriba cuando el
  // ánimo cayó fuerte hoy, y la devolución de abajo tiene que bajar el tono en
  // vez de decir algo liviano dos centímetros más abajo.
  const sharpDrop = detectMoodDrop(moodEntries) !== null;

  const reflection = buildReflection({
    recentMoods: recentMoodEntries.map(e => e.mood_id),
    historicMoods: historicMoodEntries.map(e => e.mood_id),
    streak: moodStreak,
    resourcesThisWeek: weekly.resourcesThisWeek,
    sessionsThisWeek: weekly.sessionsThisWeek,
    writingThisWeek: weekly.writingThisWeek,
    sharpDrop,
    dayKey: today,
  });

  const a1   = useRef(new Animated.Value(0)).current;
  const aMood = useRef(new Animated.Value(0)).current;
  const a2   = useRef(new Animated.Value(0)).current;
  const a3   = useRef(new Animated.Value(0)).current;
  const a4   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(a1,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(aMood, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a2,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a3,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a4,    { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [a1, aMood, a2, a3, a4]);

  const fetchNotifCount = useCallback(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadNotifCount(count ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifCount();
    const channel = supabase
      .channel(`notif-bell-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, fetchNotifCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifCount]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  useFocusEffect(useCallback(() => { fetchNotifCount(); }, [fetchNotifCount]));

  // Recarga en cada foco de la tab — así un pin hecho en otra pantalla se ve al volver
  useFocusEffect(
    useCallback(() => {
      if (!user) { setDisplayResources([]); return; }
      let active = true;
      (async () => {
        const { data: pins } = await supabase
          .from('pinned_resources')
          .select('resource_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!active) return;
        if (!pins || pins.length === 0) { setDisplayResources([]); return; }

        const ids = pins.map(p => p.resource_id as string);
        // Los ids de tools de VITA son slugs; los de recursos de coaches, uuids
        const coachIds = ids.filter(id => !VITA_TOOL_MAP[id]);

        let coachById = new Map<string, any>();
        if (coachIds.length > 0) {
          const { data: rows } = await supabase
            .from('resources')
            .select('id, type, title')
            .in('id', coachIds)
            .is('retired_at', null);
          coachById = new Map((rows ?? []).map(r => [r.id as string, r]));
        }

        if (!active) return;

        // preservar el orden de pineado (más reciente primero); saltear los retirados/borrados
        const mapped = ids.map(id => {
          const tool = VITA_TOOL_MAP[id];
          if (tool) return { id, title: tool.label, icon: tool.mdicon, route: tool.route };
          const r = coachById.get(id);
          if (r) return {
            id: r.id as string,
            title: r.title as string,
            icon: PINNED_TYPE_ICON[r.type as string] ?? 'book-open-variant',
            route: `/recurso?id=${r.id}`,
          };
          return null;
        }).filter(Boolean) as PinnedResource[];

        setDisplayResources(mapped);
      })();
      return () => { active = false; };
    }, [user])
  );

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

        // bookings.coach_id → coaches.id (NO profiles.id — ver SCHEMA regla 2).
        // Join de dos pasos: coaches.id → coaches.profile_id → profiles.name.
        const { data: coachRow } = await supabase
          .from('coaches')
          .select('profile_id, specialty')
          .eq('id', booking.coach_id)
          .maybeSingle();

        const { data: profile } = coachRow?.profile_id
          ? await supabase.from('profiles').select('name').eq('id', coachRow.profile_id).maybeSingle()
          : { data: null };

        setNextSession({
          id: booking.id,
          // profiles.id (= salas.coach_id) para navegar a la sala, no coaches.id
          coach_id: coachRow?.profile_id ?? booking.coach_id,
          sala_id: booking.sala_id ?? null,
          date: booking.scheduled_date,
          time: booking.scheduled_time,
          coachName: profile?.name ?? 'Tu profesional',
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
          description="Acá encontrás tu próxima sesión, recursos guardados y la recomendación del día"
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. TOP BAR: logo + campana + avatar ── */}
          <Animated.View style={[s.topBar, fadeUp(a1)]}>
            <VitaWordmark />
            <View style={s.topRight}>
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                hitSlop={8}
                activeOpacity={0.8}
                style={s.bellBtn}
              >
                <MaterialCommunityIcons
                  name={unreadNotifCount > 0 ? 'bell' : 'bell-outline'}
                  size={22}
                  color="#3F512F"
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

          {/* ── 2. SALUDO ── */}
          <Animated.View style={[s.greetingBlock, fadeUp(a1)]}>
            <Text style={s.greetingLine1}>{getGreeting(user?.user_metadata?.name?.split(' ')[0])}</Text>
            <Text style={s.greetingLine2}>¿Cómo venís hoy?</Text>
          </Animated.View>

          {/* ── 3. MOOD CHECK-IN ── */}
          <Animated.View style={fadeUp(aMood)}>
            <MoodCheckIn
              userId={user?.id}
              todayEntry={todayMoodEntry}
              onRequestAuth={requestAuth}
            />
          </Animated.View>

          {/* ── 3b. Sugerencia de coach si el check-in de hoy bajó fuerte ── */}
          <Animated.View style={fadeUp(aMood)}>
            <CoachSuggestionCard userId={user?.id} entries={moodEntries} />
          </Animated.View>

          {/* ── 4. SOBRE VOS ── */}
          <Animated.View style={fadeUp(a2)}>
            <SobreVosCard
              moodStreak={moodStreak}
              reflection={reflection}
              sparklineEntries={recentMoodEntries}
              semanasActivas={semanasActivas}
              areasCount={areasCount}
              sessionCount={sessionCount}
              onPress={() => router.push('/progreso')}
            />
          </Animated.View>

          {/* ── 5. TU PRÓXIMA SESIÓN ── */}
          <Animated.View style={fadeUp(a3)}>
            <View style={s.sessionHeaderRow}>
              <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Tu próxima sesión</Text>
              <TouchableOpacity onPress={() => router.push('/agenda')} hitSlop={8} activeOpacity={0.7}>
                <Text style={s.verTodasLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {nextSession ? (
              <SurfaceCard variant="elevated" backgroundColor={GLASS} borderRadius={18} style={s.sessionCardWrap}>
                <View style={s.sessionCardInner}>
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
              </SurfaceCard>
            ) : (
              <TouchableOpacity
                style={s.noSessionCard}
                onPress={() => router.push('/(tabs)/conexiones')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-plus" size={22} color={ViveColors.primary} />
                <View style={s.noSessionInfo}>
                  <Text style={s.noSessionTitle}>Sin sesiones agendadas</Text>
                  <Text style={s.noSessionSub}>Reservá una sesión con tu profesional</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.45)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── 6. TUS RECURSOS PINNEADOS ── */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Tus recursos a mano</Text>
            {displayResources.length === 0 ? (
              <TouchableOpacity
                style={s.pinnedEmpty}
                onPress={() => router.push('/(tabs)/recursos')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="pin-outline" size={22} color={ViveColors.primary} />
                <View style={s.pinnedEmptyText}>
                  <Text style={s.pinnedEmptyTitle}>Fijá tus recursos favoritos acá</Text>
                  <Text style={s.pinnedEmptySub}>Entrá a un recurso y tocá el marcador para tenerlo a mano (hasta 4)</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.45)" />
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.resourcesRow}
              >
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
                  </ScaleCard>
                ))}
              </ScrollView>
            )}
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
    paddingBottom: 2,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellBtn: {
    width: 32,
    height: 32,
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
    paddingTop: 6,
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
  // ── 3. Sobre vos ───────────────────────────────────────────────────────────
  sobreVosCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 18,
  },
  sobreVosTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sobreVosEyebrow: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: 'rgba(135,131,92,0.72)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sobreVosStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAD3C6',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sobreVosStreakText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: '#8F4A2E',
  },
  sobreVosHeadline: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 17,
    lineHeight: 23,
    color: '#3F512F',
  },
  sobreVosHeadlineBold: {
    fontFamily: ViveFonts.frauncesSerif,
  },
  sobreVosStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  sobreVosStatCardWrap: {
    flex: 1,
  },
  sobreVosStatCard: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sobreVosStatValue: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 17,
    color: '#3F512F',
  },
  sobreVosStatLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 8.5,
    color: '#6B7A56',
    textAlign: 'center',
    lineHeight: 11,
    marginTop: 3,
  },
  sobreVosCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3F512F',
    borderRadius: 24,
    paddingVertical: 13,
  },
  sobreVosCtaText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: '#F3EEDF',
  },
  sparkTooltip: {
    position: 'absolute',
    backgroundColor: '#3F512F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sparkTooltipText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#F3EEDF',
  },

  // ── 4. Recursos útiles ─────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleFlush: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  verTodasLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },
  resourcesRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 22,
  },
  resourceCard: {
    width: 130,
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
  pinnedEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    marginBottom: 22,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pinnedEmptyText: { flex: 1, gap: 3 },
  pinnedEmptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
  pinnedEmptySub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 17,
  },

  // ── 7. Próxima sesión ──────────────────────────────────────────────────────
  sessionCardWrap: {
    marginHorizontal: 18,
    marginBottom: 0,
  },
  sessionCardInner: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

});

// ─── Sobre vos ──────────────────────────────────────────────────────────────

const SOBRE_VOS_MOOD_LABEL: Record<number, string> = {
  1: 'Bajón', 2: 'Cansado', 3: 'Normal', 4: 'Bien', 5: 'Brillando',
};
const SOBRE_VOS_DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function SobreVosCard({
  moodStreak,
  reflection,
  sparklineEntries,
  semanasActivas,
  areasCount,
  sessionCount,
  onPress,
}: {
  moodStreak: number;
  reflection: Reflection;
  sparklineEntries: MoodEntry[];
  semanasActivas: number;
  areasCount: number | null;
  sessionCount: number | null;
  onPress: () => void;
}) {
  const stats = [
    { value: semanasActivas,      label: 'Semanas\nactivas'      },
    { value: areasCount ?? '—',   label: 'Áreas\ntrabajadas'     },
    { value: sessionCount ?? '—', label: 'Sesiones\ncompletadas' },
  ];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={['#F7F2E7', '#EAE2D0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.47, y: 1 }}
        style={s.sobreVosCard}>
        <View style={s.sobreVosTopRow}>
          <Text style={s.sobreVosEyebrow}>Tu semana</Text>
          {moodStreak > 0 && (
            <View style={s.sobreVosStreakBadge}>
              <MaterialCommunityIcons name="leaf" size={12} color="#8F4A2E" />
              <Text style={s.sobreVosStreakText}>{moodStreak} {moodStreak === 1 ? 'día' : 'días'} de racha</Text>
            </View>
          )}
        </View>

        <Text style={s.sobreVosHeadline}>
          {reflection.before}
          {reflection.bold ? <Text style={s.sobreVosHeadlineBold}>{reflection.bold}</Text> : null}
          {reflection.after}
        </Text>

        <MoodSparkline entries={sparklineEntries} />

        <View style={s.sobreVosStatsRow}>
          {stats.map((st, i) => (
            <SurfaceCard
              key={i}
              variant="subtle"
              backgroundColor="rgba(255,255,255,0.55)"
              borderRadius={14}
              style={s.sobreVosStatCardWrap}
            >
              <View style={s.sobreVosStatCard}>
                <Text style={s.sobreVosStatValue}>{st.value}</Text>
                <Text style={s.sobreVosStatLabel}>{st.label}</Text>
              </View>
            </SurfaceCard>
          ))}
        </View>

        <View style={s.sobreVosCta}>
          <Text style={s.sobreVosCtaText}>Ver tu progreso completo</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color="#F3EEDF" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function MoodSparkline({ entries }: { entries: MoodEntry[] }) {
  const { width: screenW } = useWindowDimensions();
  const chartW = screenW - 18 * 2 - 18 * 2; // margen de la card + padding interno, en los dos lados
  const CHART_H = 66;
  const PAD = 10;
  const plotW = chartW - PAD * 2;
  const plotH = CHART_H - PAD * 2;

  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (entries.length === 0) {
    return null;
  }

  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const n = sorted.length;
  const pts = sorted.map((e, i) => ({
    x: n === 1 ? chartW / 2 : PAD + (i / (n - 1)) * plotW,
    y: PAD + (1 - (e.mood_id - 1) / 4) * plotH,
    moodId: e.mood_id,
    date: e.entry_date,
  }));

  const areaPath = n > 1
    ? `M${pts[0].x},${pts[0].y} ` +
      pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${pts[n - 1].x},${CHART_H - PAD} L${pts[0].x},${CHART_H - PAD} Z`
    : '';
  const linePath = `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`;

  function handlePress(p: (typeof pts)[number]) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const [y, m, d] = p.date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    setTooltip({ x: p.x, y: p.y, label: `${SOBRE_VOS_DAY_NAMES[dow]}: ${SOBRE_VOS_MOOD_LABEL[p.moodId]}` });
    hideTimer.current = setTimeout(() => setTooltip(null), 2200);
  }

  return (
    <View style={{ width: chartW, height: CHART_H, alignSelf: 'center', marginVertical: 12 }}>
      <Svg width={chartW} height={CHART_H}>
        <Defs>
          <SvgLinearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C06B4A" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#C06B4A" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        {!!areaPath && <Path d={areaPath} fill="url(#sparkArea)" />}
        {n > 1 && (
          <Path d={linePath} fill="none" stroke="#C06B4A" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.5}
            fill={ViveMoodColors[p.moodId]}
            stroke="#F7F2E7"
            strokeWidth={1.5}
            onPress={() => handlePress(p)}
          />
        ))}
      </Svg>
      {tooltip && (
        <View
          pointerEvents="none"
          style={[
            s.sparkTooltip,
            { left: Math.min(Math.max(tooltip.x - 34, 0), chartW - 68), top: Math.max(tooltip.y - 32, 0) },
          ]}>
          <Text style={s.sparkTooltipText}>{tooltip.label}</Text>
        </View>
      )}
    </View>
  );
}
