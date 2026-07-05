import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';

type ProposalStatus = 'enviada' | 'necesita_ajustes' | 'aprobada' | 'descartada';

interface Proposal {
  id: string;
  type: string;
  title: string;
  status: ProposalStatus;
  reviewer_notes: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  audio: 'Audio',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

const STATUS_META: Record<ProposalStatus, { label: string; color: string; bg: string; icon: string }> = {
  enviada:          { label: 'En revisión',      color: '#87835C', bg: 'rgba(135,131,92,0.15)', icon: 'clock-outline' },
  necesita_ajustes: { label: 'Necesita ajustes',  color: '#C1694F', bg: 'rgba(193,105,79,0.15)', icon: 'alert-circle-outline' },
  aprobada:         { label: 'Aprobada',          color: '#3F7D4F', bg: 'rgba(63,125,79,0.15)',  icon: 'check-circle-outline' },
  descartada:       { label: 'Descartada',        color: '#9A9A9A', bg: 'rgba(154,154,154,0.15)', icon: 'close-circle-outline' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const meta = STATUS_META[proposal.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{TYPE_LABELS[proposal.type] ?? proposal.type}</Text>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{proposal.title}</Text>
      <Text style={styles.cardDate}>Enviada el {formatDate(proposal.created_at)}</Text>
      {proposal.reviewer_notes && (proposal.status === 'necesita_ajustes' || proposal.status === 'descartada') && (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Notas de VITA</Text>
          <Text style={styles.notesText}>{proposal.reviewer_notes}</Text>
        </View>
      )}
      {proposal.status === 'necesita_ajustes' && (
        <TouchableOpacity
          style={styles.resubmitBtn}
          onPress={() => router.push({ pathname: '/resource-proposal-new', params: { proposalId: proposal.id } })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="pencil-outline" size={14} color="#565E32" />
          <Text style={styles.resubmitBtnText}>Ajustar y reenviar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ResourceProposalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data: coachRow } = await supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!coachRow) { setLoading(false); return; }

    const { data } = await supabase
      .from('resource_proposals')
      .select('id, type, title, status, reviewer_notes, created_at')
      .eq('coach_id', coachRow.id)
      .order('created_at', { ascending: false });

    setProposals((data ?? []) as Proposal[]);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AppBg>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Mis recursos propuestos</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ProposalCard proposal={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="lightbulb-outline" size={40} color="rgba(135,131,92,0.4)" />
              <Text style={styles.emptyText}>Todavía no propusiste ningún recurso.</Text>
            </View>
          }
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/resource-proposal-new')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#F7EFE4" />
          <Text style={styles.newBtnText}>Proponer un recurso</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  titleRow: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    letterSpacing: -0.4,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  card: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(135,131,92,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
  },
  cardTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
  },
  cardDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.65)',
  },
  notesBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(193,105,79,0.08)',
    gap: 4,
  },
  resubmitBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ViveColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  resubmitBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
  },
  notesLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: 'rgba(135,131,92,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  notesText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 19,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.65)',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
    backgroundColor: 'rgba(247,239,228,0.97)',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 16,
  },
  newBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
});
