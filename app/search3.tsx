import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { NATIONALITIES, MAX_PRICE } from '@/constants/searchData';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase } from '@/lib/supabase';

type CoachResult = {
  id: string;       // profiles.id
  name: string;
  specialty: string;
  priceFrom: number;
  nationality: string;
};

// ─── Tipos ───────────────────────────────────────────────────────────────────
type SexFilter     = 'Todos' | 'Mujer' | 'Hombre';
type TypeFilter    = 'Todos' | 'Coach' | 'Psicólogo' | 'Nutricionista';
type NatFilter     = 'Todas' | string;

type Filters = {
  minRating:   number;
  sex:         SexFilter;
  maxPrice:    number;
  nationality: NatFilter;
  type:        TypeFilter;
};

const DEFAULT_FILTERS: Filters = {
  minRating:   0,
  sex:         'Todos',
  maxPrice:    MAX_PRICE,
  nationality: 'Todas',
  type:        'Todos',
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
  const { topic, query } = useLocalSearchParams<{ topic?: string; query?: string }>();

  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraft]  = useState<Filters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rawCoaches, setRawCoaches] = useState<CoachResult[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const slideAnim = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    let cancelled = false;
    setLoadingCoaches(true);
    supabase
      .from('coaches')
      .select('specialty, price_per_session, nationality, profiles!inner(id, name)')
      .eq('verified', true)
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[Search3] coaches fetch:', error.message);
        const topicStr = Array.isArray(topic) ? topic[0] : topic;
        const queryStr = Array.isArray(query) ? query[0] : query;
        const all: CoachResult[] = (data ?? []).map((c: any) => {
          const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return {
            id: profile?.id as string,
            name: profile?.name as string,
            specialty: c.specialty as string,
            priceFrom: c.price_per_session as number,
            nationality: (c.nationality ?? '') as string,
          };
        });
        const filtered = all.filter(c => {
          if (topicStr) {
            return normalize(c.specialty).includes(normalize(topicStr));
          }
          if (queryStr) {
            const q = normalize(queryStr);
            return normalize(c.name).includes(q) || normalize(c.specialty).includes(q);
          }
          return true;
        });
        setRawCoaches(filtered);
        setLoadingCoaches(false);
      });
    return () => { cancelled = true; };
  }, [topic, query]);

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

  // Apply client-side filters (only maxPrice and nationality have real data)
  const results = rawCoaches.filter(p => {
    if (filters.maxPrice < MAX_PRICE && p.priceFrom > filters.maxPrice) return false;
    if (filters.nationality !== 'Todas' && p.nationality !== filters.nationality) return false;
    return true;
  });

  const activeFilterCount = [
    filters.minRating > 0,
    filters.sex !== 'Todos',
    filters.maxPrice < MAX_PRICE,
    filters.nationality !== 'Todas',
    filters.type !== 'Todos',
  ].filter(Boolean).length;

  const title = topic ?? query ?? 'Resultados';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={openSheet} style={s.filterBtn} activeOpacity={0.8}>
          <MaterialIcons name="tune" size={18} color={activeFilterCount > 0 ? ViveColors.primary : ViveColors.text} />
          <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnActive]}>Filtrar</Text>
          {activeFilterCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Text style={s.resultCount}>
        {loadingCoaches ? 'Buscando...' : `${results.length} profesional${results.length !== 1 ? 'es' : ''} encontrado${results.length !== 1 ? 's' : ''}`}
      </Text>

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
            <Text style={s.emptyText}>Probá ajustando los filtros o eligiendo otro tema.</Text>
          </View>
        }
        renderItem={({ item: p }) => (
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
            <View style={s.avatar}>
              <MaterialIcons name="person" size={36} color="#C0BAB4" />
            </View>
            {/* Info */}
            <View style={s.cardInfo}>
              <View style={s.cardTop}>
                <Text style={s.cardName}>{p.name}</Text>
              </View>
              <Text style={s.cardSpecialty}>{p.specialty}</Text>
              <Text style={s.cardPrice}>Desde ${p.priceFrom.toLocaleString('es-AR')}</Text>
              <View style={s.tagsRow}>
                <View style={[s.tag, s.tagActive]}>
                  <Text style={[s.tagText, s.tagTextActive]}>{p.specialty}</Text>
                </View>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={`${ViveColors.text}55`} />
          </ScaleCard>
        )}
      />

      {/* ── Bottom sheet (filtros) ────────────────────────────────────── */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <Pressable style={s.backdrop} onPress={closeSheet} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Pill handle */}
          <View style={s.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>

            <Text style={s.sheetTitle}>Filtros</Text>

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
                {(['Todos', 'Coach', 'Psicólogo', 'Nutricionista'] as TypeFilter[]).map(t => (
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
  safe: { flex: 1, backgroundColor: ViveColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    ...shadow,
  },
  filterBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  filterBtnActive: { color: ViveColors.primary },
  badge: {
    backgroundColor: ViveColors.primary,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: ViveFonts.bold, fontSize: 10, color: '#FFFFFF' },

  resultCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}88`,
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  // List
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    gap: 12,
    ...shadow,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardName: { fontFamily: ViveFonts.semibold, fontSize: 14, color: ViveColors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontFamily: ViveFonts.medium, fontSize: 12, color: ViveColors.text },
  cardSpecialty: { fontFamily: ViveFonts.medium, fontSize: 12, color: ViveColors.primary, marginBottom: 2 },
  cardPrice: { fontFamily: ViveFonts.regular, fontSize: 11, color: `${ViveColors.text}88`, marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    backgroundColor: `${ViveColors.text}12`,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagActive: { backgroundColor: `${ViveColors.primary}22` },
  tagText: { fontFamily: ViveFonts.regular, fontSize: 10, color: `${ViveColors.text}BB` },
  tagTextActive: { color: ViveColors.primary, fontFamily: ViveFonts.medium },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: ViveColors.text },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: `${ViveColors.text}88`, textAlign: 'center', paddingHorizontal: 20 },

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
