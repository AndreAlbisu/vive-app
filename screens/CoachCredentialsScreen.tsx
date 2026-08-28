import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import {
  listOwnCredentials, createCredential, deleteCredential, uploadCredentialFile,
  validarCredencial, lineaCredencial, KIND_LABEL,
  type OwnCredential, type CredentialKind,
} from '@/lib/coachCredentials';

const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const LINE = 'rgba(63,81,47,0.14)';
const OK_BG = '#DCE5CB';
const OK_INK = '#42542F';

const KINDS: CredentialKind[] = ['titulo', 'matricula', 'certificacion'];

/** El estado de la revisión, dicho desde el lado del coach. */
function estadoTxt(c: OwnCredential): { txt: string; bg: string; ink: string } {
  if (c.status === 'verificada') return { txt: 'Verificada', bg: OK_BG, ink: OK_INK };
  if (c.status === 'rechazada') return { txt: 'No verificada', bg: 'rgba(192,107,74,0.16)', ink: '#8F4A2E' };
  return { txt: 'En revisión', bg: 'rgba(63,81,47,0.08)', ink: FOREST_SOFT };
}

export default function CoachCredentialsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [items, setItems] = useState<OwnCredential[]>([]);
  const [loading, setLoading] = useState(true);

  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<CredentialKind>('titulo');
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState('');
  const [numero, setNumero] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    // ⚠️ `coaches.id`, no `profiles.id`: son ids distintos y `coach_credentials`
    // apunta al PK de coaches.
    const { data } = await supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    setCoachId(id);
    if (id) setItems(await listOwnCredentials(id));
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  function limpiar() {
    setKind('titulo'); setTitle(''); setInstitution(''); setYear('');
    setNumero(''); setFilePath(null); setFileName(null); setAbierto(false);
  }

  async function elegirArchivo() {
    if (!user) return;
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    // El bucket rechaza por encima de 10MB; avisarlo acá evita una subida larga
    // que termina en error.
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      Alert.alert('Archivo muy grande', 'El documento tiene que pesar menos de 10 MB');
      return;
    }

    setSubiendo(true);
    const out = await uploadCredentialFile(user.id, asset.uri, asset.name, asset.mimeType);
    setSubiendo(false);

    if ('error' in out) {
      Alert.alert('No se pudo subir', out.error);
      return;
    }
    setFilePath(out.path);
    setFileName(asset.name);
  }

  async function guardar() {
    if (!coachId) return;
    const input = {
      kind,
      title,
      institution: institution || null,
      year: year.trim() ? Number(year.trim()) : null,
      registrationNumber: numero || null,
      filePath,
    };
    const err = validarCredencial(input);
    if (err) { Alert.alert('Falta algo', err); return; }

    setGuardando(true);
    const msg = await createCredential(coachId, input);
    setGuardando(false);

    if (msg) { Alert.alert('No se pudo guardar', msg); return; }
    limpiar();
    void cargar();
  }

  function borrar(c: OwnCredential) {
    Alert.alert(
      c.title,
      c.status === 'verificada'
        ? 'Se saca de tu perfil y se borra el documento. Para volver a mostrarla hay que cargarla de nuevo y esperar la verificación.'
        : 'Se borra junto con el documento que subiste.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar', style: 'destructive',
          onPress: async () => {
            setItems(prev => prev.filter(x => x.id !== c.id));   // optimista
            const msg = await deleteCredential(c.id, c.filePath);
            if (msg) { Alert.alert('No se pudo borrar', msg); void cargar(); }
          },
        },
      ],
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.back}>
            <Feather name="chevron-left" size={22} color={FOREST} />
          </TouchableOpacity>
          <Text style={s.title}>Formación</Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

            {/* 🔴 Esto no es relleno: el coach está por subir un documento de
                identidad y tiene derecho a saber, ANTES de tocar nada, quién lo
                va a ver. Decirlo después de la subida sería tarde. */}
            <View style={s.aviso}>
              <Feather name="lock" size={15} color={FOREST_SOFT} />
              <Text style={s.avisoTxt}>
                El documento lo mira solo el equipo de Vita, para verificarlo.{' '}
                <Text style={s.avisoFuerte}>Nunca se muestra en tu perfil</Text> — lo que
                ven las personas es el título, la institución y el número, con la marca de verificado.
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={FOREST} style={{ marginTop: 40 }} />
            ) : (
              <>
                {items.map(c => {
                  const e = estadoTxt(c);
                  const linea = lineaCredencial(c);
                  return (
                    <View key={c.id} style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={s.cardKind}>{KIND_LABEL[c.kind].toUpperCase()}</Text>
                        <View style={[s.pill, { backgroundColor: e.bg }]}>
                          <Text style={[s.pillTxt, { color: e.ink }]}>{e.txt}</Text>
                        </View>
                      </View>

                      <Text style={s.cardTitle}>{c.title}</Text>
                      {!!linea && <Text style={s.cardMeta}>{linea}</Text>}
                      {!!c.registrationNumber && <Text style={s.cardMeta}>{c.registrationNumber}</Text>}

                      {/* El motivo del rechazo es lo único accionable de la
                          tarjeta: sin él, "No verificada" no dice qué corregir. */}
                      {c.status === 'rechazada' && !!c.reviewNotes && (
                        <Text style={s.motivo}>{c.reviewNotes}</Text>
                      )}

                      <TouchableOpacity onPress={() => borrar(c)} hitSlop={8} style={s.borrar}>
                        <Feather name="trash-2" size={14} color={TERRA} />
                        <Text style={s.borrarTxt}>Borrar</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {items.length === 0 && !abierto && (
                  <Text style={s.vacio}>
                    Todavía no cargaste ninguna. Tus títulos y tu matrícula son lo primero que mira
                    alguien que no te conoce.
                  </Text>
                )}

                {!abierto ? (
                  <TouchableOpacity style={s.addBtn} onPress={() => setAbierto(true)} activeOpacity={0.8}>
                    <Feather name="plus" size={16} color={CARD} />
                    <Text style={s.addBtnTxt}>Agregar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.form}>
                    <Text style={s.label}>Tipo</Text>
                    <View style={s.kinds}>
                      {KINDS.map(k => (
                        <TouchableOpacity
                          key={k}
                          style={[s.kindPill, kind === k && s.kindPillOn]}
                          onPress={() => setKind(k)}
                          activeOpacity={0.75}>
                          <Text style={[s.kindTxt, kind === k && s.kindTxtOn]}>{KIND_LABEL[k]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.label}>
                      {kind === 'matricula' ? 'Qué matrícula es' : 'Nombre del título'}
                    </Text>
                    <TextInput
                      style={s.input}
                      value={title}
                      onChangeText={setTitle}
                      placeholder={kind === 'matricula' ? 'Matrícula Nacional de Psicología' : 'Lic. en Psicología'}
                      placeholderTextColor={FOREST_SOFT}
                      maxLength={120}
                    />

                    <Text style={s.label}>Institución</Text>
                    <TextInput
                      style={s.input}
                      value={institution}
                      onChangeText={setInstitution}
                      placeholder={kind === 'matricula' ? 'Ministerio de Salud' : 'UBA'}
                      placeholderTextColor={FOREST_SOFT}
                      maxLength={120}
                    />

                    <View style={s.fila}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Año</Text>
                        <TextInput
                          style={s.input}
                          value={year}
                          onChangeText={t => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                          placeholder="2014"
                          placeholderTextColor={FOREST_SOFT}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Text style={s.label}>
                          Número {kind === 'matricula' ? '' : '(opcional)'}
                        </Text>
                        <TextInput
                          style={s.input}
                          value={numero}
                          onChangeText={setNumero}
                          placeholder="M.N. 12.345"
                          placeholderTextColor={FOREST_SOFT}
                          maxLength={40}
                        />
                      </View>
                    </View>

                    {/* 📝 El número es lo único de toda la ficha que un usuario
                        puede ir a verificar por su cuenta, así que en matrícula
                        es obligatorio (lo exige `validarCredencial`). */}
                    {kind === 'matricula' && (
                      <Text style={s.hint}>
                        El número es lo que permite comprobar tu matrícula en el registro público.
                      </Text>
                    )}

                    <Text style={s.label}>Documento que lo respalda</Text>
                    <TouchableOpacity
                      style={s.fileBtn}
                      onPress={elegirArchivo}
                      disabled={subiendo}
                      activeOpacity={0.8}>
                      {subiendo ? (
                        <ActivityIndicator size="small" color={FOREST} />
                      ) : (
                        <Feather name={filePath ? 'check-circle' : 'paperclip'} size={16} color={filePath ? OK_INK : FOREST_SOFT} />
                      )}
                      <Text style={[s.fileTxt, !!filePath && { color: OK_INK }]} numberOfLines={1}>
                        {subiendo ? 'Subiendo…' : fileName ?? 'Elegir foto o PDF (máx. 10 MB)'}
                      </Text>
                    </TouchableOpacity>

                    <View style={s.acciones}>
                      <TouchableOpacity onPress={limpiar} style={s.cancelar} activeOpacity={0.75}>
                        <Text style={s.cancelarTxt}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.addBtn, { flex: 1 }]}
                        onPress={guardar}
                        disabled={guardando || subiendo}
                        activeOpacity={0.8}>
                        <Text style={s.addBtnTxt}>
                          {guardando ? 'Guardando…' : 'Mandar a verificar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ height: TAB_BAR_CLEARANCE }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  back: { padding: 4 },
  title: { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST },
  container: { paddingHorizontal: 20, paddingTop: 4 },

  aviso: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(63,81,47,0.06)', borderRadius: 14,
    padding: 14, marginBottom: 18,
  },
  avisoTxt: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, lineHeight: 18.5 },
  avisoFuerte: { fontFamily: ViveFonts.semibold, color: FOREST },

  card: {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: LINE,
    padding: 15, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  cardKind: { fontFamily: ViveFonts.semibold, fontSize: 9.5, letterSpacing: 0.9, color: FOREST_SOFT },
  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9 },
  pillTxt: { fontFamily: ViveFonts.semibold, fontSize: 10.5 },
  cardTitle: { fontFamily: ViveFonts.titleSemiBold, fontSize: 16, color: FOREST, lineHeight: 21 },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, marginTop: 2 },
  motivo: {
    fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#8F4A2E', lineHeight: 18,
    backgroundColor: 'rgba(192,107,74,0.10)', borderRadius: 10, padding: 10, marginTop: 10,
  },
  borrar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, alignSelf: 'flex-start' },
  borrarTxt: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: TERRA },

  vacio: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST_SOFT, lineHeight: 20, marginBottom: 18 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: FOREST, borderRadius: 16, height: 50,
  },
  addBtnTxt: { fontFamily: ViveFonts.semibold, fontSize: 15, color: CARD },

  form: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: LINE, padding: 16, gap: 4 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST, marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(63,81,47,0.05)', borderRadius: 12, paddingHorizontal: 13,
    height: 46, fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST,
  },
  fila: { flexDirection: 'row', gap: 10 },
  hint: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, marginTop: 7, lineHeight: 16.5 },

  kinds: { flexDirection: 'row', gap: 7 },
  kindPill: {
    paddingHorizontal: 13, height: 34, justifyContent: 'center', borderRadius: 17,
    borderWidth: 1, borderColor: LINE,
  },
  kindPillOn: { backgroundColor: FOREST, borderColor: FOREST },
  kindTxt: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST_SOFT },
  kindTxtOn: { color: CARD, fontFamily: ViveFonts.semibold },

  fileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderColor: LINE, borderStyle: 'dashed', borderRadius: 12,
    paddingHorizontal: 13, height: 48,
  },
  fileTxt: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT },

  acciones: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  cancelar: { paddingHorizontal: 16, height: 50, justifyContent: 'center' },
  cancelarTxt: { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
});
