// M14 (docs/problemas-abiertos.md): cómo trabaja el profesional.
//
// Desde el 21/09/2026 son cuatro: estilo, cuánto guía, sobre qué trabaja
// (las tres se le preguntan a la persona) y la escuela. El orden de abajo sigue
// valiendo para las dos originales.
//
// Dos preguntas distintas, y el orden importa. Primero el ESTILO, en las mismas
// palabras en que se le pregunta a la persona en el quiz: es lo único que el
// quiz mira para ordenar y explicar. Después el ENFOQUE, con el nombre técnico
// de la escuela, que solo se muestra en el perfil.
//
// Las dos son opcionales. Un perfil sin contestar no se penaliza en el quiz: no
// se dice nada de él (`lib/enfoque.ts`).
//
// Misma forma que `CoachTopicsScreen` (chips + guardar abajo), que es la
// pantalla con la que el profesional ya está acostumbrado a editar su perfil.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ENFOQUES,
  ESTILO_OPCIONES_COACH,
  GUIA_OPCIONES_COACH,
  FOCO_OPCIONES_COACH,
  MAX_FOCOS,
  esGuiaCoach,
  esFoco,
  type GuiaCoach,
  type Foco,
  MAX_ENFOQUES,
  enfoquesAGuardar,
  esEnfoque,
  esEstiloCoach,
  puedeDeclararEnfoque,
  type Enfoque,
  type EstiloCoach,
} from '@/lib/enfoque';

const shadow = Platform.select({
  ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4 },
  android: { elevation: 1 },
});

