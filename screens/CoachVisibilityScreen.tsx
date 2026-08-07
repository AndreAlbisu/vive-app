import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { loadCoaches, type CachedCoach } from '@/lib/coachesCache';
import {
  analyzeDoors,
  buildChecklist,
  blockingReason,
  isNewCoach,
  NEW_MAX_REVIEWS,
  NEW_MAX_AGE_DAYS,
  MIN_DECK_SIZE,
  type DoorStanding,
  type ChecklistItem,
  type SlotStanding,
  type VisibilitySelf,
} from '@/lib/coachVisibility';

// Misma paleta que CoachHomeScreen (docs/coach-app-interactivo.html).
const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const TERRA_SOFT = '#EAD3C6';
const OK_BG = '#DCE5CB';
const OK_INK = '#42542F';
const LINE = 'rgba(63,81,47,0.14)';
const GREEN_TXT = '#F3EEDF';
const GREEN_EYEBROW = '#C9CFAF';

const STATUS_STYLE: Record<SlotStanding['status'], { bg: string; ink: string; label: string }> = {
  ganado:    { bg: OK_BG,      ink: OK_INK,    label: 'Es tuyo' },
  rotando:   { bg: TERRA_SOFT, ink: '#8C4A31', label: 'Entrás al sorteo' },
  bloqueado: { bg: 'transparent', ink: 'rgba(107,122,86,0.65)', label: 'Te falta' },
};

type Loaded = {
  self: VisibilitySelf;
  doors: DoorStanding[];
  checklist: ChecklistItem[];
  blocked: ChecklistItem | null;
  inCatalog: boolean;
};

