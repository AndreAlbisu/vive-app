import { useRef, useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { GlassCard } from '@/components/ui/GlassCard';
import { VitaHeader } from '@/components/ui/VitaHeader';
import { ProgressToggle } from '@/components/ui/ProgressToggle';

// ─── Datos / placeholders ─────────────────────────────────────────────────────

const mockUser = { name: 'Andre' };

// TODO: calcular de analytics_events o tabla de progreso futura
const activeWeeks = 12;
const aboutYouText =
  'Vas por buen camino y tomando acciones que te hacen cada vez más efectivo. Los retos y la constancia construyen más balance en tu vida.';

// TODO: fetchear de tabla "phrases" o CMS futuro
const dailyPhrase = 'Todas las respuestas están en vos.';

// TODO: leer de saved_resources + Supabase
const pinnedResources = [
  { id: '1', title: 'Respiración\n4-7-8', icon: 'weather-windy' as const },
  { id: '2', title: 'Diario de\ngratitud', icon: 'notebook-outline' as const, route: '/gratitud' },
];

// TODO: fetchear próxima reserva de bookings + salas de Supabase
const mockSession = {
  name: 'María González',
  specialty: 'Psicóloga',
  date: 'Lunes 16 de junio',
  time: '11:00 hs',
  salaId: null as string | null, // TODO: pasar sala_id real desde bookings → salas
};

// TODO: fetchear de tabla de contenidos o CMS futuro
const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  type: 'Artículo · 5 min',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');
const CARD_MX = 18;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '¡Buen día';
  if (h < 19) return '¡Buenas tardes';
  return '¡Buenas noches';
}

