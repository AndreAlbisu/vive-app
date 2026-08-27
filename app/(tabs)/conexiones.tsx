import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { PaymentBadges } from '@/components/PaymentBadges';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';
import { altoDeEje } from '@/lib/ejesLayout';
import { DOORS, coachesForDoor, EJES, EJE_MAP, doorsForEje } from '@/constants/conexionesDoors';
import { rankDeck, SLOT_COLORS, type DeckSlotKey } from '@/lib/coachDeckRanking';

// ─── Paleta (refleja el HTML de referencia) ──────────────────────────────────
const FOREST      = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const INK         = '#2E3624';
const CARD        = '#F7F2E7';
const TERRACOTTA  = '#C06B4A';
const TC_SOFT     = '#EAD3C6';
const STAR        = '#C99A3F';
const LINE        = 'rgba(63,81,47,0.14)';
const SAGE        = '#DCE5CB'; // pill "Opción económica" — card-otras-estructuras.html §B2

// Pill de "motivo" (por qué esta persona está en el carrusel) — reusa
// DECK_SLOTS/SLOT_COLORS de lib/coachDeckRanking.ts, no un campo nuevo: ese
// dato YA elige de qué slot viene cada card del deck. Solo `recomendado` y
// `economico` están definidos por el HTML de referencia (fondo+texto exactos,
// medidos); `tendencia`/`nuevo` son un tinte de su propio SLOT_COLOR para
// sostener el mismo lenguaje visual — no vienen del mockup, son mi propuesta,
// ver la conversación de la sesión antes de ajustarlos.
const REASON_STYLES: Record<DeckSlotKey, { bg: string; text: string }> = {
  recomendado: { bg: TC_SOFT, text: '#8F4A2E' },
  economico:   { bg: SAGE,    text: '#42542F' },
  tendencia:   { bg: tint(SLOT_COLORS.tendencia, 0.18), text: SLOT_COLORS.tendencia },
  nuevo:       { bg: tint(SLOT_COLORS.nuevo, 0.16),      text: SLOT_COLORS.nuevo },
};

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
// Normaliza para búsqueda tolerante: sin acentos, minúsculas, sin espacios al borde.
// Así "gonzalez" encuentra "González" (el "o cerca" del pedido).
function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

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

