import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';

// ─── Paleta suave ────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: 'rgba(232,116,59,0.22)',  fg: ViveColors.primary },
  { bg: 'rgba(107,191,138,0.22)', fg: ViveColors.accent  },
  { bg: 'rgba(80,140,200,0.22)',  fg: ViveColors.calm    },
];

// ─── Datos ───────────────────────────────────────────────────────────────────
type MIcon = React.ComponentProps<typeof MaterialIcons>['name'];

const TOPICS: { id: string; icon: MIcon; label: string; searchTopics: string[] }[] = [
  { id: '1', icon: 'mood',           label: 'Estado de\nánimo',       searchTopics: ['Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría'] },
  { id: '2', icon: 'favorite',       label: 'Relaciones',              searchTopics: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: '3', icon: 'trending-up',    label: 'Desarrollo\npersonal',   searchTopics: ['Identidad', 'Motivación', 'Crecimiento', 'Propósito'] },
  { id: '4', icon: 'explore',        label: 'Propósito y\ndirección', searchTopics: ['Propósito', 'Identidad', 'Motivación', 'Momentos de cambio'] },
  { id: '5', icon: 'spa',            label: 'Ansiedad y\nestrés',     searchTopics: ['Ansiedad', 'Estrés físico'] },
  { id: '6', icon: 'work',           label: 'Trabajo y\ncarrera',     searchTopics: ['Productividad', 'Concentración', 'Procrastinación', 'Vínculos laborales'] },
  { id: '7', icon: 'repeat',         label: 'Hábitos',                 searchTopics: ['Hábitos', 'Hábitos mentales'] },
  { id: '8', icon: 'restaurant',     label: 'Nutrición',               searchTopics: ['Nutrición'] },
  { id: '9', icon: 'fitness-center', label: 'Salud y\nbienestar',     searchTopics: ['Sueño', 'Energía', 'Actividad física', 'Estrés físico'] },
];

type CoachItem = {
  profileId: string;
  name: string;
  specialty: string;
  priceFrom: number;
  avatarUrl: string | null;
};

// ─── Constantes de diseño ─────────────────────────────────────────────────
const TOPIC_W   = 88;
const TOPIC_GAP = 10;
const TOPIC_PAGE = (TOPIC_W + TOPIC_GAP) * 3;
const TOPIC_DOTS = Math.ceil(TOPICS.length / 3);

const COACH_W   = 126;
const COACH_GAP = 12;
const COACH_PAGE = (COACH_W + COACH_GAP) * 2;

const VENN_C = 26;
const VENN_O = 8;

// ─── Subcomponentes ──────────────────────────────────────────────────────────
function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[dot.base, i === active && dot.active]} />
      ))}
    </View>
  );
}

