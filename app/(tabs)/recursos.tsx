import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';

// ─── Types & Meta ─────────────────────────────────────────────────────────────
type ResourceType = 'diario' | 'respiracion' | 'meditacion' | 'lecturas';
type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  coach?: string;
  duration?: string;
}

const TYPE_META: Record<ResourceType, { label: string; icon: MCIcon; emoji: string; color: string; bg: string }> = {
  diario:      { label: 'Diario',          icon: 'notebook-outline',  emoji: '📔', color: ViveColors.primary, bg: '#FDF0E8' },
  respiracion: { label: 'Respiración',     icon: 'weather-windy',     emoji: '🫁', color: ViveColors.calm,    bg: '#E8EFF6' },
  meditacion:  { label: 'Meditación',      icon: 'meditation',        emoji: '🧘', color: ViveColors.accent,  bg: '#E8F5EE' },
  lecturas:    { label: 'Lecturas breves', icon: 'book-open-outline', emoji: '📖', color: '#B07A4F',          bg: '#F5EDE4' },
};

// ─── Explorar Categories ──────────────────────────────────────────────────────
interface ExploreCategory {
  id: string;
  label: string;
  emoji: string;
}

const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: 'diario',          label: 'Diario',           emoji: '📔' },
  { id: 'gratitud',        label: 'Gratitud',         emoji: '🙏' },
  { id: 'sueno',           label: 'Sueño',            emoji: '😴' },
  { id: 'respiracion',     label: 'Respiración',      emoji: '🌬️' },
  { id: 'meditacion',      label: 'Meditación',       emoji: '🧘' },
  { id: 'escaner',         label: 'Escáner corporal', emoji: '🫧' },
  { id: 'relajacion',      label: 'Relajación',       emoji: '💤' },
  { id: 'ruido_blanco',    label: 'Ruido blanco',     emoji: '🔇' },
  { id: 'lecturas',        label: 'Lecturas breves',  emoji: '📖' },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────
const COACH_RESOURCES: Resource[] = [
  { id: 'cr1', title: 'Respiración 4-7-8',  type: 'respiracion', coach: 'María González', duration: '5 min'  },
  { id: 'cr2', title: 'Diario de gratitud', type: 'diario',      coach: 'María González', duration: '10 min' },
];

const MAX_PINNED = 4;
const INITIAL_PINNED_COUNT = 2; // matches home screen mock

// ─── ResourceCard ─────────────────────────────────────────────────────────────
interface ResourceCardProps {
  resource: Resource;
  isFavorite: boolean;
  isPinned: boolean;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
}

function ResourceCard({ resource, isFavorite, isPinned, onToggleFavorite, onTogglePin }: ResourceCardProps) {
  const meta = TYPE_META[resource.type];
  return (
    <View style={s.resourceCard}>
      <View style={[s.resourceIconBg, { backgroundColor: meta.bg }]}>
        <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={s.resourceInfo}>
        <Text style={s.resourceTitle}>{resource.title}</Text>
        {resource.coach && (
          <Text style={s.resourceCoach}>Recomendado por {resource.coach}</Text>
        )}
        {resource.duration && (
          <Text style={s.resourceDuration}>{meta.label} · {resource.duration}</Text>
        )}
      </View>
      <View style={s.resourceActions}>
        <TouchableOpacity
          onPress={onToggleFavorite}
          hitSlop={8}
          activeOpacity={0.7}
          style={s.actionBtn}>
          <MaterialCommunityIcons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? '#E05C5C' : `${ViveColors.text}55`}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onTogglePin}
          hitSlop={8}
          activeOpacity={0.7}
          style={s.actionBtn}>
          <MaterialCommunityIcons
            name={isPinned ? 'pin' : 'pin-outline'}
            size={20}
            color={isPinned ? ViveColors.primary : `${ViveColors.text}55`}
          />
        </TouchableOpacity>
        <TouchableOpacity style={s.usarBtn} activeOpacity={0.8}>
          <Text style={s.usarBtnText}>Usar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CATEGORY_ROUTES: Partial<Record<string, string>> = {
  diario:   '/diario',
  gratitud: '/gratitud',
};