// Las "fases" de Conexiones (Ejes → Puertas/temas → Deck) son un swap de estado
// dentro de la misma pantalla, no una navegación real — así que no reciben gratis
// el slide nativo de iOS que sí tiene cualquier `router.push` del resto de la app.
// Se remonta con cada `key` distinto (recibido desde afuera) y anima una sola vez
// al montarse: fundido + deslizamiento leve desde la derecha, imitando ese push.
function SlideInView({ children, style }: { children: React.ReactNode; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [anim]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ConexionesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, requestAuth } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);

  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [deckIndex, setDeckIndex]           = useState(0);
  const [rawCoaches, setCoaches]        = useState<CachedCoach[]>([]);
  const coaches                         = useBlockedFilter(rawCoaches);
  const [coachQuery, setCoachQuery]     = useState('');
  const [loadingCoaches, setLoadingCoaches] = useState(true);
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

  // Búsqueda en vivo por nombre (sobre el cache ya cargado; sin tocar la base).
  const coachResults = useMemo(() => {
    const q = normalizeName(coachQuery);
    if (!q) return [];
    return coaches.filter(c => normalizeName(c.name).includes(q)).slice(0, 20);
  }, [coachQuery, coaches]);
  const selectedDoor = selectedDoorId ? DOORS.find(d => d.id === selectedDoorId) ?? null : null;
  const deck = useMemo(
    () => (selectedDoor ? rankDeck(coachesForDoor(selectedDoor, coaches), user?.id) : []),
    [selectedDoor, coaches, user?.id],
  );
  // La disponibilidad "esta semana" ahora viene en el cache (`hasSlotThisWeek`,
  // poblado en coachesCache contra la misma vista), así que se fue el fetch
  // aparte que se disparaba con cada cambio de deck.

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
          <SlideInView key={selectedDoorId} style={s.slideFill}>
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
                <Text style={s.deckCloseSub}>Probá con otro tema, o hacé el quiz para una sugerencia</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  key={selectedDoorId}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScrollBeginDrag={() => navigation.setOptions({ swipeEnabled: false })}
                  onScrollEndDrag={() => navigation.setOptions({ swipeEnabled: true })}
                  onMomentumScrollEnd={e => {
                    navigation.setOptions({ swipeEnabled: true });
                    setDeckIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
                  }}
                  scrollEventThrottle={16}>
                  {deck.map((entry) => {
                    const { coach, slot } = entry;
                    const isFav = favoriteIds.has(coach.id);
                    const reason = REASON_STYLES[slot.key];
                    return (
                      <View key={coach.id} style={s.cardPage}>
                        <SurfaceCard
                          variant="elevated"
                          tone="light"
                          backgroundColor={CARD}
                          borderRadius={20}
                          grainOpacity={0.045}
                          style={s.cardSurface}>
                          <View style={s.cardBody}>
                            {/* Fila superior: solo el favorito. Nada más arriba —
                                sin eyebrow suelto, sin contador "i/N" (los puntitos
                                de paginación siguen a nivel pantalla, debajo). */}
                            <View style={s.cardTop}>
                              <TouchableOpacity
                                onPress={() => toggleFav(coach.id)}
                                hitSlop={10}
                                activeOpacity={0.7}>
                                <Feather name="star" size={16} color={FOREST_SOFT} style={isFav ? undefined : s.starOff} />
                              </TouchableOpacity>
                            </View>

                            {/* Avatar con halo cálido + anillo durazno + badge de
                                verificación — card-otras-estructuras.html §B2. RN no
                                tiene radial-gradient nativo: el halo se aproxima con
                                un círculo semitransparente en vez de un degradé real
                                con caída hacia afuera. */}
                            <View style={s.avatarWrap}>
                              <View style={s.avatarGlow} />
                              <View style={s.avatarRing} />
                              {coach.avatarUrl ? (
                                <Image source={{ uri: coach.avatarUrl }} style={s.cardAvatar} />
                              ) : (
                                <View style={[s.cardAvatar, s.cardAvatarFallback]}>
                                  <Text style={s.cardInitials}>{getInitials(coach.name)}</Text>
                                </View>
                              )}
                              {coach.verified && (
                                <View style={s.vBadge}><Feather name="check" size={10} color="#F3EEDF" /></View>
                              )}
                            </View>

                            <Text style={s.cardName} numberOfLines={1}>{coach.name}</Text>
                            <Text style={s.cardMeta} numberOfLines={1}>
                              {coach.specialty}
                              {(coach.reviewCount ?? 0) >= 1 ? (
                                <Text>
                                  {'  ·  '}
                                  <Text style={{ color: STAR }}>★ </Text>
                                  {(coach.avgRating ?? 0).toFixed(1)}
                                </Text>
                              ) : (
                                '  ·  Sin reseñas todavía'
                              )}
                            </Text>

                            {/* Pill de motivo — por qué esta persona está en el
                                carrusel. Mismo dato que antes pintaba la banda
                                sólida de arriba (lib/coachDeckRanking.ts), ahora
                                como pill chica integrada al cuerpo de la card. */}
                            <View style={[s.reasonPill, { backgroundColor: reason.bg }]}>
                              <Feather name={slot.icon as any} size={11} color={reason.text} />
                              <Text style={[s.reasonText, { color: reason.text }]}>{slot.label}</Text>
                            </View>

                            {/* Con qué se le puede pagar. `compact` porque la
                                card del deck es angosta y ya tiene el pill de
                                motivo arriba: con tres cartelitos más la fila se
                                parte y desordena el cuerpo. */}
                            <PaymentBadges
                              mp={coach.acceptsMp}
                              paypal={coach.acceptsPaypal}
                              usdt={coach.acceptsUsdt}
                              compact
                            />

                            <View style={s.dots3}>
                              <View style={s.dot3} />
                              <View style={s.dot3} />
                              <View style={s.dot3} />
                            </View>

                            {!!coach.bio && (
                              <Text style={s.cardBio} numberOfLines={2}>“{coach.bio.trim()}”</Text>
                            )}

                            <TouchableOpacity
                              style={s.knowBtn}
                              onPress={() => goToPerfil(coach)}
                              activeOpacity={0.75}>
                              <Text style={s.knowText}>Conocer a {coach.name.split(' ')[0]}</Text>
                            </TouchableOpacity>
                          </View>
                        </SurfaceCard>
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
          </SlideInView>
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
          description="Elegí un tema y te presento a los profesionales indicados. Lo cambiás cuando quieras"
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
              <TouchableOpacity
                onPress={() => (user ? router.push('/notifications') : requestAuth())}
                activeOpacity={0.7}
                hitSlop={8}
                style={s.bellBtn}>
                <MaterialCommunityIcons name={unreadCount > 0 ? 'bell' : 'bell-outline'} size={22} color={FOREST} />
                {unreadCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (user ? router.push('/favoritos') : requestAuth())}
                activeOpacity={0.7}
                hitSlop={8}>
                <Feather name="star" size={22} color={FOREST} />
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
            <SlideInView key={selectedAxis.id}>
              <TouchableOpacity onPress={backToAxes} activeOpacity={0.7} hitSlop={8} style={s.menuBackRow}>
                <Feather name="chevron-left" size={18} color={FOREST_SOFT} />
                <Text style={s.menuBackText}>Áreas de bienestar</Text>
              </TouchableOpacity>

              <View style={s.askWrap}>
                <Text style={s.askTitle}>{selectedAxis.label}</Text>
                <Text style={s.askSub}>Elegí un tema y te presento a los profesionales indicados</Text>
              </View>

              <View style={s.doorsWrap}>
                {doorsForEje(selectedAxis).map(d => (
                  <ScaleCard
                    key={d.id}
                    style={s.doorCard}
                    onPress={() => openDoor(d.id)}>
                    <View style={[s.doorIcon, { backgroundColor: tint(d.color, 0.16) }]}>
                      <Feather name={d.icon as any} size={20} color={d.color} />
                    </View>
                    <View style={s.doorTextWrap}>
                      <Text style={s.doorTitle} numberOfLines={1}>{d.label}</Text>
                      <Text style={s.doorTagline} numberOfLines={1}>{d.tagline}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                  </ScaleCard>
                ))}
              </View>
            </SlideInView>
          ) : (
            /* ── Fase 1: ejes de bienestar ──────────────────────────────── */
            <SlideInView key="fase1">
              <View style={[s.askWrap, s.askWrapTight]}>
                <Text style={[s.askSub, s.askSubBig]}>Elegí un área de bienestar para empezar</Text>
              </View>

              {/* Búsqueda por nombre — en vivo sobre el cache de coaches */}
              <View style={s.searchBar}>
                <Feather name="search" size={18} color={FOREST_SOFT} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Buscá un profesional por nombre"
                  placeholderTextColor={tint(FOREST, 0.45)}
                  value={coachQuery}
                  onChangeText={setCoachQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {coachQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCoachQuery('')} hitSlop={8} activeOpacity={0.7}>
                    <Feather name="x" size={18} color={FOREST_SOFT} />
                  </TouchableOpacity>
                )}
              </View>

              {coachQuery.trim().length > 0 ? (
                /* Resultados de búsqueda por nombre */
                coachResults.length > 0 ? (
                  <View style={s.resultsWrap}>
                    {coachResults.map(coach => (
                      <ScaleCard
                        key={coach.id}
                        style={s.resultRow}
                        onPress={() => goToPerfil(coach)}>
                        {coach.avatarUrl ? (
                          <Image source={{ uri: coach.avatarUrl }} style={s.resultAvatar} />
                        ) : (
                          <View style={[s.resultAvatar, s.resultAvatarFallback]}>
                            <Text style={s.resultInitials}>{getInitials(coach.name)}</Text>
                          </View>
                        )}
                        <View style={s.resultText}>
                          <Text style={s.resultName} numberOfLines={1}>{coach.name}</Text>
                          {coach.specialty ? (
                            <Text style={s.resultSpecialty} numberOfLines={1}>{coach.specialty}</Text>
                          ) : null}
                        </View>
                        <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                      </ScaleCard>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noResults}>No encontramos profesionales con ese nombre</Text>
                )
              ) : (
                <View style={s.menuWrap}>
                  {EJES.map(e => (
                    <ScaleCard
                      key={e.id}
                      style={[s.menuCard, { backgroundColor: tint(e.color, 0.18) }]}
                      onPress={() => selectAxis(e.id)}
                      accessibilityLabel={`${e.label}. ${e.tagline}`}>
                      <Feather name={e.icon as any} size={30} color={e.color} />

                      {/* "Bienestar" va chico y arriba: lo comparten los tres, así
                          que es la parte muda del nombre. Lo que distingue va
                          grande. Entero en una línea no entra en una columna de
                          ~110pt sin perder el cuerpo que le da carácter. */}
                      <Text style={s.menuKicker}>Bienestar</Text>
                      {/* ⚠️ Una sola línea, achicándose si hace falta.
                          "Espiritual" a 18px ocupa casi los 90pt de ancho útil
                          de la columna en una pantalla de 390, y en una de 320
                          (SE) no entra: sin esto se partiría en dos renglones y
                          las tres tarjetas quedarían desparejas. */}
                      <Text style={s.menuTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {e.corto}
                      </Text>

                      <Text style={s.menuTagline}>{e.tagline}</Text>

                      {/* Empujada al fondo con `marginTop: auto`: las bajadas
                          ocupan dos o tres líneas según el eje, y sin esto las
                          tres flechas quedaban a alturas distintas. */}
                      <View style={[s.menuArrow, { borderColor: tint(e.color, 0.55) }]}>
                        <Feather name="arrow-right" size={17} color={e.color} />
                      </View>
                    </ScaleCard>
                  ))}
                </View>
              )}
            </SlideInView>
          )}

          {/* ── Teaser del quiz de orientación ─────────────────────────── */}
          <ScaleCard style={s.quizWrap} onPress={() => router.push('/quiz')}>
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
                <Text style={s.quizSub}>Respondé unas preguntas y te orientamos</Text>
              </View>
              <Text style={s.quizArrow}>›</Text>
            </LinearGradient>
          </ScaleCard>

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
  slideFill:     { flex: 1 },

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
    fontFamily: ViveFonts.title,
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
  // Búsqueda por nombre
  // marginTop: 11 — medido contra la barra "Hoy: ..." de recursos.tsx
  // (detectando el borde del pill, no el texto): 28px de diferencia real
  // sobre la captura @3x = 28/3 ≈ 9pt. 2 (valor previo) + 9 = 11.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 11,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 23,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
  },
  searchInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: FOREST,
    padding: 0,
  },
  resultsWrap: {
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tint(FOREST, 0.1),
  },
  resultAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInitials: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: FOREST,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: FOREST,
  },
  resultSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },
  noResults: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: FOREST_SOFT,
    paddingHorizontal: 20,
    marginTop: 24,
    textAlign: 'center',
  },
  askWrap: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 18,
  },
  // Sesión 121: en Fase 1 el buscador quedaba pegado al subtítulo. Sesión 126:
  // se sacó el título propio de Fase 1 ("Encontrá a alguien que pueda
  // acompañarte", pedido de Joaquín), así que hoy `askWrap` en Fase 1 contiene
  // solo el subtítulo. Sesión 128: con Plus Jakarta Sans (más "aire" propio
  // que Fraunces para el mismo lineHeight — métrica de la fuente, no un
  // margen nuestro) el bloque entero volvió a sentirse separado del buscador
  // y las cards de abajo — se achicó `marginTop` acá (antes heredaba el 10 de
  // `askWrap`) además del `marginBottom`, para traer el CONTENIDO hacia el
  // título sin tocar el título en sí.
  // marginTop: 2 — el -36 anterior fue un error de UNIDADES, no de la
  // relación entre pantallas: las capturas del iPhone son @3x (1290px =
  // 430pt), y los píxeles medidos sobre la captura se venían restando
  // directo al `marginTop`, que es en PUNTOS. Con dos mediciones reales
  // (marginTop -8 → gap 54px=18pt; marginTop 21 → gap 141px=47pt) la
  // relación es exactamente lineal 1:1 EN PUNTOS (gap_pt = marginTop + 26) —
  // el "3:1" que parecía haber no era la fuente, era no dividir por la
  // densidad de la pantalla. Objetivo: 84px = 28pt (recursos.tsx) →
  // marginTop = 28 − 26 = 2.
  askWrapTight: {
    marginTop: 2,
    marginBottom: 2,
  },
  // Título de Fase 2 (nombre del eje elegido) — Fase 1 ya no tiene título propio.
  askTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 26,
    color: FOREST,
    lineHeight: 32,
  },
  // Mismo estilo que "Herramientas de Vita" en recursos.tsx (sectionTitle),
  // pedido explícito — solo para Fase 1 ("Elegí un área de bienestar para
  // empezar"), no para el subtítulo de Fase 2, que sigue con el estilo chico.
  askSubBig: {
    fontFamily: ViveFonts.title,
    fontSize: 20,
    color: FOREST,
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
  // ── Puertas / temas (fase 2) ─────────────────────────────────────────────
  // Filas horizontales. Es el diseño que tenían también los ejes hasta el
  // 27/08/2026; acá se queda porque son hasta 6 ítems de largo variable y en
  // columnas no entrarían.
  doorsWrap: {
    paddingHorizontal: 20,
    gap: 10,
  },
  doorCard: {
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
  doorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doorTextWrap: { flex: 1, minWidth: 0 },
  doorTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: INK,
  },
  doorTagline: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },

  // ── Ejes de bienestar (fase 1) ───────────────────────────────────────────
  // 🔴 Rediseño 27/08/2026. Antes eran tres filas horizontales idénticas — el
  // patrón de lista que sirve igual para "Configuración" o "Ayuda", con el color
  // del eje metido en un círculo de 48px, o sea el 3% de la superficie de la
  // tarjeta. Ahora son tres columnas y el color ES la tarjeta.
  //
  // 📝 Sin sombra ni borde a propósito: el color de fondo ya separa cada columna
  // del crema, y agregarle sombra encima las volvía tres objetos flotando en vez
  // de una sola composición de tres partes.
  menuWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  menuCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 24,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 10,
    // El alto lo fija esta línea y no el contenido: sin ella la tarjeta mide lo
    // que miden sus partes (~236pt) y queda chata. El aire extra cae entre la
    // bajada y la flecha, porque la flecha va anclada abajo.
    //
    // 🔴 Sale del ancho de pantalla, NO es un número fijo. Con 354 clavado la
    // proporción se deformaba en los dos sentidos —4,08:1 en un SE contra
    // 2,87:1 en un 15 Pro Max— porque el ancho de la columna sí es proporcional
    // (`flex: 1`) y el alto no. Ver `lib/ejesLayout.ts`.
    //
    // ⚠️ `SCREEN_W` se lee una vez al cargar el módulo, como el resto de este
    // archivo: no se recalcula al rotar. Es la limitación que ya tenía
    // `cardPage`, no una nueva.
    minHeight: altoDeEje(SCREEN_W),
  },
  menuKicker: {
    fontFamily: ViveFonts.medium,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: FOREST_SOFT,
    marginTop: 20,
  },
  menuTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 18,
    lineHeight: 24,
    color: INK,
    textAlign: 'center',
  },
  menuTagline: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginTop: 8,
  },
  menuArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 2,
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
    fontFamily: ViveFonts.title,
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
  // Rediseño 24/08/2026 (card-otras-estructuras.html §B2) — el contenedor con
  // sombra/grano/borde-gradiente ahora lo da SurfaceCard (mismo tratamiento
  // que "Sobre vos"), no el `cardWrap`/`shadow` local que tenía antes (`shadow`
  // sigue en uso en otras cards de este archivo, no se tocó).
  cardSurface: {},
  // ── Cuerpo (todo centrado, de arriba a abajo) ─────────────────────────────
  cardBody: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' },

  cardTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  starOff: { opacity: 0.55 },

  // Avatar 76px con halo cálido + anillo durazno — HTML: .avwrap 76×76,
  // .glow inset:-16 (108×108), .ring inset:-5 (86×86).
  avatarWrap: { width: 76, height: 76, marginTop: 6, position: 'relative' },
  avatarGlow: {
    position: 'absolute',
    top: -16, left: -16, right: -16, bottom: -16,
    borderRadius: 54,
    // RN no tiene radial-gradient: se aproxima con un círculo semitransparente
    // (el HTML usa radial-gradient(rgba(192,107,74,.28), transparent 70%)).
    backgroundColor: 'rgba(192,107,74,0.16)',
  },
  avatarRing: {
    position: 'absolute',
    top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 43,
    borderWidth: 1.5,
    borderColor: TC_SOFT,
  },
  cardAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarFallback: { backgroundColor: 'rgba(107,122,86,0.18)' },
  cardInitials: { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST },
  vBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: FOREST,
    borderWidth: 2,
    borderColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardName: {
    fontFamily: ViveFonts.titleSemiBold, // Jakarta 600 — antes Fraunces 600, HTML §B2
    fontSize: 20,
    lineHeight: 24,
    color: FOREST,
    marginTop: 12,
  },
  // Rol + rating en una sola línea, sin conteo de reseñas (eso queda para el
  // perfil detallado) — reemplaza a cardRole+cardRating, que eran dos líneas.
  cardMeta: { fontFamily: ViveFonts.medium, fontSize: 11, color: FOREST_SOFT, marginTop: 3 },

  // Pill de motivo — ícono + texto, no banda. Colores en REASON_STYLES.
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 11,
    marginTop: 10,
  },
  reasonText: { fontFamily: ViveFonts.bold, fontSize: 10 },

  // Separador de tres puntos en vez de línea recta.
  dots3: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 13, marginBottom: 13 },
  dot3: { width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: TERRACOTTA, opacity: 0.6 },

  cardBio: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    fontStyle: 'italic',
    color: INK,
    opacity: 0.85,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  // Pill con borde, no relleno sólido — reemplaza al botón ancho de antes.
  knowBtn: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: FOREST,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  knowText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: FOREST },

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
