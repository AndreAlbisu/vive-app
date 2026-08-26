import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
  Animated,
  PanResponder,
  Pressable,
  FlatList,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { NATIONALITIES, MAX_PRICE } from '@/constants/searchData';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { topicOptionsFrom } from '@/constants/conexionesDoors';
import { supabase } from '@/lib/supabase';
import { getCoachesCache, CachedCoach } from '@/lib/coachesCache';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';

// ─── Paleta local (consistente con Recursos / Explorar) ──────────────────────
const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const GLASS_BG    = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// Los tipos de profesional. Vivían duplicados —una copia en las píldoras
// rápidas de la cabecera y otra dentro del sheet— y las píldoras se sacaron el
// 21/08/2026 para dejar el filtro en un solo lugar. Queda una sola lista.
const TYPE_OPTIONS: TypeFilter[] = ['Todos', 'Coach', 'Psicólogo', 'Nutricionista'];
type CoachResult = CachedCoach;

// ─── Tipos ───────────────────────────────────────────────────────────────────
type SexFilter     = 'Todos' | 'Mujer' | 'Hombre';
type TypeFilter    = 'Todos' | 'Coach' | 'Psicólogo' | 'Nutricionista';
type NatFilter     = 'Todas' | string;

type Filters = {
  minRating:   number;
  /** true = solo profesionales que atienden desde el exterior. */
  international: boolean;
  sex:         SexFilter;
  maxPrice:    number;
  nationality: NatFilter;
  type:        TypeFilter;
  /** Subtemas seleccionados. Vacío = sin filtro de tema (todos los coaches). */
  topics:      string[];
};

const DEFAULT_FILTERS: Filters = {
  minRating:   0,
  international: false,
  sex:         'Todos',
  maxPrice:    MAX_PRICE,
  nationality: 'Todas',
  type:        'Todos',
  topics:      [],
};

// ─── Normalización para búsqueda sin tildes/mayúsculas ───────────────────────
function normalize(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');
}

// ─── Sombra ──────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios:     { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 3 },
});

