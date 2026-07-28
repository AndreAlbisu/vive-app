import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  UIManager,
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
import { useRecommendedResource, type Reco, type MoodLite } from '@/hooks/useRecommendedResource';
import { DOORS } from '@/constants/conexionesDoors';
import { logResourceEvent } from '@/lib/resourceEvents';
import { TOOLS, TOOL_MAP, type Tool, type IoniconName } from '@/constants/tools';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
// `Tool`, `IoniconName`, `TOOLS`, `TOOL_MAP` viven en @/constants/tools
// (fuente única, compartida con Progreso/Hábitos).

type CoachRecoItem = {
  id: string;
  resource_id: string;
  note: string | null;
  opened_at: string | null;
  created_at: string;
  coach_resources: {
    id: string;
    title: string;
    format: string;
    duration_seconds: number | null;
    topic_id: string;
  };
  coaches: {
    profiles: { name: string };
  };
};

type CoachResourceItem = {
  id: string;
  title: string;
  format: string;
  duration_seconds: number | null;
  topic_id: string;
  coaches: {
    profile_id: string;
    profiles: { name: string };
  };
};

interface ToolGroup {
  id: string;
  title: string;
  subtitle: string;
  toolIds: string[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'calma',
    title: 'Para calmarte ahora',
    subtitle: 'Cuando la mente va rápido',
    toolIds: ['respiracion', 'ruido'],
  },
  {
    id: 'reflexion',
    title: 'Para reflexionar',
    subtitle: 'Poner en palabras lo que pasa',
    toolIds: ['diario', 'gratitud'],
  },
];

// ─── Colores locales ─────────────────────────────────────────────────────────
// Herramientas/Recomendado/Biblioteca (Ajustes 1-5) usan los tokens planos del
// mockup (CARD/LINE/CREAM_DEEP) en vez del "glass" translúcido del resto de la
// app — con el fondo con gradiente, el glass se lavaba y las cards no tenían
// el contraste que pide la spec. ContinueCard y StreakChip, fuera de los 6
// ajustes, se dejaron con GLASS_BG/GLASS_BORDER tal cual estaban.
const FOREST       = '#3F512F';
const FOREST_SOFT  = '#6B7A56';
const CREAM_LIGHT  = '#F3EEDF';
const CREAM_DEEP   = '#EAE2D0';
const CARD         = '#F7F2E7';
const LINE         = 'rgba(63,81,47,0.14)';
const TERRACOTTA   = '#C06B4A';
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

