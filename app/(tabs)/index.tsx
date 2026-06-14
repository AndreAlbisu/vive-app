import { useRef, useEffect } from 'react';
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

const mockUser = { name: 'Andre' };
const dailyPhrase = 'Cada día es una nueva oportunidad de crecer.';

type Resource = { id: string; title: string | null; icon: string | null; pinned: boolean };

const pinnedResources: Resource[] = [
  { id: '1', title: 'Respiración\n4-7-8', icon: 'weather-windy', pinned: true },
  { id: '2', title: 'Diario de\ngratitud', icon: 'notebook-outline', pinned: true },
  { id: '3', title: null, icon: null, pinned: false },
  { id: '4', title: null, icon: null, pinned: false },
];

const mockSession = {
  name: 'María González',
  specialty: 'Psicóloga',
  date: 'Lunes 16 de junio',
  time: '11:00 hs',
};

const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  description: 'Una guía práctica para sentirte más cómodo en situaciones sociales del día a día.',
  type: 'Video · 7 min',
  emoji: '💙',
};

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function InicioScreen() {
  const router = useRouter();
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

        {/* Logo centrado */}
        <Animated.View style={[styles.logoRow, fadeUp(logoAnim)]}>
          <Text style={styles.logo}>v</Text>
          <MaterialCommunityIcons name="sprout" size={26} color={ViveColors.primary} style={styles.logoIcon} />
          <Text style={styles.logo}>ve</Text>
        </Animated.View>

        {/* Saludo */}
        <Animated.View style={[styles.greetingArea, fadeUp(greetingAnim)]}>
          <Text style={styles.greeting}>Hola, {mockUser.name} 👋</Text>
        </Animated.View>

        {/* Dashboard: frase + recursos */}
        <Animated.View style={[styles.dashboardCard, fadeUp(dashboardAnim)]}>
          {/* Izquierda — frase motivacional */}
          <View style={styles.phraseHalf}>
            <MaterialCommunityIcons name="format-quote-open" size={22} color="rgba(255,255,255,0.5)" style={styles.quoteIcon} />
            <Text style={styles.phraseText}>{dailyPhrase}</Text>
          </View>

          <View style={styles.dashboardDivider} />

          {/* Derecha — recursos 2x2 */}
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
          <View style={styles.sessionCard}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionName}>
                Sesión con {mockSession.name} — {mockSession.specialty}
              </Text>
              <Text style={styles.sessionDateTime}>
                {mockSession.date} · {mockSession.time}
              </Text>
            </View>
            <TouchableOpacity style={styles.verSalaButton} onPress={() => router.push('/sala')}>
              <Text style={styles.verSalaButtonText}>Ver sala</Text>
            </TouchableOpacity>
          </View>
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
