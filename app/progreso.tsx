import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { GlassCard } from '@/components/ui/GlassCard';
import { VitaHeader } from '@/components/ui/VitaHeader';
import { ProgressToggle } from '@/components/ui/ProgressToggle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PastSession {
  id: string;
  coachName: string;
  specialty: string | null;
  date: string;
  time: string;
}

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

  function toggleHabito(id: string) {
    setHabitosDone(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

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

      const coachIds = [...new Set(bookings.map(b => b.coach_id as string))];

      const [{ data: profiles }, { data: coaches }] = await Promise.all([
        supabase.from('profiles').select('id, name').in('id', coachIds),
        supabase.from('coaches').select('profile_id, specialty').in('profile_id', coachIds),
      ]);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.name ?? 'Coach'; });

      const specialtyMap: Record<string, string> = {};
      coaches?.forEach(c => { specialtyMap[c.profile_id as string] = c.specialty as string; });

      const sessions: PastSession[] = bookings.map(b => ({
        id: b.id as string,
        coachName: profileMap[b.coach_id as string] ?? 'Coach',
        specialty: specialtyMap[b.coach_id as string] ?? null,
        date: formatDate(b.scheduled_date as string),
        time: (b.scheduled_time as string).slice(0, 5) + ' hs',
      }));

      setPastSessions(sessions);
      setLoadingSessions(false);
    }

    fetchData();
  }, [user]);

  // Stats: semanas y áreas son placeholders; sesiones viene de Supabase
  // TODO: calcular semanas activas desde fecha de primer booking (analytics_events)
  // TODO: calcular áreas trabajadas desde topics de bookings cuando exista el campo
  const stats = [
    { value: 12,                              label: 'Semanas\nactivas'      },
    { value: 3,                               label: 'Áreas\ntrabajadas'     },
    { value: sessionCount ?? '—',             label: 'Sesiones\ncompletadas' },
  ];

  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Header: VITA + toggle ── */}
          <VitaHeader right={<ProgressToggle value={tab} onChange={setTab} />} />

          {/* ── Atrás ── */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
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
                      <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
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
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginTop: 12 }} />
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
                    color="rgba(255,255,255,0.55)"
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: -1,
  },
  statLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
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
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  habitoLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  habitoLabelPending: { color: 'rgba(255,255,255,0.5)' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sesionAvatarText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFFFFF' },
  sesionInfo: { flex: 1 },
  sesionName: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#FFFFFF', lineHeight: 18 },
  sesionSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 16 },

  // ── Empty / loading ───────────────────────────────────────────────────────
  emptyCard: {
    marginHorizontal: CARD_MX,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
