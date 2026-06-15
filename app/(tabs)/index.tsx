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

interface NextSession {
  id: string;
  coach_id: string;
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

  const logoAnim = useRef(new Animated.Value(0)).current;
  const greetingAnim = useRef(new Animated.Value(0)).current;
  const dashboardAnim = useRef(new Animated.Value(0)).current;
  const sessionAnim = useRef(new Animated.Value(0)).current;
  const recommendationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(logoAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(greetingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(dashboardAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(sessionAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(recommendationAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    console.log('[Home] Buscando próxima sesión. user_id:', user.id, 'hoy:', today);

    supabase
      .from('bookings')
      .select('id, coach_id, date, time')
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
        showsVerticalScrollIndicator={false}>

        {/* Logo centrado + avatar (izq) + sesiones (der) */}
        <Animated.View style={[styles.logoRow, fadeUp(logoAnim)]}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/profile-own')}
            hitSlop={8}
            activeOpacity={0.75}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.logoCenter}>
            <Text style={styles.logo}>v</Text>
            <MaterialCommunityIcons name="sprout" size={26} color={ViveColors.primary} style={styles.logoIcon} />
            <Text style={styles.logo}>ve</Text>
          </View>
          <TouchableOpacity
            style={styles.sessionsBtn}
            onPress={() => router.push('/sessions')}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="message-outline" size={24} color={ViveColors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Saludo */}
        <Animated.View style={[styles.greetingArea, fadeUp(greetingAnim)]}>
          <Text style={styles.greeting}>Hola, {displayName} 👋</Text>
        </Animated.View>

        {/* Dashboard: frase + recursos */}
        <Animated.View style={[styles.dashboardCard, fadeUp(dashboardAnim)]}>
          <View style={styles.phraseHalf}>
            <MaterialCommunityIcons name="format-quote-open" size={22} color="rgba(255,255,255,0.5)" style={styles.quoteIcon} />
            <Text style={styles.phraseText}>{dailyPhrase}</Text>
          </View>

          <View style={styles.dashboardDivider} />

          <View style={styles.resourcesHalf}>
            <View style={styles.pinnedGrid}>
              {[pinnedResources.slice(0, 2), pinnedResources.slice(2, 4)].map((row, ri) => (
                <View key={ri} style={styles.pinnedRow}>
                  {row.map((r) => (
                    <ScaleCard key={r.id} style={styles.pinnedSquare}>
                      {r.pinned && r.icon ? (
                        <>
                          <MaterialCommunityIcons name={r.icon as any} size={20} color={ViveColors.primary} />
                          <Text style={styles.pinnedTitle} numberOfLines={2}>{r.title}</Text>
                        </>
                      ) : (
                        <Text style={styles.pinnedPlus}>+</Text>
                      )}
                    </ScaleCard>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Tu próxima sesión */}
        <Animated.View style={fadeUp(sessionAnim)}>
          <Text style={styles.sectionTitle}>Tu próxima sesión</Text>
          {nextSession ? (
            <View style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>
                  Sesión con {nextSession.coachName}
                </Text>
                <Text style={styles.sessionDateTime}>
                  {formatSessionDate(nextSession.date)} · {nextSession.time} hs
                </Text>
              </View>
              <TouchableOpacity
                style={styles.verSalaButton}
                onPress={() => router.push({ pathname: '/sala', params: { coach_id: nextSession.coach_id } })}
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

        {/* Para vos hoy */}
        <Animated.View style={fadeUp(recommendationAnim)}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Para vos hoy</Text>
          <ScaleCard style={styles.recommendationCard}>
            <Text style={styles.recommendationEmoji}>{mockRecommendation.emoji}</Text>
            <View style={styles.recommendationInfo}>
              <Text style={styles.recommendationTitle}>{mockRecommendation.title}</Text>
              <Text style={styles.recommendationDesc}>{mockRecommendation.description}</Text>
              <Text style={styles.recommendationType}>{mockRecommendation.type}</Text>
            </View>
          </ScaleCard>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Logo top-centered
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  logoCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 30,
    color: ViveColors.primary,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  logoIcon: {
    marginTop: 2,
  },
  profileBtn: {
    position: 'absolute',
    left: 0,
    padding: 4,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${ViveColors.primary}22`,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 14,
    color: ViveColors.primary,
  },
  sessionsBtn: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },

  // Greeting
  greetingArea: {
    marginBottom: 24,
  },
  greeting: {
    fontFamily: ViveFonts.semibold,
    fontSize: 32,
    color: ViveColors.text,
    lineHeight: 40,
  },

  // Dashboard card
  dashboardCard: {
    borderRadius: 20,
    flexDirection: 'row',
    marginBottom: 28,
    minHeight: 180,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  phraseHalf: {
    flex: 1,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  quoteIcon: {
    alignSelf: 'flex-start',
  },
  phraseText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
    opacity: 0.95,
  },
  dashboardDivider: {
    width: 1,
    backgroundColor: 'rgba(31, 74, 67, 0.08)',
    marginVertical: 0,
  },
  resourcesHalf: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  pinnedGrid: {
    gap: 8,
  },
  pinnedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinnedSquare: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: ViveColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ViveColors.text}10`,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#1F4A43',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  pinnedTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 9,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 13,
  },
  pinnedPlus: {
    fontFamily: ViveFonts.regular,
    fontSize: 22,
    color: ViveColors.text,
    opacity: 0.2,
  },

  // Section title
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },

  // Session card
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardShadow,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  sessionDateTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.55,
  },
  verSalaButton: {
    backgroundColor: ViveColors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // No session card
  noSessionCard: {
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

  // Recommendation card
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...cardShadow,
  },
  recommendationEmoji: {
    fontSize: 30,
    marginRight: 14,
    marginTop: 2,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  recommendationDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.6,
    lineHeight: 18,
    marginBottom: 6,
  },
  recommendationType: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.primary,
  },
});
