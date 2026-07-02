import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { useResourceProgress } from '@/hooks/useResourceProgress';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Tool {
  id: string;
  label: string;
  icon: IoniconName;
  duration: string;
  route?: string;
}

interface ToolGroup {
  id: string;
  title: string;
  subtitle: string;
  toolIds: string[];
}

interface CoachResource {
  id: string;
  toolId: string;
  icon: IoniconName;
  duration: string;
  note?: string;
}

// ─── Datos ───────────────────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario'   },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud' },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min'                      },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min'                        },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min'                      },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min'                          },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min'                         },
  { id: 'ruido',       label: 'Ruido blanco',     icon: 'volume-medium-outline', duration: 'Libre'                          },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min'                       },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.id, t]));

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'calma',
    title: 'Para calmarte ahora',
    subtitle: 'Cuando la mente va rápido',
    toolIds: ['respiracion', 'ruido', 'escaner'],
  },
  {
    id: 'reflexion',
    title: 'Para reflexionar',
    subtitle: 'Poner en palabras lo que pasa',
    toolIds: ['diario', 'gratitud', 'lecturas'],
  },
  {
    id: 'descanso',
    title: 'Para descansar',
    subtitle: 'Cerrar el día y dormir mejor',
    toolIds: ['sueno', 'relajacion', 'meditacion'],
  },
];

// Mapeo mood_id → recurso sugerido
const MOOD_TO_RESOURCE: Record<number, { toolId: string; whyText: string }> = {
  1: { toolId: 'gratitud',    whyText: 'Registrar lo que agradecés ayuda a salir del bajón' },
  2: { toolId: 'escaner',     whyText: 'Reconectar con el cuerpo cuando la energía está baja' },
  3: { toolId: 'respiracion', whyText: 'Centrar la mente y llegar con más claridad al día' },
  4: { toolId: 'meditacion',  whyText: 'Cuando estás bien es el mejor momento para el hábito' },
  5: { toolId: 'meditacion',  whyText: 'Consolidar el bienestar que ya tenés' },
};

const COACH_NAME = 'María González';
const COACH_INITIALS = 'MG';

const COACH_RESOURCES: CoachResource[] = [
  {
    id: 'cr1',
    toolId: 'respiracion',
    icon: 'cloud-outline',
    duration: '5 min',
    note: '"Cuando la cabeza va rápido, este ejercicio baja la activación en menos de 5 minutos."',
  },
  {
    id: 'cr2',
    toolId: 'gratitud',
    icon: 'heart-outline',
    duration: '10 min',
  },
];

// ─── Colores locales ─────────────────────────────────────────────────────────
const FOREST       = '#3A4F2A';
const FOREST_SOFT  = '#6B7A56';
const CREAM_LIGHT  = '#F3EEDF';
const TERRACOTTA   = '#C1694F';
const TERRA_SOFT   = '#EAD3C6';
const GLASS_BG     = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ─── StreakChip ───────────────────────────────────────────────────────────────
function StreakChip({ streak, weekActivity }: { streak: number; weekActivity: boolean[] }) {
  return (
    <View style={s.streakChip}>
      <Text style={s.streakText}>{streak} {streak === 1 ? 'día' : 'días'}</Text>
      <View style={s.streakDots}>
        {weekActivity.map((active, i) => (
          <View key={i} style={[s.streakDot, active && s.streakDotActive]} />
        ))}
      </View>
    </View>
  );
}