// ─── ExploreCategoryCard ──────────────────────────────────────────────────────
function ExploreCategoryCard({ category }: { category: ExploreCategory }) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.exploreCategoryCard}
      onPress={() => {
        const route = CATEGORY_ROUTES[category.id];
        if (route) {
          router.push(route as any);
        } else {
          console.log('open category', category.id);
        }
      }}
      activeOpacity={0.88}>
      <Text style={s.exploreCategoryEmoji}>{category.emoji}</Text>
      <Text style={s.exploreCategoryLabel}>{category.label}</Text>
    </ScaleCard>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  const { isLoggedIn, requestAuth } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [pinnedFromHere, setPinnedFromHere] = useState<Set<string>>(new Set());

  const totalPinned = INITIAL_PINNED_COUNT + pinnedFromHere.size;

  function toggleFavorite(id: string) {
    if (!isLoggedIn) { requestAuth(); return; }
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePin(resource: Resource) {
    if (!isLoggedIn) { requestAuth(); return; }
    if (pinnedFromHere.has(resource.id)) {
      setPinnedFromHere(prev => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
      return;
    }
    if (totalPinned >= MAX_PINNED) {
      Alert.alert(
        'Límite alcanzado',
        'Ya tenés 4 recursos pineados. Sacá uno para agregar este.',
        [{ text: 'Entendido' }],
      );
      return;
    }
    setPinnedFromHere(prev => new Set([...prev, resource.id]));
  }

  const savedResources = COACH_RESOURCES.filter(r => favorites.has(r.id));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_recursos"
        icon="book-open-outline"
        title="Recursos para vos"
        description="Videos, audios y guías seleccionados según tu camino. Guardá los que más te sirvan."
        delay={800}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <Text style={s.pageTitle}>Recursos</Text>

        {/* ── Buscador ────────────────────────────────────────────────── */}
        <View style={s.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={`${ViveColors.text}55`} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscá una herramienta..."
            placeholderTextColor={`${ViveColors.text}55`}
            returnKeyType="search"
          />
        </View>

        {/* ── Recomendados por tu coach ───────────────────────────────── */}
        <Text style={s.sectionTitle}>Recomendados por tu coach</Text>
        {COACH_RESOURCES.map(resource => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            isFavorite={favorites.has(resource.id)}
            isPinned={pinnedFromHere.has(resource.id)}
            onToggleFavorite={() => toggleFavorite(resource.id)}
            onTogglePin={() => togglePin(resource)}
          />
        ))}

        {/* ── Explorar ────────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Explorar</Text>
        <View style={s.exploreCategoryGrid}>
          {[0, 1, 2].map(row => (
            <View key={row} style={s.exploreCategoryRow}>
              {EXPLORE_CATEGORIES.slice(row * 3, row * 3 + 3).map(cat => (
                <ExploreCategoryCard key={cat.id} category={cat} />
              ))}
            </View>
          ))}
        </View>

        {/* ── Guardados ───────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Guardados</Text>
        {savedResources.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="bookmark-outline" size={34} color={`${ViveColors.text}2E`} />
            <Text style={s.emptyText}>
              Todavía no guardaste ningún recurso.{'\n'}Explorá la biblioteca.
            </Text>
          </View>
        ) : (
          savedResources.map(resource => (
            <ResourceCard
              key={`saved-${resource.id}`}
              resource={resource}
              isFavorite
              isPinned={pinnedFromHere.has(resource.id)}
              onToggleFavorite={() => toggleFavorite(resource.id)}
              onTogglePin={() => togglePin(resource)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sombra ───────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Header
  pageTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
    marginBottom: 14,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 28,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 6,
    gap: 8,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    padding: 0,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
  },
  sectionSpaced: {
    marginTop: 28,
  },

  // Resource Card
  resourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...shadow,
  },
  resourceIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  resourceInfo: {
    flex: 1,
    marginRight: 6,
  },
  resourceTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  resourceCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.primary,
    marginBottom: 1,
  },
  resourceDuration: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}66`,
  },
  resourceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  actionBtn: {
    padding: 4,
  },
  usarBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginLeft: 4,
  },
  usarBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Explore Category Grid (3x3)
  exploreCategoryGrid: {
    gap: 10,
  },
  exploreCategoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exploreCategoryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 90,
    ...shadow,
  },
  exploreCategoryEmoji: {
    fontSize: 28,
  },
  exploreCategoryLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}66`,
    textAlign: 'center',
    lineHeight: 20,
  },
});
