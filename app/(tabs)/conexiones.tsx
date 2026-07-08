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

import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';

// ─── Paleta (refleja el HTML de referencia) ──────────────────────────────────
const FOREST      = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const INK         = '#2E3624';
const CARD        = '#F7F2E7';
const CREAM_DEEP  = '#EAE2D0';
const TERRACOTTA  = '#C06B4A';
const TC_SOFT     = '#EAD3C6';
const STAR        = '#C99A3F';
const LIVE        = '#5F7A44';
const LINE        = 'rgba(63,81,47,0.14)';

// ─── Chips ───────────────────────────────────────────────────────────────────
type FeatherName = React.ComponentProps<typeof Feather>['name'];

type ChipItem = {
  id: string;
  icon: FeatherName;
  label: string;
  displayLabel: string;
  searchTopics: string[];
};

const CHIPS: ChipItem[] = [
  { id: '5', icon: 'wind',        label: 'Ansiedad y estrés',  displayLabel: 'ansiedad y estrés',    searchTopics: ['Ansiedad', 'Estrés físico'] },
  { id: '1', icon: 'smile',       label: 'Estado de ánimo',    displayLabel: 'estado de ánimo',      searchTopics: ['Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría'] },
  { id: '2', icon: 'heart',       label: 'Relaciones',         displayLabel: 'relaciones',            searchTopics: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: '3', icon: 'trending-up', label: 'Desarrollo',         displayLabel: 'crecimiento personal',  searchTopics: ['Identidad', 'Motivación', 'Crecimiento', 'Propósito'] },
  { id: '4', icon: 'compass',     label: 'Propósito',          displayLabel: 'propósito y dirección', searchTopics: ['Propósito', 'Identidad', 'Motivación', 'Momentos de cambio'] },
  { id: '6', icon: 'briefcase',   label: 'Trabajo',            displayLabel: 'trabajo y carrera',     searchTopics: ['Productividad', 'Concentración', 'Procrastinación', 'Vínculos laborales'] },
  { id: '7', icon: 'repeat',      label: 'Hábitos',            displayLabel: 'hábitos',               searchTopics: ['Hábitos', 'Hábitos mentales'] },
  { id: '8', icon: 'coffee',      label: 'Nutrición',          displayLabel: 'nutrición',             searchTopics: ['Nutrición'] },
  { id: '9', icon: 'activity',    label: 'Bienestar',          displayLabel: 'salud y bienestar',     searchTopics: ['Sueño', 'Energía', 'Actividad física', 'Estrés físico'] },
];

// ─── Mapeo quiz → temas de coaches ───────────────────────────────────────────
const QUIZ_TOPIC_MAP: Record<string, string[]> = {
  emocion:    ['Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Autoestima', 'Soledad'],
  relaciones: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'],
  trabajo:    ['Productividad', 'Concentración', 'Procrastinación', 'Vínculos laborales', 'Hábitos mentales'],
  salud:      ['Sueño', 'Energía', 'Actividad física', 'Estrés físico', 'Hábitos', 'Nutrición', 'Sexualidad'],
  proposito:  ['Propósito', 'Identidad', 'Motivación', 'Crecimiento', 'Momentos de cambio', 'Espiritualidad'],
};

const QUIZ_TOPIC_LABEL: Record<string, string> = {
  emocion:    'emociones',
  relaciones: 'relaciones',
  trabajo:    'trabajo',
  salud:      'salud y hábitos',
  proposito:  'propósito',
};

function matchesProfType(specialty: string, profType: string): boolean {
  if (!profType || profType === 'any') return true;
  const s = specialty.toLowerCase();
  if (profType === 'coach')         return s.includes('coach');
  if (profType === 'psicologo')     return s.includes('psicól') || s.includes('psicol');
  if (profType === 'nutricionista') return s.includes('nutrici');
  return true;
}

