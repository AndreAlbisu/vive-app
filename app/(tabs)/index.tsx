import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ViveColors, ViveFonts } from '@/constants/theme';

const mockUser = { name: 'Andre' };

const dailyPhrase = 'Cada día es una nueva oportunidad de crecer.';

const pinnedResources = [
  { id: '1', title: 'Respiración 4-7-8', pinned: true },
  { id: '2', title: 'Diario de gratitud', pinned: true },
  { id: '3', title: null, pinned: false },
  { id: '4', title: null, pinned: false },
];

const mockSession = {
  name: 'María González',
  specialty: 'Psicóloga',
  date: 'Lunes 16 de junio',
  time: '11:00 hs',
};

const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  description:
    'Una guía práctica para sentirte más cómodo en situaciones sociales del día a día.',
  type: 'Video · 7 min',
  emoji: '💙',
};

export default function InicioScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hola, {mockUser.name} 👋</Text>
          <Text style={styles.dailyPhrase}>{dailyPhrase}</Text>
        </View>

        {/* Dashboard central */}
        <View style={styles.dashboardCard}>
          {/* Mitad izquierda — logo vive / Sofía */}
          <TouchableOpacity
            style={styles.dashboardLeft}
            onPress={() => console.log('abrir Sofía')}
            activeOpacity={0.75}>
            <Text style={styles.viveLogo}>vive</Text>
          </TouchableOpacity>

          <View style={styles.dashboardDivider} />

          {/* Mitad derecha — recursos pineados 2x2 */}
          <View style={styles.dashboardRight}>
            <View style={styles.pinnedGrid}>
              <View style={styles.pinnedRow}>
                {pinnedResources.slice(0, 2).map((r) => (
                  <TouchableOpacity key={r.id} style={styles.pinnedSquare} activeOpacity={0.7}>
                    {r.pinned ? (
                      <Text style={styles.pinnedTitle} numberOfLines={2}>
                        {r.title}
                      </Text>
                    ) : (
                      <Text style={styles.pinnedPlus}>+</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.pinnedRow}>
                {pinnedResources.slice(2, 4).map((r) => (
                  <TouchableOpacity key={r.id} style={styles.pinnedSquare} activeOpacity={0.7}>
                    {r.pinned ? (
                      <Text style={styles.pinnedTitle} numberOfLines={2}>
                        {r.title}
                      </Text>
                    ) : (
                      <Text style={styles.pinnedPlus}>+</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Tu próxima sesión */}
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
          <TouchableOpacity style={styles.verSalaButton}>
            <Text style={styles.verSalaButtonText}>Ver sala</Text>
          </TouchableOpacity>
        </View>

        {/* Para vos hoy */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Para vos hoy</Text>
        <TouchableOpacity style={styles.recommendationCard} activeOpacity={0.8}>
          <Text style={styles.recommendationEmoji}>{mockRecommendation.emoji}</Text>
          <View style={styles.recommendationInfo}>
            <Text style={styles.recommendationTitle}>{mockRecommendation.title}</Text>
            <Text style={styles.recommendationDesc}>{mockRecommendation.description}</Text>
            <Text style={styles.recommendationType}>{mockRecommendation.type}</Text>
          </View>
        </TouchableOpacity>

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
    paddingTop: 24,
  },

  // Header
  header: {
    marginBottom: 28,
  },
  greeting: {
    fontFamily: ViveFonts.semibold,
    fontSize: 28,
    color: ViveColors.text,
    lineHeight: 36,
  },
  dailyPhrase: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    opacity: 0.6,
    marginTop: 6,
    lineHeight: 21,
  },

  // Dashboard card
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    marginBottom: 28,
    minHeight: 176,
    overflow: 'hidden',
    ...cardShadow,
  },
  dashboardLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viveLogo: {
    fontFamily: ViveFonts.bold,
    fontSize: 38,
    color: ViveColors.primary,
    letterSpacing: -0.5,
  },
  dashboardDivider: {
    width: 1,
    backgroundColor: `${ViveColors.text}10`,
    marginVertical: 18,
  },
  dashboardRight: {
    flex: 1,
    padding: 14,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${ViveColors.text}12`,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  pinnedTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  pinnedPlus: {
    fontFamily: ViveFonts.regular,
    fontSize: 22,
    color: ViveColors.text,
    opacity: 0.25,
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
