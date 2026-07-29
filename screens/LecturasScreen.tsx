import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { PinButton } from '@/components/PinButton';
import { ReminderBell } from '@/components/ReminderBell';
import { ensureAnonSession } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';
const GLASS_BG    = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const READINGS = [
  {
    title: 'El momento presente',
    book: 'El poder del ahora',
    author: 'Eckhart Tolle',
    duration: '3 min',
    body: `"Siempre solo hay este momento. La vida es ahora. Nunca hubo un momento en que tu vida no fuera ahora, ni lo habrá jamás."

El pasado que recordás y el futuro que anticipás existen solo como pensamientos en tu mente —ahora mismo. La única puerta de entrada a tu vida real es el presente.

Tolle nos invita a notar algo simple: la mayoría del sufrimiento mental no viene de lo que está pasando, sino de nuestra resistencia a lo que está pasando. Cuando la mente lucha contra el presente —queriendo que sea distinto, juzgándolo, escapando de él— genera tensión sin resolver nada.

La práctica no es forzarte a "estar presente". Es solo notar cuándo no lo estás. Ese reconocimiento ya es presencia.`,
  },
  {
    title: 'Elegir la respuesta',
    book: 'El hombre en busca de sentido',
    author: 'Viktor Frankl',
    duration: '4 min',
    body: `"Entre el estímulo y la respuesta hay un espacio. En ese espacio está nuestro poder de elegir nuestra respuesta. En nuestra respuesta radica nuestro crecimiento y nuestra libertad."

Frankl escribió esto después de sobrevivir los campos de concentración nazis. Perdió a su familia, su trabajo, su manuscrito. Lo que no le pudieron quitar, observó, era la actitud que tomaba frente a lo que le sucedía.

No se trata de positivismo forzado. Frankl no sugería fingir que el sufrimiento no existe. Sugería que incluso en las circunstancias más extremas, existe un margen —pequeño pero real— entre lo que nos ocurre y lo que decidimos hacer con eso.

Ese margen es suficiente para construir una vida con sentido.`,
  },
  {
    title: 'Adonde vayas, ahí estás',
    book: 'Wherever You Go, There You Are',
    author: 'Jon Kabat-Zinn',
    duration: '3 min',
    body: `"No tenés que hacer nada especial para practicar la atención plena. Solo tenés que prestar atención a lo que ya está sucediendo."

Kabat-Zinn, pionero del mindfulness clínico, parte de una premisa incómoda: solemos vivir en piloto automático. Comemos sin saborear, caminamos sin sentir el piso, escuchamos sin oír realmente.

La atención plena no es un estado de calma perfecta. Es la capacidad de notar lo que está pasando —incluyendo la agitación, el aburrimiento, la incomodidad— sin que esa experiencia nos arrastre.

Podés empezar ahora mismo. ¿Qué sentís en las manos? ¿Cómo es tu respiración en este momento? No hay respuesta correcta. Solo hay lo que hay.`,
  },
  {
    title: 'La vulnerabilidad como fortaleza',
    book: 'El poder de ser vulnerable',
    author: 'Brené Brown',
    duration: '4 min',
    body: `"La vulnerabilidad no es ganar o perder. Es tener el coraje de mostrarte y ser visto cuando no tenés control del resultado."

Durante años de investigación, Brown descubrió algo paradójico: las personas que describían tener vidas más plenas y conectadas no eran las que evitaban el riesgo emocional. Eran las que se permitían ser vulnerables.

Nuestra cultura equipara vulnerabilidad con debilidad. Sin embargo, toda conexión genuina —amar, pedir ayuda, ser honesto— requiere exponerse sin garantías.

La pregunta que Brown nos deja no es si vamos a sentir vulnerabilidad. Es si vamos a dejar que eso nos detenga, o si vamos a avanzar de todas formas.`,
  },
  {
    title: 'La impermanencia',
    book: 'Cuando todo se derrumba',
    author: 'Pema Chödrön',
    duration: '3 min',
    body: `"Las cosas se desmoronan y nos rendimos. Los regalos de las crisis de vida son preciosos, pero raras veces se perciben como tales."

Chödrön, monja budista tibetana, escribe sobre algo que todos evitamos: la incomodidad no va a desaparecer. El malestar, la incertidumbre, la pérdida —son parte del tejido de la vida, no errores del sistema.

La propuesta no es resignarse, sino relacionarse diferente con lo que no podemos controlar. En vez de luchar contra la experiencia difícil, podemos aprender a quedarnos con ella sin escapar ni colapsar.

Ese pequeño giro —de huir a permanecer— es, paradójicamente, lo que nos da más libertad.`,
  },
];

export default function LecturasScreen() {
  const router = useRouter();
  const [idx, setIdx]     = useState(0);
  const [done, setDone]   = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAnonSession().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  function handleNext() {
    if (idx + 1 >= READINGS.length) {
      setDone(true);
      if (userIdRef.current) {
        recordCompletion(userIdRef.current, 'lecturas', 420).catch(() => {});
      }
    } else {
      setIdx(idx + 1);
    }
  }

  const reading = READINGS[idx] as typeof READINGS[0] & { book: string; author: string };
  const isLast  = idx === READINGS.length - 1;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Lecturas breves</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" resourceRef="lecturas" title="Lecturas breves" />
            <PinButton resourceId="lecturas" />
          </View>
        </View>

        {done ? (
          <View style={s.doneContent}>
            <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
            <Text style={s.doneTitle}>Lecturas completadas</Text>
            <Text style={s.doneSub}>
              Leíste {READINGS.length} textos cortos.{'\n'}
              Tomarte este espacio importa.
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Progress */}
            <View style={s.progressHeader}>
              {READINGS.map((_, i) => (
                <View key={i} style={[s.progressDot, i <= idx && s.progressDotActive]} />
              ))}
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}>

              <View style={s.metaRow}>
                <Text style={s.readingNum}>{idx + 1} / {READINGS.length}</Text>
                <Text style={s.readingDuration}>{reading.duration}</Text>
              </View>

              <Text style={s.readingTitle}>{reading.title}</Text>
              <View style={s.sourceRow}>
                <MaterialCommunityIcons name="book-open-variant" size={13} color={TERRACOTTA} />
                <Text style={s.sourceText}>{reading.book} · {reading.author}</Text>
              </View>

              <View style={s.bodyCard}>
                <Text style={s.bodyText}>{reading.body}</Text>
              </View>

              <TouchableOpacity style={s.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>{isLast ? 'Terminé' : 'Siguiente'}</Text>
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:{ fontFamily: ViveFonts.medium, fontSize: 13, color: 'rgba(135,131,92,0.80)' },
  title:   { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },

  progressHeader: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  progressDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(63,81,47,0.15)' },
  progressDotActive: { backgroundColor: FOREST },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 8, gap: 16 },

  metaRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readingNum:     { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT },
  readingDuration:{ fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.60)' },
  readingTitle:   { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, lineHeight: 36, letterSpacing: -0.3 },
  sourceRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6 },
  sourceText:     { fontFamily: ViveFonts.medium, fontSize: 11.5, color: TERRACOTTA, flex: 1 },

  bodyCard: { backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 20 },
  bodyText: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#3A3A2A', lineHeight: 26 },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  doneTitle:   { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, textAlign: 'center' },
  doneSub:     { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },
});
