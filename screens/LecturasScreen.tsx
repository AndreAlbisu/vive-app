import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
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
    duration: '3 min',
    body: `Ahora mismo, mientras lees esto, hay cosas pasando: tu respiración, los sonidos a tu alrededor, las sensaciones en tu cuerpo. Sin embargo, parte de tu mente probablemente ya está en otro lado.

Este es el modo por defecto: planificar, recordar, evaluar. No está mal. Es lo que la mente hace.

Pero hay algo diferente disponible. No todo el tiempo, no como escape, sino como punto de retorno. Una pausa deliberada en el torrente del pensamiento.

El momento presente no te va a resolver los problemas. No te va a dar las respuestas que buscás. Solo te va a dar esto: que estés donde estás, cuando estás.

Eso, de vez en cuando, es suficiente.`,
  },
  {
    title: 'La mente del principiante',
    duration: '4 min',
    body: `Hay una idea del zen: la mente del principiante. En la mente del experto hay pocas posibilidades. En la del principiante, hay muchas.

Cuando sabemos demasiado sobre algo —una persona, una situación, nosotros mismos— dejamos de verlo. Proyectamos lo que ya vimos. Esperamos lo que ya conocemos.

La mente del principiante no es ingenuidad. Es una postura deliberada: ¿qué pasaría si no supiera tanto como creo que sé?

Esto se aplica en cualquier lado. En una conversación: ¿estás escuchando o estás esperando terminar tu propio pensamiento? Con vos mismo: ¿la historia que te contás de quién sos es una descripción o una jaula?

No se trata de fingir que no sabés. Se trata de dejar espacio para lo que todavía no llegó.`,
  },
  {
    title: 'Dejar ir',
    duration: '3 min',
    body: `Hay una diferencia entre soltar y abandonar.

Abandonar implica rendirse antes de tiempo, tirar algo por falta de energía o esperanza. Soltar es diferente. Es reconocer que aferrarse a algo —un resultado, una emoción, una versión de cómo debería haber sido— le hace más daño que bien.

Los pensamientos que más pesan no siempre son los más importantes. A veces son solo los más ruidosos. Volver a un pensamiento que ya no cambia nada no es procesarlo. Es rumiación.

Soltar no es un acto de voluntad. Nadie suelta algo por querer hacerlo. Sucede cuando hay algo donde poner la atención en cambio.

¿Qué hay acá, ahora, que no sea el pasado ni el futuro?`,
  },
  {
    title: 'Lo pequeño',
    duration: '4 min',
    body: `El cerebro tiene un sesgo hacia lo extraordinario. Los picos de alegría, los mínimos de angustia. Los eventos que se desvían de la norma. Y la norma, por definición, no registra.

Pero la mayor parte de la vida es norma. El café de la mañana. La luz que entra por la ventana a cierta hora. El sonido de algo familiar. El cuerpo funcionando sin que nadie lo pida.

La gratitud forzada no funciona. No podés convencerte de sentir algo que no sentís. Pero sí podés entrenar la atención. Y prestar atención a lo pequeño —sin necesidad de que sea grande, importante o Instagram-able— cambia qué registra el cerebro como parte de tu vida.

No cada momento tiene que ser significativo. Pero cada momento es algo.

Eso ya es bastante.`,
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

  const reading = READINGS[idx];
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
          <View style={{ width: 60 }} />
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

  bodyCard: { backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 20 },
  bodyText: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#3A3A2A', lineHeight: 26 },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  doneTitle:   { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, textAlign: 'center' },
  doneSub:     { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },
});
