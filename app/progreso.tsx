import { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { GlassCard } from '@/components/ui/GlassCard';
import { VitaHeader } from '@/components/ui/VitaHeader';
import { ProgressToggle } from '@/components/ui/ProgressToggle';

// ─── Datos / placeholders ─────────────────────────────────────────────────────

// TODO: calcular de analytics_events o tabla de progreso futura
const stats = [
  { value: 12, label: 'Semanas\nactivas' },
  { value: 3,  label: 'Áreas\ntrabajadas' },
  { value: 28, label: 'Sesiones\ncompletadas' }, // TODO: COUNT de bookings con status='completada'
];

// TODO: conectar con tabla de hábitos / saved_resources cuando exista
const habitos = [
  { id: '1', label: 'Respiración 4-7-8',    done: true  },
  { id: '2', label: 'Diario de gratitud',    done: true  },
  { id: '3', label: 'Meditación guiada',     done: false },
  { id: '4', label: 'Seguimiento de hábitos', done: true },
];

// TODO: fetchear de bookings con status='completada' + join con coaches/profiles
const historialSesiones = [
  { id: '1', name: 'María González', specialty: 'Psicóloga', date: 'Lunes 9 de junio',  time: '11:00 hs' },
  { id: '2', name: 'María González', specialty: 'Psicóloga', date: 'Lunes 2 de junio',  time: '11:00 hs' },
  { id: '3', name: 'María González', specialty: 'Psicóloga', date: 'Lunes 26 de mayo',  time: '11:00 hs' },
];

const { width: W } = Dimensions.get('window');
const CARD_MX = 18;

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function ProgresoScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'hoy' | 'mes'>('hoy');
  const [habitosDone, setHabitosDone] = useState<Record<string, boolean>>(
    Object.fromEntries(habitos.map(h => [h.id, h.done]))
  );

  function toggleHabito(id: string) {
    setHabitosDone(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <View style={s.root}>
      <AppBg />

      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Header: VITA + toggle */}
          <VitaHeader right={<ProgressToggle value={tab} onChange={setTab} />} />

          {/* Atrás */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          {/* Título */}
          <Text style={s.pageTitle}>Tu progreso</Text>

          {/* Stats: 3 tarjetas */}
          <View style={s.statsRow}>
            {stats.map((st, i) => (
              <GlassCard key={i} style={s.statCard}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </GlassCard>
            ))}
          </View>

          {/* Hábitos de hoy */}
          <Text style={s.sectionTitle}>Hábitos de hoy</Text>
          <GlassCard style={s.habitosCard}>
            {habitos.map((h, i) => (
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
                {i < habitos.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </GlassCard>

          {/* Historial de sesiones */}
          <Text style={s.sectionTitle}>Historial de sesiones</Text>
          <View style={s.historialList}>
            {historialSesiones.map(ses => (
              <GlassCard key={ses.id} style={s.sesionCard}>
                <View style={s.sesionAvatar}>
                  <Text style={s.sesionAvatarText}>{ses.name[0]}</Text>
                </View>
                <View style={s.sesionInfo}>
                  <Text style={s.sesionName}>{ses.name}</Text>
                  <Text style={s.sesionSub}>{ses.specialty} · {ses.date}</Text>
                  <Text style={s.sesionSub}>{ses.time}</Text>
                </View>
                <MaterialCommunityIcons name="check-circle-outline" size={22} color="rgba(255,255,255,0.55)" />
              </GlassCard>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
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

  // Stats
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

  // Sección
  sectionTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 22,
    marginBottom: 10,
  },

  // Hábitos
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

  // Historial
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
});
