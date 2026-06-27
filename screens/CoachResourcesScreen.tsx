import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';

// ─── Topics (28 temas del sistema VIVE) ──────────────────────────────────────
const ALL_TOPICS = [
  'Sueño', 'Energía', 'Nutrición', 'Actividad física', 'Hábitos',
  'Estrés físico', 'Sexualidad',
  'Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría',
  'Pareja', 'Familia', 'Amistades', 'Vínculos laborales',
  'Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales',
  'Propósito', 'Identidad', 'Momentos de cambio', 'Motivación',
  'Crecimiento', 'Espiritualidad', 'Soledad',
];

type ResourceType = 'Audio' | 'Texto' | 'Herramienta';
const RESOURCE_TYPES: ResourceType[] = ['Audio', 'Texto', 'Herramienta'];

// ─── Recursos mock ────────────────────────────────────────────────────────────
type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Resource = { id: string; title: string; type: string; icon: MCIcon; iconBg: string; iconColor: string; duration: string };

const MY_RESOURCES: Resource[] = [
  { id: '1', title: 'Respiración 4-7-8',    type: 'Audio',       icon: 'weather-windy',     iconBg: '#E8EFF6', iconColor: ViveColors.calm,    duration: '5 min'  },
  { id: '2', title: 'Diario de gratitud',    type: 'Texto',       icon: 'notebook-outline',  iconBg: '#FDF0E8', iconColor: ViveColors.primary, duration: '10 min' },
  { id: '3', title: 'Body scan guiado',      type: 'Audio',       icon: 'meditation',        iconBg: '#E8F5EE', iconColor: ViveColors.accent,  duration: '12 min' },
  { id: '4', title: 'Rueda de la vida',      type: 'Herramienta', icon: 'chart-donut',       iconBg: '#FDF0E8', iconColor: ViveColors.primary, duration: '20 min' },
];

const EXPLORE_CATS = [
  { id: 'diario', label: 'Diario', emoji: '📔' }, { id: 'respiracion', label: 'Respiración', emoji: '🌬️' },
  { id: 'meditacion', label: 'Meditación', emoji: '🧘' }, { id: 'audio', label: 'Audios', emoji: '🎧' },
  { id: 'lecturas', label: 'Lecturas', emoji: '📖' }, { id: 'herramienta', label: 'Herramientas', emoji: '🧰' },
];

const GLASS = 'rgba(255,255,255,0.14)';
const GLASS_BORDER = 'rgba(255,255,255,0.28)';

// ─── Proposal Modal ───────────────────────────────────────────────────────────
interface ProposalModalProps {
  visible: boolean;
  onClose: () => void;
}

function ProposalModal({ visible, onClose }: ProposalModalProps) {
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<ResourceType | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');

  function handleSend() {
    console.log('[Coach] propuesta de recurso:', { title, type: selectedType, topic: selectedTopic, duration, description });
    setTitle(''); setSelectedType(null); setSelectedTopic(null); setDuration(''); setDescription('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ms.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Modal header */}
          <View style={ms.header}>
            <Text style={ms.headerTitle}>Proponer recurso</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={ms.body} showsVerticalScrollIndicator={false}>

            {/* Título */}
            <Text style={ms.label}>Título del recurso</Text>
            <TextInput
              style={ms.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Meditación para el estrés"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />

            {/* Tipo */}
            <Text style={[ms.label, ms.labelSpaced]}>Tipo</Text>
            <View style={ms.chipRow}>
              {RESOURCE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[ms.chip, selectedType === t && ms.chipActive]}
                  onPress={() => setSelectedType(t)}
                  activeOpacity={0.75}>
                  <Text style={[ms.chipText, selectedType === t && ms.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tema */}
            <Text style={[ms.label, ms.labelSpaced]}>Tema</Text>
            <View style={ms.topicsWrap}>
              {ALL_TOPICS.map(topic => (
                <TouchableOpacity
                  key={topic}
                  style={[ms.topicChip, selectedTopic === topic && ms.topicChipActive]}
                  onPress={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                  activeOpacity={0.75}>
                  <Text style={[ms.topicChipText, selectedTopic === topic && ms.topicChipTextActive]}>
                    {topic}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Duración */}
            <Text style={[ms.label, ms.labelSpaced]}>Duración</Text>
            <TextInput
              style={ms.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="Ej: 10 min"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />

            {/* Descripción */}
            <Text style={[ms.label, ms.labelSpaced]}>Descripción breve</Text>
            <TextInput
              style={[ms.input, ms.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="¿De qué trata este recurso? ¿Para quién es útil?"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[ms.sendBtn, !title.trim() && ms.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!title.trim()}
              activeOpacity={0.85}>
              <Text style={ms.sendBtnText}>Enviar propuesta</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoachResourcesScreen() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        <Text style={s.pageTitle}>Recursos</Text>

        {/* Propose button */}
        <TouchableOpacity
          style={s.proposeBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#FFFFFF" />
          <Text style={s.proposeBtnText}>Proponer recurso a VIVE</Text>
        </TouchableOpacity>

        {/* Mis recursos */}
        <Text style={s.sectionTitle}>Mis recursos</Text>
        {MY_RESOURCES.map(r => (
          <View key={r.id} style={s.resourceCard}>
            <View style={[s.resourceIcon, { backgroundColor: r.iconBg }]}>
              <MaterialCommunityIcons name={r.icon} size={22} color={r.iconColor} />
            </View>
            <View style={s.resourceInfo}>
              <Text style={s.resourceTitle}>{r.title}</Text>
              <Text style={s.resourceMeta}>{r.type} · {r.duration}</Text>
            </View>
            <TouchableOpacity style={s.shareBtn} activeOpacity={0.75}>
              <Text style={s.shareBtnText}>Recomendar</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Explorar biblioteca */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Biblioteca VIVE</Text>
        <View style={s.exploreGrid}>
          {[0, 1].map(row => (
            <View key={row} style={s.exploreRow}>
              {EXPLORE_CATS.slice(row * 3, row * 3 + 3).map(cat => (
                <ScaleCard key={cat.id} style={s.exploreCat} onPress={() => console.log('cat', cat.id)}>
                  <Text style={s.exploreCatEmoji}>{cat.emoji}</Text>
                  <Text style={s.exploreCatLabel}>{cat.label}</Text>
                </ScaleCard>
              ))}
            </View>
          ))}
        </View>

        <View style={{ height: TAB_BAR_CLEARANCE }} />
      </ScrollView>

      <ProposalModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
    </AppBg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 22 },

  pageTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 16,
  },

  proposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 28,
    gap: 8,
  },
  proposeBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 28 },

  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  resourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resourceInfo: { flex: 1 },
  resourceTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  resourceMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  shareBtn: {
    borderWidth: 1.5,
    borderColor: ViveColors.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  shareBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: ViveColors.accent,
  },

  exploreGrid: { gap: 10 },
  exploreRow: { flexDirection: 'row', gap: 10 },
  exploreCat: {
    flex: 1,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
  },
  exploreCatEmoji: { fontSize: 26 },
  exploreCatLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A0A26' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  label: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  labelSpaced: { marginTop: 20 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  inputMultiline: {
    height: 100,
    paddingTop: 13,
  },

  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chipActive: {
    backgroundColor: 'rgba(232,116,59,0.18)',
    borderColor: ViveColors.primary,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  chipTextActive: {
    color: ViveColors.primary,
  },

  topicsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  topicChipActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  topicChipText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  topicChipTextActive: {
    fontFamily: ViveFonts.semibold,
    color: '#FFFFFF',
  },

  sendBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sendBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