export default function CoachVisibilityScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noCoach, setNoCoach] = useState(false);
  const [openDoor, setOpenDoor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data: coachRow } = await supabase
      .from('coaches')
      .select('id, created_at, specialty, bio, price_per_session, nationality, verified, availability_status, video_url, instant_booking')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!coachRow) { setNoCoach(true); setLoading(false); return; }

    const coachId = coachRow.id as string;

    const [{ data: profile }, { data: topicRows }, { data: reviewRows }, { data: trendRows }, { data: rebookRow }, { data: availRows }, pool] =
      await Promise.all([
        supabase.from('profiles').select('name, avatar_url, gender').eq('id', user.id).maybeSingle(),
        supabase.from('coach_topics').select('topic').eq('coach_id', coachId),
        supabase.from('reviews').select('rating').eq('reviewed_id', user.id).eq('is_private', false),
        supabase.from('coach_trending_stats').select('recent_bookers').eq('coach_id', coachId).maybeSingle(),
        supabase.from('coach_rebooking_stats').select('rebooking_rate, completadas_count').eq('coach_id', coachId).maybeSingle(),
        supabase.from('coach_availability_status').select('status').eq('coach_id', coachId).maybeSingle(),
        loadCoaches(),
      ]);

    const ratings = (reviewRows ?? []).map((r: any) => r.rating as number);
    const reviewCount = ratings.length;

    const self: VisibilitySelf = {
      id: user.id,
      coachId,
      createdAt: (coachRow.created_at ?? null) as string | null,
      name: (profile?.name as string) ?? '',
      specialty: (coachRow.specialty as string) ?? '',
      priceFrom: (coachRow.price_per_session ?? 0) as number,
      nationality: (coachRow.nationality ?? '') as string,
      gender: (profile?.gender ?? '') as string,
      avatarUrl: (profile?.avatar_url ?? null) as string | null,
      bio: (coachRow.bio ?? null) as string | null,
      topics: (topicRows ?? []).map((t: any) => t.topic as string),
      verified: !!coachRow.verified,
      avgRating: reviewCount > 0 ? ratings.reduce((a, b) => a + b, 0) / reviewCount : null,
      reviewCount,
      rebookingRate: (rebookRow?.rebooking_rate ?? null) as number | null,
      completadasCount: (rebookRow?.completadas_count ?? 0) as number,
      recentBookers: (trendRows?.recent_bookers ?? 0) as number,
      availabilityStatus: (coachRow.availability_status ?? 'activo') as 'activo' | 'en_pausa',
      hasSlotThisWeek: availRows?.status === 'this_week',
      hasVideo: !!coachRow.video_url,
      instantBooking: !!coachRow.instant_booking,
    };

    const checklist = buildChecklist(self);
    setData({
      self,
      doors: analyzeDoors(self, pool),
      checklist,
      blocked: blockingReason(checklist),
      inCatalog: (pool as CachedCoach[]).some(c => c.id === user.id),
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const header = (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
        <MaterialIcons name="arrow-back-ios" size={18} color={FOREST} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>Cómo aparecer</Text>
      <View style={s.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <AppBg>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={s.safe} edges={['top']}>
          {header}
          <View style={s.center}><ActivityIndicator size="small" color={FOREST} /></View>
        </SafeAreaView>
      </AppBg>
    );
  }

  if (noCoach || !data) {
    return (
      <AppBg>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={s.safe} edges={['top']}>
          {header}
          <View style={s.center}>
            <Text style={s.emptyTxt}>Todavía no completaste tu perfil de profesional</Text>
          </View>
        </SafeAreaView>
      </AppBg>
    );
  }

  const { self, doors, checklist, blocked, inCatalog } = data;
  const winnable = doors.filter(d => d.best).length;
  const pending = checklist.filter(i => !i.done);

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        {header}
        <ScrollView
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={FOREST} colors={[FOREST]} />}>

          {/* Estado general */}
          <View style={s.hero}>
            <View style={s.heroGlow} pointerEvents="none" />
            <Text style={s.heroEyebrow}>Tu lugar en Conexiones</Text>
            {blocked ? (
              <>
                <Text style={s.heroTitle}>Hoy no aparecés</Text>
                <Text style={s.heroSub}>{blocked.hint}</Text>
                {blocked.route && (
                  <TouchableOpacity style={s.heroBtn} activeOpacity={0.85} onPress={() => router.push(blocked.route as any)}>
                    <Text style={s.heroBtnTxt}>{blocked.label}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={s.heroTitle}>
                  {winnable > 0
                    ? `Entrás al sorteo en ${winnable} de ${doors.length} ${doors.length === 1 ? 'puerta' : 'puertas'}`
                    : `Aparecés en ${doors.length} ${doors.length === 1 ? 'puerta' : 'puertas'}`}
                </Text>
                <Text style={s.heroSub}>
                  Cada puerta tiene 4 lugares. No los gana el mejor de la lista: entran todos los que cruzan la
                  barra y se sortea entre ellos, distinto para cada persona y cada día. Ocupás el lugar más alto
                  para el que califiques.
                </Text>
              </>
            )}
          </View>

          {!blocked && !inCatalog && (
            <View style={s.note}>
              <Feather name="clock" size={13} color={FOREST_SOFT} />
              <Text style={s.noteTxt}>
                Todavía no te vemos en el catálogo público. Lo de abajo es la proyección de dónde entrarías.
              </Text>
            </View>
          )}

          {/* Puertas */}
          {doors.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyCardTitle}>No elegiste temas todavía</Text>
              <Text style={s.emptyCardTxt}>
                Los temas deciden en qué puertas competís. Es lo que más te conviene resolver primero: podés
                elegir una puerta con menos coaches y ocupar un lugar desde el día uno.
              </Text>
              <TouchableOpacity style={s.emptyCardBtn} activeOpacity={0.85} onPress={() => router.push('/coach-topics')}>
                <Text style={s.emptyCardBtnTxt}>Elegir temas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.sectionTitle}>Tus puertas</Text>
              {doors.map(d => {
                const expanded = openDoor === d.door.id;
                const badge = d.best ? STATUS_STYLE[d.best.status] : null;
                return (
                  <View key={d.door.id} style={s.doorCard}>
                    <TouchableOpacity
                      style={s.doorHead}
                      activeOpacity={0.8}
                      onPress={() => setOpenDoor(expanded ? null : d.door.id)}>
                      <View style={[s.doorIcon, { backgroundColor: d.door.color }]}>
                        <Feather name={d.door.icon as any} size={15} color="#FFF6EC" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.doorLabel}>{d.door.label}</Text>
                        <Text style={s.doorSub}>
                          {d.total} {d.total === 1 ? 'coach' : 'coaches'}
                          {` · ${d.best ? d.best.slot.label : d.fallback.label}`}
                        </Text>
                      </View>
                      {badge && (
                        <View style={[s.pill, { backgroundColor: badge.bg }]}>
                          <Text style={[s.pillTxt, { color: badge.ink }]}>{badge.label}</Text>
                        </View>
                      )}
                      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={FOREST_SOFT} />
                    </TouchableOpacity>

                    {expanded && (
                      <View style={s.slots}>
                        <View style={s.fallbackRow}>
                          <Feather name={d.fallback.icon as any} size={13} color={FOREST_SOFT} />
                          <Text style={s.fallbackTxt}>
                            {d.best
                              ? `Si el lugar de arriba se lo lleva otro, igual entrás como "${d.fallback.label}".`
                              : `Aunque hoy no llegues a ninguna barra, entrás como "${d.fallback.label}" — la puerta nunca muestra menos de ${MIN_DECK_SIZE}.`}
                          </Text>
                        </View>
                        {d.slots.map(st => {
                          const style = STATUS_STYLE[st.status];
                          const off = st.status === 'bloqueado';
                          return (
                            <View key={st.slot.key} style={s.slotRow}>
                              <Feather
                                name={st.slot.icon as any}
                                size={14}
                                color={off ? 'rgba(107,122,86,0.5)' : FOREST}
                                style={s.slotIcon}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={s.slotHead}>
                                  <Text style={[s.slotLabel, off && s.slotLabelOff]}>{st.slot.label}</Text>
                                  <View style={[s.pillSm, { backgroundColor: style.bg }, off && s.pillSmOff]}>
                                    <Text style={[s.pillSmTxt, { color: style.ink }]}>{style.label}</Text>
                                  </View>
                                </View>
                                <Text style={[s.slotDetail, off && s.slotDetailOff]}>{st.detail}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Checklist */}
          <Text style={s.sectionTitle}>
            Lo que depende de vos{pending.length > 0 ? ` · ${pending.length} pendiente${pending.length === 1 ? '' : 's'}` : ''}
          </Text>
          <View style={s.list}>
            {checklist.map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[s.item, i > 0 && s.itemBorder]}
                activeOpacity={item.route && !item.done ? 0.75 : 1}
                disabled={!item.route || item.done}
                onPress={() => item.route && router.push(item.route as any)}>
                <View style={[s.check, item.done && s.checkDone, !item.done && item.blocking && s.checkBlocking]}>
                  {item.done && <Feather name="check" size={12} color="#FFF6EC" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemLabel, item.done && s.itemLabelDone]}>{item.label}</Text>
                  {!item.done && <Text style={s.itemHint}>{item.hint}</Text>}
                </View>
                {!item.done && item.route && <Feather name="chevron-right" size={16} color={FOREST_SOFT} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Recursos — el carril que no pasa por el deck */}
          <TouchableOpacity
            style={s.altCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/coach-recurso-nuevo', params: { coach_id: self.coachId } } as any)}>
            <Feather name="book-open" size={16} color={TERRA} />
            <View style={{ flex: 1 }}>
              <Text style={s.altTitle}>Publicar un recurso</Text>
              <Text style={s.altTxt}>
                Es la otra puerta de entrada a tu perfil, y no depende del deck ni de tener reseñas: quien abre
                un recurso tuyo puede pasar directo a tu perfil.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={FOREST_SOFT} />
          </TouchableOpacity>

          {isNewCoach(self) && (
            <Text style={s.footNote}>
              Contás como nuevo mientras tengas menos de {NEW_MAX_REVIEWS} reseñas y menos de {NEW_MAX_AGE_DAYS} días
              en Vita. Es una ventana que se cierra sola: aprovechala para conseguir las primeras reseñas, que son
              las que te abren los lugares de arriba.
            </Text>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTxt: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  headerTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18, color: FOREST, textAlign: 'center', letterSpacing: -0.2 },
  headerSpacer: { width: 36 },

  // Hero
  hero: { backgroundColor: '#3E4E2C', borderRadius: 24, padding: 18, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute', right: -40, top: -46, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(234,211,198,0.10)',
  },
  heroEyebrow: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: GREEN_EYEBROW, fontFamily: ViveFonts.medium },
  heroTitle: { fontFamily: ViveFonts.frauncesSerif, fontSize: 21, color: GREEN_TXT, marginTop: 8, lineHeight: 28 },
  heroSub: { fontSize: 12, color: GREEN_EYEBROW, fontFamily: ViveFonts.regular, marginTop: 8, lineHeight: 19 },
  heroBtn: { backgroundColor: TERRA, borderRadius: 15, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  heroBtnTxt: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  noteTxt: { flex: 1, fontSize: 11.5, color: FOREST_SOFT, fontFamily: ViveFonts.regular, lineHeight: 17 },

  sectionTitle: {
    fontFamily: ViveFonts.medium, fontSize: 11, color: FOREST_SOFT, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 24, marginBottom: 10, paddingHorizontal: 2,
  },

  // Puertas
  doorCard: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20, marginBottom: 10, overflow: 'hidden' },
  doorHead: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
  doorIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  doorLabel: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  doorSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT, marginTop: 2 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  pillTxt: { fontSize: 10, fontFamily: ViveFonts.semibold },

  slots: { borderTopWidth: 1, borderTopColor: LINE, paddingHorizontal: 14, paddingVertical: 4 },
  fallbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 11, paddingBottom: 3 },
  fallbackTxt: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17 },
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11 },
  slotIcon: { marginTop: 2 },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotLabel: { fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST },
  slotLabelOff: { color: 'rgba(107,122,86,0.72)' },
  pillSm: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  pillSmOff: { borderWidth: 1, borderColor: LINE },
  pillSmTxt: { fontSize: 9.5, fontFamily: ViveFonts.semibold },
  slotDetail: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17, marginTop: 3 },
  slotDetailOff: { color: 'rgba(107,122,86,0.6)' },

  // Empty (sin temas)
  emptyCard: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20, padding: 18, marginTop: 16 },
  emptyCardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST },
  emptyCardTxt: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, lineHeight: 19, marginTop: 7 },
  emptyCardBtn: { backgroundColor: FOREST, borderRadius: 15, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  emptyCardBtnTxt: { color: GREEN_TXT, fontSize: 12.5, fontFamily: ViveFonts.semibold },

  // Checklist
  list: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 13 },
  itemBorder: { borderTopWidth: 1, borderTopColor: LINE },
  check: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.22)', backgroundColor: 'transparent',
  },
  checkDone: { backgroundColor: OK_INK, borderColor: OK_INK },
  checkBlocking: { borderColor: TERRA },
  itemLabel: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  itemLabelDone: { color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  itemHint: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17, marginTop: 3 },

  // Recursos
  altCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 15,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
  },
  altTitle: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  altTxt: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17, marginTop: 3 },

  footNote: {
    fontFamily: ViveFonts.regular, fontSize: 11, color: 'rgba(107,122,86,0.85)',
    lineHeight: 17, marginTop: 16, paddingHorizontal: 4,
  },
});
