import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, ViveMoodColors, ViveMoods } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useConsentGate } from '@/hooks/useConsentGate';
import { ConsentSheet } from '@/components/ConsentSheet';
import { supabase } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';
import { AppBg } from '@/components/ui/AppBg';
import { localDayKey } from '@/lib/dates';
import { semanaDeEscritura } from '@/lib/semanaDiario';

// ─── Types ────────────────────────────────────────────────────────────────────
interface JournalEntry {
  id: string;
  mood: number;
  content: string;
  created_at: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Pregunta del espacio de escritura, según el ánimo elegido para ESTA entrada
// (mismos niveles que ViveMoodColors: 1=Bajón..5=Brillando).
//
// Partida en tres porque se muestra en tres tamaños: `lead` valida cómo venís,
// `pregunta` es lo que se responde, `cierre` acompaña. Antes era un solo string
// corrido, que a tamaño de título no se puede jerarquizar.
type Prompt = { lead: string; pregunta: string; cierre?: string };

const MOOD_PROMPTS: Record<number, Prompt> = {
  1: { lead: 'Hoy venís con un bajón.',   pregunta: '¿Qué es lo que más te está pesando?',        cierre: 'Soltalo acá, sin filtro.' },
  2: { lead: 'Se nota que estás cansado.', pregunta: '¿Qué te está drenando la energía estos días?' },
  3: { lead: 'Un día tranquilo.',          pregunta: '¿Qué anduvo dando vueltas por tu cabeza hoy?' },
  4: { lead: 'Venís bien hoy.',            pregunta: '¿Qué fue lo que sumó para sentirte así?' },
  5: { lead: '¡Hoy estás brillando!',      pregunta: '¿Qué hizo especial este día?',              cierre: 'Dejalo guardado acá.' },
};

// La primera vez —sin ninguna entrada todavía— gana la bienvenida aunque haya
// un ánimo elegido: a quien nunca escribió acá hay que decirle qué es esto,
// no preguntarle por su día.
const PROMPT_BIENVENIDA: Prompt = {
  lead: 'Este es tu espacio.',
  pregunta: 'Escribí lo que necesites descargar, sin juzgarte.',
};

const CIERRE_DEFAULT = 'No hay respuesta correcta. Escribí lo que te salga.';

// Con hora: desde que el ánimo es por entrada se puede escribir dos veces el
// mismo día con ánimos distintos, y dos filas que dicen "4 de septiembre" no se
// distinguen entre sí.
function formatDate(iso: string) {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}

function formatTodayShort() {
  return new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

function labelDeMood(id: number): string {
  return ViveMoods.find(m => m.id === id)?.label ?? 'Normal';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ─── Shadow ───────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiarioScreen() {
  useRecursoAbierto('diario');
  const router = useRouter();
  const [journalText, setJournalText] = useState('');
  const [textFocused, setTextFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const { user, isLoggedIn, requestAuth } = useAuth();
  // El diario y la gratitud son texto libre sobre cómo está la persona: dato
  // sensible del art. 7 igual que el check-in de ánimo. El gate va antes de
  // escribir, no después.
  const consentGate = useConsentGate(user?.id);
  const saveScale = useRef(new Animated.Value(1)).current;

  const canSave = journalText.trim().length > 0;
  const words = countWords(journalText);

  // ── Ánimo ──────────────────────────────────────────────────────────────────
  // Son DOS cosas distintas y conviene no mezclarlas:
  //
  //   `mood_entries`        → "¿cómo venís HOY?". Una fila por día
  //                           (UNIQUE user_id+entry_date). La leen Inicio, la
  //                           recomendación de recursos y la tendencia que ve
  //                           el profesional.
  //   `journal_entries.mood`→ "¿cómo estás AHORA?". Una fila por entrada. Solo
  //                           la lee el Diario.
  //
  // El selector de esta pantalla escribe en la segunda. El ánimo cambia durante
  // el día —se puede venir bien y querer anotar un mal momento de la tarde— y
  // el check-in del día no puede representar eso sin mentir.
  const { entries: moodEntries } = useMoodHistory(user?.id, 1);
  // ⚠️ `localDayKey()` y no `toISOString()`: esta es la fecha del DÍA del
  // usuario, y en Argentina (UTC-3) el ISO salta a las 21:00 — el Diario venía
  // buscando el check-in de mañana toda la noche, no lo encontraba, y caía al
  // prompt genérico justo a la hora en que más se escribe.
  const todayStr = localDayKey();

  // Ánimo del check-in de hoy, si existe. Se sincroniza cuando llega el hook y
  // también cuando esta pantalla lo crea al guardar (ver `handleSave`).
  const [checkinHoy, setCheckinHoy] = useState<number | null>(null);
  useEffect(() => {
    const hoy = moodEntries.find(e => e.entry_date === todayStr);
    if (hoy) setCheckinHoy(hoy.mood_id);
  }, [moodEntries, todayStr]);

  // El ánimo de ESTA entrada. Arranca en el check-in del día (o Normal si no
  // hay), pero se puede mover — y moverlo no toca el check-in.
  const [entryMood, setEntryMood] = useState<number>(3);
  const moodTocado = useRef(false);
  useEffect(() => {
    if (moodTocado.current) return;   // no pisar lo que ya eligió la persona
    if (checkinHoy !== null) setEntryMood(checkinHoy);
  }, [checkinHoy]);

  // Avisa —dentro de la card de guardado— que esta entrada también dejó
  // registrado el día. Sin esto, la carita aparecería sola en Inicio mañana y
  // se leería como que la app decidió por vos.
  const [avisoCheckin, setAvisoCheckin] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  // Qué está desplegado del bloque colapsado mientras se escribe. Uno por vez:
  // abrir los dos comería el espacio que el colapso vino a ganar.
  const [moodAbierto, setMoodAbierto] = useState(false);
  const [preguntaAbierta, setPreguntaAbierta] = useState(false);

  // ── Pregunta ───────────────────────────────────────────────────────────────
  // Se congela apenas hay algo escrito: que la pregunta se reescriba sola
  // mientras escribís —porque moviste el ánimo a mitad de una frase— es
  // insoportable. Se fija la primera vez que hay texto y se suelta al vaciarse.
  const promptFijado = useRef<Prompt | null>(null);
  const promptBase = entries.length === 0
    ? PROMPT_BIENVENIDA
    : (MOOD_PROMPTS[entryMood] ?? PROMPT_BIENVENIDA);
  const prompt = promptFijado.current ?? promptBase;

  function handleChangeText(t: string) {
    if (t.trim().length === 0) promptFijado.current = null;
    else if (!promptFijado.current) promptFijado.current = promptBase;
    setJournalText(t);
  }

  function elegirMood(id: number) {
    moodTocado.current = true;
    setEntryMood(id);
  }

  useEffect(() => {
    if (!user) return;
    supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      // Con techo: sin `limit` esto se traía todas las entradas de la historia
      // de la persona en cada apertura — el texto más sensible de la app,
      // creciendo sin freno en cada carga de pantalla.
      .limit(50)
      .then(({ data }) => {
        if (data) setEntries(data);
      });
  }, [user]);

  async function handleSave() {
    if (!canSave || saved) return;
    if (!isLoggedIn || !user) { requestAuth('guardar_diario'); return; }

    // Antes de la animación a propósito: si dice que no, el botón no tiene que
    // haber hecho el gesto de guardar algo que no se guardó.
    if (!(await consentGate.pedir())) return;

    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.95, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();

    // Optimista: el botón confirma y el campo se limpia sin esperar la red.
    // Antes se esperaba el round-trip entero con el botón quieto en "Guardar
    // entrada", y desde que el check-in del día se crea acá eran DOS viajes en
    // serie — se notaba.
    const texto = journalText.trim();
    const moodDeLaEntrada = entryMood;
    promptFijado.current = null;
    setJournalText('');
    setErrorGuardado(null);
    setAvisoCheckin(false);
    setSaved(true);

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        mood: moodDeLaEntrada,
        content: texto,
      })
      .select()
      .single();

    // 🔴 Si falla, se devuelve el texto. Antes el campo se limpiaba y el botón
    // decía "Guardado" pasara lo que pasara —el `if (!error && data)` solo
    // envolvía el agregado a la lista—, así que un error de red borraba de la
    // pantalla una entrada que no se había guardado en ningún lado, sin decir
    // nada. Es lo más caro que puede perder esta app.
    if (error || !data) {
      setSaved(false);
      setJournalText(texto);
      setErrorGuardado('No se pudo guardar. Fijate la conexión y probá de nuevo.');
      return;
    }

    setEntries(prev => [data, ...prev]);
    // Diario es "libre" (sin duración) → completación sin duration_seconds.
    recordCompletion(user.id, 'diario').catch(() => {});

    // El check-in del día va después y SIN bloquear: es una consecuencia de
    // haber escrito, no parte de guardar la entrada, y no tiene por qué hacer
    // esperar al botón.
    //
    // Si todavía no hay check-in de hoy, esta entrada lo CREA — y nunca lo
    // pisa. Es un `insert` y no un `upsert` a propósito: el UNIQUE de
    // `mood_entries` es el que garantiza que no se sobreescriba, así que ni
    // siquiera una carrera con Inicio puede romper la regla. Sin esto, quien
    // escribe todas las noches pero no toca la carita de Inicio le aparece al
    // profesional como alguien sin ningún dato; con un upsert, en cambio, un
    // mal momento de las 23:00 redefiniría el día entero.
    if (checkinHoy === null) {
      supabase
        .from('mood_entries')
        .insert({
          user_id: user.id,
          mood_id: moodDeLaEntrada,
          mood_label: labelDeMood(moodDeLaEntrada),
          entry_date: todayStr,
        })
        .then(({ error: moodErr }) => {
          if (moodErr) return;
          setCheckinHoy(moodDeLaEntrada);
          setAvisoCheckin(true);
        });
    }
  }

  // ── Esta semana ────────────────────────────────────────────────────────────
  // Días de la semana en curso (lunes a domingo) en los que hay al menos una
  // entrada. Se deriva de `entries`, que ya están en memoria: no hay una
  // segunda consulta, y la franja se actualiza sola al guardar — el día que
  // acabás de escribir se llena delante tuyo, que es su único momento de valor.
  //
  // Es "escribiste o no", NO el ánimo: pintada por nivel hablaría del check-in
  // en vez del diario, y se pisaría con el gráfico de ánimo de Progreso.
  const semana = useMemo(
    () => semanaDeEscritura(entries.map(e => e.created_at)),
    [entries],
  );

  function escribirOtra() {
    setSaved(false);
    setAvisoCheckin(false);
    setErrorGuardado(null);
    // La entrada siguiente arranca de cero: el ánimo vuelve al del día, no al
    // de lo que se acaba de escribir.
    moodTocado.current = false;
    setEntryMood(checkinHoy ?? 3);
  }

  function renderMoodRow() {
    return (
      <View style={s.moodRow} accessibilityRole="radiogroup">
        {ViveMoods.map(m => {
          const activo = entryMood === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={s.moodOption}
              onPress={() => elegirMood(m.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={m.label}
            >
              <View style={[s.moodRing, activo && s.moodRingActive]}>
                <View style={[s.moodDot, { backgroundColor: ViveMoodColors[m.id] }]} />
              </View>
              <Text style={[s.moodLabel, activo && s.moodLabelActive]} numberOfLines={1}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderAnimo() {
    return (
      <View style={s.section}>
        <Text style={s.moodQuestion}>¿Cómo estás ahora?</Text>
        {renderMoodRow()}
      </View>
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <ToolHeader
          title="Diario"
          onBack={() => router.back()}
          right={<Text style={s.datePillText}>{formatTodayShort()}</Text>}
        />
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
            {saved ? (
              <>
                {renderAnimo()}
                {/* ── Guardado ──────────────────────────────────────── */}
                {/* Estado, no un cartel de 2,5 segundos: la entrada se cerró y
                    la pantalla lo acompaña. Se sale escribiendo otra. */}
                <View style={[s.section, s.guardadoCard]}>
                  <View style={s.guardadoCheck}>
                    <MaterialCommunityIcons name="check" size={18} color={ViveColors.accent} />
                  </View>
                  <View style={s.guardadoTexto}>
                    <Text style={s.guardadoTitulo}>Guardado.</Text>
                    <Text style={s.guardadoFrase}>
                      A veces, escribir ya es una forma de cuidarte.
                    </Text>
                    {avisoCheckin && (
                      <Text style={s.guardadoFrase}>
                        También quedó registrado cómo venís hoy.
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.saveBtn, { marginBottom: 32 }]}
                  onPress={escribirOtra}
                  activeOpacity={0.85}
                >
                  <Text style={s.saveBtnText}>Escribir otra entrada</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ── Ánimo y pregunta ──────────────────────────────── */}
                {/* Con el teclado abierto se colapsan a dos chips. No es un
                    adorno: entre header, ánimo, pregunta, hint y botón, al
                    área de escritura le quedaban ~5 líneas visibles en la
                    única pantalla de la app cuyo propósito es escribir. */}
                {textFocused ? (
                  <View style={s.section}>
                    <View style={s.chipsRow}>
                      <TouchableOpacity
                        style={s.chip}
                        onPress={() => { setMoodAbierto(v => !v); setPreguntaAbierta(false); }}
                        activeOpacity={0.8}
                      >
                        <View style={[s.chipDot, { backgroundColor: ViveMoodColors[entryMood] }]} />
                        <Text style={s.chipText}>{labelDeMood(entryMood)}</Text>
                        <MaterialCommunityIcons
                          name={moodAbierto ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={ViveColors.text}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.chip}
                        onPress={() => { setPreguntaAbierta(v => !v); setMoodAbierto(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={s.chipText}>Ver pregunta</Text>
                        <MaterialCommunityIcons
                          name={preguntaAbierta ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={ViveColors.text}
                        />
                      </TouchableOpacity>
                    </View>
                    {moodAbierto && <View style={s.chipAbierto}>{renderMoodRow()}</View>}
                    {preguntaAbierta && (
                      <View style={s.chipAbierto}>
                        <Text style={s.promptLead}>{prompt.lead}</Text>
                        <Text style={s.promptQuestion}>{prompt.pregunta}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {renderAnimo()}
                    <View style={s.section}>
                      <View style={s.promptRule} />
                      <Text style={s.promptLead}>{prompt.lead}</Text>
                      <Text style={s.promptQuestion}>{prompt.pregunta}</Text>
                      <Text style={s.promptHint}>{prompt.cierre ?? CIERRE_DEFAULT}</Text>
                    </View>
                  </>
                )}

                {/* ── Área de escritura ────────────────────────── */}
                <View style={[s.section, s.writeCard, textFocused && s.writeCardFocused]}>
                  <TextInput
                    style={s.textArea}
                    value={journalText}
                    onChangeText={handleChangeText}
                    onFocus={() => setTextFocused(true)}
                    onBlur={() => { setTextFocused(false); setMoodAbierto(false); setPreguntaAbierta(false); }}
                    placeholder="Empezá por donde quieras..."
                    placeholderTextColor={ViveColors.calm}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                  />
                  {words > 0 && (
                    <Text style={s.wordCount}>
                      {words} {words === 1 ? 'palabra' : 'palabras'}
                    </Text>
                  )}
                </View>

                {/* ── Botón guardar ────────────────────────────────────── */}
                <Animated.View style={{ transform: [{ scale: saveScale }], marginBottom: 32 }}>
                  <TouchableOpacity
                    style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!canSave}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.saveBtnText, !canSave && s.saveBtnTextDisabled]}>Guardar entrada</Text>
                  </TouchableOpacity>
                  {errorGuardado && (
                    <Text style={s.errorGuardado}>{errorGuardado}</Text>
                  )}
                </Animated.View>

                {/* ── Primera vez ──────────────────────────────────────── */}
                {/* Sin franja semanal ni historial: no hay nada que mostrar
                    todavía, y siete círculos vacíos el día uno se leen como un
                    reproche antes de haber escrito una palabra. */}
                {entries.length === 0 && !textFocused && (
                  <View style={s.primeraVez}>
                    <View style={s.primeraVezIcono}>
                      <MaterialCommunityIcons name="notebook-outline" size={22} color={ViveColors.primary} />
                    </View>
                    <Text style={s.primeraVezTitulo}>Acá empieza tu diario.</Text>
                    <Text style={s.primeraVezTexto}>
                      Lo que escribas queda guardado con su fecha, para cuando quieras volver a leerlo.
                    </Text>
                  </View>
                )}
              </>
            )}


            {/* ── Esta semana ──────────────────────────────────────── */}
            {/* No aparece hasta la primera entrada: a quien abre el Diario por
                primera vez, siete círculos vacíos le dicen "vas mal" antes de
                escribir una palabra. */}
            {entries.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Esta semana</Text>
                <View style={s.semanaRow}>
                  {semana.map(d => (
                    <View
                      key={d.key}
                      style={s.semanaDia}
                      accessibilityLabel={`${d.label}: ${d.escrito ? 'escribiste' : 'sin entrada'}`}
                    >
                      <View
                        style={[
                          s.semanaPunto,
                          d.escrito && s.semanaPuntoEscrito,
                          d.esHoy && s.semanaPuntoHoy,
                        ]}
                      />
                      <Text style={s.semanaLabel}>{d.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Historial ────────────────────────────────────────── */}
            <View>
              {entries.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>Entradas anteriores</Text>
                  {entries.map(entry => {
                    const moodColor = ViveMoodColors[entry.mood];
                    const preview =
                      entry.content.length > 64
                        ? entry.content.slice(0, 64).trimEnd() + '...'
                        : entry.content;
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        style={s.entryCard}
                        onPress={() => setSelectedEntry(entry)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.entryMoodDot, moodColor && { backgroundColor: moodColor }]} />
                        <View style={s.entryInfo}>
                          <Text style={s.entryDate}>{formatDate(entry.created_at)}</Text>
                          <Text style={s.entryPreview}>{preview}</Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={18}
                          color={`${ViveColors.text}44`}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Modal: Entrada completa ──────────────────────────────── */}
        <Modal
          visible={selectedEntry !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedEntry(null)}
        >
          <SafeAreaView style={s.modalSafe} edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedEntry(null)}
                style={s.modalCloseBtn}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={22} color={ViveColors.text} />
              </TouchableOpacity>
              {selectedEntry && ViveMoodColors[selectedEntry.mood] && (
                <View style={[s.entryMoodDot, { backgroundColor: ViveMoodColors[selectedEntry.mood] }]} />
              )}
              <Text style={s.modalTitle}>
                {selectedEntry ? formatDate(selectedEntry.created_at) : ''}
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={s.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* El ánimo con el que se escribió. Antes había un badge con una
                  pregunta fija ("¿Qué fue lo más importante que sentiste hoy?")
                  que esa entrada probablemente nunca vio: no se guarda qué
                  prompt le tocó a cada una. Esto sí es un dato real de la fila. */}
              {selectedEntry && ViveMoodColors[selectedEntry.mood] && (
                <View style={s.modalMoodBadge}>
                  <View style={[s.chipDot, { backgroundColor: ViveMoodColors[selectedEntry.mood] }]} />
                  <Text style={s.modalMoodText}>{labelDeMood(selectedEntry.mood)}</Text>
                </View>
              )}
              <Text style={s.modalBodyText}>{selectedEntry?.content}</Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <ConsentSheet {...consentGate.sheetProps} />
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // El fondo lo pone `AppBg` (mismo gradiente cálido que Inicio y Recursos).
  // El Diario era la única pantalla de la app con el crema plano.
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: { flex: 1 },

  // Header — layout compartido en ToolHeader; acá solo queda el contenido del slot `right`
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
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },

  // Scroll
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  section: {
    marginBottom: 20,
  },

  // Ánimo de esta entrada — 5 niveles, un toque (el hold-to-confirm es del
  // check-in de Inicio, que registra el día; acá se elige el tono de lo que se
  // va a escribir).
  moodQuestion: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    marginBottom: 12,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,   // el área tocable incluye el label (~65px, sobre el mínimo de 44)
  },
  moodRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodRingActive: {
    borderColor: ViveColors.primary,
  },
  moodDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  // ⚠️ Sin opacidad: el oliva sobre crema da 6.05:1 pleno, pero al 50% cae a
  // 2.2 y al 33% a 1.6 — así estaba toda la jerarquía de esta pantalla, muy
  // por debajo del mínimo AA de 4.5. En esta paleta no hay gris intermedio que
  // pase (el más oscuro, `calm`, da 3.39), así que la jerarquía la dan el
  // tamaño y el peso, no la transparencia.
  moodLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.text,
  },
  moodLabelActive: {
    fontFamily: ViveFonts.semibold,
  },

  // Pregunta — sin card, tipografía sobre el fondo
  promptRule: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: ViveColors.primary,
    marginBottom: 14,
  },
  promptLead: {
    fontFamily: ViveFonts.title,
    fontSize: 22,
    lineHeight: 30,
    color: ViveColors.text,
  },
  promptQuestion: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 22,
    lineHeight: 30,
    color: ViveColors.text,
    marginBottom: 10,
  },
  promptHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ViveColors.text,
  },

  // Write area
  writeCard: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.25)',
    padding: 16,
    ...shadow,
  },
  writeCardFocused: {
    borderColor: '#C1694F',
  },
  textArea: {
    fontFamily: ViveFonts.regular,
    fontSize: 16,          // mínimo de cuerpo del proyecto en mobile; estaba en 15
    color: ViveColors.text,
    lineHeight: 26,
    minHeight: 220,
    textAlignVertical: 'top',
    padding: 0,
  },
  wordCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.text,
    textAlign: 'right',
    marginTop: 10,
  },

  // Save button
  saveBtn: {
    backgroundColor: ViveColors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: {
    backgroundColor: '#EAE2D0',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F7EFE4',
  },
  saveBtnTextDisabled: {
    color: 'rgba(86,94,50,0.40)',
  },
  // Chips del estado colapsado (mientras se escribe)
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
  chipDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  chipAbierto: {
    marginTop: 14,
  },

  // Guardado — estado de cierre, no un cartel pasajero
  guardadoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
    ...shadow,
  },
  guardadoCheck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${ViveColors.accent}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardadoTexto: {
    flex: 1,
    gap: 4,
  },
  guardadoTitulo: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 17,
    color: ViveColors.text,
  },
  guardadoFrase: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ViveColors.text,
  },

  // Primera vez
  primeraVez: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  primeraVezIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${ViveColors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  primeraVezTitulo: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
  },
  primeraVezTexto: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ViveColors.text,
    textAlign: 'center',
  },

  // Esta semana — un solo color: lleno = escribiste. El anillo marca hoy y NO
  // reemplaza al relleno: el día que escribís tiene que verse lleno Y con
  // anillo, si no, el único día que importa es el que no se ve.
  semanaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  semanaDia: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  semanaPunto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}33`,
    backgroundColor: 'transparent',
  },
  semanaPuntoEscrito: {
    backgroundColor: ViveColors.primary,
    borderColor: ViveColors.primary,
  },
  semanaPuntoHoy: {
    borderWidth: 2.5,
    borderColor: ViveColors.primaryInk,
  },
  semanaLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.text,
  },

  errorGuardado: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primaryInk,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },

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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    ...shadow,
  },
  entryMoodDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.text,
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  entryPreview: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 19,
  },

  // Modal
  modalSafe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F7EFE4',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
    gap: 12,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
  },
  modalContent: {
    padding: 24,
    gap: 20,
  },
  modalMoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: `${ViveColors.primary}15`,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalMoodText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  modalBodyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 16,
    color: ViveColors.text,
    lineHeight: 26,
  },
});
