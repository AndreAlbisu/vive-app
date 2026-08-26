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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';
import { QUIZ_AREAS as Q1_OPTIONS } from '@/constants/searchData';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';
import { supabase } from '@/lib/supabase';

const F  = '#3A4F2A';
const FS = '#6B7A56';
const CR = '#F3EEDF';
const TC = '#C1694F';
const BG = 'rgba(255,248,240,0.65)';
const BD = 'rgba(255,255,255,0.65)';
const SG = '#C99A3F';

// ─── Quiz data ───────────────────────────────────────────────────────────────
type Q2Opt = { id: string; label: string; desc: string; kw: string | null };
const Q2_OPTIONS: Q2Opt[] = [
  { id: 'coach',         label: 'Coach de vida',   desc: 'Metas, hábitos y propósito',     kw: 'coach' },
  { id: 'psicologo',     label: 'Psicólogo/a',     desc: 'Salud mental y terapia',          kw: 'psic' },
  { id: 'nutricionista', label: 'Nutricionista',   desc: 'Alimentación y hábitos físicos',  kw: 'nutri' },
  { id: 'any',           label: 'Sin preferencia', desc: 'Quiero ver todas las opciones',   kw: null },
];

type Q3Opt = { id: string; label: string; max: number | null };
const Q3_OPTIONS: Q3Opt[] = [
  { id: 'low',  label: 'Hasta $5.000',    max: 5000 },
  { id: 'mid',  label: '$5.000–$10.000',  max: 10000 },
  { id: 'high', label: 'Más de $10.000',  max: null },
  { id: 'flex', label: 'Es flexible',     max: null },
];

// ─── Matching logic ──────────────────────────────────────────────────────────
function computeMatches(
  coaches: CachedCoach[],
  q1Id: string,
  q2Id: string,
  q3Id: string,
): CachedCoach[] {
  const q1 = Q1_OPTIONS.find(o => o.id === q1Id);
  const q2 = Q2_OPTIONS.find(o => o.id === q2Id);
  const q3 = Q3_OPTIONS.find(o => o.id === q3Id);

  const subtemas = q1?.subtemas ?? [];
  const kw = q2?.kw ?? null;
  const maxPrice = q3?.max ?? null;

  const byTopic = (c: CachedCoach) => subtemas.length === 0 || subtemas.some(s => c.topics.includes(s));
  const byType  = (c: CachedCoach) => !kw || c.specialty.toLowerCase().includes(kw);
  const byPrice = (c: CachedCoach) => !maxPrice || c.priceFrom <= maxPrice;
  const sortRating = (a: CachedCoach, b: CachedCoach) => ((b.avgRating ?? 0) - (a.avgRating ?? 0));

  let res = coaches.filter(c => byTopic(c) && byType(c) && byPrice(c));
  if (res.length === 0) res = coaches.filter(c => byTopic(c) && byType(c)); // relax budget
  if (res.length === 0) res = coaches.filter(c => byTopic(c));              // relax type
  if (res.length === 0) res = [...coaches];                                  // fallback: all

  return res.sort(sortRating).slice(0, 2);
}

function buildReason(coach: CachedCoach, q1Id: string): string {
  const q1 = Q1_OPTIONS.find(o => o.id === q1Id);
  const hit = q1?.subtemas.find(s => coach.topics.includes(s));
  if (hit) return `Trabaja ${hit.toLowerCase()} — alineado con lo que estás buscando`;
  return 'Su perfil encaja con tus respuestas';
}

function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function QuizScreen() {
  const router = useRouter();
  const [step, setStep]   = useState(0);   // 0–2 = questions, 3 = results
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string | null>(null);
  const [rawCoaches, setCoaches] = useState<CachedCoach[]>([]);
  const coaches = useBlockedFilter(rawCoaches);
  const [matches, setMatches] = useState<CachedCoach[]>([]);

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
    if (step < 2) {
      setStep(s => s + 1);
    } else {
      const ms = computeMatches(coaches, q1 ?? '', q2 ?? '', q3 ?? '');
      setMatches(ms);
      if (q1) AsyncStorage.setItem('vive_quiz_topic', q1).catch(() => {});
      // Persistir en Supabase para personalización futura
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user?.id;
        if (!uid) return;
        supabase.from('user_quiz_answers').upsert(
          { user_id: uid, topic: q1, professional_type: q2, budget: q3, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ).then(({ error }) => { if (error) console.warn('[quiz] upsert:', error.message); });
      });
      setStep(3);
    }
  }

  const canAdvance = (step === 0 && q1) || (step === 1 && q2) || (step === 2 && q3);

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
          {step < 3 && (
            <Text style={s.stepLabel}>{step + 1} / 3</Text>
          )}
          <View style={{ width: 60 }} />
        </View>

        {/* Progress bar */}
        {step < 3 && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${((step + 1) / 3) * 100}%` as any }]} />
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
              <Text style={s.question}>¿Cómo preferís el acompañamiento?</Text>
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

          {/* ── Results ── */}
          {step === 3 && (
            <>
              <Text style={s.resultsTitle}>Para vos</Text>
              <Text style={s.resultsSub}>
                Basándonos en tus respuestas, estos perfiles se adaptan a lo que buscás.
              </Text>

              {matches.length === 0 ? (
                <Text style={s.noMatches}>
                  Todavía no hay profesionales cargados que coincidan exactamente. Explorá el directorio completo.
                </Text>
              ) : matches.map(coach => (
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
                  <Text style={s.resultReason}>{buildReason(coach, q1 ?? '')}</Text>
                  <TouchableOpacity style={s.resultBtn} onPress={() => goToPerfil(coach)} activeOpacity={0.85}>
                    <Text style={s.resultBtnText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={s.backToDir}
                onPress={() => router.back()}
                activeOpacity={0.8}>
                <Text style={s.backToDirText}>Volver a Conexiones</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Siguiente button */}
          {step < 3 && (
            <TouchableOpacity
              style={[s.nextBtn, !canAdvance && s.nextBtnDisabled]}
              onPress={() => canAdvance && advance()}
              activeOpacity={canAdvance ? 0.85 : 1}>
              <Text style={[s.nextBtnText, !canAdvance && s.nextBtnTextDisabled]}>
                {step === 2 ? 'Ver sugerencias' : 'Siguiente'}
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
  noMatches:    { fontFamily: ViveFonts.regular, fontSize: 14, color: FS, lineHeight: 22, textAlign: 'center', marginTop: 20 },

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
  resultReason:{ fontFamily: ViveFonts.regular, fontSize: 13, color: FS, lineHeight: 20, fontStyle: 'italic' },

  resultBtn: {
    backgroundColor: F, borderRadius: 14,
    paddingVertical: 11, alignItems: 'center',
  },
  resultBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: CR },

  backToDir:     { alignSelf: 'center', marginTop: 8 },
  backToDirText: { fontFamily: ViveFonts.medium, fontSize: 13, color: TC },
});
