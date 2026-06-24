import { useRef, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

import { ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';

// ─── Datos / placeholders ─────────────────────────────────────────────────────

const mockUser = { name: 'Andre' };

// TODO: fetchear de Supabase — analytics_events o tabla de progreso futura
const activeWeeks = 12;
const aboutYouText =
  'Vas por buen camino y tomando acciones que te hacen cada vez más efectivo. Los retos y la constancia construyen más balance en tu vida.';

// TODO: fetchear de tabla "phrases" o CMS futuro
const dailyPhrase = 'Todas las respuestas están en vos.';

// TODO: leer de saved_resources + Supabase
type Resource = { id: string; title: string; icon: string; route?: string };
const pinnedResources: Resource[] = [
  { id: '1', title: 'Respiración\n4-7-8', icon: 'weather-windy' },
  { id: '2', title: 'Diario de\ngratitud', icon: 'notebook-outline', route: '/gratitud' },
];

// TODO: fetchear próxima reserva de bookings + salas de Supabase
const mockSession = {
  name: 'María González',
  specialty: 'Psicóloga',
  date: 'Lunes 16 de junio',
  time: '11:00 hs',
  // TODO: pasar sala_id real desde bookings → salas
  salaId: null as string | null,
};

// TODO: fetchear de tabla de contenidos o CMS futuro
const mockRecommendation = {
  title: 'Cómo manejar la ansiedad social',
  type: 'Artículo · 5 min',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '¡Buen día';
  if (h < 19) return '¡Buenas tardes';
  return '¡Buenas noches';
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

// ─── GlassCard ────────────────────────────────────────────────────────────────

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={38} tint="light" style={[s.glass, style]}>
        {children}
      </BlurView>
    );
  }
  // Android: blur no soportado — simular con rgba
  return (
    <View style={[s.glass, s.glassAndroid, style]}>
      {children}
    </View>
  );
}

// ─── Pantalla ──────────────────────────────────────────────────────────────────

