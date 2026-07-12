import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle as SvgCircle, Line as SvgLine, Polyline, Text as SvgText,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ViveFonts, ViveMoodColors } from '@/constants/theme';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import type { MoodEntry } from '@/hooks/useMoodHistory';
import { AppBg } from '@/components/ui/AppBg';
import { GlassCard } from '@/components/ui/GlassCard';
import { VitaHeader } from '@/components/ui/VitaHeader';
import { ProgressToggle } from '@/components/ui/ProgressToggle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getSemanasActivas } from '@/lib/stats';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PastSession {
  id: string;
  coachName: string;
  specialty: string | null;
  date: string;
  time: string;
}

// ─── Mapeo de topics de coach → áreas de la app ──────────────────────────────
const TOPIC_TO_AREA: Record<string, string> = {
  'Tristeza': 'emocion', 'Ansiedad': 'emocion', 'Enojo': 'emocion',
  'Culpa': 'emocion', 'Vergüenza': 'emocion', 'Alegría': 'emocion', 'Autoestima': 'emocion',
  'Soledad': 'emocion', 'Ansiedad social': 'emocion', 'Duelo': 'emocion',
  'Pareja': 'relaciones', 'Familia': 'relaciones', 'Amistades': 'relaciones', 'Vínculos laborales': 'relaciones',
  'Productividad': 'trabajo', 'Concentración': 'trabajo', 'Procrastinación': 'trabajo',
  'Hábitos mentales': 'trabajo', 'Burnout (estrés laboral)': 'trabajo',
  'Sueño': 'salud', 'Energía': 'salud', 'Actividad física': 'salud',
  'Estrés físico': 'salud', 'Hábitos': 'salud', 'Nutrición': 'salud', 'Sexualidad': 'salud',
  'Propósito': 'proposito', 'Identidad': 'proposito', 'Motivación': 'proposito',
  'Crecimiento': 'proposito', 'Momentos de cambio': 'proposito', 'Espiritualidad': 'proposito',
};

// ─── Hábitos (estado local, sin DB aún) ──────────────────────────────────────
// TODO: conectar con tabla de hábitos cuando exista

const HABITOS_INIT = [
  { id: '1', label: 'Respiración 4-7-8',      done: true  },
  { id: '2', label: 'Diario de gratitud',      done: true  },
  { id: '3', label: 'Meditación guiada',       done: false },
  { id: '4', label: 'Seguimiento de hábitos',  done: true  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  return `${dayName} ${day} de ${MONTHS_ES[month - 1]}`;
}

const CARD_MX = 18;

// ─── Pantalla ─────────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<number, string> = {
  1: 'Bajón', 2: 'Cansado', 3: 'Neutral', 4: 'Bien', 5: 'Genial',
};
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LETTERS     = ['D',   'L',   'M',   'M',   'J',   'V',   'S'];