export default function CoachEnfoqueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tienePerfil, setTienePerfil] = useState(false);
  const [estilo, setEstilo] = useState<EstiloCoach | null>(null);
  const [enfoques, setEnfoques] = useState<Enfoque[]>([]);
  // M14 ampliado (21/09/2026): las otras dos preguntas que se le hacen a la
  // persona en el quiz, con las mismas ideas y en primera persona.
  const [guia, setGuia] = useState<GuiaCoach | null>(null);
  const [focos, setFocos] = useState<Foco[]>([]);
  // La escuela solo la declara quien tiene matrícula verificada por Vita.
  const [hasMatricula, setHasMatricula] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('coaches')
        .select('estilo, enfoques, guia, focos, has_matricula')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      setTienePerfil(true);
      setHasMatricula(!!(data as { has_matricula?: boolean }).has_matricula);
      const e = (data as { estilo?: string | null }).estilo;
      setEstilo(esEstiloCoach(e) ? e : null);
      setEnfoques((((data as { enfoques?: string[] }).enfoques) ?? []).filter(esEnfoque));
      const g = (data as { guia?: string | null }).guia;
      setGuia(esGuiaCoach(g) ? g : null);
      setFocos((((data as { focos?: string[] }).focos) ?? []).filter(esFoco));
      setLoading(false);
    })();
  }, [user]);

  function toggleEnfoque(id: Enfoque) {
    setEnfoques(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      // El tope también está en el CHECK de la base. Acá se avisa antes, para
      // que el rechazo no aparezca recién al guardar.
      if (prev.length >= MAX_ENFOQUES) {
        Alert.alert(
          'Hasta tres',
          `Elegí las ${MAX_ENFOQUES} que más te representen. Marcar todas no ayuda a que te encuentren.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  }

  function toggleFoco(id: Foco) {
    setFocos(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      // El tope también está en el CHECK de la base.
      if (prev.length >= MAX_FOCOS) {
        Alert.alert('Hasta dos', 'Elegí las dos que más te representen. Marcar las tres no ayuda a que te encuentren.');
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('coaches')
      .update({ estilo, guia, focos, enfoques: enfoquesAGuardar(hasMatricula, enfoques) })
      .eq('profile_id', user.id);
    setSaving(false);

    if (error) {
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
      return;
    }
    router.back();
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Cómo trabajo</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={ViveColors.primary} />
          </View>
        ) : !tienePerfil ? (
          <View style={s.loadingWrap}>
            <Text style={s.emptyText}>Todavía no completaste tu perfil de profesional</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
              <View style={s.block}>
                <Text style={s.blockTitle}>Cómo acompañás</Text>
                <Text style={s.blockHint}>
                  Es la pregunta que le hacemos a la persona antes de sugerirle profesionales, con estas mismas palabras.
                </Text>
                {ESTILO_OPCIONES_COACH.map(op => {
                  const activo = estilo === op.id;
                  return (
                    <TouchableOpacity
                      key={op.id}
                      style={[s.option, activo && s.optionActive]}
                      // Volver a tocar la elegida la deja sin contestar: es
                      // opcional, así que tiene que poder deshacerse.
                      onPress={() => setEstilo(activo ? null : op.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionText, activo && s.optionTextActive]}>{op.label}</Text>
                        <Text style={[s.optionDesc, activo && s.optionDescActive]}>{op.desc}</Text>
                      </View>
                      {activo && <MaterialIcons name="check" size={18} color="#F7EFE4" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.block}>
                <Text style={s.blockTitle}>Cuánto guiás</Text>
                <Text style={s.blockHint}>
                  A la persona le preguntamos si quiere que la guíen o prefiere elegir ella el camino.
                </Text>
                {GUIA_OPCIONES_COACH.map(op => {
                  const activo = guia === op.id;
                  return (
                    <TouchableOpacity
                      key={op.id}
                      style={[s.option, activo && s.optionActive]}
                      onPress={() => setGuia(activo ? null : op.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionText, activo && s.optionTextActive]}>{op.label}</Text>
                        <Text style={[s.optionDesc, activo && s.optionDescActive]}>{op.desc}</Text>
                      </View>
                      {activo && <MaterialIcons name="check" size={18} color="#F7EFE4" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.block}>
                <Text style={s.blockTitle}>Sobre qué trabajás</Text>
                <Text style={s.blockHint}>
                  Hasta {MAX_FOCOS}. A la persona le preguntamos si quiere entender lo que vivió, resolver algo de ahora o repensar hacia dónde va.
                </Text>
                {FOCO_OPCIONES_COACH.map(op => {
                  const activo = focos.includes(op.id);
                  return (
                    <TouchableOpacity
                      key={op.id}
                      style={[s.option, activo && s.optionActive]}
                      onPress={() => toggleFoco(op.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionText, activo && s.optionTextActive]}>{op.label}</Text>
                        <Text style={[s.optionDesc, activo && s.optionDescActive]}>{op.desc}</Text>
                      </View>
                      {activo && <MaterialIcons name="check" size={18} color="#F7EFE4" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sin matrícula verificada no se ofrece: las seis son escuelas
                  de psicología, y declarar una sin matrícula insinúa en el
                  perfil una profesión que Vita no chequeó. La regla de verdad
                  está en la base (`trg_enfoques_requieren_matricula`); esto
                  evita ofrecer algo que no se iba a guardar. */}
              {!puedeDeclararEnfoque(hasMatricula) ? (
                <View style={s.block}>
                  <Text style={s.blockTitle}>Tu enfoque</Text>
                  <Text style={s.blockHint}>
                    Las escuelas (cognitivo conductual, sistémico y las demás) se muestran en el perfil de quien tiene una matrícula verificada por Vita. Si tenés matrícula, cargala en Credenciales y esta pregunta aparece sola.
                  </Text>
                </View>
              ) : (
              <View style={s.block}>
                <Text style={s.blockTitle}>Tu enfoque</Text>
                <Text style={s.blockHint}>
                  Hasta {MAX_ENFOQUES}. Se muestran en tu perfil. A quien busca no le preguntamos por esto: la mayoría no conoce las escuelas.
                </Text>
                <View style={s.chipsRow}>
                  {ENFOQUES.map(e => {
                    const activo = enfoques.includes(e.id);
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[s.chip, activo && s.chipActive]}
                        onPress={() => toggleEnfoque(e.id)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activo }}
                        accessibilityHint={e.desc}>
                        {activo && (
                          <MaterialIcons name="check" size={14} color="#F7EFE4" style={{ marginRight: 4 }} />
                        )}
                        <Text style={[s.chipText, activo && s.chipTextActive]}>{e.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              )}

              <Text style={s.nota}>
                Todo es opcional. Si no contestás algo, no se muestra y tampoco te deja afuera de las sugerencias.
              </Text>
              <View style={{ height: 20 }} />
            </ScrollView>

            <SafeAreaView style={s.footerSafe} edges={['bottom']}>
              <View style={s.footer}>
                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                  accessibilityRole="button">
                  {saving
                    ? <ActivityIndicator size="small" color="#F7EFE4" />
                    : <Text style={s.saveBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.72)', textAlign: 'center' },

  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 26 },
  block: { gap: 10 },
  blockTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32' },
  blockHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
    lineHeight: 19,
    marginBottom: 2,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,248,240,0.55)',
    ...shadow,
  },
  optionActive: { backgroundColor: ViveColors.primary, borderColor: ViveColors.primary },
  optionText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32' },
  optionTextActive: { color: '#F7EFE4' },
  optionDesc: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.85)', marginTop: 2 },
  optionDescActive: { color: 'rgba(247,239,228,0.85)' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,248,240,0.55)',
    ...shadow,
  },
  chipActive: { backgroundColor: ViveColors.primary, borderColor: ViveColors.primary },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#565E32' },
  chipTextActive: { color: '#F7EFE4', fontFamily: ViveFonts.semibold },

  nota: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: 'rgba(135,131,92,0.75)',
    lineHeight: 18,
  },

  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  saveBtn: {
    backgroundColor: '#565E32', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#F7EFE4', letterSpacing: 0.2 },
});
