import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { AppBg } from '@/components/ui/AppBg';

// ─── Types ────────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Tool {
  id: string;
  label: string;
  icon: IoniconName;
  route?: string;
}

interface CoachResource {
  id: string;
  title: string;
  subtitle: string;
  icon: IoniconName;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',           icon: 'book-outline',           route: '/diario'   },
  { id: 'gratitud',    label: 'Gratitud',          icon: 'heart-outline',          route: '/gratitud' },
  { id: 'sueno',       label: 'Sueño',             icon: 'moon-outline'                               },
  { id: 'respiracion', label: 'Respiración',       icon: 'cloud-outline'                              },
  { id: 'meditacion',  label: 'Meditación',        icon: 'leaf-outline'                               },
  { id: 'escaner',     label: 'Escáner corporal',  icon: 'body-outline'                               },
  { id: 'relajacion',  label: 'Relajación',        icon: 'musical-notes-outline'                      },
  { id: 'ruido',       label: 'Ruido blanco',      icon: 'volume-medium-outline'                      },
  { id: 'lecturas',    label: 'Lecturas breves',   icon: 'library-outline'                            },
];

const COACH_RESOURCES: CoachResource[] = [
  { id: 'cr1', title: 'Respiración 4-7-8',  subtitle: 'Recomendado por María González · 5 min',  icon: 'cloud-outline'  },
  { id: 'cr2', title: 'Diario de gratitud', subtitle: 'Recomendado por María González · 10 min', icon: 'heart-outline'  },
];

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolCard}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.88}>
      <Ionicons name={tool.icon} size={28} color="rgba(255,255,255,0.85)" />
      <Text style={s.toolLabel}>{tool.label}</Text>
    </ScaleCard>
  );
}

// ─── CoachResourceCard ────────────────────────────────────────────────────────
function CoachResourceCard({ resource }: { resource: CoachResource }) {
  return (
    <View style={s.coachCard}>
      <View style={s.coachIconWrap}>
        <Ionicons name={resource.icon} size={20} color="rgba(255,255,255,0.80)" />
      </View>
      <View style={s.coachInfo}>
        <Text style={s.coachTitle}>{resource.title}</Text>
        <Text style={s.coachSubtitle}>{resource.subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.35)" />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
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

          <Text style={s.pageTitle}>Recursos</Text>

          {/* Recomendados por tu coach */}
          {COACH_RESOURCES.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recomendados por tu coach</Text>
              {COACH_RESOURCES.map(r => (
                <CoachResourceCard key={r.id} resource={r} />
              ))}
            </>
          )}

          {/* Herramientas */}
          <Text style={[s.sectionTitle, COACH_RESOURCES.length > 0 && s.sectionSpaced]}>
            Herramientas
          </Text>
          <View style={s.grid}>
            {[0, 1, 2].map(row => (
              <View key={row} style={s.gridRow}>
                {TOOLS.slice(row * 3, row * 3 + 3).map(tool => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  pageTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 20,
  },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 28 },

  coachCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  coachIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachInfo: { flex: 1 },
  coachTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 2,
  },
  coachSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 16,
  },

  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  toolCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 96,
  },
  toolLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 15,
  },
});