// ─── Custom slider ───────────────────────────────────────────────────────────
function CustomSlider({
  value, onValueChange, min, max, formatLabel,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  formatLabel: (v: number) => string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const startValue = useRef(value);
  const currentValue = useRef(value);

  useEffect(() => { currentValue.current = value; }, [value]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startValue.current = currentValue.current;
      },
      onPanResponderMove: (_, gs) => {
        if (trackWidth === 0) return;
        const newPos  = Math.max(0, Math.min(trackWidth, (startValue.current - min) / (max - min) * trackWidth + gs.dx));
        const newVal  = Math.round(min + (newPos / trackWidth) * (max - min));
        onValueChange(newVal);
      },
    })
  ).current;

  const pct   = trackWidth > 0 ? (value - min) / (max - min) : 0;
  const fillW = trackWidth * pct;
  const thumbL = fillW - 12;

  return (
    <View style={sl.wrap}>
      <View
        style={sl.track}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}>
        <View style={[sl.fill, { width: fillW }]} />
        <View style={[sl.thumb, { left: Math.max(0, thumbL) }]} />
      </View>
      <Text style={sl.label}>{formatLabel(value)}</Text>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function SearchScreen3() {
  const router = useRouter();
  const { topic, label, query } = useLocalSearchParams<{ topic?: string; label?: string; query?: string }>();

  // Los subtemas con los que se entró (los de la puerta). Siembran el filtro en
  // vez de competir con él: llegan pre-seleccionados, visibles y editables. Antes
  // el tema era el título de la pantalla y no se podía tocar — ni siquiera
  // "Limpiar filtros" lo alcanzaba, siendo el más restrictivo de todos.
  const seedTopics = useMemo(() => {
    const t = Array.isArray(topic) ? topic[0] : topic;
    return t ? t.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
  }, [topic]);

  const [filters, setFilters]     = useState<Filters>(() => ({ ...DEFAULT_FILTERS, topics: seedTopics }));
  const [draftFilters, setDraft]  = useState<Filters>(() => ({ ...DEFAULT_FILTERS, topics: seedTopics }));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rawCoaches, setRawCoaches] = useState<CoachResult[]>([]);
  const visibleCoaches = useBlockedFilter(rawCoaches);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const slideAnim = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    let cancelled = false;

    // ⚠️ El filtro por TEMA ya no se aplica acá. Antes se hacía en este paso, con
    // el parámetro de la ruta, y eso dejaba `rawCoaches` recortado a la puerta
    // por la que se entró: el sheet no tenía forma de AMPLIAR a otros temas
    // porque los coaches de las otras puertas nunca habían entrado a la lista.
    // Ahora el tema es un filtro más, junto al precio y los otros, y esta lista
    // guarda el universo completo — que además es de donde salen las opciones
    // del filtro (ver `topicOptions`).
    function applyAndSet(all: CachedCoach[]) {
      const queryStr = Array.isArray(query) ? query[0] : query;
      const filtered = !queryStr ? all : all.filter(c => {
        const q = normalize(queryStr);
        return normalize(c.name).includes(q)
          || normalize(c.specialty).includes(q)
          || c.topics.some(ct => normalize(ct).includes(q));
      });
      setRawCoaches(filtered);
      setLoadingCoaches(false);
    }

    const cached = getCoachesCache();
    if (cached) {
      applyAndSet(cached);
      return;
    }

    setLoadingCoaches(true);
    supabase
      .from('coaches')
      .select('id, specialty, bio, price_per_session, nationality, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
      .eq('verified', true)
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[Search3] coaches fetch:', error.message);
        const all: CachedCoach[] = (data ?? []).map((c: any) => {
          const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return {
            id: profile?.id as string,
            name: profile?.name as string,
            specialty: c.specialty as string,
            priceFrom: c.price_per_session as number,
            nationality: (c.nationality ?? '') as string,
            gender: (profile?.gender ?? '') as string,
            avatarUrl: (profile?.avatar_url ?? null) as string | null,
            bio: (c.bio ?? null) as string | null,
            topics: (c.coach_topics ?? []).map((t: any) => t.topic as string),
          };
        });
        applyAndSet(all);
      });
    return () => { cancelled = true; };
  }, [query]);

  // Rating promedio real por coach — mismo criterio que ProfesionalScreen.tsx
  // (reviews públicas, is_private=false). Se recalcula cuando cambia la lista
  // de coaches visibles (después de aplicar topic/query, antes de los filtros
  // del bottom sheet).
  const [avgRatingById, setAvgRatingById] = useState<Record<string, number>>({});

  useEffect(() => {
    if (rawCoaches.length === 0) { setAvgRatingById({}); return; }
    let cancelled = false;
    supabase
      .from('reviews')
      .select('reviewed_id, rating')
      .eq('is_private', false)
      .in('reviewed_id', rawCoaches.map(c => c.id))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[Search3] reviews fetch:', error.message); return; }
        const sums: Record<string, { total: number; count: number }> = {};
        (data ?? []).forEach(r => {
          const id = r.reviewed_id as string;
          if (!sums[id]) sums[id] = { total: 0, count: 0 };
          sums[id].total += r.rating as number;
          sums[id].count += 1;
        });
        const avgs: Record<string, number> = {};
        Object.entries(sums).forEach(([id, { total, count }]) => {
          avgs[id] = Math.round((total / count) * 10) / 10;
        });
        setAvgRatingById(avgs);
      });
    return () => { cancelled = true; };
  }, [rawCoaches]);

  // Heurística de "tipo" a partir del texto libre de specialty — no hay
  // columna estructurada para esto en coaches todavía (decisión: usar esto
  // por ahora, en vez de agregar una columna nueva).
  function inferType(specialty: string): 'Coach' | 'Psicólogo' | 'Nutricionista' {
    const s = normalize(specialty);
    if (s.includes('psicolog')) return 'Psicólogo';
    if (s.includes('nutricion')) return 'Nutricionista';
    return 'Coach';
  }

  const SEX_TO_GENDER: Record<'Mujer' | 'Hombre', string> = {
    Mujer: 'Femenino',
    Hombre: 'Masculino',
  };

  function openSheet() {
    setDraft(filters);
    setSheetOpen(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 200 }).start();
  }

  function closeSheet() {
    Animated.timing(slideAnim, { toValue: 700, useNativeDriver: true, duration: 220 }).start(() => setSheetOpen(false));
  }

  function applyFilters() {
    setFilters(draftFilters);
    closeSheet();
  }

  const results = visibleCoaches.filter(p => {
    if (filters.topics.length > 0) {
      const wanted = filters.topics.map(normalize);
      if (!p.topics.some(t => wanted.includes(normalize(t)))) return false;
    }
    if (filters.maxPrice < MAX_PRICE && p.priceFrom > filters.maxPrice) return false;
    if (filters.nationality !== 'Todas' && p.nationality !== filters.nationality) return false;
    if (filters.sex !== 'Todos' && p.gender !== SEX_TO_GENDER[filters.sex]) return false;
    if (filters.type !== 'Todos' && inferType(p.specialty) !== filters.type) return false;
    if (filters.minRating > 0 && (avgRatingById[p.id] ?? 0) < filters.minRating) return false;
    if (filters.international && !p.acceptsInternational) return false;
    return true;
  });

  // Opciones del filtro derivadas de los coaches que existen, no de la
  // taxonomía. El porqué —y por qué se calcula sobre el universo completo y no
  // sobre el resultado— está en `topicOptionsFrom`.
  const topicOptions = useMemo(() => topicOptionsFrom(visibleCoaches), [visibleCoaches]);

  // ¿La selección sigue siendo la de la puerta por la que se entró? Decide el
  // título y si el tema cuenta como filtro "tocado".
  const topicsIgualAPuerta =
    filters.topics.length === seedTopics.length &&
    filters.topics.every(t => seedTopics.includes(t));

  const activeFilterCount = [
    filters.minRating > 0,
    filters.sex !== 'Todos',
    filters.maxPrice < MAX_PRICE,
    filters.nationality !== 'Todas',
    filters.type !== 'Todos',
    filters.international,
    !topicsIgualAPuerta,
  ].filter(Boolean).length;

  // El título dejaba de ser cierto apenas se tocaban los temas: decía el nombre
  // de la puerta aunque la selección ya no fuera esa. Se mantiene mientras
  // coincida, y si no, dice qué se está mirando.
  const title = (() => {
    if (topicsIgualAPuerta && label) return label;
    if (filters.topics.length === 1) return filters.topics[0];
    if (filters.topics.length > 1) return `${filters.topics.length} temas`;
    return query ?? 'Profesionales';
  })();

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={8} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back-ios-new" size={18} color={FOREST} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openSheet} style={s.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="tune" size={19} color={activeFilterCount > 0 ? ViveColors.primary : FOREST} />
          {activeFilterCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Título editorial ─────────────────────────────────────────── */}
      <View style={s.titleBlock}>
        <Text style={s.title} numberOfLines={2}>{title}</Text>
        <Text style={s.subtitle}>
          {loadingCoaches
            ? 'Buscando…'
            : `${results.length} ${results.length === 1 ? 'profesional disponible' : 'profesionales disponibles'}`}
        </Text>
      </View>

      {/* ── Lista ────────────────────────────────────────────────────── */}
      <FlatList
        data={results}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🔍</Text>
            <Text style={s.emptyTitle}>Sin resultados</Text>
            <Text style={s.emptyText}>Probá ajustando los filtros o eligiendo otro tema</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const rating = avgRatingById[p.id];
          const topics = p.topics.slice(0, 2);
          return (
            <ScaleCard
              style={s.card}
              onPress={() => router.push({
                pathname: '/profesional',
                params: {
                  profileId: p.id,
                  name: p.name,
                  specialty: p.specialty,
                  priceFrom: String(p.priceFrom),
                },
              })}>
              {/* Foto */}
              {p.avatarUrl ? (
                <Image source={{ uri: p.avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatar}>
                  <MaterialIcons name="person" size={34} color="#C0BAB4" />
                </View>
              )}
              {/* Info */}
              <View style={s.cardInfo}>
                <View style={s.cardTop}>
                  <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                  {rating ? (
                    <View style={s.ratingPill}>
                      <MaterialIcons name="star" size={12} color="#E0A93B" />
                      <Text style={s.ratingText}>{rating.toFixed(1)}</Text>
                    </View>
                  ) : (
                    <View style={s.newPill}>
                      <Text style={s.newPillText}>Nuevo</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardSpecialty} numberOfLines={1}>{p.specialty}</Text>
                {topics.length > 0 && (
                  <View style={s.tagsRow}>
                    {topics.map(t => (
                      <View key={t} style={s.tag}>
                        <Text style={s.tagText} numberOfLines={1}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={s.cardPrice}>
                  Desde ${p.priceFrom.toLocaleString('es-AR')}
                  <Text style={s.cardPriceUnit}> · por sesión</Text>
                </Text>
              </View>
            </ScaleCard>
          );
        }}
      />

      {/* ── Bottom sheet (filtros) ────────────────────────────────────── */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <Pressable style={s.backdrop} onPress={closeSheet} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Pill handle */}
          <View style={s.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>

            <Text style={s.sheetTitle}>Filtros</Text>

            {/* ── Temas ──
                Va primero porque es el filtro que más recorta: con la puerta
                sembrada, es también lo que explica por qué la lista es la que es. */}
            {topicOptions.length > 0 && (
              <View style={s.filterSection}>
                <View style={s.temasHead}>
                  <Text style={s.filterLabel}>Temas</Text>
                  {draftFilters.topics.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setDraft(d => ({ ...d, topics: [] }))}
                      hitSlop={8}
                      activeOpacity={0.7}>
                      <Text style={s.temasClear}>Ver todos</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {topicOptions.map(group => (
                  <View key={group.id} style={s.temaGroup}>
                    <Text style={s.temaGroupLabel}>{group.label}</Text>
                    <View style={s.pillRow}>
                      {group.subtemas.map(t => {
                        const on = draftFilters.topics.includes(t);
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[s.pill, on && s.pillActive]}
                            onPress={() => setDraft(d => ({
                              ...d,
                              topics: on ? d.topics.filter(x => x !== t) : [...d.topics, t],
                            }))}
                            activeOpacity={0.75}>
                            <Text style={[s.pillText, on && s.pillTextActive]}>{t}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Puntuación mínima ── */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Puntuación mínima</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setDraft(d => ({ ...d, minRating: d.minRating === star ? 0 : star }))}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <MaterialIcons
                      name={star <= draftFilters.minRating ? 'star' : 'star-border'}
                      size={30}
                      color={star <= draftFilters.minRating ? '#E8C547' : `${ViveColors.text}44`}
                    />
                  </TouchableOpacity>
                ))}
                {draftFilters.minRating > 0 && (
                  <Text style={s.starHint}>{draftFilters.minRating}+ estrellas</Text>
                )}
              </View>
            </View>

            {/* ── Sexo ── */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Profesional</Text>
              <View style={s.pillRow}>
                {(['Todos', 'Mujer', 'Hombre'] as SexFilter[]).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.pill, draftFilters.sex === opt && s.pillActive]}
                    onPress={() => setDraft(d => ({ ...d, sex: opt }))}
                    activeOpacity={0.75}>
                    <Text style={[s.pillText, draftFilters.sex === opt && s.pillTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Precio máximo ── */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Precio máximo por sesión</Text>
              <CustomSlider
                value={draftFilters.maxPrice}
                onValueChange={v => setDraft(d => ({ ...d, maxPrice: v }))}
                min={1000}
                max={MAX_PRICE}
                formatLabel={v => v >= MAX_PRICE ? 'Sin límite' : `$${v.toLocaleString('es-AR')}`}
              />
            </View>

            {/* ── Desde el exterior ──
                No cambia los horarios del profesional —atiende en sus mismas
                franjas y el que se acomoda es quien reserva—, cambia el cobro:
                Mercado Pago rechaza tarjetas emitidas fuera de Argentina, así
                que estas sesiones se pagan en dólares por transferencia de
                USDT. Sin este filtro no había forma de saber quién los toma:
                el dato es público justamente para poder buscar por él, y hasta
                ahora solo se leía en la pantalla de pago — o sea que se
                descubría recién al final. */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>¿Estás fuera de Argentina?</Text>
              <View style={s.pillRow}>
                {([false, true] as const).map(opt => (
                  <TouchableOpacity
                    key={String(opt)}
                    style={[s.pill, draftFilters.international === opt && s.pillActive]}
                    onPress={() => setDraft(d => ({ ...d, international: opt }))}
                    activeOpacity={0.75}>
                    <Text style={[s.pillText, draftFilters.international === opt && s.pillTextActive]}>
                      {opt ? 'Atienden desde el exterior' : 'No filtrar'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {draftFilters.international && (
                <Text style={s.starHint}>Se paga en dólares, con USDT</Text>
              )}
            </View>

            {/* ── Nacionalidad ── */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Nacionalidad</Text>
              <View style={s.pillRow}>
                {(['Todas', ...NATIONALITIES] as NatFilter[]).map(nat => (
                  <TouchableOpacity
                    key={nat}
                    style={[s.pill, draftFilters.nationality === nat && s.pillActive]}
                    onPress={() => setDraft(d => ({ ...d, nationality: nat }))}
                    activeOpacity={0.75}>
                    <Text style={[s.pillText, draftFilters.nationality === nat && s.pillTextActive]}>{nat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Tipo ── */}
            <View style={s.filterSection}>
              <Text style={s.filterLabel}>Tipo</Text>
              <View style={s.pillRow}>
                {TYPE_OPTIONS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.pill, draftFilters.type === t && s.pillActive]}
                    onPress={() => setDraft(d => ({ ...d, type: t }))}
                    activeOpacity={0.75}>
                    <Text style={[s.pillText, draftFilters.type === t && s.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </ScrollView>

          {/* ── Aplicar ── */}
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={s.resetBtn}
              onPress={() => setDraft(DEFAULT_FILTERS)}
              activeOpacity={0.7}>
              <Text style={s.resetText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.85}>
              <Text style={s.applyText}>Aplicar filtros</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Modal>

      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos: slider ──────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingVertical: 4,
  },
  track: {
    height: 36,
    justifyContent: 'center',
  },
  fill: {
    height: 4,
    backgroundColor: ViveColors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 16,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ViveColors.primary,
    position: 'absolute',
    top: 6,
    ...Platform.select({
      ios:     { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  label: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
  },
});

// ─── Estilos: pantalla ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3, right: -3,
    backgroundColor: ViveColors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: ViveFonts.bold, fontSize: 10, color: '#FFFFFF' },

  // Título editorial
  titleBlock: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 30,
    color: FOREST,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },

  // Filtros rápidos

  // List
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 13,
    ...shadow,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0, gap: 3 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardName: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 15.5, color: FOREST },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(224,169,59,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    flexShrink: 0,
  },
  ratingText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: '#9A6E1E' },
  newPill: {
    backgroundColor: `${ViveColors.primary}1E`,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    flexShrink: 0,
  },
  newPillText: { fontFamily: ViveFonts.semibold, fontSize: 10.5, color: ViveColors.primary },
  cardSpecialty: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: ViveColors.primary },
  cardPrice: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST, marginTop: 2 },
  cardPriceUnit: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  tag: {
    backgroundColor: 'rgba(107,122,86,0.14)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 130,
  },
  tagText: { fontFamily: ViveFonts.medium, fontSize: 10.5, color: FOREST_SOFT },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: FOREST },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT, textAlign: 'center', paddingHorizontal: 20 },

  // Backdrop
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(86,94,50,0.12)',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F7EFE4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 20 },
    }),
  },
  temasHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  temasClear: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: ViveColors.primary,
  },
  temaGroup: {
    marginTop: 10,
  },
  temaGroupLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 5,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${ViveColors.text}33`,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sheetTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: ViveColors.text,
    marginBottom: 20,
    marginTop: 8,
  },

  // Filter sections
  filterSection: {
    marginBottom: 22,
  },
  filterLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.text,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starHint: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    marginLeft: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1.5,
    borderColor: 'rgba(86,94,50,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,248,240,0.70)',
  },
  pillActive: {
    backgroundColor: ViveColors.primary,
    borderColor: ViveColors.primary,
  },
  pillText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  pillTextActive: {
    color: '#F7EFE4',
  },

  // Sheet footer
  sheetFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}12`,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}33`,
    borderRadius: 14,
  },
  resetText: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: ViveColors.text,
  },
  applyBtn: {
    flex: 2,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F7EFE4',
  },
});
