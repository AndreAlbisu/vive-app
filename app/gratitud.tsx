import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { PASTEL_DURAZNO } from '@/constants/tools';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { PinButton } from '@/components/PinButton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ToolWash } from '@/components/ui/ToolWash';
import { RachaPill } from '@/components/ui/RachaPill';
import { NumberBadge } from '@/components/ui/NumberBadge';
import { SaveScreen } from '@/components/ui/SaveScreen';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuth } from '@/context/AuthContext';
import { useConsentGate } from '@/hooks/useConsentGate';
import { ConsentSheet } from '@/components/ConsentSheet';
import { supabase } from '@/lib/supabase';
import { cifrar, descifrar, estaCifrado, obtenerClave, obtenerClaveSiSePuede } from '@/lib/wellbeingCrypto';
import { logError } from '@/lib/logging';
import { anotar } from '@/lib/analytics';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';
import { GRATITUD_TITULO, GRATITUD_SUBTITULO } from '@/lib/vozCompartida';
import ParaQueSirve from '@/components/ParaQueSirve';

const CREAM_DEEP = '#EAE2D0';
const TERRACOTA = '#C1694F';
const TERRACOTA_TINT = 'rgba(193,105,79,0.12)';
// Gradiente durazno de la pantalla de guardado — variantes del token durazno,
// no un color nuevo.
const SAVE_GRADIENT: [string, string] = ['#F3CDB7', '#F8EADF'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface GratitudeEntry {
  id: string;
  item_1: string;
  item_2: string;
  item_3: string;
  created_at: string;
}

const CAMPOS = ['item_1', 'item_2', 'item_3'] as const;

const PLACEHOLDERS: [string, string, string] = [
  'Algo que pasó hoy...',
  'Alguien que te importa...',
  'Algo simple que disfrutaste...',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function formatTodayShort() {
  return new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

function dayKey(iso: string) {
  return iso.split('T')[0];
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function GratitudScreen() {
  useRecursoAbierto('gratitud');
  const router = useRouter();
  const reduced = useReducedMotion();
  const [items, setItems] = useState<[string, string, string]>(['', '', '']);
  const [focused, setFocused] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [streak, setStreak] = useState(0);

  // Pantalla de guardado (la pieza principal) + datos congelados para su recap.
  const [showSave, setShowSave] = useState(false);
  const [savedItems, setSavedItems] = useState<string[]>([]);
  const [rachaGuardado, setRachaGuardado] = useState(0);
  const [savedTick, setSavedTick] = useState(0);

  const { user, isLoggedIn, requestAuth } = useAuth();
  // Mismo criterio que el diario y el check-in: es dato sensible, así que el
  // consentimiento va antes de guardar.
  const consentGate = useConsentGate(user?.id);
  const saveScale = useRef(new Animated.Value(1)).current;

  const filled = items.filter(i => i.trim().length > 0).length;
  const canSave = filled > 0;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('gratitude_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data) return;
        // Mismo esquema que el Diario (ver `lib/wellbeingCrypto.ts`): el texto
        // llega cifrado, y lo de antes del cifrado se cifra al abrir.
        const clave = await obtenerClaveSiSePuede(user.id);
        setEntries(data.map(e => ({
          ...e,
          item_1: descifrar(e.item_1, clave, user.id),
          item_2: descifrar(e.item_2, clave, user.id),
          item_3: descifrar(e.item_3, clave, user.id),
        })));
        if (!clave) return;
        for (const e of data) {
          const viejos = CAMPOS.filter(c => e[c] && !estaCifrado(e[c]));
          if (viejos.length === 0) continue;
          try {
            await supabase
              .from('gratitude_entries')
              .update(Object.fromEntries(viejos.map(c => [c, cifrar(e[c], clave, user.id)])))
              .eq('id', e.id);
          } catch {
            // Se reintenta en la próxima apertura.
          }
        }
      });
  }, [user]);

  // Racha de Gratitud: no hay streak propio en la tabla — se calcula sobre
  // resource_completions (resource_id='gratitud'), mismo algoritmo que
  // useResourceProgress pero acotado a esta herramienta. Sin migración nueva.
  useEffect(() => {
    if (!user) return;
    const from = new Date();
    from.setDate(from.getDate() - 30);
    supabase
      .from('resource_completions')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('resource_id', 'gratitud')
      .gte('completed_at', from.toISOString())
      .then(({ data }) => {
        const dates = new Set((data ?? []).map(r => (r.completed_at as string).split('T')[0]));
        let streakCount = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (dates.has(d.toISOString().split('T')[0])) streakCount++;
          else break;
        }
        setStreak(streakCount);
      });
  }, [user, savedTick]);

  function updateItem(index: 0 | 1 | 2, value: string) {
    setItems(prev => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function setFieldFocused(index: 0 | 1 | 2, value: boolean) {
    setFocused(prev => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || showSave) return;
    if (!isLoggedIn || !user) { requestAuth('guardar_gratitud'); return; }

    if (!(await consentGate.pedir())) return;

    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.95, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();

    // 🔴 Falla cerrado: sin clave no se guarda en claro; cae en el error de abajo.
    const textos = items.map(i => i.trim());
    const cantidad = textos.filter(t => t.length > 0).length;
    let cifrados: string[] | null = null;
    try {
      const clave = await obtenerClave(user.id);
      cifrados = textos.map(t => cifrar(t, clave, user.id));
    } catch {
      cifrados = null;
    }

    const { data: fila, error } = cifrados === null
      ? { data: null, error: new Error('sin clave') }
      : await supabase
          .from('gratitude_entries')
          .insert({
            user_id: user.id,
            item_1: cifrados[0],
            item_2: cifrados[1],
            item_3: cifrados[2],
          })
          .select()
          .single();
    // La fila vuelve cifrada: en pantalla va lo que se escribió.
    const data = fila ? { ...fila, item_1: textos[0], item_2: textos[1], item_3: textos[2] } : null;

    if (error || !data) {
      await logError('GratitudScreen: save entry failed', error);
      Alert.alert('Error', 'No se pudo guardar tu gratitud. Intentá de nuevo');
      return;
    }

    // Racha a mostrar en el guardado: si hoy es la primera, +1. Número fijo para
    // que no parpadee con el refetch asíncrono.
    const primeraHoy = !entries.some(e => dayKey(e.created_at) === dayKey(new Date().toISOString()));
    setRachaGuardado(primeraHoy ? streak + 1 : streak);

    setEntries(prev => [data, ...prev]);
    recordCompletion(user.id, 'gratitud', 300).catch(() => {});
    setSavedTick(t => t + 1); // refetch de la racha real para el resto de la pantalla

    // Analítica: SOLO la cantidad, nunca el texto.
    anotar('gratitud_guardada', { cantidad });

    setSavedItems(textos.filter(t => t.length > 0));
    setShowSave(true);
  }

  function cerrarGuardado() {
    setShowSave(false);
    setItems(['', '', '']);
    setFocused([false, false, false]);
  }

  function irAlDiario() {
    anotar('invitacion_cruzada_tomada', { origen: 'gratitud' });
    setShowSave(false);
    setItems(['', '', '']);
    router.push('/diario');
  }

  const counterText = filled === 0 ? 'Con una alcanza' : `${filled} de 3`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ToolWash color={PASTEL_DURAZNO} opacity={0.55} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <ToolHeader
        title="Gratitud"
        onBack={() => router.back()}
        right={
          <>
            <Text style={s.datePillText}>{formatTodayShort()}</Text>
            <PinButton resourceId="gratitud" inline />
          </>
        }
      />

      {/* Racha, arriba y chica. Degrada sin romper: si no hay, no se muestra. */}
      {streak > 0 && (
        <View style={s.rachaRow}>
          <RachaPill
            icon="fire"
            label={`${streak} ${streak === 1 ? 'día seguido' : 'días seguidos'}`}
            color={TERRACOTA}
            tint={TERRACOTA_TINT}
          />
        </View>
      )}
      <View style={s.headerDivider} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Intro ────────────────────────────────────────────── */}
          <ParaQueSirve toolId="gratitud" style={{ marginBottom: 16 }} />
          <View style={s.intro}>
            <Text style={s.introTitle}>{GRATITUD_TITULO}</Text>
            <Text style={s.introSubtitle}>{GRATITUD_SUBTITULO}</Text>
          </View>

          {/* ── Campos: tres filas en una card ───────────────────── */}
          <SurfaceCard variant="elevated" backgroundColor="rgba(255,248,240,0.88)" borderRadius={20}>
            {([0, 1, 2] as const).map(i => {
              const tiene = items[i].trim().length > 0;
              return (
                <View key={i} style={[s.fieldRow, i > 0 && s.fieldRowDivider]}>
                  <NumberBadge n={i + 1} filled={tiene} reduced={reduced} />
                  <TextInput
                    style={s.fieldInput}
                    value={items[i]}
                    onChangeText={v => updateItem(i, v)}
                    onFocus={() => setFieldFocused(i, true)}
                    onBlur={() => setFieldFocused(i, false)}
                    placeholder={PLACEHOLDERS[i]}
                    placeholderTextColor={`${ViveColors.text}55`}
                    multiline
                    textAlignVertical="top"
                    maxLength={300}
                  />
                </View>
              );
            })}
          </SurfaceCard>

          <Text style={s.counter}>{counterText}</Text>

          {/* ── Botón guardar ────────────────────────────────────── */}
          <Animated.View style={[s.saveBtnWrap, { transform: [{ scale: saveScale }] }]}>
            <TouchableOpacity
              style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <Text style={[s.saveBtnText, !canSave && s.saveBtnTextDisabled]}>Guardar</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Historial ────────────────────────────────────────── */}
          {entries.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Entradas anteriores</Text>
              {entries.map(entry => {
                const displayItems = [entry.item_1, entry.item_2, entry.item_3];
                return (
                  <View key={entry.id} style={s.entryCard}>
                    <Text style={s.entryDate}>{formatDate(entry.created_at)}</Text>
                    {displayItems.map((item, idx) =>
                      item ? (
                        <View key={idx} style={s.entryRow}>
                          <Text style={s.entryBullet}>{idx + 1}</Text>
                          <Text style={s.entryText}>{item}</Text>
                        </View>
                      ) : null
                    )}
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <SaveScreen
        visible={showSave}
        onDone={cerrarGuardado}
        gradient={SAVE_GRADIENT}
        title="Quedó guardado"
        racha={rachaGuardado > 0 ? {
          icon: 'fire',
          label: `${rachaGuardado} ${rachaGuardado === 1 ? 'día seguido' : 'días seguidos'}`,
          color: TERRACOTA,
          tint: TERRACOTA_TINT,
        } : null}
        recap={
          <>
            {savedItems.map((t, i) => (
              <View key={i} style={s.recapRow}>
                <Text style={s.recapNum}>{i + 1}</Text>
                <Text style={s.recapText}>{t}</Text>
              </View>
            ))}
          </>
        }
        crossInvite={{ label: '¿Querés escribir en el diario?', onPress: irAlDiario }}
        origen="gratitud"
        reduced={reduced}
      />

      <ConsentSheet {...consentGate.sheetProps} />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ViveColors.background },
  flex: { flex: 1 },

  datePillText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  rachaRow: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  headerDivider: { height: 1, backgroundColor: `${ViveColors.text}0D` },

  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 24 },

  intro: { alignItems: 'center', marginBottom: 20, gap: 8 },
  introTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 20,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  introSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}99`,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Campos (3 filas en una card)
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 14,
    paddingLeft: 6,   // corre los números un poco a la derecha (Joaquín, 08/10)
  },
  fieldRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(86,94,50,0.16)',
  },
  fieldInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 23,
    minHeight: 24,
    paddingTop: 1,
    padding: 0,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: `${ViveColors.text}88`,
    textAlign: 'right',
    marginTop: 8,
  },

  // Save button
  saveBtnWrap: { marginTop: 16, marginBottom: 36 },
  saveBtn: {
    backgroundColor: ViveColors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: {
    backgroundColor: CREAM_DEEP,
    opacity: 0.55,
    ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 } }),
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.onPrimaryInk,
    textAlign: 'center',
    lineHeight: 22,
  },
  saveBtnTextDisabled: { color: 'rgba(86,94,50,0.45)' },

  // History
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
  },
  entryCard: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: `${ViveColors.text}88`,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  entryBullet: {
    fontFamily: ViveFonts.bold,
    fontSize: 12,
    color: ViveColors.primary,
    lineHeight: 20,
    width: 14,
    flexShrink: 0,
  },
  entryText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 20,
  },

  // Recap de la pantalla de guardado
  recapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recapNum: {
    fontFamily: ViveFonts.feedback,
    fontSize: 15,
    color: TERRACOTA,
    lineHeight: 24,
    width: 16,
    flexShrink: 0,
  },
  recapText: {
    flex: 1,
    fontFamily: ViveFonts.feedback,
    fontSize: 15,
    color: ViveColors.text,
    lineHeight: 24,
  },
});
