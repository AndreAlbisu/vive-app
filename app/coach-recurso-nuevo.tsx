import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ViveFonts, ViveColors } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase, registrarEvento } from '@/lib/supabase';
import { DOORS } from '@/constants/conexionesDoors';
import { useAuth } from '@/context/AuthContext';
import { AudioRecorderModal, type RecordedAsset } from '@/components/AudioRecorderModal';

// ─── Constantes ───────────────────────────────────────────────────────────────
const FORMATS = [
  { id: 'audio',   label: 'Audio',   color: '#C1694F', icon: 'volume-medium-outline' as const, desc: 'Práctica guiada (mp3/m4a, máx. 30 MB)' },
  { id: 'video',   label: 'Video',   color: '#7B5EA7', icon: 'videocam-outline' as const,      desc: 'Link de YouTube (público o no listado)' },
  { id: 'podcast', label: 'Podcast', color: '#3B7FC4', icon: 'mic-outline' as const,           desc: 'Link a Spotify / Apple Podcasts / YouTube' },
  { id: 'lectura', label: 'Lectura', color: '#4A7C59', icon: 'book-outline' as const,          desc: 'Texto en markdown, máx. ~1.000 palabras' },
];

// El OBJETIVO del recurso (para qué sirve), distinto del tema. Los `id` son los
// mismos que el CHECK de `coach_resources.wellness_goal` (add-resource-wellness-goal.sql):
// si se agrega un valor allá, se agrega acá, y al revés. Su feature —descubrir
// por intención— es de una fase futura; acá SOLO se captura.
const WELLNESS_GOALS = [
  { id: 'calmar_ansiedad',    label: 'Calmar la ansiedad' },
  { id: 'dormir_mejor',       label: 'Dormir mejor' },
  { id: 'mejorar_animo',      label: 'Mejorar el ánimo' },
  { id: 'ganar_foco',         label: 'Ganar foco' },
  { id: 'construir_habitos',  label: 'Construir hábitos' },
  { id: 'entender_emociones', label: 'Entender emociones' },
  { id: 'mover_el_cuerpo',    label: 'Mover el cuerpo' },
  { id: 'alimentacion',       label: 'Alimentación' },
] as const;

const AUDIO_MAX_BYTES = 30 * 1024 * 1024;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

