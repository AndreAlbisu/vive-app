import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  StatusBar, TextInput, Image, Dimensions, ActivityIndicator,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';

import {
  ViveFonts, ResourceFormatColors, ResourceFormatLabels, resourceFormatGradient,
} from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DOORS } from '@/constants/conexionesDoors';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.79);
const CARD_GAP = 14;
const SNAP = CARD_W + CARD_GAP;

const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRACOTTA = '#C06B4A';
const CREAM_LIGHT = '#F3EEDF';

const FORMAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'mic-outline', podcast: 'musical-notes-outline', video: 'videocam-outline', lectura: 'book-outline',
};
const FORMAT_DESC: Record<string, string> = {
  audio:   'Prácticas guiadas para hacer ahora',
  podcast: 'Para escuchar mientras hacés otra cosa',
  video:   'Técnicas explicadas paso a paso',
  lectura: 'Textos breves para pensar',
};

type Resource = {
  id: string;
  title: string;
  format: string;
  topic_id: string;
  duration_seconds: number | null;
  author: string;
};

function displayTitle(t: string) { return t.replace(/^\[SEED\]\s*/, ''); }
function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}
function topicLabel(id: string): string {
  return DOORS.find(d => d.id === id)?.label ?? id;
}
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Grano de papel a ~9% — misma técnica que SurfaceCard (patrón SVG de puntos,
// sin PNG externo), como overlay sobre el gradiente de color de la card.
const GRAIN_TILE = 48;
const GRAIN_DOTS = Array.from({ length: 42 }, () => ({
  x: Math.random() * GRAIN_TILE, y: Math.random() * GRAIN_TILE,
  r: 0.35 + Math.random() * 0.7, o: 0.15 + Math.random() * 0.4,
}));
function Grain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={{ opacity: 0.09 }}>
        <Defs>
          <Pattern id="g" patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
            {GRAIN_DOTS.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#000" fillOpacity={d.o} />)}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}

export default function FormatoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Reduced-motion: el deck es scroll manual sin animaciones de entrada ni
  // auto-scroll, así que no hay transición que gatear — se respeta por
  // construcción. Si se sumara alguna animación, gatearla con useReducedMotion.
  const params = useLocalSearchParams<{ formato?: string }>();
  const formato = (Array.isArray(params.formato) ? params.formato[0] : params.formato) ?? 'audio';

  const color = ResourceFormatColors[formato] ?? TERRACOTTA;
  const label = ResourceFormatLabels[formato] ?? formato;

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [recoByResource, setRecoByResource] = useState<Record<string, string>>({});
  const [coach, setCoach] = useState<{ salaId: string; name: string; avatarUrl: string | null } | null>(null);

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [listView, setListView] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  const maxPosLogged = useRef(0);

  // ── formato_abierto (una vez al montar) ────────────────────────────────────
  useEffect(() => {
    registrarEvento('formato_abierto', { formato }).catch(() => {});
  }, [formato]);

  // ── Recursos del formato + guardados + completados + recos + coach ──────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('coach_resources')
        .select('id, title, format, topic_id, duration_seconds, coaches!inner(profiles!inner(name))')
        .eq('status', 'published')
        .eq('format', formato)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setResources((data ?? []).map((r: any) => ({
        id: r.id, title: r.title, format: r.format, topic_id: r.topic_id,
        duration_seconds: r.duration_seconds,
        author: r.coaches?.profiles?.name ?? 'un profesional',
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [formato]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [saves, olderSaves, events, recos, salas] = await Promise.all([
        supabase.from('resource_saves').select('resource_id').eq('user_id', user.id),
        supabase.from('saved_resources').select('resource_id').eq('user_id', user.id),
        supabase.from('resource_events').select('resource_id').eq('user_id', user.id).eq('event', 'complete'),
        supabase.from('resource_recommendations').select('resource_id, coaches!inner(profiles!inner(name))').eq('user_id', user.id),
        supabase.from('salas').select('id, coach_id, profiles!salas_coach_id_fkey(name, avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;

      const s = new Set<string>();
      (saves.data ?? []).forEach(r => s.add(r.resource_id as string));
      (olderSaves.data ?? []).forEach(r => s.add(r.resource_id as string));
      setSavedIds(s);

      setCompletedIds(new Set((events.data ?? []).map(r => r.resource_id as string)));

      const rmap: Record<string, string> = {};
      (recos.data ?? []).forEach((r: any) => {
        rmap[r.resource_id as string] = r.coaches?.profiles?.name ?? 'tu profesional';
      });
      setRecoByResource(rmap);

      const sala = (salas.data ?? [])[0] as any;
      if (sala) {
        const prof = sala.profiles;
        setCoach({ salaId: sala.id as string, name: prof?.name ?? 'tu profesional', avatarUrl: prof?.avatar_url ?? null });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Temas presentes en este formato (para los chips) ───────────────────────
  const topics = useMemo(() => {
    const ids = [...new Set(resources.map(r => r.topic_id))];
    return ids.map(id => ({ id, label: topicLabel(id) }));
  }, [resources]);

  // ── Deck filtrado (tema + búsqueda) ────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = resources;
    if (selectedTopic) out = out.filter(r => r.topic_id === selectedTopic);
    const q = norm(searchText.trim());
    if (q) out = out.filter(r => norm(displayTitle(r.title)).includes(q));
    return out;
  }, [resources, selectedTopic, searchText]);

  // ── Progreso del formato (sobre TODOS los del formato, no el filtro) ───────
  const total = resources.length;
  const done = resources.filter(r => completedIds.has(r.id)).length;
  const totalMin = Math.round(resources.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60);

  async function toggleSave(id: string) {
    const isSaved = savedIds.has(id);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(id); else next.add(id);
      return next;
    });
    if (!user) return;
    if (isSaved) await supabase.from('resource_saves').delete().eq('user_id', user.id).eq('resource_id', id);
    else await supabase.from('resource_saves').insert({ user_id: user.id, resource_id: id });
  }

  function openResource(id: string) {
    router.push({ pathname: '/coach-recurso', params: { id } } as any);
  }

  function contextLine(r: Resource): string {
    // Prioridad del brief SIN la opción "a medias" (no hay progreso parcial para
    // coach_resources) y sin "el sistema lo eligió" (no hay motivo por recurso —
    // useRecommendedResource da uno global, no atado a coach_resources).
    if (recoByResource[r.id]) return `Te lo recomendó ${recoByResource[r.id]}`;
    return topicLabel(r.topic_id);
  }

  function onDeckScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    setDeckIndex(idx);
    // deck_deslizado: solo la posición MÁXIMA por sesión, no cada swipe.
    if (idx > maxPosLogged.current) {
      maxPosLogged.current = idx;
      registrarEvento('deck_deslizado', { formato, posicion: idx }).catch(() => {});
    }
  }

  function openList() {
    setListView(true);
    registrarEvento('vista_lista_abierta', { formato }).catch(() => {});
  }

  function pedirReco() {
    if (!coach) return;
    registrarEvento('recomendacion_pedida_a_coach', { formato }).catch(() => {});
    router.push({ pathname: '/sala', params: { sala_id: coach.salaId } } as any);
  }

  const renderCard = ({ item, index }: { item: Resource; index: number }) => {
    const [from, to] = resourceFormatGradient(formato, index);
    const saved = savedIds.has(item.id);
    return (
      <View style={s.cardWrap}>
        {/* Toda la card es tocable con la animación de escala del resto de la
            app (ScaleCard). El bookmark, como touchable interno, se queda con
            su propio toque; "Empezar" pasa a ser visual (tocar la card abre). */}
        <ScaleCard onPress={() => openResource(item.id)} activeOpacity={0.92}>
          <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
            <Grain />
            {/* Manchas de luz: clara arriba-derecha, oscura abajo-izquierda */}
            <View style={s.blobLight} pointerEvents="none" />
            <View style={s.blobDark} pointerEvents="none" />

            <View style={s.cardTop}>
              <View style={s.durPill}>
                <Ionicons name={FORMAT_ICON[formato] ?? 'book-outline'} size={13} color="#fff" />
                {!!item.duration_seconds && <Text style={s.durPillText}>{fmtDuration(item.duration_seconds)}</Text>}
              </View>
              <TouchableOpacity onPress={() => toggleSave(item.id)} hitSlop={10} activeOpacity={0.8}>
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />

            <Text style={s.cardTitle} numberOfLines={3}>{displayTitle(item.title)}</Text>
            <Text style={s.cardAuthor} numberOfLines={1}>{item.author}</Text>
            <Text style={s.cardContext} numberOfLines={1}>{contextLine(item)}</Text>

            <View style={s.startBtn}>
              <Text style={[s.startBtnText, { color: to }]}>Empezar</Text>
            </View>
          </LinearGradient>
        </ScaleCard>
      </View>
    );
  };

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={FOREST} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{label}</Text>
            <Text style={s.headerCount}>{total} {total === 1 ? 'recurso' : 'recursos'}</Text>
          </View>
          <TouchableOpacity onPress={() => setSearchOpen(v => !v)} hitSlop={8} style={s.headerBtn}>
            <Ionicons name={searchOpen ? 'close' : 'search'} size={21} color={FOREST} />
          </TouchableOpacity>
        </View>

        {searchOpen ? (
          <View style={s.searchRow}>
            <Ionicons name="search" size={17} color={FOREST_SOFT} />
            <TextInput
              style={s.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={`Buscar en ${label.toLowerCase()}…`}
              placeholderTextColor="rgba(107,122,86,0.5)"
              autoFocus
            />
          </View>
        ) : (
          <Text style={s.formatDesc}>{FORMAT_DESC[formato] ?? ''}</Text>
        )}

        {/* Chips de tema */}
        {topics.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            <TouchableOpacity style={[s.chip, !selectedTopic && s.chipActive]} onPress={() => setSelectedTopic(null)} activeOpacity={0.8}>
              <Text style={[s.chipText, !selectedTopic && s.chipTextActive]}>Todos</Text>
            </TouchableOpacity>
            {topics.map(t => {
              const active = selectedTopic === t.id;
              return (
                <TouchableOpacity key={t.id} style={[s.chip, active && s.chipActive]} onPress={() => setSelectedTopic(active ? null : t.id)} activeOpacity={0.8}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <View style={s.loadingBox}><ActivityIndicator color={FOREST} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>
                  {searchText.trim() || selectedTopic ? 'No hay recursos con ese filtro.' : `Todavía no hay ${label.toLowerCase()} en la biblioteca.`}
                </Text>
              </View>
            ) : listView ? (
              // ── Vista de lista ────────────────────────────────────────────
              <View style={s.listWrap}>
                {filtered.map((r, i) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.listRow, i < filtered.length - 1 && s.listRowDivider]}
                    onPress={() => openResource(r.id)}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.listTitle} numberOfLines={1}>{displayTitle(r.title)}</Text>
                      <Text style={s.listMeta} numberOfLines={1}>
                        {topicLabel(r.topic_id)}{r.duration_seconds ? ` · ${fmtDuration(r.duration_seconds)}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleSave(r.id)} hitSlop={10} activeOpacity={0.8}>
                      <Ionicons name={savedIds.has(r.id) ? 'bookmark' : 'bookmark-outline'} size={19} color={FOREST_SOFT} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.backToDeck} onPress={() => setListView(false)} activeOpacity={0.7}>
                  <Ionicons name="albums-outline" size={16} color={TERRACOTTA} />
                  <Text style={s.backToDeckText}>Ver como deck</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Deck */}
                <FlatList
                  data={filtered}
                  keyExtractor={r => r.id}
                  renderItem={renderCard}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={SNAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  disableIntervalMomentum
                  contentContainerStyle={s.deckContent}
                  onMomentumScrollEnd={onDeckScrollEnd}
                  scrollEventThrottle={16}
                />

                {/* Puntitos */}
                {filtered.length > 1 && (
                  <View style={s.dotsRow}>
                    {filtered.map((_, i) => (
                      <View key={i} style={[s.dot, i === deckIndex && s.dotActive]} />
                    ))}
                  </View>
                )}

                {/* Bloques */}
                <View style={s.blocks}>
                  {/* Progreso del formato */}
                  {total > 0 && (
                    <View style={s.block}>
                      <View style={s.blockRow}>
                        <Text style={s.blockTitle}>
                          {formato === 'lectura' ? 'Leíste' : 'Escuchaste'} {done} de {total}
                        </Text>
                        {totalMin > 0 && <Text style={s.blockMeta}>{totalMin} min en total</Text>}
                      </View>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${total ? Math.round((done / total) * 100) : 0}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  )}

                  {/* Ver como lista */}
                  <ScaleCard style={s.block} onPress={openList} activeOpacity={0.9}>
                    <View style={s.blockRow}>
                      <View style={s.blockRowLeft}>
                        <Ionicons name="list-outline" size={18} color={FOREST} />
                        <Text style={s.blockTitle}>Ver como lista</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={FOREST_SOFT} />
                    </View>
                  </ScaleCard>

                  {/* Pedile una reco al coach — solo si tiene sala */}
                  {coach && (
                    <ScaleCard style={s.block} onPress={pedirReco} activeOpacity={0.9}>
                      <View style={s.blockRowLeft}>
                        {coach.avatarUrl ? (
                          <Image source={{ uri: coach.avatarUrl }} style={s.coachAvatar} />
                        ) : (
                          <View style={[s.coachAvatar, s.coachAvatarFallback]}>
                            <Text style={s.coachAvatarText}>{(coach.name[0] ?? '?').toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.blockTitle}>¿No encontrás lo que buscás?</Text>
                          <Text style={s.blockSub} numberOfLines={1}>Pedile una recomendación a {coach.name}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={FOREST_SOFT} />
                      </View>
                    </ScaleCard>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontFamily: ViveFonts.title, fontSize: 24, color: FOREST },
  headerCount: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: -1 },
  formatDesc: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST_SOFT, paddingHorizontal: 20, marginBottom: 12 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: 'rgba(86,94,50,0.10)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST, padding: 0 },

  chipsRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  chip: {
    backgroundColor: 'rgba(255,248,240,0.6)', borderWidth: 1, borderColor: 'rgba(63,81,47,0.14)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipActive: { backgroundColor: FOREST, borderColor: FOREST },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST },
  chipTextActive: { color: CREAM_LIGHT },

  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyBox: { paddingTop: 60, paddingHorizontal: 40, alignItems: 'center' },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center', lineHeight: 21 },

  // Deck
  deckContent: { paddingHorizontal: 20, paddingVertical: 4 },
  cardWrap: { width: CARD_W, marginRight: CARD_GAP },
  card: {
    height: Math.round(CARD_W * 1.28),
    borderRadius: 26, padding: 20, overflow: 'hidden',
  },
  blobLight: {
    position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  blobDark: {
    position: 'absolute', bottom: -60, left: -50, width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  durPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  durPillText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: '#fff' },
  cardTitle: { fontFamily: ViveFonts.title, fontSize: 21, color: '#fff', lineHeight: 27 },
  cardAuthor: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  cardContext: { fontFamily: ViveFonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 10 },
  startBtn: {
    marginTop: 14, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  startBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14.5 },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(63,81,47,0.22)' },
  dotActive: { width: 18, backgroundColor: TERRACOTTA },

  // Bloques
  blocks: { paddingHorizontal: 20, marginTop: 22, gap: 12 },
  block: {
    backgroundColor: 'rgba(255,248,240,0.5)', borderWidth: 1, borderColor: 'rgba(63,81,47,0.12)',
    borderRadius: 18, padding: 16,
  },
  blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  blockTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  blockMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT },
  blockSub: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(63,81,47,0.12)', marginTop: 11, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  coachAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(63,81,47,0.12)' },
  coachAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  coachAvatarText: { fontFamily: ViveFonts.bold, fontSize: 15, color: FOREST },

  // Lista
  listWrap: { paddingHorizontal: 20, paddingTop: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  listRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(63,81,47,0.16)' },
  listTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST },
  listMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: 2 },
  backToDeck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  backToDeckText: { fontFamily: ViveFonts.medium, fontSize: 13, color: TERRACOTTA },
});