// ─── MoodContextBlock ─────────────────────────────────────────────────────────
function MoodContextBlock({
  moodEntry,
  onGoToCheckIn,
}: {
  moodEntry?: { mood_id: number; mood_label: string };
  onGoToCheckIn: () => void;
}) {
  const router = useRouter();
  const suggestion = moodEntry ? MOOD_TO_RESOURCE[moodEntry.mood_id] : null;
  const suggestedTool = suggestion ? TOOL_MAP[suggestion.toolId] : null;

  return (
    <LinearGradient
      colors={['#42542F', '#354526']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.moodCard}>

      {moodEntry && suggestedTool ? (
        <>
          <Text style={s.moodEyebrow}>SEGÚN TU CHECK-IN DE HOY</Text>
          <Text style={s.moodTitle}>
            {'Te sentiste '}
            <Text style={s.moodEmphasis}>{moodEntry.mood_label.toLowerCase()}</Text>
            {' esta mañana. Esto te puede ayudar ahora:'}
          </Text>
          <TouchableOpacity
            style={s.moodSuggestion}
            onPress={() => { if (suggestedTool.route) router.push(suggestedTool.route as any); }}
            activeOpacity={0.8}>
            <View style={s.moodSuggestionIcon}>
              <Ionicons name={suggestedTool.icon} size={20} color={TERRA_SOFT} />
            </View>
            <View style={s.moodSuggestionText}>
              <Text style={s.moodSuggestionTitle}>{suggestedTool.label}</Text>
              <Text style={s.moodSuggestionWhy}>{suggestedTool.duration} · {suggestion!.whyText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TERRA_SOFT} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={s.moodEyebrow}>CHECK-IN DE ÁNIMO</Text>
          <Text style={s.moodTitle}>{'¿Cómo te sentís hoy?'}</Text>
          <TouchableOpacity style={s.moodCta} onPress={onGoToCheckIn} activeOpacity={0.8}>
            <Ionicons name="happy-outline" size={20} color={TERRA_SOFT} />
            <Text style={s.moodCtaText}>Registrar mi estado de ánimo</Text>
            <Ionicons name="chevron-forward" size={16} color={TERRA_SOFT} />
          </TouchableOpacity>
        </>
      )}
    </LinearGradient>
  );
}

// ─── ContinueCard ─────────────────────────────────────────────────────────────
function ContinueCard({
  resourceId,
  progressSeconds,
  durationSeconds,
}: {
  resourceId: string;
  progressSeconds: number;
  durationSeconds: number;
}) {
  const router = useRouter();
  const tool = TOOL_MAP[resourceId];
  if (!tool) return null;

  const pct = progressSeconds / durationSeconds;
  const remainingMin = Math.ceil((durationSeconds - progressSeconds) / 60);
  const totalMin = Math.ceil(durationSeconds / 60);

  return (
    <ScaleCard
      style={s.continueCard}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.88}>
      <View style={s.continueIcon}>
        <Ionicons name={tool.icon} size={22} color={FOREST} />
      </View>
      <View style={s.continueText}>
        <Text style={s.continueTitle}>Continuar: {tool.label}</Text>
        <Text style={s.continueSub}>Te quedan {remainingMin} min de {totalMin}</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
      </View>
    </ScaleCard>
  );
}

