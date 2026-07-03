import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';

// ─── Paleta earth-tone ───────────────────────────────────────────────────────
const F   = '#3A4F2A';
const FS  = '#6B7A56';
const CR  = '#F3EEDF';
const TC  = '#C1694F';
const BG  = 'rgba(255,248,240,0.55)';
const BD  = 'rgba(255,255,255,0.65)';
const SG  = '#C99A3F';
const LN  = 'rgba(63,81,47,0.14)';

const shadow = Platform.select({
  ios: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

// ─── Chips de categoría ──────────────────────────────────────────────────────
type FeatherName = React.ComponentProps<typeof Feather>['name'];

type ChipItem = {
  id: string;
  icon: FeatherName;
  label: string;
  displayLabel: string;
  searchTopics: string[];
};

const CHIPS: ChipItem[] = [
  { id: '5', icon: 'wind',        label: 'Ansiedad',    displayLabel: 'ansiedad y estrés',    searchTopics: ['Ansiedad', 'Estrés físico'] },
  { id: '1', icon: 'smile',       label: 'Ánimo',       displayLabel: 'estado de ánimo',      searchTopics: ['Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría'] },
  { id: '2', icon: 'heart',       label: 'Relaciones',  displayLabel: 'relaciones',            searchTopics: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: '3', icon: 'trending-up', label: 'Crecimiento', displayLabel: 'crecimiento personal',  searchTopics: ['Identidad', 'Motivación', 'Crecimiento', 'Propósito'] },
  { id: '4', icon: 'compass',     label: 'Propósito',   displayLabel: 'propósito y dirección', searchTopics: ['Propósito', 'Identidad', 'Motivación', 'Momentos de cambio'] },
  { id: '6', icon: 'briefcase',   label: 'Trabajo',     displayLabel: 'trabajo y carrera',     searchTopics: ['Productividad', 'Concentración', 'Procrastinación', 'Vínculos laborales'] },
  { id: '7', icon: 'repeat',      label: 'Hábitos',     displayLabel: 'hábitos',               searchTopics: ['Hábitos', 'Hábitos mentales'] },
  { id: '8', icon: 'coffee',      label: 'Nutrición',   displayLabel: 'nutrición',             searchTopics: ['Nutrición'] },
  { id: '9', icon: 'activity',    label: 'Bienestar',   displayLabel: 'salud y bienestar',     searchTopics: ['Sueño', 'Energía', 'Actividad física', 'Estrés físico'] },
];

// ─── Re-book ─────────────────────────────────────────────────────────────────
type RebookData = {
  coachProfileId: string;
  name: string;
  specialty: string;
  pricePerSession: number;
  avatarUrl: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ConexionesScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);

  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [coaches, setCoaches]           = useState<CachedCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [rebookData, setRebookData]     = useState<RebookData | null>(null);

  // ── Cache poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    prefetchCoaches();
    let t: ReturnType<typeof setInterval>;
    const check = () => {
      const c = getCoachesCache();
      if (c) { setCoaches(c); setLoadingCoaches(false); clearInterval(t); }
    };
    check();
    t = setInterval(check, 80);
    return () => clearInterval(t);
  }, []);

  // ── Re-book query ─────────────────────────────────────────────────────────
  const loadRebook = useCallback(async () => {
    if (!user?.id) { setRebookData(null); return; }
    const today = new Date().toISOString().split('T')[0];

    const { data: last } = await supabase
      .from('bookings')
      .select('coach_id, scheduled_date')
      .eq('user_id', user.id)
      .eq('status', 'completada')
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!last?.coach_id) { setRebookData(null); return; }

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('coach_id', last.coach_id)
      .in('status', ['pendiente', 'confirmada'])
      .gte('scheduled_date', today);

    if ((count ?? 0) > 0) { setRebookData(null); return; }

    const { data: coachRow } = await supabase
      .from('coaches')
      .select('specialty, price_per_session, profile_id, profiles!inner(name, avatar_url)')
      .eq('id', last.coach_id)
      .single();

    if (!coachRow) { setRebookData(null); return; }

    const profile = Array.isArray(coachRow.profiles) ? coachRow.profiles[0] : coachRow.profiles;
    setRebookData({
      coachProfileId: coachRow.profile_id as string,
      name:           (profile?.name ?? '') as string,
      specialty:      coachRow.specialty as string,
      pricePerSession: coachRow.price_per_session as number,
      avatarUrl:      (profile?.avatar_url ?? null) as string | null,
    });
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadRebook(); }, [loadRebook]));

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const chip = CHIPS.find(c => c.id === selectedChip) ?? null;
  const displayed = chip
    ? coaches.filter(c => chip.searchTopics.some(t => c.topics.includes(t)))
    : coaches;

  // ── Navegación ────────────────────────────────────────────────────────────
  function goToPerfil(coach: CachedCoach) {
    router.push({
      pathname: '/profesional',
      params: {
        profileId: coach.id,
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

  function goRebook() {
    if (!rebookData) return;
    router.push({
      pathname: '/booking-calendar',
      params: {
        coachId:   rebookData.coachProfileId,
        name:      rebookData.name,
        specialty: rebookData.specialty,
        priceFrom: String(rebookData.pricePerSession),
      },
    });
  }

  const sectionTitle = chip
    ? `Trabajan ${chip.displayLabel}`
    : 'Todos los profesionales';

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

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Conexiones</Text>
              <Text style={s.subtitle}>Las personas indicadas para lo que estás viviendo.</Text>
            </View>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => (user ? router.push('/favoritos') : requestAuth())}
              activeOpacity={0.7}>
              <Feather name="star" size={22} color={FS} />
            </TouchableOpacity>
          </View>

          {/* ── Buscador ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.searchBar}
            onPress={() => router.push('/search1')}
            activeOpacity={0.85}>
            <Feather name="search" size={16} color={FS} />
            <Text style={s.searchPlaceholder}>Buscá por nombre, especialidad o tema...</Text>
            <Feather name="sliders" size={16} color={FS} />
          </TouchableOpacity>

          {/* ── Re-book card (condicional) ──────────────────────────────── */}
          {rebookData && (
            <TouchableOpacity style={s.rebookCard} onPress={goRebook} activeOpacity={0.88}>
              <View style={s.rebookLeft}>
                {rebookData.avatarUrl ? (
                  <Image source={{ uri: rebookData.avatarUrl }} style={s.rebookAvatar} />
                ) : (
                  <View style={[s.rebookAvatar, s.rebookAvatarFallback]}>
                    <Text style={s.rebookInitials}>{getInitials(rebookData.name)}</Text>
                  </View>
                )}
              </View>
              <View style={s.rebookCenter}>
                <Text style={s.rebookLabel}>Reservar de nuevo con</Text>
                <Text style={s.rebookName} numberOfLines={1}>{rebookData.name}</Text>
                <Text style={s.rebookSpec} numberOfLines={1}>{rebookData.specialty}</Text>
              </View>
              <Feather name="arrow-right" size={18} color={F} />
            </TouchableOpacity>
          )}

          {/* ── Chips de categoría ─────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}>
            {CHIPS.map(chip => {
              const active = selectedChip === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setSelectedChip(active ? null : chip.id)}
                  activeOpacity={0.8}>
                  <Feather name={chip.icon} size={14} color={active ? CR : FS} />
                  <Text style={[s.chipLabel, active && s.chipLabelActive]}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Lista de profesionales ─────────────────────────────────── */}
          <View style={s.listSection}>
            <Text style={s.listTitle}>{sectionTitle}</Text>

            {/* ── PUNTO DE INSERCIÓN: carrusel "Para vos" por temas ── */}
            {/* Pendiente: agregar aquí carrusel personalizado basado en quiz/historial */}

            {loadingCoaches ? (
              <ActivityIndicator size="small" color={F} style={{ marginTop: 24 }} />
            ) : displayed.length === 0 ? (
              <Text style={s.emptyText}>
                {chip
                  ? `No hay profesionales de ${chip.displayLabel} en este momento.`
                  : 'No hay profesionales disponibles.'}
              </Text>
            ) : displayed.map((coach, idx) => (
              <View key={coach.id}>
                <TouchableOpacity
                  style={s.proCard}
                  onPress={() => goToPerfil(coach)}
                  activeOpacity={0.88}>
                  {/* Avatar */}
                  <View style={s.proAvatarWrap}>
                    {coach.avatarUrl ? (
                      <Image source={{ uri: coach.avatarUrl }} style={s.proAvatar} />
                    ) : (
                      <View style={[s.proAvatar, s.proAvatarFallback]}>
                        <Text style={s.proAvatarInitials}>{getInitials(coach.name)}</Text>
                      </View>
                    )}
                    {coach.verified && (
                      <View style={s.verifiedBadge}>
                        <Feather name="check" size={9} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={s.proInfo}>
                    <View style={s.proTopRow}>
                      <Text style={s.proName} numberOfLines={1}>{coach.name}</Text>
                      <TouchableOpacity
                        onPress={() => toggleFav(coach.id)}
                        hitSlop={8}
                        activeOpacity={0.7}>
                        <Feather
                          name={favoriteIds.has(coach.id) ? 'star' : 'star'}
                          size={18}
                          color={favoriteIds.has(coach.id) ? SG : 'rgba(63,81,47,0.25)'}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={s.proSpecialty} numberOfLines={1}>{coach.specialty}</Text>

                    {/* Topic chips (máx 2) */}
                    {coach.topics.length > 0 && (
                      <View style={s.proTopics}>
                        {coach.topics.slice(0, 2).map(t => (
                          <View key={t} style={s.proTopicPill}>
                            <Text style={s.proTopicText}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Rating + precio */}
                    <View style={s.proBottomRow}>
                      {(coach.reviewCount ?? 0) >= 1 ? (
                        <View style={s.ratingRow}>
                          <Feather name="star" size={11} color={SG} />
                          <Text style={s.ratingText}>
                            {(coach.avgRating ?? 0).toFixed(1)}
                            <Text style={s.ratingCount}> ({coach.reviewCount})</Text>
                          </Text>
                        </View>
                      ) : (
                        <View />
                      )}
                      <Text style={s.proPrice}>
                        Desde ${(coach.priceFrom ?? 0).toLocaleString('es-AR')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {idx < displayed.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>

          {/* ── Quiz card ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.quizCardWrap}
            onPress={() => router.push('/quiz')}
            activeOpacity={0.88}>
            <LinearGradient
              colors={['#C1694F', '#A0513C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.quizCard}>
              <View style={s.quizLeft}>
                <View style={s.quizIconCircle}>
                  <Feather name="help-circle" size={22} color="#fff" />
                </View>
              </View>
              <View style={s.quizText}>
                <Text style={s.quizTitle}>¿No sabés qué necesitás?</Text>
                <Text style={s.quizSub}>3 preguntas · te ayudamos a encontrarlo</Text>
              </View>
              <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.80)" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: 'transparent' },
  screen:        { flex: 1, backgroundColor: 'transparent' },
  screenContent: { paddingTop: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: F,
    lineHeight: 32,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FS,
    lineHeight: 19,
  },
  iconBtn: {
    marginTop: 4,
    padding: 4,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BD,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    gap: 10,
    ...shadow,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(107,122,86,0.70)',
  },

  // Re-book card
  rebookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BD,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    gap: 12,
    ...shadow,
  },
  rebookLeft: {},
  rebookAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  rebookAvatarFallback: {
    backgroundColor: 'rgba(63,81,47,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebookInitials: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: F,
  },
  rebookCenter: { flex: 1 },
  rebookLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FS,
    marginBottom: 2,
  },
  rebookName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: F,
    marginBottom: 1,
  },
  rebookSpec: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: TC,
  },

  // Chips
  chipsRow: {
    paddingLeft: 20,
    paddingRight: 10,
    marginBottom: 24,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BG,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BD,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: F,
    borderColor: F,
  },
  chipLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FS,
  },
  chipLabelActive: {
    color: CR,
  },

  // Pro list
  listSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: F,
    marginBottom: 14,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FS,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },

  // Pro card
  proCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  proAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  proAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  proAvatarFallback: {
    backgroundColor: 'rgba(63,81,47,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proAvatarInitials: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: F,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: F,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: CR,
  },
  proInfo: {
    flex: 1,
    gap: 4,
  },
  proTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: F,
    flex: 1,
    marginRight: 8,
  },
  proSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: TC,
  },
  proTopics: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  proTopicPill: {
    backgroundColor: 'rgba(63,81,47,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proTopicText: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: FS,
  },
  proBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11.5,
    color: F,
  },
  ratingCount: {
    fontFamily: ViveFonts.regular,
    color: FS,
  },
  proPrice: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: FS,
  },
  divider: {
    height: 1,
    backgroundColor: LN,
  },

  // Quiz card
  quizCardWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadow,
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  quizLeft: {},
  quizIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizText: { flex: 1 },
  quizTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#fff',
    marginBottom: 3,
  },
  quizSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
  },
});