export default function ProgresoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'hoy' | 'mes'>('hoy');
  const [habitosDone, setHabitosDone] = useState<Record<string, boolean>>(
    Object.fromEntries(HABITOS_INIT.map(h => [h.id, h.done]))
  );
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [semanasActivas, setSemanasActivas] = useState<number>(0);
  const [areasCount, setAreasCount] = useState<number | null>(null);

  const { entries: moodEntries, loading: moodLoading } = useMoodHistory(user?.id, 14);

  // ── Métricas de mood ───────────────────────────────────────────────────────
  const avgMoodLabel = (() => {
    if (!moodEntries.length) return '—';
    const avg = moodEntries.reduce((s, e) => s + e.mood_id, 0) / moodEntries.length;
    return MOOD_LABELS[Math.round(avg)];
  })();

  const moodStreak = (() => {
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    const sorted = [...moodEntries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    let expected = today;
    for (const e of sorted) {
      if (e.entry_date === expected) {
        streak++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().split('T')[0];
      } else break;
    }
    return streak;
  })();

  const bestDayLabel = (() => {
    if (!moodEntries.length) return '—';
    const byDow: Record<number, { sum: number; count: number }> = {};
    moodEntries.forEach(e => {
      const [y, m, d] = e.entry_date.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      if (!byDow[dow]) byDow[dow] = { sum: 0, count: 0 };
      byDow[dow].sum += e.mood_id;
      byDow[dow].count += 1;
    });
    const best = Object.entries(byDow)
      .map(([dow, { sum, count }]) => ({ dow: Number(dow), avg: sum / count }))
      .sort((a, b) => b.avg - a.avg)[0];
    return best ? DAY_NAMES_SHORT[best.dow] : '—';
  })();

  function toggleHabito(id: string) {
    setHabitosDone(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    getSemanasActivas(user!.id).then(setSemanasActivas);

    async function fetchData() {
      // Sesiones pasadas (confirmadas con fecha ya pasada, o completadas)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, coach_id, scheduled_date, scheduled_time')
        .eq('user_id', user!.id)
        .or(`status.eq.completada,and(status.eq.confirmada,scheduled_date.lt.${today})`)
        .order('scheduled_date', { ascending: false })
        .limit(10);

      if (!bookings || bookings.length === 0) {
        setPastSessions([]);
        setSessionCount(0);
        setLoadingSessions(false);
        return;
      }

      setSessionCount(bookings.length);

      // bookings.coach_id → coaches.id (PK interno, no profiles.id)
      const coachInternalIds = [...new Set(bookings.map(b => b.coach_id as string))];

      const { data: coachRows } = await supabase
        .from('coaches')
        .select('id, profile_id, specialty')
        .in('id', coachInternalIds);

      const { data: topicRows } = await supabase
        .from('coach_topics')
        .select('topic')
        .in('coach_id', coachInternalIds);

      const uniqueAreas = new Set<string>();
      topicRows?.forEach(t => {
        const area = TOPIC_TO_AREA[t.topic as string];
        if (area) uniqueAreas.add(area);
      });
      setAreasCount(uniqueAreas.size || null);

      const profileIds = [...new Set((coachRows ?? []).map(c => c.profile_id as string))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, name').in('id', profileIds);

      const coachToProfileId: Record<string, string> = {};
      const specialtyMap: Record<string, string> = {};
      coachRows?.forEach(c => {
        coachToProfileId[c.id as string] = c.profile_id as string;
        specialtyMap[c.id as string] = c.specialty as string;
      });

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.name ?? 'Coach'; });

      const sessions: PastSession[] = bookings.map(b => ({
        id: b.id as string,
        coachName: profileMap[coachToProfileId[b.coach_id as string] ?? ''] ?? 'Coach',
        specialty: specialtyMap[b.coach_id as string] ?? null,
        date: formatDate(b.scheduled_date as string),
        time: (b.scheduled_time as string).slice(0, 5) + ' hs',
      }));

      setPastSessions(sessions);
      setLoadingSessions(false);
    }

    fetchData();
  }, [user]);

  const stats = [
    { value: semanasActivas,        label: 'Semanas\nactivas'      },
    { value: areasCount ?? '—',     label: 'Áreas\ntrabajadas'     },
    { value: sessionCount ?? '—',   label: 'Sesiones\ncompletadas' },
  ];

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Header: VITA + toggle ── */}
          <VitaHeader right={<ProgressToggle value={tab} onChange={setTab} />} />

          {/* ── Atrás ── */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
          </TouchableOpacity>

          {/* ── Título ── */}
          <Text style={s.pageTitle}>Tu progreso</Text>

          {/* ── Stats: 3 tarjetas ── */}
          <View style={s.statsRow}>
            {stats.map((st, i) => (
              <GlassCard key={i} style={s.statCard}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </GlassCard>
            ))}
          </View>

          {/* ── Estado de ánimo ── */}
          <Text style={s.sectionTitle}>Estado de ánimo</Text>
          <View style={s.moodStatsRow}>
            <GlassCard style={s.moodStatCard}>
              <Text style={s.moodStatValue}>{avgMoodLabel}</Text>
              <Text style={s.moodStatLabel}>{'Promedio\n14 días'}</Text>
            </GlassCard>
            <GlassCard style={s.moodStatCard}>
              <Text style={s.moodStatValue}>{moodStreak > 0 ? `${moodStreak}d` : '—'}</Text>
              <Text style={s.moodStatLabel}>{'Racha\nactual'}</Text>
            </GlassCard>
            <GlassCard style={s.moodStatCard}>
              <Text style={s.moodStatValue}>{bestDayLabel}</Text>
              <Text style={s.moodStatLabel}>{'Mejor\ndía'}</Text>
            </GlassCard>
          </View>
          <GlassCard style={s.moodChartCard}>
            {moodLoading ? (
              <ActivityIndicator size="small" color="#87835C" />
            ) : moodEntries.length === 0 ? (
              <Text style={s.emptyText}>
                Hacé tu primer check-in en la pantalla de inicio.
              </Text>
            ) : (
              <MoodLineChart entries={moodEntries} />
            )}
          </GlassCard>

          {/* ── Hábitos de hoy ── */}
          <Text style={s.sectionTitle}>Hábitos de hoy</Text>
          <GlassCard style={s.habitosCard}>
            {HABITOS_INIT.map((h, i) => (
              <View key={h.id}>
                <TouchableOpacity
                  style={s.habitoRow}
                  onPress={() => toggleHabito(h.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkCircle, habitosDone[h.id] && s.checkCircleDone]}>
                    {habitosDone[h.id] && (
                      <MaterialCommunityIcons name="check" size={14} color="#565E32" />
                    )}
                  </View>
                  <Text style={[s.habitoLabel, !habitosDone[h.id] && s.habitoLabelPending]}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
                {i < HABITOS_INIT.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </GlassCard>

          {/* ── Historial de sesiones ── */}
          <Text style={s.sectionTitle}>Historial de sesiones</Text>

          {loadingSessions ? (
            <ActivityIndicator size="small" color="#87835C" style={{ marginTop: 12 }} />
          ) : pastSessions.length === 0 ? (
            <GlassCard style={[s.emptyCard]}>
              <Text style={s.emptyText}>Todavía no hay sesiones completadas.</Text>
            </GlassCard>
          ) : (
            <View style={s.historialList}>
              {pastSessions.map(ses => (
                <GlassCard key={ses.id} style={s.sesionCard}>
                  <View style={s.sesionAvatar}>
                    <Text style={s.sesionAvatarText}>{ses.coachName[0]}</Text>
                  </View>
                  <View style={s.sesionInfo}>
                    <Text style={s.sesionName}>{ses.coachName}</Text>
                    <Text style={s.sesionSub}>
                      {ses.specialty ? `${ses.specialty} · ` : ''}{ses.date}
                    </Text>
                    <Text style={s.sesionSub}>{ses.time}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={22}
                    color="rgba(135,131,92,0.80)"
                  />
                </GlassCard>
              ))}
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 16 },

  backBtn: {
    marginLeft: 18,
    marginTop: 4,
    marginBottom: -4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pageTitle: {
    fontFamily: ViveFonts.bold,
    fontSize: 32,
    color: '#565E32',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 20,
    letterSpacing: -0.3,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: CARD_MX,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  statValue: {
    fontFamily: ViveFonts.bold,
    fontSize: 36,
    color: '#565E32',
    lineHeight: 42,
    letterSpacing: -1,
  },
  statLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#87835C',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },

  // ── Sección ───────────────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 22,
    marginBottom: 10,
  },

  // ── Mood ──────────────────────────────────────────────────────────────────
  moodStatsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: CARD_MX,
    marginBottom: 10,
  },
  moodStatCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  moodStatValue: {
    fontFamily: ViveFonts.bold,
    fontSize: 18,
    color: '#565E32',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  moodStatLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: '#87835C',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 4,
  },
  moodChartCard: {
    marginHorizontal: CARD_MX,
    marginBottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },

  // ── Hábitos ───────────────────────────────────────────────────────────────
  habitosCard: {
    marginHorizontal: CARD_MX,
    marginBottom: 24,
    paddingVertical: 4,
  },
  habitoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: 'rgba(86,94,50,0.14)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  habitoLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#565E32',
    flex: 1,
  },
  habitoLabelPending: { color: 'rgba(135,131,92,0.72)' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.48)',
    marginHorizontal: 16,
  },

  // ── Historial ─────────────────────────────────────────────────────────────
  historialList: { gap: 10, paddingHorizontal: CARD_MX },
  sesionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  sesionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,248,240,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sesionAvatarText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32' },
  sesionInfo: { flex: 1 },
  sesionName: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', lineHeight: 18 },
  sesionSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: '#87835C', lineHeight: 16 },

  // ── Empty / loading ───────────────────────────────────────────────────────
  emptyCard: {
    marginHorizontal: CARD_MX,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
    textAlign: 'center',
  },
});

// ─── Gráfico de línea de mood ─────────────────────────────────────────────────

function MoodLineChart({ entries }: { entries: MoodEntry[] }) {
  const { width: screenW } = useWindowDimensions();
  const chartW = screenW - 36;

  const NUM_DAYS  = 14;
  const PAD_TOP   = 10;
  const PAD_BOT   = 28;
  const PAD_H     = 14;
  const CHART_H   = 110;
  const plotH     = CHART_H - PAD_TOP - PAD_BOT;
  const plotW     = chartW - PAD_H * 2;

  // Array de últimos 14 días (del más antiguo al más reciente)
  const dates: string[] = [];
  for (let i = NUM_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const entryMap: Record<string, number> = {};
  entries.forEach(e => { entryMap[e.entry_date] = e.mood_id; });

  const pts = dates.map((date, i) => {
    const moodId = entryMap[date];
    const x = PAD_H + (i / (NUM_DAYS - 1)) * plotW;
    const y = moodId != null
      ? PAD_TOP + (1 - (moodId - 1) / 4) * plotH
      : null;
    return { x, y, moodId, date };
  });

  // Segmentos continuos (se cortan donde no hay dato)
  const segments: string[][] = [];
  let seg: string[] = [];
  pts.forEach(p => {
    if (p.y !== null) {
      seg.push(`${p.x},${p.y}`);
    } else {
      if (seg.length) { segments.push(seg); seg = []; }
    }
  });
  if (seg.length) segments.push(seg);

  return (
    <Svg width={chartW} height={CHART_H}>
      {/* Guías horizontales por nivel de mood */}
      {[1, 2, 3, 4, 5].map(mood => {
        const gy = PAD_TOP + (1 - (mood - 1) / 4) * plotH;
        return (
          <SvgLine
            key={mood}
            x1={PAD_H} y1={gy} x2={chartW - PAD_H} y2={gy}
            stroke="rgba(86,94,50,0.07)"
            strokeWidth={1}
          />
        );
      })}

      {/* Línea conectando los puntos (salta días sin dato) */}
      {segments.filter(s => s.length > 1).map((s, i) => (
        <Polyline
          key={i}
          points={s.join(' ')}
          fill="none"
          stroke="rgba(86,94,50,0.28)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Puntos coloreados por mood */}
      {pts.filter(p => p.y !== null).map((p, i) => (
        <SvgCircle
          key={i}
          cx={p.x}
          cy={p.y!}
          r={4.5}
          fill={ViveMoodColors[p.moodId!]}
        />
      ))}

      {/* Etiquetas de día — cada 2 para 14 días */}
      {dates.map((date, i) => {
        if (i % 2 !== 0) return null;
        const x = PAD_H + (i / (NUM_DAYS - 1)) * plotW;
        const [y, m, d] = date.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        return (
          <SvgText
            key={i}
            x={x}
            y={CHART_H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(86,94,50,0.38)"
          >
            {DAY_LETTERS[dow]}
          </SvgText>
        );
      })}
    </Svg>
  );
}