function isYouTubeUrl(s: string) {
  return /youtu(\.be|be\.com)/.test(s);
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CoachRecursoNuevoScreen() {
  const router = useRouter();
  const { coach_id, format } = useLocalSearchParams<{ coach_id: string; format?: string }>();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  // `format` llega preseleccionado cuando se entra por "Grabar audio" (audio).
  const [formato, setFormato] = useState<string | null>(format ?? null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [wellnessGoal, setWellnessGoal] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [duracionMin, setDuracionMin] = useState('');
  const [declared, setDeclared] = useState(false);
  const [audioAsset, setAudioAsset] = useState<{ name: string; uri: string; mimeType: string | undefined; size: number | undefined } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);

  function onRecorded(asset: RecordedAsset) {
    setAudioAsset(asset);
    setRecorderOpen(false);
  }

  async function pickAudio() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    // 🔴 Rechazo del .wav — es el formato que más pesa y el bucket lo acepta
    // (allowed_mime_types incluye audio/wav), así que sin este guard un coach
    // sube 80 MB de un audio de 8 minutos que en el celular no suena distinto a
    // un mp3 de 8 MB. Se chequea por extensión Y por mimeType: el picker de
    // iOS a veces no completa el mimeType, y algún que otro exportador manda
    // `.wav` con `audio/x-wav`. Más barato frenarlo acá que rechazarlo después.
    const esWav = /\.wav$/i.test(asset.name) || /wav/i.test(asset.mimeType ?? '');
    if (esWav) {
      Alert.alert(
        'Ese formato no',
        'Los archivos .wav pesan como 10 veces más sin que se escuche mejor en el celular. Convertilo a mp3 y subilo de nuevo.',
      );
      return;
    }
    if (asset.size && asset.size > AUDIO_MAX_BYTES) {
      Alert.alert('Archivo muy grande', 'El audio no puede superar los 30 MB');
      return;
    }
    setAudioAsset({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size });
  }

  function validate(): string | null {
    if (!titulo.trim()) return 'El título es obligatorio';
    if (!formato) return 'Elegí un formato';
    if (!topicId) return 'Elegí un tema';
    if (!wellnessGoal) return 'Elegí para qué sirve el recurso';
    if (!declared) return 'Tenés que declarar que el contenido es tuyo';
    if (formato === 'audio' && !audioAsset) return 'Seleccioná un archivo de audio';
    if (formato === 'video') {
      if (!url.trim()) return 'Pegá el link de YouTube';
      if (!isYouTubeUrl(url)) return 'El link debe ser de YouTube';
    }
    if (formato === 'podcast') {
      if (!url.trim()) return 'Pegá el link del podcast';
      if (!isValidUrl(url)) return 'El link no es válido';
    }
    if (formato === 'lectura' && !bodyMd.trim()) return 'Escribí el contenido de la lectura';
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { Alert.alert('Falta completar', err); return; }

    setSaving(true);
    try {
      let storagePath: string | null = null;

      if (formato === 'audio' && audioAsset) {
        setUploading(true);
        const file = new File(audioAsset.uri);
        const bytes = await file.bytes();
        const ext = audioAsset.name.split('.').pop() ?? 'mp3';
        // La RLS del bucket exige que la carpeta sea auth.uid() (profiles.id),
        // NO coaches.id — son ids distintos (ver SCHEMA.md).
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('resource-audio')
          .upload(path, bytes, { contentType: audioAsset.mimeType ?? 'audio/mpeg', upsert: false });
        setUploading(false);
        if (upErr) {
          Alert.alert('Error al subir el audio', upErr.message);
          return;
        }
        storagePath = path;
      }

      const durSec = duracionMin.trim() ? Math.round(parseFloat(duracionMin) * 60) : null;

      const { error: insertErr } = await supabase.from('coach_resources').insert({
        coach_id,
        title: titulo.trim(),
        description: descripcion.trim() || null,
        format: formato,
        source: formato === 'audio' || formato === 'lectura' ? 'native' : 'external',
        topic_id: topicId,
        wellness_goal: wellnessGoal,
        url: url.trim() || null,
        storage_path: storagePath,
        body_md: bodyMd.trim() || null,
        duration_seconds: durSec,
        status: 'pending',
        is_author_declared: true,
      });

      if (insertErr) {
        Alert.alert('Error al guardar', insertErr.message);
        return;
      }

      // Analítica de la fase — no bloquea el flujo (fire and forget, como en
      // el resto de la app). `objetivo` es el wellness_goal recién capturado.
      registrarEvento('recurso_subido', { formato, objetivo: wellnessGoal }).catch(() => {});

      Alert.alert(
        '¡Recurso enviado!',
        'Lo revisamos en los próximos días y te avisamos cuando esté publicado',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const selectedFormat = FORMATS.find(f => f.id === formato);

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={ViveColors.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nuevo recurso</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── 1. Título ───────────────────────────────────────── */}
          <Text style={s.label}>Título <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            value={titulo}
            onChangeText={t => setTitulo(t.slice(0, 80))}
            placeholder="Máx. 80 caracteres"
            placeholderTextColor="rgba(135,131,92,0.55)"
            maxLength={80}
          />
          <Text style={s.charCount}>{titulo.length}/80</Text>

          {/* ── 2. Descripción ──────────────────────────────────── */}
          <Text style={s.label}>Descripción</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Qué trabaja o qué va a encontrar el usuario…"
            placeholderTextColor="rgba(135,131,92,0.55)"
            multiline
            maxLength={300}
          />

          {/* ── 3. Formato ──────────────────────────────────────── */}
          <Text style={s.label}>Formato <Text style={s.required}>*</Text></Text>
          <View style={s.formatGrid}>
            {FORMATS.map(f => {
              const active = formato === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[s.formatCard, active && { borderColor: f.color, backgroundColor: f.color + '12' }]}
                  onPress={() => { setFormato(f.id); setUrl(''); setAudioAsset(null); setBodyMd(''); }}
                  activeOpacity={0.75}>
                  <Ionicons name={f.icon} size={20} color={active ? f.color : '#87835C'} />
                  <Text style={[s.formatLabel, active && { color: f.color }]}>{f.label}</Text>
                  <Text style={s.formatDesc}>{f.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 4. Tema ─────────────────────────────────────────── */}
          <Text style={s.label}>Tema <Text style={s.required}>*</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            {DOORS.map(door => {
              const active = topicId === door.id;
              return (
                <TouchableOpacity
                  key={door.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setTopicId(active ? null : door.id)}
                  activeOpacity={0.75}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{door.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── 5. Objetivo de bienestar ────────────────────────── */}
          <Text style={s.label}>¿Para qué sirve? <Text style={s.required}>*</Text></Text>
          <Text style={s.inputHint}>El objetivo con el que alguien lo buscaría — distinto del tema.</Text>
          <View style={s.goalGrid}>
            {WELLNESS_GOALS.map(g => {
              const active = wellnessGoal === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setWellnessGoal(active ? null : g.id)}
                  activeOpacity={0.75}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 6. Contenido según formato ──────────────────────── */}
          {formato === 'audio' && (
            <>
              {/* Aviso de calidad ANTES del picker — el ruido de fondo es el
                  motivo más común de rechazo, y prevenirlo cuesta menos que
                  rechazar un audio ya grabado y subido. */}
              <View style={s.audioTip}>
                <Ionicons name="mic-outline" size={16} color="#8A6A20" />
                <Text style={s.audioTipText}>
                  Grabá en un lugar silencioso: el ruido de fondo es el motivo más común de rechazo.
                </Text>
              </View>
              <Text style={s.label}>Archivo de audio <Text style={s.required}>*</Text></Text>
              <TouchableOpacity style={s.recordBtn} onPress={() => setRecorderOpen(true)} activeOpacity={0.85}>
                <Ionicons name="mic" size={18} color="#fff" />
                <Text style={s.recordBtnText}>Grabar ahora</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filePickerBtn} onPress={pickAudio} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={20} color="#C1694F" />
                <Text style={s.filePickerText}>
                  {audioAsset ? audioAsset.name : 'o elegí un archivo mp3 / m4a (máx. 30 MB)'}
                </Text>
              </TouchableOpacity>
              {audioAsset?.size && (
                <Text style={s.fileSizeText}>{(audioAsset.size / (1024*1024)).toFixed(1)} MB</Text>
              )}
            </>
          )}

          {(formato === 'video' || formato === 'podcast') && (
            <>
              <Text style={s.label}>
                {formato === 'video' ? 'URL de YouTube' : 'URL del podcast'}
                <Text style={s.required}> *</Text>
              </Text>
              <TextInput
                style={s.input}
                value={url}
                onChangeText={setUrl}
                placeholder={formato === 'video' ? 'https://youtube.com/watch?v=...' : 'https://open.spotify.com/...'}
                placeholderTextColor="rgba(135,131,92,0.55)"
                autoCapitalize="none"
                keyboardType="url"
              />
            </>
          )}

          {formato === 'lectura' && (
            <>
              <Text style={s.label}>Contenido (markdown) <Text style={s.required}>*</Text></Text>
              <Text style={s.inputHint}>Podés usar ## para títulos y **negrita**. Máx. ~1.000 palabras.</Text>
              <TextInput
                style={[s.input, s.inputLarge]}
                value={bodyMd}
                onChangeText={setBodyMd}
                placeholder="## Título&#10;&#10;Acá va el contenido..."
                placeholderTextColor="rgba(135,131,92,0.55)"
                multiline
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{bodyMd.split(/\s+/).filter(Boolean).length} palabras</Text>
            </>
          )}

          {/* ── 7. Duración ─────────────────────────────────────── */}
          {formato && (
            <>
              <Text style={s.label}>Duración en minutos</Text>
              <TextInput
                style={[s.input, s.inputSmall]}
                value={duracionMin}
                onChangeText={setDuracionMin}
                placeholder="ej: 8"
                placeholderTextColor="rgba(135,131,92,0.55)"
                keyboardType="numeric"
              />
            </>
          )}

          {/* ── 8. Declaración ──────────────────────────────────── */}
          <TouchableOpacity
            style={s.declaredRow}
            onPress={() => setDeclared(v => !v)}
            activeOpacity={0.75}>
            <View style={[s.checkbox, declared && s.checkboxChecked]}>
              {declared && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.declaredText}>
              Declaro que este contenido es de mi autoría y acepto las reglas de contenido de Vita.
            </Text>
          </TouchableOpacity>

          {/* ── Submit ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, (saving || !declared || !formato) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !declared || !formato}
            activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.submitBtnText}>
                  {uploading ? 'Subiendo audio…' : 'Enviar para revisión'}
                </Text>}
          </TouchableOpacity>

          <Text style={s.submitHint}>
            Tu recurso quedará en estado “Pendiente” hasta que lo revisemos.{'\n'}
            Te avisamos cuando esté publicado o si necesita ajustes.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <AudioRecorderModal
        visible={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onDone={onRecorded}
      />
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const FOREST = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 22, paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 18,
    color: FOREST,
  },

  label: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
    marginTop: 20,
    marginBottom: 8,
  },
  required: { color: ViveColors.primary },
  inputHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 6,
    marginTop: -4,
  },

  input: {
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: FOREST,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputLarge: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  inputSmall: {
    width: 100,
  },
  charCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: FOREST_SOFT,
    textAlign: 'right',
    marginTop: 4,
  },

  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formatCard: {
    width: '47%',
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 5,
  },
  formatLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST_SOFT,
  },
  formatDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: FOREST_SOFT,
    lineHeight: 14,
  },

  chipsRow: {
    gap: 7,
    paddingBottom: 2,
  },
  // Los objetivos son 8 fijos y entran mejor en una grilla que envuelve que en
  // un scroll horizontal (no hay tantos como para que el scroll gane algo).
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  audioTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(240,228,196,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138,106,32,0.22)',
    padding: 11,
    marginTop: 16,
  },
  audioTipText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#8A6A20',
    lineHeight: 16,
  },
  chip: {
    backgroundColor: GLASS,
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

  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C1694F',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  recordBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#fff',
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(193,105,79,0.35)',
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filePickerText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13.5,
    color: '#C1694F',
    flex: 1,
  },
  fileSizeText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 5,
  },

  declaredRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#87835C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  declaredText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST,
    lineHeight: 19,
  },

  submitBtn: {
    backgroundColor: FOREST,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(58,79,42,0.35)',
  },
  submitBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F3EEDF',
  },
  submitHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 12,
  },
});
