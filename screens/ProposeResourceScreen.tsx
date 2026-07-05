import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { AXES } from '@/constants/searchData';

type ResourceType = 'audio' | 'guia_pasos' | 'lectura_breve';

const TYPES: { value: ResourceType; label: string; icon: string }[] = [
  { value: 'audio', label: 'Audio', icon: 'volume-high' },
  { value: 'guia_pasos', label: 'Guía de pasos', icon: 'format-list-numbered' },
  { value: 'lectura_breve', label: 'Lectura breve', icon: 'book-open-variant' },
];

const DESCRIPTION_MAX = 300;
const TAGS_MAX = 3;

const AXIS_OPTIONS = [
  { value: 'cuerpo', label: 'Cuerpo', icon: 'human-handsup' },
  { value: 'mente', label: 'Mente', icon: 'head-heart-outline' },
  { value: 'alma', label: 'Alma', icon: 'flower-outline' },
] as const;

type Step = { title: string; body: string };

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

function isValidUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}

export default function ProposeResourceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ proposalId?: string }>();
  const proposalId = typeof params.proposalId === 'string' ? params.proposalId : undefined;
  const isEditing = !!proposalId;

  const [loadingProposal, setLoadingProposal] = useState(isEditing);
  const [reviewerNotes, setReviewerNotes] = useState<string | null>(null);

  const [type, setType] = useState<ResourceType | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [axes, setAxes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [officialTags, setOfficialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Contenido específico por tipo
  const [audioUrl, setAudioUrl] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ title: '', body: '' }]);
  const [readingBody, setReadingBody] = useState('');
  const [readingSource, setReadingSource] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (submitted) {
      Animated.timing(successAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [submitted]);

  // Tags oficiales para el selector (SELECT público)
  useEffect(() => {
    supabase
      .from('resource_tags')
      .select('label')
      .eq('status', 'oficial')
      .order('label')
      .then(({ data }) => setOfficialTags((data ?? []).map(t => t.label)));
  }, []);

  // Modo edición: precargar la propuesta en necesita_ajustes
  useEffect(() => {
    if (!proposalId) return;

    (async () => {
      const { data } = await supabase
        .from('resource_proposals')
        .select('type, title, topic, description, duration_min, content, status, reviewer_notes, axes, tags')
        .eq('id', proposalId)
        .maybeSingle();

      // Solo se ajusta lo que VITA pidió ajustar — cualquier otro estado vuelve al historial
      if (!data || data.status !== 'necesita_ajustes') {
        router.replace('/resource-proposals');
        return;
      }

      setType(data.type as ResourceType);
      setTitle(data.title ?? '');
      setTopic(data.topic ?? null);
      setDescription(data.description ?? '');
      setDurationMin(data.duration_min != null ? String(data.duration_min) : '');
      setAxes(Array.isArray(data.axes) ? data.axes : []);
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setReviewerNotes(data.reviewer_notes ?? null);

      const content = data.content ?? {};
      if (data.type === 'audio') {
        setAudioUrl(content.url ?? '');
      } else if (data.type === 'guia_pasos') {
        setSteps(Array.isArray(content.steps) && content.steps.length > 0
          ? content.steps.map((s: any) => ({ title: s.title ?? '', body: s.body ?? '' }))
          : [{ title: '', body: '' }]);
      } else if (data.type === 'lectura_breve') {
        setReadingBody(content.body ?? '');
        setReadingSource(content.source ?? '');
      }

      setLoadingProposal(false);
    })();
  }, [proposalId]);

  function toggleAxis(value: string) {
    setAxes(prev => prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]);
  }

  function toggleTag(label: string) {
    setTags(prev => {
      if (prev.includes(label)) return prev.filter(t => t !== label);
      if (prev.length >= TAGS_MAX) return prev;
      return [...prev, label];
    });
  }

  function addNewTag() {
    const label = newTag.trim();
    if (!label || tags.length >= TAGS_MAX) return;
    if (!tags.includes(label)) setTags(prev => [...prev, label]);
    setNewTag('');
  }

  // Alta best-effort de tags que no existen como oficiales: quedan 'propuesto'
  // (RLS lo permite solo a coaches); si el label ya existe, ignoreDuplicates
  // evita el conflicto con el UNIQUE. Un fallo acá no bloquea la propuesta —
  // los labels viajan igual en resource_proposals.tags.
  async function proposeNewTags() {
    const nuevos = tags.filter(t => !officialTags.includes(t));
    if (nuevos.length === 0) return;
    await supabase
      .from('resource_tags')
      .upsert(nuevos.map(label => ({ label, status: 'propuesto' })), {
        onConflict: 'label',
        ignoreDuplicates: true,
      });
  }

  function updateStep(i: number, field: keyof Step, value: string) {
    setSteps(prev => prev.map((s, si) => (si === i ? { ...s, [field]: value } : s)));
  }

  function addStep() {
    setSteps(prev => [...prev, { title: '', body: '' }]);
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, si) => si !== i));
  }

  function buildContent(): Record<string, any> | null {
    if (type === 'audio') {
      if (!audioUrl.trim() || !isValidUrl(audioUrl.trim())) return null;
      return { url: audioUrl.trim() };
    }
    if (type === 'guia_pasos') {
      const validSteps = steps
        .map(s => ({ title: s.title.trim(), body: s.body.trim() }))
        .filter(s => s.title.length > 0 || s.body.length > 0);
      if (validSteps.length === 0) return null;
      return { steps: validSteps };
    }
    if (type === 'lectura_breve') {
      if (readingBody.trim().length < 10) return null;
      return { body: readingBody.trim(), source: readingSource.trim() || undefined };
    }
    return null;
  }

  async function handleSubmit() {
    if (!type) { setSubmitError('Elegí un tipo de recurso.'); return; }
    if (!title.trim()) { setSubmitError('Ponele un título.'); return; }
    if (axes.length === 0) { setSubmitError('Elegí al menos un eje: Cuerpo, Mente o Alma.'); return; }
    if (!description.trim()) { setSubmitError('Contanos brevemente de qué se trata.'); return; }
    if (durationMin.trim() && (isNaN(Number(durationMin)) || Number(durationMin) <= 0)) {
      setSubmitError('La duración tiene que ser un número mayor a 0.');
      return;
    }

    const content = buildContent();
    if (!content) {
      if (type === 'audio') setSubmitError('Pegá el link del audio (tiene que empezar con http:// o https://).');
      else if (type === 'guia_pasos') setSubmitError('Agregá al menos un paso con título o contenido.');
      else setSubmitError('Escribí el texto de la lectura (mínimo 10 caracteres).');
      return;
    }

    if (!user) { setSubmitError('No encontramos tu sesión. Volvé a ingresar.'); return; }

    setSubmitting(true);
    setSubmitError(null);

    if (isEditing) {
      await proposeNewTags();

      // Re-envío: UPDATE sobre la misma fila; el trigger permite necesita_ajustes → enviada.
      // axes/tags van acá igual que en el INSERT de creación — si faltaran, el coach
      // que reenvía perdería lo que eligió.
      const { error } = await supabase
        .from('resource_proposals')
        .update({
          type,
          title: title.trim(),
          topic,
          axes,
          tags,
          description: description.trim(),
          duration_min: durationMin.trim() ? Number(durationMin) : null,
          content,
          status: 'enviada',
        })
        .eq('id', proposalId);

      setSubmitting(false);

      if (error) {
        setSubmitError(`No pudimos reenviar tu propuesta. (${error.message})`);
        return;
      }

      setSubmitted(true);
      return;
    }

    const { data: coachRow, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (coachError || !coachRow) {
      setSubmitting(false);
      setSubmitError('No pudimos encontrar tu perfil de coach.');
      return;
    }

    await proposeNewTags();

    const { error } = await supabase.from('resource_proposals').insert({
      coach_id: coachRow.id,
      type,
      title: title.trim(),
      topic,
      axes,
      tags,
      description: description.trim(),
      duration_min: durationMin.trim() ? Number(durationMin) : null,
      content,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(`No pudimos enviar tu propuesta. (${error.message})`);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AppBg>
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.successContainer, fadeUp(successAnim)]}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-circle-outline" size={64} color={ViveColors.accent} />
          </View>
          <Text style={styles.successTitle}>
            {isEditing ? '¡Reenviada!' : '¡Listo! Tu propuesta está en revisión.'}
          </Text>
          <Text style={styles.successSubtitle}>
            {isEditing
              ? 'Gracias por los ajustes — la miramos de nuevo y te avisamos.'
              : 'El equipo de VITA la va a revisar y te va a avisar el resultado.'}
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => router.replace('/resource-proposals')}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Ver mis propuestas</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
      </AppBg>
    );
  }

  if (loadingProposal) {
    return (
      <AppBg>
      <SafeAreaView style={[styles.container, styles.loadingWrap]}>
        <ActivityIndicator size="large" color={ViveColors.primary} />
      </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
              <Text style={styles.backText}>Atrás</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.content, fadeUp(formAnim)]}>
            <View style={styles.titleArea}>
              <Text style={styles.title}>
                {isEditing ? 'Ajustá tu propuesta' : 'Proponé un recurso'}
              </Text>
              <Text style={styles.subtitle}>
                {isEditing
                  ? 'Revisá las sugerencias de VITA, hacé los cambios y reenviala cuando esté lista.'
                  : 'Lo revisa el equipo de VITA antes de publicarlo — Journaling y Gratitud son exclusivos de VITA y no se proponen acá.'}
              </Text>
            </View>

            {isEditing && !!reviewerNotes && (
              <View style={styles.reviewerNotesBox}>
                <Text style={styles.reviewerNotesLabel}>Notas de VITA</Text>
                <Text style={styles.reviewerNotesText}>{reviewerNotes}</Text>
              </View>
            )}

            {/* Tipo */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tipo de recurso</Text>
              <View style={styles.typeGrid}>
                {TYPES.map(t => {
                  const isSelected = type === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setType(t.value)}
                      activeOpacity={0.75}
                      style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                    >
                      <MaterialCommunityIcons
                        name={t.icon as any}
                        size={16}
                        color={isSelected ? '#565E32' : '#87835C'}
                      />
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Título */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Título</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ej: Respiración para antes de dormir"
                placeholderTextColor="rgba(135,131,92,0.45)"
              />
            </View>

            {/* Tema */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tema</Text>
              {AXES.map(axis => (
                <View key={axis.id} style={styles.axisBlock}>
                  <Text style={styles.axisLabel}>{axis.emoji} {axis.label}</Text>
                  {axis.groups.map((group, gi) => (
                    <View key={gi} style={styles.typeGrid}>
                      {group.items.map(t => {
                        const isSelected = topic === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            onPress={() => setTopic(isSelected ? null : t)}
                            activeOpacity={0.75}
                            style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                          >
                            <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                              {t}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Eje */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Eje</Text>
              <Text style={styles.fieldHint}>
                ¿A qué parte de la persona le habla este recurso? Podés elegir más de uno.
              </Text>
              <View style={styles.typeGrid}>
                {AXIS_OPTIONS.map(a => {
                  const isSelected = axes.includes(a.value);
                  return (
                    <TouchableOpacity
                      key={a.value}
                      onPress={() => toggleAxis(a.value)}
                      activeOpacity={0.75}
                      style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                    >
                      <MaterialCommunityIcons
                        name={a.icon as any}
                        size={16}
                        color={isSelected ? '#565E32' : '#87835C'}
                      />
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Tags (opcional)</Text>
                <Text style={styles.charCount}>{tags.length}/{TAGS_MAX}</Text>
              </View>
              <Text style={styles.fieldHint}>
                Ayudan a que tu recurso se encuentre. Si no encontrás el tuyo, escribilo — lo revisamos junto con tu propuesta.
              </Text>
              {(officialTags.length > 0 || tags.length > 0) && (
                <View style={styles.typeGrid}>
                  {[...new Set([...officialTags, ...tags])].map(label => {
                    const isSelected = tags.includes(label);
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => toggleTag(label)}
                        activeOpacity={0.75}
                        style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                      >
                        <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {tags.length < TAGS_MAX && (
                <View style={styles.newTagRow}>
                  <TextInput
                    style={[styles.input, styles.newTagInput]}
                    value={newTag}
                    onChangeText={setNewTag}
                    placeholder="Agregar el tuyo"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    onSubmitEditing={addNewTag}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.newTagBtn}
                    onPress={addNewTag}
                    activeOpacity={0.75}
                    disabled={!newTag.trim()}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={ViveColors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Presentación breve */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Presentación breve</Text>
                <Text style={styles.charCount}>{description.length}/{DESCRIPTION_MAX}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, DESCRIPTION_MAX))}
                placeholder="Contá de qué se trata y a quién le puede servir"
                placeholderTextColor="rgba(135,131,92,0.45)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Duración */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Duración estimada (minutos, opcional)</Text>
              <TextInput
                style={styles.input}
                value={durationMin}
                onChangeText={setDurationMin}
                placeholder="Ej: 8"
                placeholderTextColor="rgba(135,131,92,0.45)"
                keyboardType="numeric"
              />
            </View>

            {/* Contenido específico por tipo */}
            {type === 'audio' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Link del audio</Text>
                <Text style={styles.fieldHint}>
                  Un link directo o de Drive/YouTube/Spotify — no se sube el archivo acá.
                </Text>
                <TextInput
                  style={styles.input}
                  value={audioUrl}
                  onChangeText={setAudioUrl}
                  placeholder="https://..."
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {type === 'guia_pasos' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Pasos</Text>
                {steps.map((step, i) => (
                  <View key={i} style={styles.stepCard}>
                    <View style={styles.stepHeader}>
                      <Text style={styles.stepNumber}>Paso {i + 1}</Text>
                      {steps.length > 1 && (
                        <TouchableOpacity onPress={() => removeStep(i)} hitSlop={8}>
                          <MaterialCommunityIcons name="close" size={16} color="rgba(135,131,92,0.72)" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={[styles.input, styles.stepInput]}
                      value={step.title}
                      onChangeText={(t) => updateStep(i, 'title', t)}
                      placeholder="Título del paso"
                      placeholderTextColor="rgba(135,131,92,0.45)"
                    />
                    <TextInput
                      style={[styles.input, styles.multilineInput, styles.stepInput]}
                      value={step.body}
                      onChangeText={(t) => updateStep(i, 'body', t)}
                      placeholder="Qué tiene que hacer la persona en este paso"
                      placeholderTextColor="rgba(135,131,92,0.45)"
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.addStepBtn} onPress={addStep} activeOpacity={0.75}>
                  <MaterialCommunityIcons name="plus" size={16} color={ViveColors.primary} />
                  <Text style={styles.addStepText}>Agregar paso</Text>
                </TouchableOpacity>
              </View>
            )}

            {type === 'lectura_breve' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Texto</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput, styles.readingInput]}
                    value={readingBody}
                    onChangeText={setReadingBody}
                    placeholder="El texto completo de la lectura"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Fuente (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={readingSource}
                    onChangeText={setReadingSource}
                    placeholder="Ej: propio, o libro/autor de referencia"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                  />
                </View>
              </>
            )}

            {submitError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C0392B" />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>
                {submitting
                  ? (isEditing ? 'Reenviando...' : 'Enviando...')
                  : (isEditing ? 'Reenviar propuesta' : 'Enviar propuesta')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 48 },
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
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 24 },
  titleArea: { gap: 8 },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 30,
    color: '#565E32',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#87835C',
    lineHeight: 21,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.58)',
  },
  fieldHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.72)',
    lineHeight: 17,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  axisBlock: { gap: 8, marginBottom: 12 },
  axisLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  typeChipSelected: {
    backgroundColor: 'rgba(107,191,138,0.22)',
    borderColor: ViveColors.accent,
  },
  typeChipText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
  },
  typeChipTextSelected: {
    fontFamily: ViveFonts.medium,
    color: '#565E32',
  },
  input: {
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  multilineInput: { minHeight: 84, paddingTop: 14 },
  readingInput: { minHeight: 160 },
  stepCard: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,248,240,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepNumber: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(135,131,92,0.8)',
  },
  stepInput: { paddingVertical: 10, fontSize: 14 },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addStepText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224,82,82,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#FF7070',
    flex: 1,
    lineHeight: 18,
  },
  button: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    letterSpacing: 0.3,
  },
  loadingWrap: { alignItems: 'center', justifyContent: 'center' },

  newTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  newTagInput: { flex: 1 },
  newTagBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reviewerNotesBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(193,105,79,0.08)',
    gap: 4,
  },
  reviewerNotesLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#C1694F',
  },
  reviewerNotesText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 19,
  },

  successContainer: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  successIcon: { marginBottom: 8 },
  successTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    letterSpacing: -0.3,
    lineHeight: 34,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#87835C',
    lineHeight: 22,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 12,
  },
});