// ─── CoachSection ─────────────────────────────────────────────────────────────
function CoachSection({ completedInLast7Days }: { completedInLast7Days: Set<string> }) {
  const newCount = COACH_RESOURCES.filter(r => !completedInLast7Days.has(r.toolId)).length;
  const hasNote = !!COACH_RESOURCES[0]?.note;

  return (
    <View style={s.coachCard}>
      {/* Header */}
      <View style={s.coachHeader}>
        <LinearGradient
          colors={['#C06B4A', '#A5583B']}
          style={s.coachAvatar}>
          <Text style={s.coachInitials}>{COACH_INITIALS}</Text>
        </LinearGradient>
        <View style={s.coachHeaderText}>
          <Text style={s.coachName}>{COACH_NAME}</Text>
          <Text style={s.coachUpdated}>Actualizado hace 3 días</Text>
        </View>
        {newCount > 0 && (
          <View style={s.coachBadge}>
            <Text style={s.coachBadgeText}>{newCount} nuevo{newCount !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Nota del coach */}
      {hasNote && (
        <Text style={s.coachNote}>{COACH_RESOURCES[0].note}</Text>
      )}

      {/* Recursos */}
      <View style={s.coachResources}>
        {COACH_RESOURCES.map(r => {
          const tool = TOOL_MAP[r.toolId];
          const done = completedInLast7Days.has(r.toolId);
          return (
            <View key={r.id} style={s.coachResRow}>
              <View style={s.coachResIcon}>
                <Ionicons name={r.icon} size={18} color={FOREST} />
              </View>
              <View style={s.coachResText}>
                <Text style={s.coachResTitle}>{tool?.label ?? r.toolId}</Text>
                <Text style={s.coachResSub}>
                  {r.duration} · {done ? 'completado' : 'sin completar'}
                </Text>
              </View>
              <View style={[s.checkCircle, done && s.checkCircleDone]}>
                {done && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── FilterChips ──────────────────────────────────────────────────────────────
function FilterChips({
  active,
  savedCount,
  onSelect,
}: {
  active: 'all' | 'saved';
  savedCount: number;
  onSelect: (v: 'all' | 'saved') => void;
}) {
  return (
    <View style={s.filterRow}>
      <TouchableOpacity
        style={[s.filterChip, active === 'all' && s.filterChipActive]}
        onPress={() => onSelect('all')}
        activeOpacity={0.8}>
        <Text style={[s.filterChipLabel, active === 'all' && s.filterChipLabelActive]}>
          Todos
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.filterChip, active === 'saved' && s.filterChipActive]}
        onPress={() => onSelect('saved')}
        activeOpacity={0.8}>
        <Text style={[s.filterChipLabel, active === 'saved' && s.filterChipLabelActive]}>
          Guardados{savedCount > 0 ? ` · ${savedCount}` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({
  tool,
  saved,
  onSave,
}: {
  tool: Tool;
  saved: boolean;
  onSave: () => void;
}) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolCard}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.88}>
      <TouchableOpacity style={s.bookmarkBtn} onPress={onSave} hitSlop={8}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={15}
          color={saved ? TERRACOTTA : '#87835C'}
        />
      </TouchableOpacity>
      <View style={s.toolIconWrap}>
        <Ionicons name={tool.icon} size={24} color={FOREST} />
      </View>
      <Text style={s.toolLabel}>{tool.label}</Text>
      <Text style={s.toolDuration}>{tool.duration}</Text>
    </ScaleCard>
  );
}

// ─── ToolGroupSection ─────────────────────────────────────────────────────────
function ToolGroupSection({
  group,
  savedIds,
  onSave,
  filter,
}: {
  group: ToolGroup;
  savedIds: Set<string>;
  onSave: (id: string) => void;
  filter: 'all' | 'saved';
}) {
  const tools = group.toolIds
    .map(id => TOOL_MAP[id])
    .filter(t => t && (filter === 'all' || savedIds.has(t.id)));

  if (tools.length === 0) return null;

  // Siempre renderizar en filas de 3
  const rows: Tool[][] = [];
  for (let i = 0; i < tools.length; i += 3) {
    rows.push(tools.slice(i, i + 3));
  }

  return (
    <View style={s.groupSection}>
      <Text style={s.groupTitle}>{group.title}</Text>
      <Text style={s.groupSubtitle}>{group.subtitle}</Text>
      <View style={s.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={s.gridRow}>
            {row.map(tool => (
              <ToolCard
                key={tool.id}
                tool={tool}
                saved={savedIds.has(tool.id)}
                onSave={() => onSave(tool.id)}
              />
            ))}
            {/* Celdas vacías para mantener el grid de 3 columnas */}
            {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={s.toolCardPlaceholder} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'saved'>('all');

  const { entries: moodEntries } = useMoodHistory(user?.id, 1);
  const todayMoodEntry = moodEntries[0];

  const { streak, weekActivity, lastInProgress, completedInLast7Days } =
    useResourceProgress(user?.id);

  // ── Cargar guardados ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map(r => r.resource_id as string)));
      });
  }, [user]);

  async function toggleSave(resourceId: string) {
    if (!user) { requestAuth(); return; }
    const isSaved = savedIds.has(resourceId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(resourceId); else next.add(resourceId);
      return next;
    });
    if (isSaved) {
      await supabase
        .from('saved_resources')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId);
    } else {
      await supabase
        .from('saved_resources')
        .insert({ user_id: user.id, resource_id: resourceId });
    }
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_recursos"
          icon="book-open-outline"
          title="Recursos para vos"
          description="Herramientas de bienestar para usar cuando quieras, a tu ritmo."
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {/* 1. Header + racha */}
          <View style={s.header}>
            <Text style={s.pageTitle}>Recursos</Text>
            {streak > 0 && (
              <StreakChip streak={streak} weekActivity={weekActivity} />
            )}
          </View>

          {/* 2. Bloque de contexto según mood */}
          <MoodContextBlock
            moodEntry={todayMoodEntry}
            onGoToCheckIn={() => router.push('/')}
          />

          {/* 3. Continuar donde dejaste */}
          {lastInProgress && (
            <ContinueCard {...lastInProgress} />
          )}

          {/* 4. De tu coach */}
          <Text style={s.sectionTitle}>De tu coach</Text>
          <CoachSection completedInLast7Days={completedInLast7Days} />

          {/* 5 + 6. Filtro + herramientas agrupadas */}
          <FilterChips
            active={filter}
            savedCount={savedIds.size}
            onSelect={setFilter}
          />

          {filter === 'saved' && savedIds.size === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="bookmark-outline" size={32} color={FOREST_SOFT} />
              <Text style={s.emptyStateText}>
                Tocá el marcador en cualquier herramienta para guardarla acá.
              </Text>
            </View>
          ) : (
            TOOL_GROUPS.map(group => (
              <ToolGroupSection
                key={group.id}
                group={group}
                savedIds={savedIds}
                onSave={toggleSave}
                filter={filter}
              />
            ))
          )}

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1 },
  scroll:    { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 34,
    color: FOREST,
    lineHeight: 40,
  },

  // ── StreakChip ─────────────────────────────────────────────────────────────
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 4,
  },
  streakText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: FOREST,
  },
  streakDots:    { flexDirection: 'row', gap: 4 },
  streakDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(63,81,47,0.18)' },
  streakDotActive: { backgroundColor: TERRACOTTA },

  // ── MoodContextBlock ───────────────────────────────────────────────────────
  moodCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  moodEyebrow: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(201,207,175,0.9)',
    marginBottom: 8,
  },
  moodTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: CREAM_LIGHT,
    lineHeight: 26,
    marginBottom: 14,
  },
  moodEmphasis: {
    fontStyle: 'italic',
    color: TERRA_SOFT,
  },
  moodSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 13,
  },
  moodSuggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(234,211,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moodSuggestionText: { flex: 1 },
  moodSuggestionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: CREAM_LIGHT,
    marginBottom: 2,
  },
  moodSuggestionWhy: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(201,207,175,0.85)',
    lineHeight: 15,
  },
  moodCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 13,
  },
  moodCtaText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: CREAM_LIGHT,
  },

  // ── ContinueCard ──────────────────────────────────────────────────────────
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 14,
  },
  continueIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  continueText: { flex: 1, minWidth: 0 },
  continueTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST,
    marginBottom: 2,
  },
  continueSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(235,229,215,0.80)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: TERRACOTTA,
    borderRadius: 3,
  },

  // ── Sección "De tu coach" ─────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20,
    color: FOREST,
    marginTop: 8,
    marginBottom: 10,
  },
  coachCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginBottom: 24,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachInitials: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 16,
    color: '#FFF3E8',
  },
  coachHeaderText: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
  },
  coachUpdated: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  coachBadge: {
    backgroundColor: TERRA_SOFT,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coachBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: '#8F4A2E',
  },
  coachNote: {
    fontFamily: ViveFonts.frauncesSerif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: '#2E3624',
    lineHeight: 21,
    paddingBottom: 12,
  },
  coachResources: { gap: 8 },
  coachResRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CREAM_LIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(63,81,47,0.10)',
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  coachResIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: GLASS_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachResText: { flex: 1 },
  coachResTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
  },
  coachResSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: FOREST_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: FOREST_SOFT,
    borderColor: FOREST_SOFT,
  },

  // ── FilterChips ───────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(63,81,47,0.20)',
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  filterChipLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: FOREST_SOFT,
  },
  filterChipLabelActive: {
    color: CREAM_LIGHT,
  },

  // ── Grupos de herramientas ────────────────────────────────────────────────
  groupSection: { marginBottom: 24 },
  groupTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: FOREST,
    marginBottom: 2,
  },
  groupSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 12,
  },
  grid:    { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },

  // ── ToolCard ──────────────────────────────────────────────────────────────
  toolCard: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 100,
  },
  toolCardPlaceholder: { flex: 1 },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: FOREST,
    textAlign: 'center',
    lineHeight: 15,
  },
  toolDuration: {
    fontFamily: ViveFonts.regular,
    fontSize: 9.5,
    color: FOREST_SOFT,
    textAlign: 'center',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state (Guardados vacío) ─────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 19,
  },
});
