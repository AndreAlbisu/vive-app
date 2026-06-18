import { useRef, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const dailyPhrase = 'Cada día es una nueva oportunidad de crecer.';

type Resource = { id: string; title: string | null; icon: string | null; pinned: boolean };

const pinnedResources: Resource[] = [
  { id: '1', title: 'Respiración\n4-7-8', icon: 'weather-windy', pinned: true },
  { id: '2', title: 'Diario de\ngratitud', icon: 'notebook-outline', pinned: true },
  { id: '3', title: null, icon: null, pinned: false },
  { id: '4', title: null, icon: null, pinned: false },
];

const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  description: 'Una guía práctica para sentirte más cómodo en situaciones sociales del día a día.',
  type: 'Video · 7 min',
  emoji: '💙',
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function getFormattedDate(): string {
  const d = new Date();
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

const RESOURCE_ICON_COLOR = [ViveColors.primary, ViveColors.accent];
const RESOURCE_BUBBLE_BG  = ['rgba(232,116,59,0.13)', 'rgba(107,191,138,0.13)'];

interface NextSession {
  id: string;
  coach_id: string;
  sala_id: string | null;
  date: string;
  time: string;
  coachName: string;
}

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  const monthName = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][month - 1];
  return `${dayName} ${day} de ${monthName}`;
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function InicioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [nextSession, setNextSession] = useState<NextSession | null>(null);

  const headerAnim    = useRef(new Animated.Value(0)).current;
  const logoAnim      = useRef(new Animated.Value(0)).current;
  const quoteAnim     = useRef(new Animated.Value(0)).current;
  const resourcesAnim = useRef(new Animated.Value(0)).current;
  const sessionAnim   = useRef(new Animated.Value(0)).current;
  const recAnim       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(logoAnim,      { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(quoteAnim,     { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(resourcesAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(sessionAnim,   { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(recAnim,       { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    console.log('[Home] Buscando próxima sesión. user_id:', user.id, 'hoy:', today);

    supabase
      .from('bookings')
      .select('id, coach_id, sala_id, date, time')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: booking, error: bookingError }) => {
        console.log('[Home] Resultado booking:', booking, 'error:', bookingError?.message);
        if (!booking) { setNextSession(null); return; }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', booking.coach_id)
          .maybeSingle();

        console.log('[Home] Perfil coach:', profile, 'error:', profileError?.message);

        setNextSession({
          id: booking.id,
          coach_id: booking.coach_id,
          sala_id: booking.sala_id ?? null,
          date: booking.date,
          time: booking.time,
          coachName: profile?.name ?? 'Tu coach',
        });
      });
  }, [user]);

  const displayName = user?.user_metadata?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Hola';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_inicio"
        icon="home-outline"
        title="Tu espacio de inicio"
        description="Acá encontrás tu próxima sesión, recursos guardados y la recomendación del día."
        delay={800}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Logo ── */}
        <Animated.View style={[styles.logoBar, fadeUp(logoAnim)]}>
          <Text style={styles.logo}>vita</Text>
        </Animated.View>

        {/* ── 1. HEADER ── */}
        <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.push('/profile-own')}
              hitSlop={8}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={['#FF9A52', ViveColors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarCircle}
              >
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>Hola, {displayName} 👋</Text>
              <Text style={styles.date}>{getFormattedDate()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.searchBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/sessions')}
          >
            <MaterialCommunityIcons name="message-outline" size={20} color={ViveColors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── 2. QUOTE CARD ── */}
        <Animated.View style={fadeUp(quoteAnim)}>
          <LinearGradient
            colors={['#FF9A52', ViveColors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quoteCard}
          >
            <Text style={styles.quoteDecor}>{'"'}</Text>
            <Text style={styles.quoteText}>{dailyPhrase}</Text>
            <Text style={styles.quoteLabel}>Frase del día</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── 3. RECURSOS GUARDADOS ── */}
        <Animated.View style={fadeUp(resourcesAnim)}>
          <Text style={styles.sectionTitle}>Recursos guardados</Text>
          <View style={styles.resourcesGrid}>
            {pinnedResources.map((r, i) => {
              if (r.pinned && r.icon) {
                return (
                  <ScaleCard key={r.id} style={styles.resourceCard}>
                    <View style={[styles.resourceIconBubble, { backgroundColor: RESOURCE_BUBBLE_BG[i] }]}>
                      <MaterialCommunityIcons name={r.icon as any} size={22} color={RESOURCE_ICON_COLOR[i]} />
                    </View>
                    <Text style={styles.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  </ScaleCard>
                );
              }
              return (
                <View key={r.id} style={[styles.resourceCard, styles.resourceCardEmpty]}>
                  <Text style={styles.resourcePlus}>+</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── 4. PRÓXIMA SESIÓN ── */}
        <Animated.View style={fadeUp(sessionAnim)}>
          <Text style={styles.sectionTitle}>Tu próxima sesión</Text>
          {nextSession ? (
            <View style={styles.sessionCard}>
              <View style={styles.sessionAvatar}>
                <Text style={styles.sessionAvatarText}>{nextSession.coachName[0]}</Text>
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>Sesión con {nextSession.coachName}</Text>
                <Text style={styles.sessionSub}>
                  {formatSessionDate(nextSession.date)} · {nextSession.time} hs
                </Text>
              </View>
              <TouchableOpacity
                style={styles.verSalaButton}
                onPress={() => router.push({
                  pathname: '/sala',
                  params: nextSession.sala_id
                    ? { sala_id: nextSession.sala_id }
                    : { coach_id: nextSession.coach_id },
                })}
                activeOpacity={0.82}
              >
                <Text style={styles.verSalaButtonText}>Ver sala</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noSessionCard}
              onPress={() => router.push('/(tabs)/coaches')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-plus" size={22} color={ViveColors.primary} />
              <View style={styles.noSessionInfo}>
                <Text style={styles.noSessionTitle}>Sin sesiones agendadas</Text>
                <Text style={styles.noSessionSubtitle}>Reservá una sesión con tu coach</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={`${ViveColors.text}44`} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── 5. PARA VOS HOY ── */}
        <Animated.View style={fadeUp(recAnim)}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Para vos hoy</Text>
          <ScaleCard style={styles.recCard}>
            <Text style={styles.recEmoji}>{mockRecommendation.emoji}</Text>
            <View style={styles.recInfo}>
              <Text style={styles.recSuperLabel}>Recomendación</Text>
              <Text style={styles.recTitle}>{mockRecommendation.title}</Text>
              <Text style={styles.recDesc}>{mockRecommendation.description}</Text>
              <View style={styles.recPill}>
                <MaterialCommunityIcons name="play-circle-outline" size={12} color={ViveColors.primary} />
                <Text style={styles.recPillText}>{mockRecommendation.type}</Text>
              </View>
            </View>
          </ScaleCard>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  container: {
    paddingTop: 0,
    paddingBottom: 32,
  },

  // 1. Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  avatarInitial: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  greeting: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 20,
  },
  date: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.5,
    marginTop: 1,
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(31,74,67,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Logo bar
  logoBar: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 10,
  },
  logo: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 26,
    color: ViveColors.primary,
    letterSpacing: -0.5,
    lineHeight: 30,
  },

  // 2. Quote card
  quoteCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 18 },
      android: { elevation: 6 },
    }),
  },
  quoteDecor: {
    position: 'absolute',
    top: -12,
    right: 16,
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 100,
    color: 'rgba(255,255,255,0.18)',
    lineHeight: 110,
  },
  quoteText: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
    maxWidth: '82%',
  },
  quoteLabel: {
    marginTop: 14,
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // 3. Resources grid
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 20,
  },
  resourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  resourceCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    gap: 10,
    ...cardShadow,
  },
  resourceCardEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(31,74,67,0.18)',
    ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 } }),
  },
  resourceIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 17,
  },
  resourcePlus: {
    fontFamily: ViveFonts.regular,
    fontSize: 28,
    color: ViveColors.text,
    opacity: 0.22,
    lineHeight: 32,
  },

  // 4. Session card
  sessionCard: {
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 0,
    ...cardShadow,
  },
  sessionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ViveColors.calm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionAvatarText: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
  },
  sessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.52,
    lineHeight: 18,
    marginTop: 2,
  },
  verSalaButton: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // No session card
  noSessionCard: {
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...cardShadow,
  },
  noSessionInfo: {
    flex: 1,
  },
  noSessionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    marginBottom: 2,
  },
  noSessionSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}66`,
  },

  // 5. Recommendation card
  recCard: {
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    ...cardShadow,
  },
  recEmoji: {
    fontSize: 34,
    lineHeight: 40,
    marginTop: 2,
    flexShrink: 0,
  },
  recInfo: {
    flex: 1,
  },
  recSuperLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  recTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 15,
    fontWeight: '700',
    color: ViveColors.text,
    lineHeight: 22,
    marginBottom: 5,
  },
  recDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.55,
    lineHeight: 19,
    marginBottom: 10,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,116,59,0.11)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  recPillText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.primary,
  },
});