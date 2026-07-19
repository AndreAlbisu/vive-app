import React, { useState, useEffect, useMemo } from 'react';
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
import { useRecommendedResource, type Reco } from '@/hooks/useRecommendedResource';
import { DOORS, DOOR_MAP } from '@/constants/conexionesDoors';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
  url: string | null;
  source: string;
  coaches: {
    profiles: { name: string };
  };
};

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


// ─── Datos ───────────────────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario'      },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud'    },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min',  route: '/sueno'       },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min',    route: '/respiracion' },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min',  route: '/meditacion'  },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min',      route: '/escaner'     },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min',     route: '/relajacion'  },
  { id: 'ruido',       label: 'Ruido blanco',     icon: 'volume-medium-outline', duration: 'Libre',      route: '/ruido'       },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min',   route: '/lecturas'    },
  { id: 'anclaje',     label: 'Anclaje',          icon: 'locate-outline',        duration: '2–3 min',    route: '/anclaje'     },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.id, t]));

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

// ─── RecommendedCard ──────────────────────────────────────────────────────────
// Tarjeta única que reemplaza al viejo bloque de mood + la CoachSection falsa.
// La lógica de qué recomendar vive en useRecommendedResource; acá solo se pinta.
function RecommendedCard({
  reco,
  onGoToCheckIn,
}: {
  reco: Reco | null;
  onGoToCheckIn: () => void;
}) {
  const router = useRouter();

  // Sin señal (ni ánimo ni tema ni historial) → invitamos al check-in, que es
  // justo lo que destraba la recomendación personalizada.
  if (!reco) {
    return (
      <LinearGradient
        colors={['#42542F', '#354526']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.moodCard}>
        <Text style={s.moodEyebrow}>CHECK-IN DE ÁNIMO</Text>
        <Text style={s.moodTitle}>{'¿Cómo te sentís hoy?'}</Text>
        <TouchableOpacity style={s.moodPillBtn} onPress={onGoToCheckIn} activeOpacity={0.85}>
          <Ionicons name="happy-outline" size={18} color={FOREST} />
          <Text style={s.moodPillText}>Registrar mi estado de ánimo</Text>
          <Ionicons name="arrow-forward" size={16} color={FOREST} />
        </TouchableOpacity>
      </LinearGradient>
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

  return (
    <LinearGradient
      colors={['#42542F', '#354526']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.moodCard}>
      <Text style={s.moodEyebrow}>{reco.eyebrow}</Text>
      <Text style={s.moodTitle}>{reco.why}</Text>
      <TouchableOpacity style={s.moodPillBtn} onPress={onPress} activeOpacity={0.85}>
        <Ionicons name={icon} size={18} color={FOREST} />
        <Text style={s.moodPillText}>{title}{duration ? ` · ${duration}` : ''}</Text>
        <Ionicons name="arrow-forward" size={16} color={FOREST} />
      </TouchableOpacity>
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
  audio:   '#C1694F',
  podcast: '#3B7FC4',
  video:   '#7B5EA7',
  lectura: '#4A7C59',
};
const FORMAT_LABEL: Record<string, string> = {
  audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura',
};
const FORMAT_ICON: Record<string, IoniconName> = {
  audio:   'volume-medium-outline',
  podcast: 'mic-outline',
  video:   'videocam-outline',
  lectura: 'book-outline',
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)}h`;
}

// Dónde se consume el recurso — mismo criterio que coach-recurso.tsx.
function podcastSource(url: string): string {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('apple')) return 'Apple Podcasts';
  if (url.includes('youtube')) return 'YouTube';
  return 'la fuente';
}

function whereLine(r: { format: string; url: string | null }): string {
  if (r.format === 'video') return 'abre en YouTube';
  if (r.format === 'podcast' && r.url) return `abre en ${podcastSource(r.url)}`;
  return 'en la app';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── CoachRecoSection ─────────────────────────────────────────────────────────
function CoachRecoSection({
  recos,
  onPress,
}: {
  recos: CoachRecoItem[];
  onPress: (item: CoachRecoItem) => void;
}) {
  if (recos.length === 0) return null;
  const unopenedCount = recos.filter(r => !r.opened_at).length;

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={s.libraryHeaderRow}>
        <Text style={[s.sectionTitle, s.sectionTitleFlush]}>De tus coaches</Text>
        {unopenedCount > 0 && (
          <Text style={s.recoUnopenedCount}>{unopenedCount} sin abrir</Text>
        )}
      </View>
      {recos.map(item => {
        const res = item.coach_resources;
        const color = FORMAT_COLOR[res.format] ?? TERRACOTTA;
        const isNew = !item.opened_at;
        const coachName = item.coaches?.profiles?.name ?? 'Tu coach';
        return (
          <ScaleCard
            key={item.id}
            style={s.recoCard}
            onPress={() => onPress(item)}
            activeOpacity={0.9}>
            <View style={s.recoRow}>
              <View style={[s.recoIconSq, { backgroundColor: color }]}>
                <Ionicons name={FORMAT_ICON[res.format] ?? 'book-outline'} size={20} color="#fff" />
              </View>
              <View style={s.recoBody}>
                <View style={s.recoTopRow}>
                  <Text style={s.recoTitle} numberOfLines={2}>{res.title}</Text>
                  {isNew && <View style={s.recoBadge}><Text style={s.recoBadgeText}>NUEVO</Text></View>}
                </View>
                <Text style={s.recoMeta} numberOfLines={2}>
                  {FORMAT_LABEL[res.format] ?? res.format}
                  {res.duration_seconds ? ` · ${fmtDuration(res.duration_seconds)}` : ''}
                  {' · te lo mandó '}
                  <Text style={s.recoCoachBold}>{coachName}</Text>
                  {' por chat'}
                </Text>
              </View>
            </View>
            {item.note ? (
              <View style={s.recoNoteBox}>
                <Text style={s.recoNote} numberOfLines={3}>"{item.note}"</Text>
              </View>
            ) : null}
            <View style={s.recoOpenBtn}>
              <Text style={s.recoOpenBtnText}>Abrir</Text>
            </View>
          </ScaleCard>
        );
      })}
    </View>
  );
}

// ─── ExploreSection ───────────────────────────────────────────────────────────
const FORMATS = ['audio', 'video', 'podcast', 'lectura'] as const;

function ExploreSection({
  resources,
  savedIds,
  onSave,
  selectedDoor,
  onSelectDoor,
  selectedFormat,
  onSelectFormat,
}: {
  resources: CoachResourceItem[];
  savedIds: Set<string>;
  onSave: (id: string) => void;
  selectedDoor: string | null;
  onSelectDoor: (id: string | null) => void;
  selectedFormat: string | null;
  onSelectFormat: (f: string | null) => void;
}) {
  const router = useRouter();

  return (
    <View style={{ marginTop: 8 }}>
      <View style={s.libraryHeaderRow}>
        <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Explorar por tema</Text>
        <Text style={s.sectionSubtitle}>Contenido de coaches</Text>
      </View>

      {/* Chips de puertas */}
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
      </ScrollView>

      {/* Filtro de formato — tabs de texto */}
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

      {/* Lista de recursos */}
      {resources.length === 0 ? (
        <Text style={s.emptyText}>No hay recursos para este tema todavía.</Text>
      ) : (
        <View style={{ marginTop: 12, gap: 10 }}>
          {resources.map(r => {
            const color = FORMAT_COLOR[r.format] ?? TERRACOTTA;
            const isSaved = savedIds.has(r.id);
            const coachName = r.coaches?.profiles?.name ?? 'un coach';
            const doorLabel = DOOR_MAP[r.topic_id]?.label;
            return (
              <ScaleCard
                key={r.id}
                style={s.exploreRow}
                onPress={() => router.push({ pathname: '/coach-recurso', params: { id: r.id } } as any)}
                activeOpacity={0.9}>
                <View style={s.exploreRowTop}>
                  <View style={[s.exploreIconSq, { backgroundColor: color }]}>
                    <Ionicons name={FORMAT_ICON[r.format] ?? 'book-outline'} size={18} color="#fff" />
                    <Text style={s.exploreIconLabel}>{(FORMAT_LABEL[r.format] ?? r.format).toUpperCase()}</Text>
                  </View>
                  <View style={s.exploreRowText}>
                    <Text style={s.exploreRowTitle} numberOfLines={2}>{r.title}</Text>
                    <Text style={s.exploreRowMeta}>
                      {r.duration_seconds ? `${fmtDuration(r.duration_seconds)} · ` : ''}{whereLine(r)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onSave(r.id)} hitSlop={8}>
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? TERRACOTTA : 'rgba(135,131,92,0.55)'}
                    />
                  </TouchableOpacity>
                </View>
                <View style={s.exploreRowDivider} />
                <View style={s.exploreRowBottom}>
                  <View style={s.exploreAvatar}>
                    <Text style={s.exploreAvatarText}>{initials(coachName)}</Text>
                  </View>
                  <Text style={s.exploreRowCoach} numberOfLines={1}>por {coachName}</Text>
                  <View style={{ flex: 1 }} />
                  {doorLabel ? (
                    <View style={s.explorePill}>
                      <Text style={s.explorePillText} numberOfLines={1}>{doorLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </ScaleCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolTile}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.75}>
      <View style={s.toolIconWrap}>
        <Ionicons name={tool.icon} size={24} color={FOREST} />
      </View>
      <Text style={s.toolLabel}>{tool.label}</Text>
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
          coachName: r.profiles?.name ?? 'un coach',
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
      .select('id, title, format, duration_seconds, topic_id, url, source, coaches!inner(profiles!inner(name))')
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
          description="Herramientas de bienestar para usar cuando quieras, a tu ritmo."
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
                activeOpacity={0.7}>
                <Ionicons name="bookmark-outline" size={22} color={FOREST} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Recomendación personalizada (ánimo + tema) */}
          <RecommendedCard
            reco={reco}
            onGoToCheckIn={() => router.push('/')}
          />

          {/* 3. Continuar donde dejaste */}
          {lastInProgress && (
            <ContinueCard {...lastInProgress} />
          )}

          {/* 4. De tus coaches — recomendaciones personalizadas por chat */}
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
              router.push({ pathname: '/coach-recurso', params: { id: item.resource_id } } as any);
            }}
          />

          {/* 5. Herramientas de Vita */}
          <View style={s.libraryHeaderRow}>
            <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Herramientas de Vita</Text>
            <Text style={s.sectionSubtitle}>Prácticas, de uso diario</Text>
          </View>
          <ToolsCarousel />

          {/* 6. Explorar por tema — coach_resources publicados */}
          <ExploreSection
            resources={exploreResources}
            savedIds={savedIds}
            onSave={id => toggleSave(id, true)}
            selectedDoor={selectedDoor}
            onSelectDoor={setSelectedDoor}
            selectedFormat={selectedFormat}
            onSelectFormat={setSelectedFormat}
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
  coachCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginBottom: 24,
  },
  libraryRow: { gap: 10, paddingBottom: 4 },
  libraryCard: {
    width: 140,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 6,
  },
  libraryCardTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FOREST,
    lineHeight: 17,
  },
  libraryCardMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
  },
  libraryCardCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(58,79,42,0.55)',
    fontStyle: 'italic',
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
  libraryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
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
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  toolTile: {
    alignItems: 'center',
    gap: 8,
    width: 74,
  },
  toolIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: FOREST,
    textAlign: 'center',
    lineHeight: 16,
  },

  sectionSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },

  // ── CoachRecoSection ──────────────────────────────────────────────────────
  recoUnopenedCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  recoCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  recoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recoIconSq: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recoBody: {
    flex: 1,
    gap: 4,
  },
  recoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recoTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: FOREST,
    lineHeight: 20,
  },
  recoBadge: {
    backgroundColor: TERRACOTTA,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  recoBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  recoMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
    lineHeight: 17,
  },
  recoCoachBold: {
    fontFamily: ViveFonts.semibold,
    color: FOREST,
  },
  recoNoteBox: {
    backgroundColor: CREAM_LIGHT,
    borderRadius: 12,
    padding: 12,
  },
  recoNote: {
    fontFamily: ViveFonts.frauncesSerif,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: FOREST,
    lineHeight: 19,
  },
  recoOpenBtn: {
    alignSelf: 'flex-end',
    backgroundColor: FOREST,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  recoOpenBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#F3EEDF',
  },

  // ── ExploreSection ────────────────────────────────────────────────────────
  chipsRow: {
    gap: 7,
    paddingBottom: 2,
  },
  chip: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
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
  formatTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 12,
    paddingRight: 8,
  },
  formatTab: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  formatTabActive: {
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: FOREST,
    borderRadius: 14,
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
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 13,
  },
  exploreRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  exploreIconSq: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
  },
  exploreIconLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 8,
    letterSpacing: 0.4,
    color: '#fff',
  },
  exploreRowText: {
    flex: 1,
    gap: 3,
  },
  exploreRowTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: FOREST,
    lineHeight: 20,
  },
  exploreRowMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  exploreRowDivider: {
    height: 1,
    backgroundColor: 'rgba(63,81,47,0.10)',
    marginVertical: 11,
  },
  exploreRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exploreAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreAvatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 9,
    color: '#fff',
  },
  exploreRowCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
  },
  explorePill: {
    backgroundColor: 'rgba(107,122,86,0.16)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 140,
  },
  explorePillText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: FOREST,
  },

});
