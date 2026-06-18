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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase } from '@/lib/supabase';

// ─── Paleta suave ────────────────────────────────────────────────────────────
const TERRACOTA_SOFT = '#FDF0E8';
const VERDE_SOFT     = '#E8F5EE';
const AZUL_SOFT      = '#E8EFF6';

const PALETTE = [
  { bg: TERRACOTA_SOFT, fg: ViveColors.primary },
  { bg: VERDE_SOFT,     fg: ViveColors.accent  },
  { bg: AZUL_SOFT,      fg: ViveColors.calm    },
];

// ─── Datos ───────────────────────────────────────────────────────────────────
type MIcon = React.ComponentProps<typeof MaterialIcons>['name'];

const TOPICS: { id: string; icon: MIcon; label: string }[] = [
  { id: '1', icon: 'mood',           label: 'Estado de\nánimo'       },
  { id: '2', icon: 'favorite',       label: 'Relaciones'              },
  { id: '3', icon: 'trending-up',    label: 'Desarrollo\npersonal'   },
  { id: '4', icon: 'explore',        label: 'Propósito y\ndirección' },
  { id: '5', icon: 'spa',            label: 'Ansiedad y\nestrés'     },
  { id: '6', icon: 'work',           label: 'Trabajo y\ncarrera'     },
  { id: '7', icon: 'repeat',         label: 'Hábitos'                 },
  { id: '8', icon: 'restaurant',     label: 'Nutrición'               },
  { id: '9', icon: 'fitness-center', label: 'Salud y\nbienestar'     },
];

type CoachItem = {
  profileId: string;
  name: string;
  specialty: string;
  priceFrom: number;
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
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [topicDot, setTopicDot] = useState(0);
  const [coachDot, setCoachDot] = useState(0);
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const coachDots = Math.max(1, Math.ceil(coaches.length / 2));

  useEffect(() => {
    supabase
      .from('coaches')
      .select('specialty, price_per_session, profiles!inner(id, name)')
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
    setFavs(prev => {
      const next = new Set(prev);
      next.has(profileId) ? next.delete(profileId) : next.add(profileId);
      return next;
    });
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
    <SafeAreaView style={s.safe} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_conexiones"
        icon="account-group-outline"
        iconColor={ViveColors.accent}
        title="Encontrá a tu guía"
        description="Explorá coaches y profesionales según lo que estás viviendo. Filtrá por tema o buscá por nombre."
        delay={800}
      />
      <View style={s.screen}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Conexiones</Text>
            <Text style={s.subtitle}>Las personas indicadas para lo que estás viviendo.</Text>
          </View>
          <TouchableOpacity style={s.bellBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={24} color={ViveColors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Buscador ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => router.push('/search1')}
          activeOpacity={0.85}>
          <MaterialIcons name="search" size={18} color={ViveColors.text} />
          <Text style={s.searchPlaceholder}>Buscá por nombre, especialidad o tema...</Text>
          <MaterialIcons name="tune" size={18} color={ViveColors.text} />
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
                    params: { topic: t.label.replace('\n', ' ') },
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
                {/* Foto placeholder */}
                <View style={s.coachPhoto}>
                  <MaterialIcons name="person" size={42} color="#C0BAB4" />
                  <TouchableOpacity
                    style={s.favBtn}
                    onPress={() => toggleFav(coach.profileId)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name={favs.has(coach.profileId) ? 'star' : 'star-border'}
                      size={20}
                      color={favs.has(coach.profileId) ? ViveColors.primary : '#FFFFFF'}
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

      </View>
    </SafeAreaView>
  );
}

// ─── Sombra ──────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: ViveColors.background,
    paddingTop: 16,
    paddingBottom: 100,
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
    color: ViveColors.text,
    lineHeight: 32,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}99`,
    lineHeight: 19,
  },
  bellBtn: {
    marginTop: 4,
    padding: 2,
  },

  // Buscador
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    color: `${ViveColors.text}66`,
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
    color: ViveColors.text,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
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
    color: ViveColors.text,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: COACH_GAP,
    ...shadow,
  },
  coachPhoto: {
    width: COACH_W,
    height: 82,
    backgroundColor: '#EDE7E0',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 14,
    padding: 4,
  },
  coachInfo: {
    padding: 10,
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.text,
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
    color: ViveColors.text,
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
    color: `${ViveColors.text}99`,
  },

  // Sofía
  sofiaCard: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    color: ViveColors.text,
    marginBottom: 2,
  },
  sofiaA: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}B3`,
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
    backgroundColor: `${ViveColors.text}33`,
  },
  active: {
    width: 16,
    backgroundColor: ViveColors.text,
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