// ─── RecommendedCard ──────────────────────────────────────────────────────────
// Sugerencia del día dentro de "Herramientas de Vita". 3 estados de render
// (Ajuste 1 — el mapeo mood→sugerencia de useRecommendedResource no se toca,
// solo cambia el envoltorio):
//   · Sin señal (reco null)                        → línea "¿Cómo estás hoy?"
//   · Mood de hoy en los 2 valores más intensos     → hero verde completo
//   · Cualquier otro caso (mood suave, o sin mood   → línea compacta con la
//     pero con reco por interés/quiz)                 sugerencia real
function RecommendedCard({
  reco,
  todayMoodEntry,
  onGoToCheckIn,
}: {
  reco: Reco | null;
  todayMoodEntry: MoodLite | undefined;
  onGoToCheckIn: () => void;
}) {
  const router = useRouter();

  if (!reco) {
    return (
      <TouchableOpacity style={s.moodLine} onPress={onGoToCheckIn} activeOpacity={0.85}>
        <Ionicons name="happy-outline" size={17} color={FOREST} />
        <Text style={s.moodLineWhy}>¿Cómo estás hoy?</Text>
        <Ionicons name="chevron-forward" size={18} color={FOREST_SOFT} />
      </TouchableOpacity>
    );
  }

  // Datos de presentación según el tipo de recurso recomendado.
  let icon: IoniconName;
  let title: string;
  let duration: string | null;
  let onPress: () => void;
  if (reco.kind === 'tool') {
    const tool = TOOL_MAP[reco.toolId];
    icon = tool?.icon ?? 'sparkles-outline';
    title = tool?.label ?? reco.toolId;
    duration = tool?.duration ?? null;
    onPress = () => { if (tool?.route) router.push(tool.route as any); };
  } else {
    icon = LIBRARY_TYPE_ICON[reco.resource.type] ?? 'book-outline';
    title = reco.resource.title;
    duration = null;
    onPress = () => router.push({ pathname: '/recurso', params: { id: reco.resource.id } });
  }

  const isIntense = !!todayMoodEntry && todayMoodEntry.mood_id <= 2;

  if (isIntense) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
        <LinearGradient
          colors={['#42542F', '#354526']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.moodCard}>
          <Text style={s.moodEyebrow}>{reco.eyebrow}</Text>
          <Text style={s.moodTitle}>{reco.why}</Text>
          <View style={s.moodPillBtn}>
            <Ionicons name={icon} size={18} color={FOREST} />
            <Text style={s.moodPillText}>{title}{duration ? ` · ${duration}` : ''}</Text>
            <Ionicons name="arrow-forward" size={16} color={FOREST} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={s.moodLine} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={17} color={FOREST} />
      <View style={s.moodLineTextRow}>
        <Text style={s.moodLineWhy} numberOfLines={1}>
          Hoy: <Text style={s.moodLineBold}>{reco.why}</Text>
        </Text>
        <Text style={s.moodLineTool} numberOfLines={1}>
          {' '}→ {title}{duration ? ` · ${duration}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={FOREST_SOFT} />
    </TouchableOpacity>
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

// LibraryResource alimenta la recomendación por eje (useRecommendedResource);
// el carrusel "Recursos de nuestros coaches" se removió por pisarse con "Explorar
// por tema", pero el tipo sigue en uso para el feed de la recomendación.
type LibraryResource = {
  id: string;
  type: string;
  title: string;
  duration_min: number | null;
  attributed_to_coach_id: string;
  coachName: string;
  axes: string[];   // resource_axes — alimenta la recomendación por eje
};

const LIBRARY_TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'volume-medium-outline',
  podcast: 'mic-outline',
  video: 'videocam-outline',
  guia_pasos: 'list-outline',
  lectura_breve: 'book-outline',
};

const FORMAT_COLOR: Record<string, string> = {
  audio:   '#C06B4A',
  podcast: '#7E8CA8',
  video:   '#8A6FA8',
  lectura: '#6B7A56',
};
const FORMAT_LABEL: Record<string, string> = {
  audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura',
};
const FORMAT_ICON: Record<string, IoniconName> = {
  audio:   'mic-outline',
  podcast: 'musical-notes-outline',
  video:   'videocam-outline',
  lectura: 'book-outline',
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)}h`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// "hoy" / "ayer" / "16 jul" — para la cabecera de la tarjeta-mensaje (Ajuste 3).
function relativeDay(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  const monthName = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  return `${d.getDate()} ${monthName}`;
}

const MAX_RECOS_VISIBLE = 1;

// ─── CoachRecoSection ─────────────────────────────────────────────────────────
// Rediseño Ajuste 3: cada recomendación es un "mensaje" en 3 capas (cabecera del
// coach, su nota, el recurso como adjunto tocable) — no una card de catálogo.
// Solo el adjunto abre el recurso; el resto de la tarjeta es decorativo.
function CoachRecoSection({
  recos,
  onPress,
}: {
  recos: CoachRecoItem[];
  onPress: (item: CoachRecoItem) => void;
}) {
  const router = useRouter();
  if (recos.length === 0) return null;
  const unopenedCount = recos.filter(r => !r.opened_at).length;
  const visible = recos.slice(0, MAX_RECOS_VISIBLE);

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={s.libraryHeaderRow}>
        <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Recomendado por tu profesional</Text>
        <Text style={s.recoUnopenedCount}>{unopenedCount > 0 ? `${unopenedCount} sin abrir` : 'Al día ✓'}</Text>
      </View>
      <View style={{ gap: 10 }}>
        {visible.map(item => {
          const res = item.coach_resources;
          const color = FORMAT_COLOR[res.format] ?? TERRACOTTA;
          const isNew = !item.opened_at;
          const coachName = item.coaches?.profiles?.name ?? 'Tu profesional';
          return (
            <View key={item.id} style={s.recbox}>
              <View style={s.recHead}>
                <LinearGradient
                  colors={['#C06B4A', '#A5583B']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.recAvatar}>
                  <Text style={s.recAvatarText}>{initials(coachName)}</Text>
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.recHeadName} numberOfLines={1}>{coachName}</Text>
                  <Text style={s.recHeadSub}>te recomendó esto · {relativeDay(item.created_at)}</Text>
                </View>
                {isNew && <View style={s.recDot} />}
              </View>
              {item.note ? (
                <Text style={s.recNote} numberOfLines={4}>"{item.note}"</Text>
              ) : null}
              <ScaleCard style={s.recAttach} onPress={() => onPress(item)} activeOpacity={0.92}>
                <View style={[s.recAttachIcon, { backgroundColor: color }]}>
                  <Ionicons name={FORMAT_ICON[res.format] ?? 'book-outline'} size={16} color="#fff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.recAttachTitle} numberOfLines={1}>{displayTitle(res.title)}</Text>
                  <Text style={s.recAttachMeta}>
                    {FORMAT_LABEL[res.format] ?? res.format}{res.duration_seconds ? ` · ${fmtDuration(res.duration_seconds)}` : ''}
                  </Text>
                </View>
                <View style={s.recAttachPlay}>
                  <Ionicons name="play" size={13} color={FOREST} />
                </View>
              </ScaleCard>
            </View>
          );
        })}
      </View>
      {recos.length > MAX_RECOS_VISIBLE && (
        <TouchableOpacity onPress={() => router.push('/mis-recomendaciones' as any)} hitSlop={8} activeOpacity={0.7}>
          <Text style={s.exploreLink}>+{recos.length - MAX_RECOS_VISIBLE} más →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── ExploreSection ───────────────────────────────────────────────────────────
const FORMATS = ['audio', 'video', 'podcast', 'lectura'] as const;

// Saca el prefijo "[SEED] " de los títulos de datos de prueba — solo al
// mostrar, no toca el dato (Ajuste 5).
function displayTitle(title: string): string {
  return title.replace(/^\[SEED\]\s*/, '');
}

function ExploreSection({
  resources,
  savedIds,
  onSave,
  selectedDoor,
  onSelectDoor,
  selectedFormat,
  onSelectFormat,
  userId,
}: {
  resources: CoachResourceItem[];
  savedIds: Set<string>;
  onSave: (id: string) => void;
  selectedDoor: string | null;
  onSelectDoor: (id: string | null) => void;
  selectedFormat: string | null;
  onSelectFormat: (f: string | null) => void;
  userId: string | undefined;
}) {
  const router = useRouter();
  const [fmtOpen, setFmtOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  function toggleFmtOpen() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setFmtOpen(v => !v);
  }

  return (
    <View style={{ marginTop: 8 }}>
      <View style={s.libraryHeaderRow}>
        <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Biblioteca</Text>
        <Text style={s.sectionSubtitle}>Contenido de los profesionales de Vita</Text>
      </View>

      {/* Chips de puertas + botón de filtro */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}>
        <TouchableOpacity
          style={[s.chip, !selectedDoor && s.chipActive]}
          onPress={() => onSelectDoor(null)}
          activeOpacity={0.75}>
          <Text style={[s.chipText, !selectedDoor && s.chipTextActive]}>Todos</Text>
        </TouchableOpacity>
        {DOORS.map(door => {
          const active = selectedDoor === door.id;
          return (
            <TouchableOpacity
              key={door.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => onSelectDoor(active ? null : door.id)}
              activeOpacity={0.75}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{door.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[s.filterBtn, fmtOpen && s.filterBtnActive]}
          onPress={toggleFmtOpen}
          activeOpacity={0.75}>
          <Ionicons name="options-outline" size={16} color={fmtOpen ? '#F3EEDF' : FOREST} />
        </TouchableOpacity>
      </ScrollView>

      {/* Filtro de formato — colapsado detrás del botón de filtro */}
      {fmtOpen && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.formatTabsRow}>
          <TouchableOpacity
            style={[s.formatTab, !selectedFormat && s.formatTabActive]}
            onPress={() => onSelectFormat(null)}
            activeOpacity={0.75}>
            <Text style={[s.formatTabText, !selectedFormat && s.formatTabTextActive]}>Todo</Text>
          </TouchableOpacity>
          {FORMATS.map(f => {
            const active = selectedFormat === f;
            return (
              <TouchableOpacity
                key={f}
                style={[s.formatTab, active && s.formatTabActive]}
                onPress={() => onSelectFormat(active ? null : f)}
                activeOpacity={0.75}>
                <Text style={[s.formatTabText, active && s.formatTabTextActive]}>{FORMAT_LABEL[f]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Lista de recursos */}
      {resources.length === 0 ? (
        <Text style={s.emptyText}>No hay recursos para este tema todavía</Text>
      ) : (
        <View style={{ marginTop: 12, gap: 9 }}>
          {resources.map(r => {
            const color = FORMAT_COLOR[r.format] ?? TERRACOTTA;
            const isSaved = savedIds.has(r.id);
            const coachName = r.coaches?.profiles?.name ?? 'un profesional';
            const coachProfileId = r.coaches?.profile_id;
            return (
              <ScaleCard
                key={r.id}
                style={s.exploreRow}
                onPress={() => router.push({ pathname: '/coach-recurso', params: { id: r.id } } as any)}
                activeOpacity={0.9}>
                <View style={[s.exploreCover, { backgroundColor: color }]}>
                  <Ionicons name={FORMAT_ICON[r.format] ?? 'book-outline'} size={15} color="#fff" />
                  <Text style={s.exploreCoverLabel}>{(FORMAT_LABEL[r.format] ?? r.format).toUpperCase()}</Text>
                </View>
                <View style={s.exploreRowText}>
                  <Text style={s.exploreRowTitle} numberOfLines={2}>{displayTitle(r.title)}</Text>
                  <Text style={s.exploreRowMeta} numberOfLines={1}>
                    {r.duration_seconds ? `${fmtDuration(r.duration_seconds)} · ` : ''}por{' '}
                    <Text
                      style={s.exploreRowAuthor}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!coachProfileId) return;
                        if (userId) logResourceEvent(userId, r.id, 'coach_profile_visit');
                        router.push({ pathname: '/profesional', params: { profileId: coachProfileId, resourceId: r.id } } as any);
                      }}>
                      {coachName}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onSave(r.id)} hitSlop={8}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={isSaved ? TERRACOTTA : FOREST_SOFT}
                  />
                </TouchableOpacity>
              </ScaleCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Labels cortos solo para el tile (Ajuste 2) — el label "real" de Tool sigue
// intacto para el resto de los consumidores (ReminderBell, headers de tool, etc.).
const TILE_LABEL: Record<string, string> = {
  respiracion: 'Respirar',
  ruido: 'Ruidos',
};

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolTile}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.75}>
      <View style={s.toolIconWrap}>
        <Ionicons name={tool.icon} size={16} color={FOREST} />
      </View>
      <Text style={s.toolLabel}>{TILE_LABEL[tool.id] ?? tool.label}</Text>
    </ScaleCard>
  );
}

// ─── ToolsCarousel ────────────────────────────────────────────────────────────
// Todas las tools de VITA en una fila fija (no scrollea — son 4, entran enteras).
// El orden preserva la intención de TOOL_GROUPS (calma → reflexión).
function ToolsCarousel() {
  const seen = new Set<string>();
  const tools: Tool[] = [];
  for (const g of TOOL_GROUPS) {
    for (const id of g.toolIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = TOOL_MAP[id];
      if (t) tools.push(t);
    }
  }

  return (
    <View style={s.toolsRow}>
      {tools.map(tool => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [libraryResources, setLibraryResources] = useState<LibraryResource[]>([]);
  const [coachRecos, setCoachRecos] = useState<CoachRecoItem[]>([]);
  const [exploreResources, setExploreResources] = useState<CoachResourceItem[]>([]);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  // ── Cargar biblioteca de recursos publicados por coaches (tabla resources vieja) ──
  useEffect(() => {
    supabase
      .from('resources')
      .select('id, type, title, duration_min, attributed_to_coach_id, profiles!inner(name), resource_axes(axis)')
      .not('attributed_to_coach_id', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!data) return;
        setLibraryResources(data.map((r: any) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          duration_min: r.duration_min,
          attributed_to_coach_id: r.attributed_to_coach_id,
          coachName: r.profiles?.name ?? 'un profesional',
          axes: (r.resource_axes ?? []).map((a: any) => a.axis),
        })));
      });
  }, []);

  // ── Recomendaciones de coaches al usuario ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('resource_recommendations')
      .select('id, resource_id, note, opened_at, created_at, coach_resources!inner(id, title, format, duration_seconds, topic_id), coaches!inner(profiles!inner(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setCoachRecos(data as any); });
  }, [user]);

  // ── Explorar coach_resources con filtros ────────────────────────────────────
  useEffect(() => {
    let query = supabase
      .from('coach_resources')
      .select('id, title, format, duration_seconds, topic_id, coaches!inner(profile_id, profiles!inner(name))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20);
    if (selectedDoor) query = query.eq('topic_id', selectedDoor);
    if (selectedFormat) query = query.eq('format', selectedFormat);
    query.then(({ data }) => { if (data) setExploreResources(data as any); });
  }, [selectedDoor, selectedFormat]);

  const { entries: moodEntries } = useMoodHistory(user?.id, 1);
  const todayMoodEntry = moodEntries[0];

  const { streak, weekActivity, lastInProgress, completedInLast7Days } =
    useResourceProgress(user?.id);

  const { reco } = useRecommendedResource({
    userId: user?.id,
    todayMood: todayMoodEntry,
    library: libraryResources,
    recentlyDone: completedInLast7Days,
  });

  // ── Cargar guardados ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('saved_resources').select('resource_id').eq('user_id', user.id),
      supabase.from('resource_saves').select('resource_id').eq('user_id', user.id),
    ]).then(([old, newer]) => {
      const ids = new Set<string>();
      (old.data ?? []).forEach(r => ids.add(r.resource_id as string));
      (newer.data ?? []).forEach(r => ids.add(r.resource_id as string));
      setSavedIds(ids);
    });
  }, [user]);

  async function toggleSave(resourceId: string, isCoachResource = false) {
    if (!user) { requestAuth(); return; }
    const isSaved = savedIds.has(resourceId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(resourceId); else next.add(resourceId);
      return next;
    });
    const table = isCoachResource ? 'resource_saves' : 'saved_resources';
    if (isSaved) {
      await supabase.from(table).delete().eq('user_id', user.id).eq('resource_id', resourceId);
    } else {
      await supabase.from(table).insert({ user_id: user.id, resource_id: resourceId });
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
          description="Herramientas de bienestar para usar cuando quieras, a tu ritmo"
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {/* 1. Header + racha + guardados */}
          <View style={s.header}>
            <Text style={s.pageTitle}>Recursos</Text>
            <View style={s.headerActions}>
              {streak > 0 && (
                <StreakChip streak={streak} weekActivity={weekActivity} />
              )}
              <TouchableOpacity
                onPress={() => (user ? router.push('/mis-recordatorios' as any) : requestAuth())}
                hitSlop={8}
                activeOpacity={0.7}>
                <Ionicons name="notifications-outline" size={22} color={FOREST} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (user ? router.push('/recursos-guardados') : requestAuth())}
                hitSlop={8}
                activeOpacity={0.7}
                style={s.bookmarkBtnWrap}>
                <Ionicons name="bookmark-outline" size={22} color={FOREST} />
                {savedIds.size > 0 && (
                  <View style={s.bookmarkBadge}>
                    <Text style={s.bookmarkBadgeText}>{savedIds.size}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 1. Herramientas de Vita — sugerencia del día (hero/línea) + tiles */}
          <View style={s.libraryHeaderRow}>
            <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Herramientas de Vita</Text>
            <Text style={s.sectionSubtitle}>Prácticas, de uso diario</Text>
          </View>
          <RecommendedCard
            reco={reco}
            todayMoodEntry={todayMoodEntry}
            onGoToCheckIn={() => router.push('/')}
          />
          <ToolsCarousel />

          {/* Continuar donde dejaste */}
          {lastInProgress && (
            <ContinueCard {...lastInProgress} />
          )}

          {/* 2. Recomendado por tu coach — recomendaciones personalizadas por chat */}
          <CoachRecoSection
            recos={coachRecos}
            onPress={async item => {
              if (!item.opened_at) {
                await supabase
                  .from('resource_recommendations')
                  .update({ opened_at: new Date().toISOString() })
                  .eq('id', item.id)
                  .is('opened_at', null);
                setCoachRecos(prev => prev.map(r =>
                  r.id === item.id ? { ...r, opened_at: new Date().toISOString() } : r
                ));
              }
              router.push({
                pathname: '/coach-recurso',
                params: { id: item.resource_id, note: item.note ?? '', fromCoachName: item.coaches?.profiles?.name ?? '' },
              } as any);
            }}
          />

          {/* 3. Biblioteca — coach_resources publicados */}
          <ExploreSection
            resources={exploreResources}
            savedIds={savedIds}
            onSave={id => toggleSave(id, true)}
            selectedDoor={selectedDoor}
            onSelectDoor={setSelectedDoor}
            selectedFormat={selectedFormat}
            onSelectFormat={setSelectedFormat}
            userId={user?.id}
          />

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bookmarkBtnWrap: {
    position: 'relative',
  },
  bookmarkBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bookmarkBadgeText: {
    fontFamily: ViveFonts.bold,
    fontSize: 9,
    color: '#FFF6EC',
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
    marginBottom: 12,
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
  moodPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: TERRA_SOFT,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  moodPillText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST,
  },
  moodLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
  },
  moodLineTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodLineWhy: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST,
  },
  moodLineTool: {
    flexShrink: 0,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST,
  },
  moodLineBold: {
    fontFamily: ViveFonts.semibold,
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
  libraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitleFlush: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
  exploreLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: TERRACOTTA,
    marginLeft: 10,
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
  toolsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
  },
  toolTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  toolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: FOREST,
    textAlign: 'center',
    lineHeight: 13,
  },

  sectionSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },

  // ── CoachRecoSection — tarjeta-mensaje (Ajuste 3) ────────────────────────────
  recoUnopenedCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  recbox: {
    backgroundColor: CREAM_DEEP,
    borderRadius: 22,
    padding: 15,
  },
  recHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recAvatarText: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 12,
    color: '#FFF3E8',
  },
  recHeadName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: FOREST,
  },
  recHeadSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: FOREST_SOFT,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TERRACOTTA,
    flexShrink: 0,
  },
  recNote: {
    fontFamily: ViveFonts.frauncesSerif,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: '#2E3624',
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 11,
  },
  recAttach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    padding: 10,
    marginTop: 10,
  },
  recAttachIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recAttachTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: FOREST,
  },
  recAttachMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  recAttachPlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CREAM_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── ExploreSection ────────────────────────────────────────────────────────
  chipsRow: {
    gap: 7,
    paddingBottom: 2,
  },
  chip: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: FOREST,
  },
  chipTextActive: {
    color: '#F3EEDF',
  },
  filterBtn: {
    flexShrink: 0,
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  formatTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 12,
    paddingRight: 8,
  },
  formatTab: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  formatTabActive: {
    borderColor: LINE,
    backgroundColor: CARD,
    paddingHorizontal: 12,
  },
  formatTabText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FOREST_SOFT,
  },
  formatTabTextActive: {
    fontFamily: ViveFonts.semibold,
    color: FOREST,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginVertical: 20,
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  exploreCover: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    flexShrink: 0,
  },
  exploreCoverLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 7,
    letterSpacing: 0.4,
    color: '#fff',
  },
  exploreRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  exploreRowTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: FOREST,
    lineHeight: 17,
  },
  exploreRowMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: FOREST_SOFT,
  },
  exploreRowAuthor: {
    color: FOREST,
    fontFamily: ViveFonts.medium,
  },

});