const fadeUp = (a: Animated.Value) => ({
  opacity: a,
  transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function InicioScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'hoy' | 'mes'>('hoy');
  const anims = Array.from({ length: 7 }, () => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.stagger(70, anims.map(a =>
      Animated.timing(a, { toValue: 1, duration: 360, useNativeDriver: true }),
    )).start();
  }, []);

  const [a0, a1, a2, a3, a4, a5, a6] = anims;

  return (
    <View style={s.root}>
      <AppBg />

      <FirstTimeTooltip
        storageKey="vive_tooltip_inicio"
        icon="home-outline"
        title="Tu espacio de inicio"
        description="Acá encontrás tu próxima sesión, recursos guardados y la recomendación del día."
        delay={800}
      />

      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* 1. Header */}
          <Animated.View style={fadeUp(a0)}>
            <VitaHeader userName={mockUser.name} />
          </Animated.View>

          {/* 2. Saludo */}
          <Animated.View style={[s.greetingBlock, fadeUp(a0)]}>
            <Text style={s.greetingMain}>{getGreeting()}, {mockUser.name}!</Text>
            <Text style={s.greetingSub}>¿cómo estás hoy?</Text>
          </Animated.View>

          {/* 3. Tu progreso + toggle */}
          <Animated.View style={[s.progressRow, fadeUp(a1)]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Tu progreso</Text>
              <MaterialCommunityIcons name="information-outline" size={13} color="rgba(255,255,255,0.65)" />
            </View>
            <ProgressToggle value={tab} onChange={setTab} />
          </Animated.View>

          {/* 4. Tarjeta progreso → navega a Progreso */}
          <Animated.View style={[{ marginHorizontal: CARD_MX, marginBottom: 14 }, fadeUp(a1)]}>
            <ScaleCard onPress={() => router.push('/progreso')} style={s.cardPressable}>
              <GlassCard style={s.cardProgressInner}>
                <View style={s.progressLeft}>
                  <Text style={s.weeksNumber}>{activeWeeks}</Text>
                  <Text style={s.weeksLabel}>Semanas</Text>
                </View>
                <View style={s.progressRight}>
                  <View style={s.progressRightHeader}>
                    <Text style={s.progressRightTitle}>Sobre ti</Text>
                    <MaterialCommunityIcons name="information-outline" size={14} color="rgba(255,255,255,0.55)" />
                  </View>
                  <Text style={s.progressRightText} numberOfLines={5}>{aboutYouText}</Text>
                </View>
              </GlassCard>
            </ScaleCard>
          </Animated.View>

          {/* 5. Frase del día */}
          <Animated.View style={fadeUp(a2)}>
            <GlassCard style={s.cardPhrase}>
              <View style={s.phraseInner}>
                <Text style={s.phraseLabel}>Frase del día</Text>
                <Text style={s.phraseText}>{dailyPhrase}</Text>
              </View>
              <MaterialCommunityIcons name="shimmer" size={26} color="rgba(255,255,255,0.7)" style={s.sparkle} />
            </GlassCard>
          </Animated.View>

          {/* 6. Recursos útiles */}
          <Animated.View style={fadeUp(a3)}>
            <Text style={s.sectionTitle}>Recursos útiles</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.resourcesScroll}
            >
              {pinnedResources.map(r => (
                <ScaleCard
                  key={r.id}
                  style={s.resourceCard}
                  onPress={r.route ? () => router.push(r.route as any) : undefined}
                >
                  <View style={s.resourceIconCircle}>
                    <MaterialCommunityIcons name={r.icon} size={22} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={s.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  <View style={s.resourcePlusCircle}>
                    <MaterialCommunityIcons name="plus" size={13} color="rgba(255,255,255,0.75)" />
                  </View>
                </ScaleCard>
              ))}
              <View style={[s.resourceCard, s.resourceCardEmpty]}>
                <MaterialCommunityIcons name="plus" size={22} color="rgba(255,255,255,0.4)" />
              </View>
            </ScrollView>
          </Animated.View>

          {/* 7. Tu próxima sesión */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={s.sectionTitle}>Tu próxima sesión</Text>
            <GlassCard style={s.cardSession}>
              <View style={s.sessionAvatar}>
                <Text style={s.sessionAvatarText}>{mockSession.name[0]}</Text>
              </View>
              <View style={s.sessionInfo}>
                <Text style={s.sessionName}>{mockSession.name}</Text>
                <Text style={s.sessionSub}>{mockSession.specialty} · {mockSession.date}</Text>
                <Text style={s.sessionSub}>{mockSession.time}</Text>
              </View>
              <TouchableOpacity
                style={s.verSalaBtn}
                onPress={() => router.push(
                  mockSession.salaId
                    ? { pathname: '/sala', params: { sala_id: mockSession.salaId } }
                    : '/sala',
                )}
                activeOpacity={0.82}
              >
                <Text style={s.verSalaBtnText}>Ver sala</Text>
              </TouchableOpacity>
            </GlassCard>
          </Animated.View>

          {/* 8. Para vos hoy */}
          <Animated.View style={fadeUp(a5)}>
            <Text style={s.sectionTitle}>Para vos hoy</Text>
            <GlassCard style={s.cardRec}>
              <View style={s.recBody}>
                <Text style={s.recLabel}>RECOMENDACIÓN</Text>
                <Text style={s.recTitle}>{mockRecommendation.title}</Text>
                <Text style={s.recType}>{mockRecommendation.type}</Text>
              </View>
              <View style={s.recArrow}>
                <MaterialCommunityIcons name="arrow-right" size={18} color="rgba(255,255,255,0.9)" />
              </View>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 90 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingBottom: 8 },

  // 2. Saludo
  greetingBlock: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  greetingMain: {
    fontFamily: ViveFonts.bold,
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 24,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 32,
  },

  // 3. Progreso row
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
  },

  // 4. Tarjeta progreso
  cardPressable: { borderRadius: 22 },
  cardProgressInner: {
    flexDirection: 'row',
    padding: 20,
    gap: 14,
  },
  progressLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 68 },
  weeksNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 54,
    color: '#FFFFFF',
    lineHeight: 60,
    letterSpacing: -2,
  },
  weeksLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  progressRight: { flex: 1 },
  progressRightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressRightTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  progressRightText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },

  // 5. Frase
  cardPhrase: {
    marginHorizontal: CARD_MX,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 18,
  },
  phraseInner: { flex: 1 },
  phraseLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  phraseText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 25,
  },
  sparkle: { marginLeft: 10, marginBottom: 2 },

  // 6. Recursos
  sectionTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 22,
    marginBottom: 10,
    marginTop: 2,
  },
  resourcesScroll: {
    paddingHorizontal: CARD_MX,
    gap: 12,
    paddingBottom: 14,
  },
  resourceCard: {
    width: W * 0.36,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: 14,
    alignItems: 'center',
    gap: 8,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  resourceCardEmpty: { justifyContent: 'center', opacity: 0.55 },
  resourceIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
  },
  resourcePlusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Sesión
  cardSession: {
    marginHorizontal: CARD_MX,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  sessionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionAvatarText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#FFFFFF' },
  sessionInfo: { flex: 1 },
  sessionName: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#FFFFFF', lineHeight: 19 },
  sessionSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 16 },
  verSalaBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 13,
    flexShrink: 0,
  },
  verSalaBtnText: { fontFamily: ViveFonts.semibold, fontSize: 12, color: '#C07080' },

  // 8. Recomendación
  cardRec: {
    marginHorizontal: CARD_MX,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  recBody: { flex: 1 },
  recLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#E8A060',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  recTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 3 },
  recType: { fontFamily: ViveFonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  recArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