function VennDiagram() {
  return (
    <View style={venn.wrap}>
      <View style={[venn.c, { backgroundColor: ViveColors.primary, top: 0,          left: VENN_O }]} />
      <View style={[venn.c, { backgroundColor: ViveColors.accent,  top: VENN_O + 2, left: 0       }]} />
      <View style={[venn.c, { backgroundColor: ViveColors.calm,    top: VENN_O + 2, left: VENN_O * 2 }]} />
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ConexionesScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);
  const [topicDot, setTopicDot] = useState(0);
  const [coachDot, setCoachDot] = useState(0);
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const coachDots = Math.max(1, Math.ceil(coaches.length / 2));

  useEffect(() => {
    supabase
      .from('coaches')
      .select('specialty, price_per_session, profiles!inner(id, name, avatar_url)')
      .eq('verified', true)
      .limit(5)
      .then(({ data, error }) => {
        if (error) { console.error('[Conexiones] coaches fetch:', error.message); }
        console.log('[Conexiones] coaches raw data:', JSON.stringify(data, null, 2));
        console.log('[Conexiones] coaches count:', data?.length ?? 0);
        const rows = (data ?? []).map((c: any) => {
          const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return {
            profileId: profile?.id as string,
            name: profile?.name as string,
            specialty: c.specialty as string,
            priceFrom: c.price_per_session as number,
            avatarUrl: (profile?.avatar_url ?? null) as string | null,
          };
        });
        setCoaches(rows);
        console.log('[Conexiones] rows mapeados:', JSON.stringify(rows, null, 2));
        console.log('[Conexiones] rows.length:', rows.length);
        setLoadingCoaches(false);
      });
  }, []);

  function goToPerfil(coach: CoachItem) {
    router.push({
      pathname: '/profesional',
      params: {
        profileId: coach.profileId,
        name: coach.name,
        specialty: coach.specialty,
        priceFrom: String(coach.priceFrom),
      },
    });
  }

  function toggleFav(profileId: string) {
    if (!user) { requestAuth(); return; }
    toggleFavorite(profileId);
  }

  function handleTopicScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    setTopicDot(Math.min(Math.round(x / TOPIC_PAGE), TOPIC_DOTS - 1));
  }

  function handleCoachScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    setCoachDot(Math.min(Math.round(x / COACH_PAGE), coachDots - 1));
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_conexiones"
        icon="account-group-outline"
        iconColor="#87835C"
        title="Encontrá a tu guía"
        description="Explorá coaches y profesionales según lo que estás viviendo. Filtrá por tema o buscá por nombre."
        delay={800}
      />
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.screenContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Conexiones</Text>
            <Text style={s.subtitle}>Las personas indicadas para lo que estás viviendo.</Text>
          </View>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => (user ? router.push('/favoritos') : requestAuth())}
            activeOpacity={0.7}>
            <MaterialIcons name="star-border" size={24} color="#565E32" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.bellBtn, s.bellBtnSpaced]} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={24} color="#565E32" />
          </TouchableOpacity>
        </View>

        {/* ── Buscador ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => router.push('/search1')}
          activeOpacity={0.85}>
          <MaterialIcons name="search" size={18} color="#87835C" />
          <Text style={s.searchPlaceholder}>Buscá por nombre, especialidad o tema...</Text>
          <MaterialIcons name="tune" size={18} color="#87835C" />
        </TouchableOpacity>

        {/* ── Temas ────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>¿Qué te gustaría trabajar hoy?</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={s.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.topicsRow}
            onScroll={handleTopicScroll}
            scrollEventThrottle={16}>
            {TOPICS.map((t, i) => {
              const pal = PALETTE[i % PALETTE.length];
              return (
                <ScaleCard
                  key={t.id}
                  style={s.topicCard}
                  onPress={() => router.push({
                    pathname: '/search3',
                    params: { topic: t.searchTopics.join(','), label: t.label.replace('\n', ' ') },
                  })}>
                  <View style={[s.topicCircle, { backgroundColor: pal.bg }]}>
                    <MaterialIcons name={t.icon} size={22} color={pal.fg} />
                  </View>
                  <Text style={s.topicLabel}>{t.label}</Text>
                </ScaleCard>
              );
            })}
          </ScrollView>

          <Dots count={TOPIC_DOTS} active={topicDot} />
        </View>

        {/* ── Destacados ───────────────────────────────────────────────── */}
        <View style={[s.section, { marginBottom: 8 }]}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Destacados de la semana</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={s.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.coachesRow}
            onScroll={handleCoachScroll}
            scrollEventThrottle={16}>
            {loadingCoaches ? (
              <ActivityIndicator
                size="small"
                color={ViveColors.primary}
                style={{ marginLeft: 20, marginTop: 20 }}
              />
            ) : coaches.map(coach => (
              <ScaleCard key={coach.profileId} style={s.coachCard} onPress={() => goToPerfil(coach)}>
                {/* Foto */}
                <View style={s.coachPhoto}>
                  {coach.avatarUrl ? (
                    <Image source={{ uri: coach.avatarUrl }} style={s.coachPhotoImage} />
                  ) : (
                    <MaterialIcons name="person" size={42} color="rgba(135,131,92,0.72)" />
                  )}
                  <TouchableOpacity
                    style={s.favBtn}
                    onPress={() => toggleFav(coach.profileId)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name={favoriteIds.has(coach.profileId) ? 'star' : 'star-border'}
                      size={20}
                      color={favoriteIds.has(coach.profileId) ? ViveColors.primary : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                </View>
                {/* Info */}
                <View style={s.coachInfo}>
                  <Text style={s.coachName} numberOfLines={1}>{coach.name}</Text>
                  <Text style={s.coachSpecialty} numberOfLines={1}>{coach.specialty}</Text>
                  <Text style={s.coachPrice}>Desde ${coach.priceFrom.toLocaleString('es-AR')}</Text>
                </View>
              </ScaleCard>
            ))}
          </ScrollView>

          <Dots count={coachDots} active={coachDot} />
        </View>

        {/* ── Tarjeta Sofía ────────────────────────────────────────────── */}
        <ScaleCard
          style={s.sofiaCard}
          onPress={() => console.log('matching guiado')}>
          <VennDiagram />
          <View style={s.sofiaText}>
            <Text style={s.sofiaQ}>¿No sabés qué necesitás?</Text>
            <Text style={s.sofiaA}>Te ayudo a encontrarlo.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={ViveColors.primary} />
        </ScaleCard>

        <View style={{ height: TAB_BAR_CLEARANCE }} />

      </ScrollView>
    </SafeAreaView>
    </AppBg>
  );
}

// ─── Sombra ──────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenContent: {
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    lineHeight: 32,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 19,
  },
  bellBtn: {
    marginTop: 4,
    padding: 2,
  },
  bellBtnSpaced: {
    marginLeft: 8,
  },

  // Buscador
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    marginHorizontal: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 6,
    gap: 8,
    ...shadow,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
  },

  // Secciones
  section: {
    marginBottom: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
    flex: 1,
  },
  seeAll: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
  },

  // Temas
  topicsRow: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  topicCard: {
    width: TOPIC_W,
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 6,
    marginRight: TOPIC_GAP,
    ...shadow,
  },
  topicCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  topicLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: '#565E32',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Coaches
  coachesRow: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  coachCard: {
    width: COACH_W,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    marginRight: COACH_GAP,
    ...shadow,
  },
  coachPhoto: {
    width: COACH_W,
    height: 82,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coachPhotoImage: {
    width: COACH_W,
    height: 82,
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(86,94,50,0.18)',
    borderRadius: 14,
    padding: 4,
  },
  coachInfo: {
    padding: 10,
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
    marginBottom: 2,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.primary,
    marginBottom: 5,
  },
  coachPrice: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#87835C',
    marginBottom: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#87835C',
  },

  // Sofía
  sofiaCard: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...shadow,
  },
  sofiaText: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  sofiaQ: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
    marginBottom: 2,
  },
  sofiaA: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
  },
});

// ─── Dots ─────────────────────────────────────────────────────────────────────
const dot = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  base: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(86,94,50,0.10)',
  },
  active: {
    width: 16,
    backgroundColor: '#565E32',
  },
});

// ─── Venn ─────────────────────────────────────────────────────────────────────
const venn = StyleSheet.create({
  wrap: {
    width: VENN_C + VENN_O * 2,
    height: VENN_C + VENN_O + 2,
    position: 'relative',
    flexShrink: 0,
  },
  c: {
    width: VENN_C,
    height: VENN_C,
    borderRadius: VENN_C / 2,
    opacity: 0.7,
    position: 'absolute',
  },
});
