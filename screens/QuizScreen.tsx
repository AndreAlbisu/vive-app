import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';
import { QUIZ_AREAS as Q1_OPTIONS } from '@/constants/searchData';
import {
  recomendarDesdeQuiz,
  TIPO_OPCIONES as Q2_OPTIONS,
  PRESUPUESTO_OPCIONES as Q3_OPTIONS,
  ESTILO_OPCIONES as Q4_OPTIONS,
  TAMANO_TANDA,
  type ResultadoQuiz,
} from '@/lib/quizMatch';
import type { EstiloPedido } from '@/lib/enfoque';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';
import { supabase } from '@/lib/supabase';
import { guardarPendiente, volcarPendiente } from '@/lib/quizPendiente';

const F  = '#3A4F2A';
const FS = '#566245';
const CR = '#F3EEDF';
const TC = '#C1694F';
const BG = 'rgba(255,248,240,0.65)';
const BD = 'rgba(255,255,255,0.65)';
const SG = '#C99A3F';

// Opciones, criterio de coincidencia y razones: `lib/quizMatch.ts`.

function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function QuizScreen() {
  const router = useRouter();
  const [step, setStep]   = useState(0);   // 0–3 = preguntas, 4 = resultados
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string | null>(null);
  // M14: cómo quiere que la acompañen. La última porque es la única opcional:
  // quien no sabe qué contestar ya respondió lo que importa.
  const [q4, setQ4] = useState<EstiloPedido | null>(null);
  const [rawCoaches, setCoaches] = useState<CachedCoach[]>([]);
  const coaches = useBlockedFilter(rawCoaches);
  const [resultado, setResultado] = useState<ResultadoQuiz>({ recomendaciones: [], hayCoincidenciaExacta: false });
  // Cuántas tandas se ven (M2): "Ver otras opciones" suma una.
  const [tandas, setTandas] = useState(1);

  useEffect(() => {
    prefetchCoaches();
    let t: ReturnType<typeof setInterval>;
    const check = () => {
      const c = getCoachesCache();
      if (c) { setCoaches(c); clearInterval(t); }
    };
    check();
    t = setInterval(check, 80);
    return () => clearInterval(t);
  }, []);

  function advance() {
    if (step < 3) {
      setStep(s => s + 1);
    } else {
      setResultado(recomendarDesdeQuiz(coaches, { tema: q1, tipo: q2, presupuesto: q3, estilo: q4 }));
      setTandas(1);
      // 🔴 Antes esto era `if (!uid) return;`: quien hacía el quiz SIN cuenta
      // perdía las tres respuestas en silencio. Lo único que quedaba era
      // `vive_quiz_topic` en AsyncStorage, una clave que no lee nadie — o sea
      // nada. Y el quiz se puede hacer sin cuenta: se llega desde Profesionales,
      // que es navegable como anónimo.
      //
      // Ahora hay un solo camino: se encolan siempre, y si YA hay sesión se
      // vuelcan en el acto para que la recomendación se actualice enseguida.
      // Si no, quedan esperando y las vuelca `AuthContext` al registrarse.
      // ⚠️ El estilo (q4) NO se guarda: `quiz_pendiente` y la fila del usuario
      // tienen tema, tipo y presupuesto, y sumarle una columna es otra migración.
      // Vale para esta corrida del quiz; si después se quiere recomendar con el
      // estilo fuera de esta pantalla, hay que persistirlo.
      guardarPendiente({ topic: q1, professionalType: q2, budget: q3 })
        .then(() => supabase.auth.getSession())
        .then(({ data }) => {
          const uid = data.session?.user?.id;
          if (uid) return volcarPendiente(uid);
        })
        .catch(e => console.warn('[quiz] no se pudo guardar:', e?.message ?? e));
      setStep(4);
    }
  }

  // M2: volver a las preguntas con lo ya elegido marcado, para cambiar una sola.
  function volverAResponder() {
    setStep(0);
  }

  const visibles = resultado.recomendaciones.slice(0, tandas * TAMANO_TANDA);
  const hayMas = resultado.recomendaciones.length > visibles.length;

  const canAdvance = (step === 0 && q1) || (step === 1 && q2) || (step === 2 && q3) || (step === 3 && q4);

  function goToPerfil(coach: CachedCoach) {
    router.push({
      pathname: '/profesional',
      params: {
        profileId: coach.id,
        name: coach.name,
        specialty: coach.specialty,
        priceFrom: String(coach.priceFrom),
      },
    });
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={F} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          {step < 4 && (
            <Text style={s.stepLabel}>{step + 1} / 4</Text>
          )}
          <View style={{ width: 60 }} />
        </View>

        {/* Progress bar */}
        {step < 4 && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${((step + 1) / 4) * 100}%` as any }]} />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}>

          {/* ── Q1 ── */}
          {step === 0 && (
            <>
              <Text style={s.question}>{Q1_OPTIONS.length > 0 ? '¿Qué querés trabajar principalmente?' : ''}</Text>
              {Q1_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.option, q1 === opt.id && s.optionActive]}
                  onPress={() => setQ1(opt.id)}
                  activeOpacity={0.8}>
                  <Feather name={opt.icon as any} size={18} color={q1 === opt.id ? CR : FS} />
                  <Text style={[s.optionText, q1 === opt.id && s.optionTextActive]}>{opt.label}</Text>
                  {q1 === opt.id && <Feather name="check" size={16} color={CR} />}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Q2 ── */}
          {step === 1 && (
            <>
              <Text style={s.question}>¿Con quién preferís hacerlo?</Text>
              {Q2_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.option, q2 === opt.id && s.optionActive]}
                  onPress={() => setQ2(opt.id)}
                  activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionText, q2 === opt.id && s.optionTextActive]}>{opt.label}</Text>
                    <Text style={[s.optionDesc, q2 === opt.id && s.optionDescActive]}>{opt.desc}</Text>
                  </View>
                  {q2 === opt.id && <Feather name="check" size={16} color={CR} />}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Q3 ── */}
          {step === 2 && (
            <>
              <Text style={s.question}>¿Cuál es tu presupuesto por sesión?</Text>
              {Q3_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.option, q3 === opt.id && s.optionActive]}
                  onPress={() => setQ3(opt.id)}
                  activeOpacity={0.8}>
                  <Text style={[s.optionText, q3 === opt.id && s.optionTextActive]}>{opt.label}</Text>
                  {q3 === opt.id && <Feather name="check" size={16} color={CR} />}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Q4 (M14) ── */}
          {step === 3 && (
            <>
              <Text style={s.question}>¿Cómo te gustaría que te acompañen?</Text>
              <Text style={s.questionHint}>
                No hay respuesta correcta, y se puede cambiar sobre la marcha.
              </Text>
              {Q4_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.option, q4 === opt.id && s.optionActive]}
                  onPress={() => setQ4(opt.id)}
                  activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionText, q4 === opt.id && s.optionTextActive]}>{opt.label}</Text>
                    <Text style={[s.optionDesc, q4 === opt.id && s.optionDescActive]}>{opt.desc}</Text>
                  </View>
                  {q4 === opt.id && <Feather name="check" size={16} color={CR} />}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Results ── */}
          {step === 4 && (
            <>
              <Text style={s.resultsTitle}>Para vos</Text>
              <Text style={s.resultsSub}>
                {resultado.recomendaciones.length === 0
                  ? 'Todavía no hay profesionales que trabajen lo que elegiste.'
                  : resultado.hayCoincidenciaExacta
                    ? 'Estos perfiles coinciden con lo que respondiste. Abajo de cada uno te contamos por qué.'
                    : 'No encontramos a nadie con todo lo que pediste. Estos se acercan, y te marcamos en qué no coinciden.'}
              </Text>

              {visibles.map(({ coach, razones, diferencias }) => (
                <View key={coach.id} style={s.resultCard}>
                  <View style={s.resultTop}>
                    {/* Avatar */}
                    <View style={s.avatarWrap}>
                      {coach.avatarUrl ? (
                        <Image source={{ uri: coach.avatarUrl }} style={s.avatar} />
                      ) : (
                        <View style={[s.avatar, s.avatarFallback]}>
                          <Text style={s.avatarInitials}>{getInitials(coach.name)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName} numberOfLines={1}>{coach.name}</Text>
                      <Text style={s.resultRole} numberOfLines={1}>{coach.specialty}</Text>
                      {(coach.reviewCount ?? 0) >= 1 && (
                        <View style={s.ratingRow}>
                          <Feather name="star" size={11} color={SG} />
                          <Text style={s.ratingText}>
                            {(coach.avgRating ?? 0).toFixed(1)} · {coach.reviewCount} {(coach.reviewCount ?? 0) === 1 ? 'reseña' : 'reseñas'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.resultPrice}>
                      ${(coach.priceFrom ?? 0).toLocaleString('es-AR')}
                    </Text>
                  </View>

                  {/* M1: por qué aparece. Solo cosas que el perfil cumple de verdad. */}
                  <View style={s.reasons} accessibilityLabel={`Por qué te lo sugerimos: ${razones.join('. ')}`}>
                    {razones.map(r => (
                      <View key={r} style={s.reasonRow}>
                        <Feather name="check" size={13} color={F} style={s.reasonIcon} />
                        <Text style={s.reasonText}>{r}</Text>
                      </View>
                    ))}
                    {diferencias.map(d => (
                      <View key={d} style={s.reasonRow}>
                        <Feather name="minus" size={13} color={FS} style={s.reasonIcon} />
                        <Text style={[s.reasonText, s.diffText]}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity style={s.resultBtn} onPress={() => goToPerfil(coach)} activeOpacity={0.85}>
                    <Text style={s.resultBtnText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* M2: salidas para cuando ninguno convence. */}
              <View style={s.exits}>
                {hayMas ? (
                  <TouchableOpacity
                    style={s.exitPrimary}
                    onPress={() => setTandas(n => n + 1)}
                    activeOpacity={0.85}
                    accessibilityRole="button">
                    <Text style={s.exitPrimaryText}>Ver otras opciones</Text>
                  </TouchableOpacity>
                ) : resultado.recomendaciones.length > 0 ? (
                  <Text style={s.noMore}>No hay más perfiles que trabajen lo que elegiste.</Text>
                ) : null}

                <TouchableOpacity style={s.exitSecondary} onPress={volverAResponder} activeOpacity={0.8} accessibilityRole="button">
                  <Feather name="rotate-ccw" size={14} color={F} />
                  <Text style={s.exitSecondaryText}>Cambiar mis respuestas</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.backToDir} onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={s.backToDirText}>Ver todos los profesionales</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Siguiente button */}
          {step < 4 && (
            <TouchableOpacity
              style={[s.nextBtn, !canAdvance && s.nextBtnDisabled]}
              onPress={() => canAdvance && advance()}
              activeOpacity={canAdvance ? 0.85 : 1}>
              <Text style={[s.nextBtnText, !canAdvance && s.nextBtnTextDisabled]}>
                {step === 3 ? 'Ver sugerencias' : 'Siguiente'}
              </Text>
              <Feather name="arrow-right" size={16} color={canAdvance ? CR : 'rgba(63,81,47,0.35)'} />
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:{ fontFamily: ViveFonts.medium, fontSize: 13, color: FS },
  stepLabel: { fontFamily: ViveFonts.medium, fontSize: 13, color: FS },

  progressTrack: { height: 3, backgroundColor: 'rgba(63,81,47,0.10)', marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },
  progressFill:  { height: '100%', backgroundColor: F, borderRadius: 2 },

  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  question: { fontFamily: ViveFonts.title, fontSize: 24, color: F, lineHeight: 32, marginBottom: 6 },
  questionHint: { fontFamily: ViveFonts.regular, fontSize: 14, color: FS, lineHeight: 20, marginBottom: 10 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: BG, borderRadius: 18,
    borderWidth: 1.5, borderColor: BD,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionActive: { backgroundColor: F, borderColor: F },
  optionText:   { flex: 1, fontFamily: ViveFonts.medium, fontSize: 14, color: F },
  optionTextActive: { color: CR },
  optionDesc:   { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FS, marginTop: 2 },
  optionDescActive: { color: 'rgba(243,238,223,0.70)' },

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: F, borderRadius: 18,
    paddingVertical: 14, marginTop: 8,
  },
  nextBtnDisabled: { backgroundColor: 'rgba(63,81,47,0.12)' },
  nextBtnText:     { fontFamily: ViveFonts.semibold, fontSize: 15, color: CR },
  nextBtnTextDisabled: { color: 'rgba(63,81,47,0.35)' },

  // Results
  resultsTitle: { fontFamily: ViveFonts.title, fontSize: 28, color: F, marginBottom: 4 },
  resultsSub:   { fontFamily: ViveFonts.regular, fontSize: 14, color: FS, lineHeight: 22, marginBottom: 8 },

  resultCard: {
    backgroundColor: BG, borderRadius: 22,
    borderWidth: 1, borderColor: BD,
    padding: 16, gap: 12,
  },
  resultTop:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatar:     { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { backgroundColor: 'rgba(63,81,47,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: ViveFonts.semibold, fontSize: 16, color: F },
  resultName:  { fontFamily: ViveFonts.semibold, fontSize: 14, color: F },
  resultRole:  { fontFamily: ViveFonts.medium, fontSize: 11.5, color: TC, marginTop: 1 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ratingText:  { fontFamily: ViveFonts.regular, fontSize: 11, color: FS },
  resultPrice: { fontFamily: ViveFonts.semibold, fontSize: 13, color: F },
  reasons:     { gap: 6 },
  reasonRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasonIcon:  { marginTop: 3 },
  reasonText:  { flex: 1, fontFamily: ViveFonts.regular, fontSize: 13, color: F, lineHeight: 19 },
  diffText:    { color: FS },

  resultBtn: {
    backgroundColor: F, borderRadius: 14,
    paddingVertical: 11, alignItems: 'center',
  },
  resultBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: CR },

  exits:         { gap: 10, marginTop: 6 },
  exitPrimary:   { borderRadius: 16, borderWidth: 1.5, borderColor: F, paddingVertical: 13, alignItems: 'center' },
  exitPrimaryText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: F },
  exitSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, minHeight: 44 },
  exitSecondaryText: { fontFamily: ViveFonts.medium, fontSize: 13.5, color: F },
  noMore:        { fontFamily: ViveFonts.regular, fontSize: 13, color: FS, textAlign: 'center', lineHeight: 20 },
  backToDir:     { alignSelf: 'center', marginTop: 2, minHeight: 44, justifyContent: 'center' },
  backToDirText: { fontFamily: ViveFonts.medium, fontSize: 13, color: TC },
});