// ─── Re-book ─────────────────────────────────────────────────────────────────
type RebookData = {
  coachProfileId: string;
  name: string;
  specialty: string;
  pricePerSession: number;
  avatarUrl: string | null;
  lastDate: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
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
  const [unreadCount, setUnreadCount]   = useState(0);
  const [quizTopic, setQuizTopic]       = useState<string | null>(null);
  const [quizProfType, setQuizProfType] = useState<string | null>(null);

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

  // ── Quiz answers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_quiz_answers')
      .select('topic, professional_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setQuizTopic(data?.topic ?? null);
        setQuizProfType(data?.professional_type ?? null);
      });
  }, [user]);

  // ── Notificaciones no leídas ──────────────────────────────────────────────
  const fetchNotifCount = useCallback(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifCount();
    const channel = supabase
      .channel(`notif-conexiones-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, fetchNotifCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifCount]);

  useFocusEffect(useCallback(() => { fetchNotifCount(); }, [fetchNotifCount]));

  // ── Re-book query ─────────────────────────────────────────────────────────
  const loadRebook = useCallback(async () => {
    if (!user?.id) { setRebookData(null); return; }
    const today = new Date().toISOString().split('T')[0];

    const { data: last } = await supabase
      .from('bookings')
      .select('coach_id, scheduled_date, coach_name, coach_specialty')
      .eq('user_id', user.id)
      .or(`status.eq.completada,and(status.eq.confirmada,scheduled_date.lt.${today})`)
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
      .select('specialty, price_per_session, profile_id')
      .eq('id', last.coach_id)
      .eq('availability_status', 'activo')
      .single();

    if (!coachRow) { setRebookData(null); return; }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', coachRow.profile_id)
      .single();

    setRebookData({
      coachProfileId: coachRow.profile_id as string,
      name:           (profileRow?.name || (last.coach_name as string) || '') as string,
      specialty:      (coachRow.specialty || (last.coach_specialty as string) || '') as string,
      pricePerSession: coachRow.price_per_session as number,
      avatarUrl:      (profileRow?.avatar_url ?? null) as string | null,
      lastDate:       (last.scheduled_date as string) ?? null,
    });
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadRebook(); }, [loadRebook]));

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const chip = CHIPS.find(c => c.id === selectedChip) ?? null;
  const displayed = chip
    ? coaches.filter(c => chip.searchTopics.some(t => c.topics.includes(t)))
    : coaches;

  const suggestedCoaches: CachedCoach[] = quizTopic
    ? coaches
        .filter(c =>
          (QUIZ_TOPIC_MAP[quizTopic] ?? []).some(t => c.topics.includes(t)) &&
          matchesProfType(c.specialty, quizProfType ?? 'any'),
        )
        .slice(0, 4)
    : [];

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
          iconColor={FOREST_SOFT}
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
            <View style={s.hicons}>
              <TouchableOpacity
                onPress={() => (user ? router.push('/favoritos') : requestAuth())}
                activeOpacity={0.7}
                hitSlop={8}>
                <Feather name="star" size={21} color={FOREST} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (user ? router.push('/notifications') : requestAuth())}
                activeOpacity={0.7}
                hitSlop={8}
                style={s.bellBtn}>
                <Feather name="bell" size={21} color={FOREST} />
                {unreadCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Buscador ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.searchBar}
            onPress={() => router.push('/search1')}
            activeOpacity={0.85}>
            <Feather name="search" size={16} color={FOREST_SOFT} />
            <Text style={s.searchPlaceholder}>Buscá por nombre, especialidad o tema…</Text>
            <Feather name="sliders" size={16} color={FOREST} />
          </TouchableOpacity>

          {/* ── Para vos (quiz) ────────────────────────────────────────── */}
          {suggestedCoaches.length > 0 && (
            <View style={s.paraVosWrap}>
              <View style={s.paraVosHead}>
                <Text style={s.paraVosTitle}>Para vos</Text>
                <Text style={s.paraVosSub}>
                  Trabajan {QUIZ_TOPIC_LABEL[quizTopic!] ?? quizTopic}
                </Text>
                <TouchableOpacity onPress={() => router.push('/quiz')} hitSlop={8}>
                  <Text style={s.paraVosLink}>Cambiar</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.paraVosRow}>
                {suggestedCoaches.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={s.paraVosCard}
                    onPress={() => goToPerfil(c)}
                    activeOpacity={0.85}>
                    {c.avatarUrl ? (
                      <Image source={{ uri: c.avatarUrl }} style={s.paraVosAvatar} />
                    ) : (
                      <View style={[s.paraVosAvatar, s.paraVosAvatarFallback]}>
                        <Text style={s.paraVosInitials}>{getInitials(c.name)}</Text>
                      </View>
                    )}
                    <Text style={s.paraVosName} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                    <Text style={s.paraVosRole} numberOfLines={1}>{c.specialty}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Re-book card (condicional) ──────────────────────────────── */}
          {rebookData && (
            <View style={s.rebook}>
              {/* Avatar */}
              {rebookData.avatarUrl ? (
                <Image source={{ uri: rebookData.avatarUrl }} style={s.rebookAvatar} />
              ) : (
                <View style={[s.rebookAvatar, s.rebookAvatarFallback]}>
                  <Text style={s.rebookInitials}>{getInitials(rebookData.name)}</Text>
                </View>
              )}
              {/* Texto */}
              <View style={s.rebookText}>
                <Text style={s.rebookTitle} numberOfLines={1}>
                  ¿Otra sesión con {rebookData.name.split(' ')[0]}?
                </Text>
                {rebookData.lastDate && (
                  <Text style={s.rebookSub}>
                    Tu última fue el {formatShortDate(rebookData.lastDate)}
                  </Text>
                )}
              </View>
              {/* CTA */}
              <TouchableOpacity style={s.rebookCta} onPress={goRebook} activeOpacity={0.85}>
                <Text style={s.rebookCtaText}>Reservar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Sección chips ──────────────────────────────────────────── */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>¿Qué te gustaría trabajar hoy?</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedChip(null)}>
              <Text style={s.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}>
            {CHIPS.map(c => {
              const active = selectedChip === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setSelectedChip(active ? null : c.id)}
                  activeOpacity={0.8}>
                  <Feather name={c.icon} size={14} color={active ? '#F3EEDF' : FOREST} />
                  <Text style={[s.chipLabel, active && s.chipLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Resultados ─────────────────────────────────────────────── */}
          <View style={s.resultsHead}>
            <Text style={s.resultsTitle}>{sectionTitle}</Text>
          </View>

          {loadingCoaches ? (
            <ActivityIndicator size="small" color={FOREST} style={{ marginTop: 24 }} />
          ) : displayed.length === 0 ? (
            <Text style={s.emptyText}>
              {chip
                ? `No hay profesionales de ${chip.displayLabel} cargados aún.`
                : 'No hay profesionales disponibles.'}
            </Text>
          ) : displayed.map(coach => (
            <View key={coach.id} style={s.proCard}>
              {/* Top row */}
              <View style={s.proTop}>
                {/* Avatar */}
                <View style={s.proAvatarWrap}>
                  {coach.avatarUrl ? (
                    <Image source={{ uri: coach.avatarUrl }} style={s.proAvatar} />
                  ) : (
                    <View style={[s.proAvatar, s.proAvatarFallback]}>
                      <Text style={s.proInitials}>{getInitials(coach.name)}</Text>
                    </View>
                  )}
                  {coach.verified && (
                    <View style={s.vBadge}>
                      <Text style={s.vBadgeText}>✓</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={s.proInfo}>
                  <Text style={s.proName} numberOfLines={1}>{coach.name}</Text>
                  <Text style={s.proRole} numberOfLines={1}>{coach.specialty}</Text>
                  {(coach.reviewCount ?? 0) >= 1 && (
                    <View style={s.statsRow}>
                      <Text style={s.statsStar}>★ {(coach.avgRating ?? 0).toFixed(1)}</Text>
                      <Text style={s.statsCount}>{coach.reviewCount} reseñas</Text>
                    </View>
                  )}
                </View>

                {/* Fav */}
                <TouchableOpacity
                  onPress={() => toggleFav(coach.id)}
                  hitSlop={8}
                  activeOpacity={0.7}
                  style={s.favBtn}>
                  <Feather
                    name="star"
                    size={18}
                    color={favoriteIds.has(coach.id) ? TERRACOTTA : FOREST_SOFT}
                  />
                </TouchableOpacity>
              </View>

              {/* Tags */}
              {coach.topics.length > 0 && (
                <View style={s.tagsRow}>
                  {coach.topics.slice(0, 2).map(t => (
                    <View key={t} style={s.tag}>
                      <Text style={s.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Bottom row */}
              <View style={s.proBottom}>
                <Text style={s.proPrice} numberOfLines={1}>
                  Desde ${(coach.priceFrom ?? 0).toLocaleString('es-AR')}
                </Text>
                <TouchableOpacity
                  style={s.proBookBtn}
                  onPress={() => goToPerfil(coach)}
                  activeOpacity={0.85}>
                  <Text style={s.proBookBtnText}>Ver perfil</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* ── Quiz card ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.quizWrap}
            onPress={() => router.push('/quiz')}
            activeOpacity={0.88}>
            <LinearGradient
              colors={[TC_SOFT, '#F0DDD2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.quizCard}>
              {/* Overlapping circles */}
              <View style={s.quizCircles}>
                <View style={[s.qc, { backgroundColor: TERRACOTTA }]} />
                <View style={[s.qc, { backgroundColor: FOREST_SOFT, marginLeft: -9 }]} />
                <View style={[s.qc, { backgroundColor: '#7E8CA8', marginLeft: -9 }]} />
              </View>
              {/* Text */}
              <View style={s.quizText}>
                <Text style={s.quizTitle}>¿No sabés qué necesitás?</Text>
                <Text style={s.quizSub}>3 preguntas y te sugiero el perfil indicado</Text>
              </View>
              <Text style={s.quizArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: 'rgba(46,54,36,0.22)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: 'transparent' },
  screen:        { flex: 1, backgroundColor: 'transparent' },
  screenContent: { paddingTop: 10 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 34,
    color: FOREST,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    marginTop: 2,
    lineHeight: 19,
  },
  hicons: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 10,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 20,
    marginBottom: 0,
    ...shadow,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
  },

  // Re-book
  rebook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    ...shadow,
  },
  rebookAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    flexShrink: 0,
  },
  rebookAvatarFallback: {
    backgroundColor: 'rgba(192,107,74,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebookInitials: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: TERRACOTTA,
  },
  rebookText: { flex: 1 },
  rebookTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: FOREST,
  },
  rebookSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  rebookCta: {
    backgroundColor: TERRACOTTA,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  rebookCtaText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11.5,
    color: '#FFF6EC',
  },

  // Section head (chips)
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: FOREST,
  },
  sectionLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: TERRACOTTA,
  },

  // Chips
  chipsRow: {
    paddingLeft: 20,
    paddingRight: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  chipLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: FOREST,
  },
  chipLabelActive: {
    color: '#F3EEDF',
  },

  // Results head
  resultsHead: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 0,
  },
  resultsTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: FOREST,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },

  // Pro card
  proCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 15,
    ...shadow,
  },
  proTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  proAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  proAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  proAvatarFallback: {
    backgroundColor: 'rgba(107,122,86,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proInitials: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: FOREST,
  },
  vBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LIVE,
    borderWidth: 2,
    borderColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vBadgeText: {
    fontSize: 10,
    color: '#F3EEDF',
    fontFamily: ViveFonts.semibold,
  },
  proInfo: {
    flex: 1,
    minWidth: 0,
  },
  proName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: FOREST,
  },
  proRole: {
    fontFamily: ViveFonts.medium,
    fontSize: 11.5,
    color: TERRACOTTA,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  statsStar: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    color: STAR,
  },
  statsCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
  },
  favBtn: {
    paddingTop: 2,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 11,
  },
  tag: {
    backgroundColor: CREAM_DEEP,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: ViveFonts.medium,
    fontSize: 10.5,
    color: FOREST,
  },

  // Pro bottom row
  proBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  proPrice: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
  },
  proBookBtn: {
    borderWidth: 1.5,
    borderColor: FOREST,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  proBookBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11.5,
    color: FOREST,
  },

  // Quiz
  quizWrap: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 22,
    overflow: 'hidden',
    ...shadow,
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,107,74,0.25)',
    borderRadius: 22,
  },
  quizCircles: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  qc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    opacity: 0.75,
  },
  quizText: { flex: 1 },
  quizTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST,
  },
  quizSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: '#8F6A55',
    marginTop: 2,
  },
  quizArrow: {
    fontSize: 22,
    color: TERRACOTTA,
    lineHeight: 26,
  },

  // Para vos
  paraVosWrap: {
    marginTop: 14,
    marginHorizontal: 20,
  },
  paraVosHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 10,
  },
  paraVosTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: FOREST,
  },
  paraVosSub: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  paraVosLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: TERRACOTTA,
  },
  paraVosRow: {
    gap: 10,
    paddingRight: 4,
  },
  paraVosCard: {
    width: 100,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios:     { shadowColor: 'rgba(46,54,36,0.18)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  paraVosAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  paraVosAvatarFallback: {
    backgroundColor: 'rgba(107,122,86,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paraVosInitials: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: FOREST,
  },
  paraVosName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: FOREST,
    textAlign: 'center',
  },
  paraVosRole: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: TERRACOTTA,
    textAlign: 'center',
  },

  bellBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
});
