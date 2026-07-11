import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Dimensions,
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
import { coachesWithSlotThisWeek } from '@/lib/coachAvailability';
import { DOORS, coachesForDoor, EJES, EJE_MAP, doorsForEje } from '@/constants/conexionesDoors';
import { rankDeck } from '@/lib/coachDeckRanking';

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

const SCREEN_W = Dimensions.get('window').width;

// Feature flag temporal: ocultar la card de reagendar en el menú (pedido Andre).
// Poner en true para volver a mostrarla.
const SHOW_REBOOK: boolean = false;

// Tinte suave desde un hex de eje (para círculos del menú + banda del deck).
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [deckIndex, setDeckIndex]           = useState(0);
  const [coaches, setCoaches]           = useState<CachedCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set());
  const [rebookData, setRebookData]     = useState<RebookData | null>(null);
  const [unreadCount, setUnreadCount]   = useState(0);

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

  // ── Selección eje / puerta ──────────────────────────────────────────────────
  const selectedAxis = selectedAxisId ? EJE_MAP[selectedAxisId] ?? null : null;
  const selectedDoor = selectedDoorId ? DOORS.find(d => d.id === selectedDoorId) ?? null : null;
  const deck = useMemo(
    () => (selectedDoor ? rankDeck(coachesForDoor(selectedDoor, coaches), user?.id) : []),
    [selectedDoor, coaches, user?.id],
  );
  // ── Disponibilidad "esta semana" — solo para los coaches del deck visible ──
  useEffect(() => {
    if (deck.length === 0) { setAvailableSet(new Set()); return; }
    let cancelled = false;
    const ids = deck.map(e => e.coach.coachId).filter(Boolean) as string[];
    coachesWithSlotThisWeek(ids).then(set => { if (!cancelled) setAvailableSet(set); });
    return () => { cancelled = true; };
  }, [deck]);

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

  function selectAxis(id: string) {
    setSelectedAxisId(id);
  }
  function backToAxes() {
    setSelectedAxisId(null);
  }
  function openDoor(id: string) {
    // Aseguro que el eje quede fijado (por si se abre desde los chips del deck).
    const door = DOORS.find(d => d.id === id);
    const eje = EJES.find(e => door && e.color === door.color);
    if (eje) setSelectedAxisId(eje.id);
    setSelectedDoorId(id);
    setDeckIndex(0);
  }
  function backToMenu() {
    // Vuelve a los temas del eje (fase 2), no a los ejes.
    setSelectedDoorId(null);
    setDeckIndex(0);
  }
  function verTodosEnPuerta() {
    if (!selectedDoor) return;
    router.push({
      pathname: '/search3',
      params: { topic: selectedDoor.subtemas.join(','), label: selectedDoor.label },
    });
  }

  // ═══ Vista DECK (una puerta elegida) ═══════════════════════════════════════
  if (selectedDoor) {
    return (
      <AppBg>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={s.safe} edges={['top']}>
          <ScrollView
            style={s.screen}
            contentContainerStyle={s.screenContent}
            showsVerticalScrollIndicator={false}>

            {/* Header con volver */}
            <View style={s.deckHeader}>
              <TouchableOpacity onPress={backToMenu} hitSlop={10} activeOpacity={0.7} style={s.backBtn}>
                <Feather name="chevron-left" size={26} color={FOREST} />
              </TouchableOpacity>
              <Text style={s.deckHeaderTitle}>Conexiones</Text>
              <View style={s.hicons}>
                <TouchableOpacity onPress={() => router.push('/search1')} activeOpacity={0.7} hitSlop={8}>
                  <Feather name="search" size={20} color={FOREST} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => (user ? router.push('/favoritos') : requestAuth())} activeOpacity={0.7} hitSlop={8}>
                  <Feather name="star" size={20} color={FOREST} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chips deslizables de temas — solo los del eje actual */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.themeChipsRow}>
              {DOORS.filter(d => d.color === selectedDoor.color).map(d => {
                const active = d.id === selectedDoorId;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      s.themeChip,
                      active ? { backgroundColor: d.color, borderColor: d.color } : { borderColor: tint(d.color, 0.28) },
                    ]}
                    onPress={() => openDoor(d.id)}
                    activeOpacity={0.85}>
                    <Feather name={d.icon as any} size={13} color={active ? '#F7EFE4' : d.color} />
                    <Text style={[s.themeChipText, active && s.themeChipTextActive]} numberOfLines={1}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Deck — carrusel paginado (swipe izq/der) */}
            {loadingCoaches ? (
              <ActivityIndicator size="small" color={FOREST} style={{ marginTop: 40 }} />
            ) : deck.length === 0 ? (
              <View style={s.deckClose}>
                <Feather name="search" size={22} color={FOREST_SOFT} />
                <Text style={s.deckCloseTitle}>Todavía no hay profesionales en {selectedDoor.label.toLowerCase()}</Text>
                <Text style={s.deckCloseSub}>Probá con otro tema, o hacé el quiz para una sugerencia.</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  key={selectedDoorId}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e =>
                    setDeckIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
                  }
                  scrollEventThrottle={16}>
                  {deck.map((entry, i) => {
                    const { coach, slot } = entry;
                    const available = coach.coachId && availableSet.has(coach.coachId);
                    return (
                      <View key={coach.id} style={s.cardPage}>
                        <View style={s.cardWrap}>
                          {/* Banda de color por eje */}
                          <View style={[s.cardBand, { backgroundColor: tint(selectedDoor.color, 0.20) }]}>
                            <TouchableOpacity
                              onPress={() => toggleFav(coach.id)}
                              hitSlop={8}
                              activeOpacity={0.7}
                              style={s.cardFav}>
                              <Feather name="star" size={17} color={favoriteIds.has(coach.id) ? TERRACOTTA : FOREST_SOFT} />
                            </TouchableOpacity>
                            <View style={s.cardCounter}>
                              <Text style={s.cardCounterText}>{i + 1} de {deck.length}</Text>
                            </View>
                          </View>

                          {/* Avatar solapado */}
                          <View style={s.cardAvatarWrap}>
                            {coach.avatarUrl ? (
                              <Image source={{ uri: coach.avatarUrl }} style={s.cardAvatar} />
                            ) : (
                              <View style={[s.cardAvatar, s.cardAvatarFallback]}>
                                <Text style={s.cardInitials}>{getInitials(coach.name)}</Text>
                              </View>
                            )}
                            {coach.verified && (
                              <View style={s.vBadge}><Feather name="check" size={11} color="#F3EEDF" /></View>
                            )}
                          </View>

                          {/* Cuerpo */}
                          <View style={s.cardBody}>
                            <View style={[s.whyChip, { backgroundColor: tint(selectedDoor.color, 0.16) }]}>
                              <Feather name={slot.icon as any} size={12} color={selectedDoor.color} />
                              <Text style={[s.whyChipText, { color: selectedDoor.color }]}>{slot.label}</Text>
                            </View>
                            <Text style={s.slotSublabel}>{slot.sublabel}</Text>

                            <Text style={s.cardName} numberOfLines={1}>{coach.name}</Text>
                            <Text style={s.cardRole} numberOfLines={1}>{coach.specialty}</Text>

                            <View style={s.cardRatingRow}>
                              {(coach.reviewCount ?? 0) >= 1 ? (
                                <Text style={s.cardRating}>
                                  <Text style={{ color: STAR }}>★ </Text>
                                  {(coach.avgRating ?? 0).toFixed(1)}
                                  <Text style={s.cardRatingMuted}>  ·  {coach.reviewCount} reseñas</Text>
                                </Text>
                              ) : (
                                <Text style={s.cardNew}>Sin reseñas todavía</Text>
                              )}
                            </View>

                            {!!coach.bio && (
                              <Text style={s.cardBio} numberOfLines={3}>“{coach.bio.trim()}”</Text>
                            )}

                            <View style={s.cardMetaRow}>
                              {available && (
                                <>
                                  <View style={s.liveDot} />
                                  <Text style={s.cardAvail}>Con lugar esta semana</Text>
                                  <Text style={s.cardMetaDivider}>·</Text>
                                </>
                              )}
                              <Text style={s.cardPrice}>Desde ${(coach.priceFrom ?? 0).toLocaleString('es-AR')}</Text>
                            </View>

                            <TouchableOpacity
                              style={s.knowBtn}
                              onPress={() => goToPerfil(coach)}
                              activeOpacity={0.85}>
                              <Text style={s.knowText}>Conocer a {coach.name.split(' ')[0]}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Dots */}
                {deck.length > 1 && (
                  <View style={s.dotsRow}>
                    {deck.map((e, i) => (
                      <View key={e.coach.id} style={[s.dot, i === deckIndex && s.dotActive]} />
                    ))}
                  </View>
                )}

                <TouchableOpacity onPress={verTodosEnPuerta} activeOpacity={0.7} style={s.verListaBtn}>
                  <Text style={s.verListaText}>Ver lista completa</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
          </ScrollView>
        </SafeAreaView>
      </AppBg>
    );
  }

  // ═══ Vista MENÚ (ninguna puerta elegida) ═══════════════════════════════════
  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_conexiones"
          icon="account-group-outline"
          iconColor={FOREST_SOFT}
          title="Encontrá a tu guía"
          description="Elegí un tema y te presento a los profesionales indicados. Lo cambiás cuando quieras."
          delay={800}
        />

        <ScrollView
          style={s.screen}
          contentContainerStyle={s.screenContent}
          showsVerticalScrollIndicator={false}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={s.header}>
            <Text style={s.title}>Conexiones</Text>
            <View style={s.hicons}>
              <TouchableOpacity onPress={() => router.push('/search1')} activeOpacity={0.7} hitSlop={8}>
                <Feather name="search" size={21} color={FOREST} />
              </TouchableOpacity>
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

          {/* ── Re-book card (condicional) — OCULTA por ahora (pedido Andre) ─ */}
          {SHOW_REBOOK && rebookData && (
            <View style={s.rebook}>
              {rebookData.avatarUrl ? (
                <Image source={{ uri: rebookData.avatarUrl }} style={s.rebookAvatar} />
              ) : (
                <View style={[s.rebookAvatar, s.rebookAvatarFallback]}>
                  <Text style={s.rebookInitials}>{getInitials(rebookData.name)}</Text>
                </View>
              )}
              <View style={s.rebookText}>
                <Text style={s.rebookTitle} numberOfLines={1}>
                  ¿Otra sesión con {rebookData.name.split(' ')[0]}?
                </Text>
                {rebookData.lastDate && (
                  <Text style={s.rebookSub}>Tu última fue el {formatShortDate(rebookData.lastDate)}</Text>
                )}
              </View>
              <TouchableOpacity style={s.rebookCta} onPress={goRebook} activeOpacity={0.85}>
                <Text style={s.rebookCtaText}>Reservar</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedAxis ? (
            /* ── Fase 2: temas del eje ──────────────────────────────────── */
            <>
              <TouchableOpacity onPress={backToAxes} activeOpacity={0.7} hitSlop={8} style={s.menuBackRow}>
                <Feather name="chevron-left" size={18} color={FOREST_SOFT} />
                <Text style={s.menuBackText}>Áreas de bienestar</Text>
              </TouchableOpacity>

              <View style={s.askWrap}>
                <Text style={s.askTitle}>{selectedAxis.label}</Text>
                <Text style={s.askSub}>Elegí un tema y te presento a los profesionales indicados.</Text>
              </View>

              <View style={s.menuWrap}>
                {doorsForEje(selectedAxis).map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={s.menuCard}
                    onPress={() => openDoor(d.id)}
                    activeOpacity={0.85}>
                    <View style={[s.menuIcon, { backgroundColor: tint(d.color, 0.16) }]}>
                      <Feather name={d.icon as any} size={20} color={d.color} />
                    </View>
                    <View style={s.menuTextWrap}>
                      <Text style={s.menuTitle} numberOfLines={1}>{d.label}</Text>
                      <Text style={s.menuTagline} numberOfLines={1}>{d.tagline}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            /* ── Fase 1: ejes de bienestar ──────────────────────────────── */
            <>
              <View style={s.askWrap}>
                <Text style={s.askTitle}>¿Qué te gustaría{'\n'}trabajar hoy?</Text>
                <Text style={s.askSub}>Elegí un área de bienestar para empezar.</Text>
              </View>

              <View style={s.menuWrap}>
                {EJES.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={s.menuCard}
                    onPress={() => selectAxis(e.id)}
                    activeOpacity={0.85}>
                    <View style={[s.menuIcon, { backgroundColor: tint(e.color, 0.16) }]}>
                      <Feather name={e.icon as any} size={20} color={e.color} />
                    </View>
                    <View style={s.menuTextWrap}>
                      <Text style={s.menuTitle} numberOfLines={1}>{e.label}</Text>
                      <Text style={s.menuTagline} numberOfLines={1}>{e.tagline}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── VITA IA — teaser de intake conversacional ─────────────── */}
          <TouchableOpacity
            style={s.quizWrap}
            onPress={() => router.push('/ia')}
            activeOpacity={0.88}>
            <LinearGradient
              colors={[TC_SOFT, '#F0DDD2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.quizCard}>
              <View style={s.quizIcon}>
                <Feather name="message-circle" size={20} color="#FFF6EC" />
              </View>
              <View style={s.quizText}>
                <Text style={s.quizTitle}>¿No sabés por dónde empezar?</Text>
                <Text style={s.quizSub}>Contale a VITA qué te pasa y te oriento</Text>
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

  // Header menú
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
  },
  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 32,
    color: FOREST,
    lineHeight: 38,
  },
  hicons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // Pregunta editorial
  askWrap: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 18,
  },
  askTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 26,
    color: FOREST,
    lineHeight: 32,
  },
  askSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: FOREST_SOFT,
    marginTop: 8,
    lineHeight: 20,
  },

  // Menú (cards de ejes / puertas)
  menuBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  menuBackText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FOREST_SOFT,
  },
  menuWrap: {
    paddingHorizontal: 20,
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...shadow,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuTextWrap: { flex: 1, minWidth: 0 },
  menuTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: INK,
  },
  menuTagline: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },

  // ── Deck header ──────────────────────────────────────────────────────────
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  deckHeaderTitle: {
    flex: 1,
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 26,
    color: FOREST,
    marginLeft: 2,
  },

  // Chips de temas (deslizables)
  themeChipsRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 0,
  },
  themeChipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST },
  themeChipTextActive: { color: '#F7EFE4' },

  // ── Card rica del deck ───────────────────────────────────────────────────
  cardPage: {
    width: SCREEN_W,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',   // centra la card verticalmente dentro de la página
  },
  cardWrap: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 26,
    overflow: 'hidden',
    ...shadow,
  },
  cardBand: {
    height: 92,
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardFav: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCounter: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  cardCounterText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: FOREST },

  cardAvatarWrap: {
    alignSelf: 'center',
    marginTop: -46,
  },
  cardAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: CARD,
  },
  cardAvatarFallback: {
    backgroundColor: 'rgba(107,122,86,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInitials: { fontFamily: ViveFonts.semibold, fontSize: 30, color: FOREST },
  vBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LIVE,
    borderWidth: 3,
    borderColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  whyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  whyChipText: { fontFamily: ViveFonts.semibold, fontSize: 11.5 },
  slotSublabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginTop: 5,
  },
  cardName: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 24,
    color: FOREST,
    textAlign: 'center',
  },
  cardRole: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: TERRACOTTA,
    marginTop: 3,
    textAlign: 'center',
  },
  cardRatingRow: { marginTop: 7 },
  cardRating: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  cardRatingMuted: { fontFamily: ViveFonts.regular, color: FOREST_SOFT },
  cardNew: { fontFamily: ViveFonts.semibold, fontSize: 12, color: TERRACOTTA },
  cardBio: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 15,
    fontStyle: 'italic',
    color: INK,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE },
  cardAvail: { fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST },
  cardMetaDivider: { color: FOREST_SOFT, fontSize: 12.5 },
  cardPrice: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT },

  knowBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: FOREST,
    marginTop: 16,
  },
  knowText: { fontFamily: ViveFonts.semibold, fontSize: 13.5, color: '#F3EEDF' },

  // Dots del carrusel
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tint(FOREST, 0.22),
  },
  dotActive: {
    width: 20,
    backgroundColor: FOREST,
  },

  verListaBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 2 },
  verListaText: { fontFamily: ViveFonts.semibold, fontSize: 13.5, color: TERRACOTTA },

  // Deck close / empty
  deckClose: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 26,
    paddingHorizontal: 20,
    ...shadow,
  },
  deckCloseTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST, textAlign: 'center' },
  deckCloseSub: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, textAlign: 'center', lineHeight: 18 },

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
    marginBottom: 16,
    padding: 12,
    ...shadow,
  },
  rebookAvatar: { width: 38, height: 38, borderRadius: 19, flexShrink: 0 },
  rebookAvatarFallback: { backgroundColor: 'rgba(192,107,74,0.20)', alignItems: 'center', justifyContent: 'center' },
  rebookInitials: { fontFamily: ViveFonts.semibold, fontSize: 13, color: TERRACOTTA },
  rebookText: { flex: 1 },
  rebookTitle: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  rebookSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT, marginTop: 1 },
  rebookCta: { backgroundColor: TERRACOTTA, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8 },
  rebookCtaText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: '#FFF6EC' },

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
  quizIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quizText: { flex: 1 },
  quizTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  quizSub: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: '#8F6A55', marginTop: 2 },
  quizArrow: { fontSize: 22, color: TERRACOTTA, lineHeight: 26 },

  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