export default function InicioScreen() {
  const router = useRouter();
  const [progressTab, setProgressTab] = useState<'hoy' | 'mes'>('hoy');

  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const a4 = useRef(new Animated.Value(0)).current;
  const a5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [a0, a1, a2, a3, a4, a5].map(a =>
      Animated.timing(a, { toValue: 1, duration: 380, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#FBC79A', '#F2A8B6', '#CBC9EA']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

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

          {/* ── 1. Top bar ── */}
          <Animated.View style={[s.topBar, fadeUp(a0)]}>
            <Text style={s.logo}>VITA</Text>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{mockUser.name[0]}</Text>
            </View>
          </Animated.View>

          {/* ── 2. Saludo ── */}
          <Animated.View style={[s.greetingBlock, fadeUp(a0)]}>
            <Text style={s.greetingMain}>{getGreeting()}, {mockUser.name}!</Text>
            <Text style={s.greetingSub}>¿cómo estás hoy?</Text>
          </Animated.View>

          {/* ── 3. Tu progreso + toggle ── */}
          <Animated.View style={[s.progressRow, fadeUp(a1)]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Tu progreso</Text>
              <MaterialCommunityIcons name="information-outline" size={14} color="rgba(255,255,255,0.7)" />
            </View>
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, progressTab === 'hoy' && s.toggleBtnActive]}
                onPress={() => setProgressTab('hoy')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleText, progressTab === 'hoy' && s.toggleTextActive]}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, progressTab === 'mes' && s.toggleBtnActive]}
                onPress={() => setProgressTab('mes')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleText, progressTab === 'mes' && s.toggleTextActive]}>Mes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── 4. Tarjeta progreso ── */}
          <Animated.View style={fadeUp(a1)}>
            <GlassCard style={s.cardProgress}>
              <View style={s.progressLeft}>
                <Text style={s.weeksNumber}>{activeWeeks}</Text>
                <Text style={s.weeksLabel}>Semanas</Text>
              </View>
              <View style={s.progressRight}>
                <View style={s.progressRightHeader}>
                  <Text style={s.progressRightTitle}>Sobre ti</Text>
                  <MaterialCommunityIcons name="information-outline" size={15} color="rgba(255,255,255,0.6)" />
                </View>
                <Text style={s.progressRightText} numberOfLines={5}>{aboutYouText}</Text>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── 5. Frase del día ── */}
          <Animated.View style={fadeUp(a2)}>
            <GlassCard style={s.cardPhrase}>
              <View style={s.phraseInner}>
                <Text style={s.phraseLabel}>Frase del día</Text>
                <Text style={s.phraseText}>{dailyPhrase}</Text>
              </View>
              <MaterialCommunityIcons name="shimmer" size={26} color="rgba(255,255,255,0.75)" style={s.sparkle} />
            </GlassCard>
          </Animated.View>

          {/* ── 6. Recursos útiles ── */}
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
                    <MaterialCommunityIcons name={r.icon as any} size={24} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={s.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  <View style={s.resourcePlusCircle}>
                    <MaterialCommunityIcons name="plus" size={14} color="rgba(255,255,255,0.8)" />
                  </View>
                </ScaleCard>
              ))}
              {/* Tarjeta vacía para añadir */}
              <View style={[s.resourceCard, s.resourceCardEmpty]}>
                <MaterialCommunityIcons name="plus" size={22} color="rgba(255,255,255,0.45)" />
              </View>
            </ScrollView>
          </Animated.View>

          {/* ── 7. Tu próxima sesión ── */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={s.sectionTitle}>Tu próxima sesión</Text>
            <GlassCard style={s.cardSession}>
              <View style={s.sessionAvatar}>
                <Text style={s.sessionAvatarText}>{mockSession.name[0]}</Text>
              </View>
              <View style={s.sessionInfo}>
                <Text style={s.sessionName}>{mockSession.name}</Text>
                <Text style={s.sessionSub}>
                  {mockSession.specialty} · {mockSession.date}
                </Text>
                <Text style={s.sessionSub}>{mockSession.time}</Text>
              </View>
              <TouchableOpacity
                style={s.verSalaBtn}
                onPress={() => router.push(
                  mockSession.salaId
                    ? { pathname: '/sala', params: { sala_id: mockSession.salaId } }
                    : '/sala'
                )}
                activeOpacity={0.82}
              >
                <Text style={s.verSalaBtnText}>Ver sala</Text>
              </TouchableOpacity>
            </GlassCard>
          </Animated.View>

          {/* ── 8. Para vos hoy ── */}
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

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CARD_MX = 18;
const GLASS_BG = 'rgba(255,255,255,0.18)';
const GLASS_BORDER = 'rgba(255,255,255,0.35)';

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingBottom: 32 },

  // Glass base
  glass: {
    marginHorizontal: CARD_MX,
    marginBottom: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  glassAndroid: {
    backgroundColor: GLASS_BG,
  },

  // 1. Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // 2. Saludo
  greetingBlock: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
  },
  greetingMain: {
    fontFamily: ViveFonts.bold,
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 26,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 34,
    letterSpacing: -0.2,
  },

  // 3. Progreso row
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  toggleTextActive: {
    color: '#C0748A',
  },

  // 4. Tarjeta progreso
  cardProgress: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  progressLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  weeksNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 58,
    color: '#FFFFFF',
    lineHeight: 64,
    letterSpacing: -2,
  },
  weeksLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  progressRight: {
    flex: 1,
  },
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
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },

  // 5. Frase del día
  cardPhrase: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 18,
  },
  phraseInner: { flex: 1 },
  phraseLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  phraseText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 19,
    color: '#FFFFFF',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  sparkle: {
    marginLeft: 10,
    marginBottom: 2,
  },

  // 6. Recursos
  sectionTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 22,
    marginBottom: 10,
    marginTop: 4,
  },
  resourcesScroll: {
    paddingHorizontal: CARD_MX,
    gap: 12,
    paddingBottom: 4,
    marginBottom: 14,
  },
  resourceCard: {
    width: SCREEN_W * 0.38,
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  resourceCardEmpty: {
    justifyContent: 'center',
    opacity: 0.6,
  },
  resourceIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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
  resourcePlusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Próxima sesión
  cardSession: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sessionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionAvatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 19,
  },
  sessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 17,
  },
  verSalaBtn: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  verSalaBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#C0748A',
  },

  // 8. Para vos hoy
  cardRec: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  recBody: { flex: 1 },
  recLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#E8A070',
    letterSpacing: 0.8,
    marginBottom: 5,
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
  },
  recArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
