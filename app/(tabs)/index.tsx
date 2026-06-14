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

import { AnimatedGradientCard } from '@/components/AnimatedGradientCard';
import { ViveColors, ViveFonts } from '@/constants/theme';

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

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.25)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

export default function InicioScreen() {
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
        <Animated.View style={[styles.dashboardWrapper, fadeUp(dashboardAnim)]}>
          <AnimatedGradientCard style={styles.dashboardCard}>
            {/* Izquierda — frase motivacional */}
            <View style={styles.phraseHalf}>
              <MaterialCommunityIcons name="format-quote-open" size={22} color="rgba(255,255,255,0.5)" style={styles.quoteIcon} />
              <Text style={[styles.phraseText, textShadow]}>{dailyPhrase}</Text>
            </View>

            <View style={styles.dashboardDivider} />

            {/* Derecha — recursos 2x2 */}
            <View style={styles.resourcesHalf}>
              <View style={styles.pinnedGrid}>
                {[pinnedResources.slice(0, 2), pinnedResources.slice(2, 4)].map((row, ri) => (
                  <View key={ri} style={styles.pinnedRow}>
                    {row.map((r) => (
                      <TouchableOpacity key={r.id} style={styles.pinnedSquare} activeOpacity={0.7}>
                        {r.pinned && r.icon ? (
                          <>
                            <MaterialCommunityIcons name={r.icon as any} size={20} color={ViveColors.primary} />
                            <Text style={styles.pinnedTitle} numberOfLines={2}>{r.title}</Text>
                          </>
                        ) : (
                          <Text style={styles.pinnedPlus}>+</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </AnimatedGradientCard>
        </Animated.View>

        {/* Tu próxima sesión */}
        <Animated.View style={fadeUp(sessionAnim)}>
          <Text style={styles.sectionTitle}>Tu próxima sesión</Text>
          <View style={styles.sessionWrapper}>
            <AnimatedGradientCard style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={[styles.sessionName, textShadow]}>
                  Sesión con {mockSession.name} — {mockSession.specialty}
                </Text>
                <Text style={[styles.sessionDateTime, textShadow]}>
                  {mockSession.date} · {mockSession.time}
                </Text>
              </View>
              <TouchableOpacity style={styles.verSalaButton}>
                <Text style={styles.verSalaButtonText}>Ver sala</Text>
              </TouchableOpacity>
            </AnimatedGradientCard>
          </View>
        </Animated.View>

        {/* Para vos hoy */}
        <Animated.View style={fadeUp(recommendationAnim)}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Para vos hoy</Text>
          <View style={styles.recommendationWrapper}>
            <TouchableOpacity activeOpacity={0.8} style={styles.recommendationTouchable}>
              <AnimatedGradientCard style={styles.recommendationCard}>
                <Text style={styles.recommendationEmoji}>{mockRecommendation.emoji}</Text>
                <View style={styles.recommendationInfo}>
                  <Text style={[styles.recommendationTitle, textShadow]}>{mockRecommendation.title}</Text>
                  <Text style={[styles.recommendationDesc, textShadow]}>{mockRecommendation.description}</Text>
                  <Text style={[styles.recommendationType, textShadow]}>{mockRecommendation.type}</Text>
                </View>
              </AnimatedGradientCard>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const wrapperShadow = Platform.select({
  ios: {
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  android: { elevation: 5 },
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
  dashboardWrapper: {
    borderRadius: 20,
    marginBottom: 28,
    ...wrapperShadow,
  },
  dashboardCard: {
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 180,
  },
  phraseHalf: {
    flex: 1,
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
    backgroundColor: 'rgba(255,255,255,0.20)',
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
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
    opacity: 0.3,
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
  sessionWrapper: {
    borderRadius: 16,
    ...wrapperShadow,
  },
  sessionCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 4,
  },
  sessionDateTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
  },
  verSalaButton: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.80)',
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Recommendation card
  recommendationWrapper: {
    borderRadius: 16,
    ...wrapperShadow,
  },
  recommendationTouchable: {
    borderRadius: 16,
  },
  recommendationCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 4,
  },
  recommendationDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 18,
    marginBottom: 6,
  },
  recommendationType: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
});
