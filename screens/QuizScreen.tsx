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
import { PriceSlider } from '@/components/ui/PriceSlider';
import { ViveFonts } from '@/constants/theme';
import { prefetchCoaches, getCoachesCache, CachedCoach } from '@/lib/coachesCache';
import { QUIZ_AREAS as Q1_OPTIONS } from '@/constants/searchData';
import {
  recomendarDesdeQuiz,
  TIPO_OPCIONES as Q2_OPTIONS,
  PRESUPUESTO_MIN,
  PRESUPUESTO_TOPE,
  PRESUPUESTO_PASO,
  topeDeRango,
  ESTILO_OPCIONES as Q4_OPTIONS,
  TAMANO_TANDA,
  type ResultadoQuiz,
} from '@/lib/quizMatch';
import {
  GUIA_OPCIONES_PERSONA as Q5_OPTIONS,
  FOCO_OPCIONES_PERSONA as Q6_OPTIONS,
  GENERO_OPCIONES_PERSONA as Q7_OPTIONS,
  type EstiloPedido,
  type GuiaPedida,
  type FocoPedido,
  type GeneroPedido,
} from '@/lib/enfoque';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';
import { supabase } from '@/lib/supabase';
import { guardarPendiente, volcarPendiente, leerRespuestasGuardadas } from '@/lib/quizPendiente';

const F  = '#3A4F2A';
const FS = '#566245';
const CR = '#F3EEDF';
const TC = '#C1694F';
const BG = 'rgba(255,248,240,0.65)';
const BD = 'rgba(255,255,255,0.65)';
const SG = '#C99A3F';

// Opciones, criterio de coincidencia y razones: `lib/quizMatch.ts`.

// Los pasos dependen de lo que se va contestando (21/09/2026, tomado de Selia):
// con nutricionista no se pregunta cómo trabaja, porque "entender lo que viví"
// no le dice nada a alguien que busca un plan de alimentación. Después de las
// preguntas va el resumen editable (también de Selia: ver todo junto y cambiar
// una sola sin rehacer el resto) y después los resultados.
type Pregunta = 'areas' | 'subtemas' | 'tipo' | 'presupuesto' | 'estilo' | 'guia' | 'foco' | 'genero';
type Paso = Pregunta | 'resumen' | 'resultados';

const MAX_AREAS = 2;
const MAX_SUBTEMAS = 3;

function preguntasPara(tipo: string | null): Pregunta[] {
  const ejes: Pregunta[] = tipo === 'nutricionista' ? [] : ['estilo', 'guia', 'foco'];
  return ['areas', 'subtemas', 'tipo', 'presupuesto', ...ejes, 'genero'];
}

function etiquetaPresupuesto(v: number): string {
  return v >= PRESUPUESTO_TOPE ? 'Sin límite' : `Hasta $${v.toLocaleString('es-AR')}`;
}

/** "a, b y c" */
function listarY(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/** Solo acepta un valor guardado si sigue siendo una opción de la pregunta:
 *  una respuesta vieja con un id que ya no existe dejaría el quiz trabado. */
function valida<T extends string>(v: unknown, opciones: { id: T }[]): T | null {
  return opciones.some(o => o.id === v) ? (v as T) : null;
}

function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function QuizScreen() {
  const router = useRouter();
  const [step, setStep]   = useState<Paso>('areas');
  // Hasta 2 áreas y, adentro, hasta 3 temas concretos. Los temas son los mismos
  // nombres que marca el profesional (`coach_topics`), así que el match es
  // directo. Sin temas marcados = "cualquiera de estos".
  const [areas, setAreas] = useState<string[]>([]);
  const [subtemas, setSubtemas] = useState<string[]>([]);
  const [q2, setQ2] = useState<string | null>(null);
  // Barra deslizable (21/09/2026). Arranca en el extremo, "sin límite": que la
  // persona baje el tope si le importa, no que tenga que subirlo para ver a todos.
  // El extremo se guarda como el número del tope, no como null, porque la cola
  // descarta los null y dejaría vivo un tope viejo.
  const [presupuesto, setPresupuesto] = useState<number>(PRESUPUESTO_TOPE);
  // M14: cómo quiere que la acompañen. La última porque es la única opcional:
  // quien no sabe qué contestar ya respondió lo que importa.
  const [q4, setQ4] = useState<EstiloPedido | null>(null);
  // M14 ampliado (21/09/2026). Las cuatro últimas tienen "no sé / me da igual".
  const [q5, setQ5] = useState<GuiaPedida | null>(null);
  const [q6, setQ6] = useState<FocoPedido | null>(null);
  const [q7, setQ7] = useState<GeneroPedido | null>(null);
  // Se entró a una pregunta desde el resumen: al contestarla se vuelve ahí.
  const [editando, setEditando] = useState(false);
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

  // Si ya hizo el quiz, vuelve con sus respuestas marcadas
  // (`leerRespuestasGuardadas`: primero lo local, después la base).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = (await leerRespuestasGuardadas()) as Record<string, unknown> | null;
      if (cancelado || !r) return;
      // Antes del 21/09 se guardaba una sola área (`topic`): sirve igual.
      const areasGuardadas = (Array.isArray(r.areas) ? r.areas : r.topic ? [r.topic] : [])
        .filter((a): a is string => typeof a === 'string' && Q1_OPTIONS.some(o => o.id === a))
        .slice(0, MAX_AREAS);
      const posibles = Q1_OPTIONS.filter(o => areasGuardadas.includes(o.id)).flatMap(o => o.subtemas);
      const subtemasGuardados = Array.isArray(r.subtemas)
        ? (r.subtemas as unknown[]).filter((t): t is string => typeof t === 'string' && posibles.includes(t)).slice(0, MAX_SUBTEMAS)
        : null;
      const tipo = valida(r.professionalType, Q2_OPTIONS);
      setAreas(areasGuardadas);
      setSubtemas(subtemasGuardados ?? []);
      setQ2(tipo);
      // Respuestas de antes de la barra: el rango se traduce a su tope.
      const topeGuardado = typeof r.budgetMax === 'number'
        ? r.budgetMax
        : r.budget ? topeDeRango(r.budget as string) ?? PRESUPUESTO_TOPE : null;
      if (topeGuardado != null) {
        setPresupuesto(Math.max(PRESUPUESTO_MIN, Math.min(PRESUPUESTO_TOPE, topeGuardado)));
      }
      setQ4(valida(r.estilo, Q4_OPTIONS));
      setQ5(valida(r.guia, Q5_OPTIONS));
      setQ6(valida(r.foco, Q6_OPTIONS));
      setQ7(valida(r.generoPref, Q7_OPTIONS));
      // Con todo contestado, directo al resumen: que vuelva a pasar por todas
      // para cambiar una es lo que el resumen viene a evitar. Solo si todavía
      // está en la primera pregunta, por si ya empezó a tocar.
      const contestada: Record<Pregunta, boolean> = {
        areas: areasGuardadas.length > 0,
        subtemas: subtemasGuardados !== null,
        tipo: !!tipo,
        presupuesto: topeGuardado != null,
        estilo: !!valida(r.estilo, Q4_OPTIONS),
        guia: !!valida(r.guia, Q5_OPTIONS),
        foco: !!valida(r.foco, Q6_OPTIONS),
        genero: !!valida(r.generoPref, Q7_OPTIONS),
      };
      if (preguntasPara(tipo).every(p => contestada[p])) {
        setStep(p => (p === 'areas' ? 'resumen' : p));
      }
    })().catch(e => console.warn('[quiz] no se pudieron leer respuestas previas:', e?.message ?? e));
    return () => { cancelado = true; };
  }, []);

  const preguntas = preguntasPara(q2);
  const indicePregunta = preguntas.indexOf(step as Pregunta);

  function advance() {
    // Cambiar las áreas desde el resumen deja temas elegidos de otra área:
    // se pasa por los temas antes de volver, para que no queden viejos.
    if (editando && step === 'areas') {
      setStep('subtemas');
    } else if (editando) {
      setEditando(false);
      setStep('resumen');
    } else if (indicePregunta >= 0) {
      setStep(preguntas[indicePregunta + 1] ?? 'resumen');
    } else if (step === 'resumen') {
      setResultado(recomendarDesdeQuiz(coaches, {
        tema: areas[0] ?? null, areas, subtemas,
        tipo: q2, presupuesto: null, presupuestoMax: presupuesto, estilo: q4, guia: q5, foco: q6, genero: q7,
      }));
      setTandas(1);
      // 🔴 Antes esto era `if (!uid) return;`: quien hacía el quiz SIN cuenta
      // perdía las respuestas en silencio. Ahora hay un solo camino: se encolan
      // siempre, y si YA hay sesión se vuelcan en el acto. Si no, las vuelca
      // `AuthContext` al registrarse.
      guardarPendiente({
        topic: areas[0] ?? null, areas, subtemas,
        professionalType: q2, budgetMax: presupuesto,
        estilo: q4, guia: q5, foco: q6, generoPref: q7,
      })
        .then(() => supabase.auth.getSession())
        .then(({ data }) => {
          const uid = data.session?.user?.id;
          if (uid) return volcarPendiente(uid);
        })
        .catch(e => console.warn('[quiz] no se pudo guardar:', e?.message ?? e));
      setStep('resultados');
    }
  }

  // M2: volver a las respuestas para cambiar una sola. Desde el 21/09 va al
  // resumen y no a la primera pregunta.
  function volverAResponder() {
    setStep('resumen');
  }

  function editar(paso: Pregunta) {
    setEditando(true);
    setStep(paso);
  }

  function toggleArea(id: string) {
    const next = areas.includes(id)
      ? areas.filter(x => x !== id)
      : areas.length >= MAX_AREAS ? areas : [...areas, id];
    setAreas(next);
    // Los temas de un área que se sacó ya no corresponden.
    const posibles = Q1_OPTIONS.filter(o => next.includes(o.id)).flatMap(o => o.subtemas);
    setSubtemas(st => st.filter(t => posibles.includes(t)));
  }

  function toggleSubtema(t: string) {
    setSubtemas(prev => prev.includes(t)
      ? prev.filter(x => x !== t)
      : prev.length >= MAX_SUBTEMAS ? prev : [...prev, t]);
  }

  const deLoQueElegiste = coaches.filter(c => {
    const temas = Q1_OPTIONS.filter(o => areas.includes(o.id)).flatMap(o => o.subtemas);
    return temas.length === 0 || temas.some(t => c.topics.includes(t));
  });
  const entran = presupuesto >= PRESUPUESTO_TOPE
    ? deLoQueElegiste.length
    : deLoQueElegiste.filter(c => (c.priceFrom ?? 0) <= presupuesto).length;
  const total = deLoQueElegiste.length;
  const textoCuantosEntran =
    total === 0 ? ''
    : total === 1 ? (entran === 1
        ? 'Entra el único profesional que trabaja lo que elegiste.'
        : 'El único profesional que trabaja lo que elegiste cobra más. Igual te lo mostramos.')
    : entran === total ? `Entran los ${total} profesionales que trabajan lo que elegiste.`
    : entran === 0 ? `Ninguno de los ${total} que trabajan lo que elegiste entra en ese precio. Igual te los mostramos.`
    : `Entran ${entran} de los ${total} profesionales que trabajan lo que elegiste.`;

  // Los temas del segundo nivel: los de las áreas elegidas, sin repetir
  // (Vínculos laborales y Orientación vocacional están en dos).
  const subtemasPosibles = [...new Set(Q1_OPTIONS.filter(o => areas.includes(o.id)).flatMap(o => o.subtemas))];

  // Lo que se ve en el resumen. `label` de la opción elegida, o null.
  const labelDe = <T extends string>(v: T | null, ops: { id: T; label: string }[]) =>
    ops.find(o => o.id === v)?.label ?? null;
  const RESUMEN: Record<Pregunta, { pregunta: string; respuesta: string | null }> = {
    areas:       { pregunta: 'Qué querés trabajar',    respuesta: areas.length ? listarY(Q1_OPTIONS.filter(o => areas.includes(o.id)).map(o => o.label)) : null },
    subtemas:    { pregunta: 'Más en concreto',        respuesta: subtemas.length ? listarY(subtemas) : 'Cualquiera de estos' },
    tipo:        { pregunta: 'Con quién',              respuesta: labelDe(q2 as any, Q2_OPTIONS) },
    presupuesto: { pregunta: 'Presupuesto por sesión', respuesta: etiquetaPresupuesto(presupuesto) },
    estilo:      { pregunta: 'Cómo te acompañen',      respuesta: labelDe(q4, Q4_OPTIONS) },
    guia:        { pregunta: 'Cuánto te guíen',        respuesta: labelDe(q5, Q5_OPTIONS) },
    foco:        { pregunta: 'Hacia dónde mirar',      respuesta: labelDe(q6, Q6_OPTIONS) },
    genero:      { pregunta: 'Género del profesional', respuesta: labelDe(q7, Q7_OPTIONS) },
  };
  const resumen = preguntas.map(p => ({ paso: p, ...RESUMEN[p] }));

  const visibles = resultado.recomendaciones.slice(0, tandas * TAMANO_TANDA);
  const hayMas = resultado.recomendaciones.length > visibles.length;

  const contestada: Record<Pregunta, boolean> = {
    areas: areas.length > 0,
    subtemas: true, // "cualquiera de estos" también es una respuesta
    tipo: !!q2, presupuesto: true, estilo: !!q4, guia: !!q5, foco: !!q6, genero: !!q7,
  };
  const canAdvance = step === 'resumen' || (indicePregunta >= 0 && contestada[step as Pregunta]);

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
          {indicePregunta >= 0 && (
            <Text style={s.stepLabel}>{indicePregunta + 1} / {preguntas.length}</Text>
          )}
          <View style={{ width: 60 }} />
        </View>

        {/* Progress bar */}
        {indicePregunta >= 0 && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${((indicePregunta + 1) / preguntas.length) * 100}%` as any }]} />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}>

          {/* ── Áreas (hasta 2) ── */}
          {step === 'areas' && (
            <>
              <Text style={s.question}>¿Qué querés trabajar principalmente?</Text>
              <Text style={s.questionHint}>Podés elegir hasta {MAX_AREAS}.</Text>
              {Q1_OPTIONS.map(opt => {
                const activo = areas.includes(opt.id);
                const bloqueado = !activo && areas.length >= MAX_AREAS;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.option, activo && s.optionActive, bloqueado && s.optionBlocked]}
                    onPress={() => toggleArea(opt.id)}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: activo, disabled: bloqueado }}>
                    <Feather name={opt.icon as any} size={18} color={activo ? CR : FS} />
                    <Text style={[s.optionText, activo && s.optionTextActive]}>{opt.label}</Text>
                    {activo && <Feather name="check" size={16} color={CR} />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* ── Temas concretos (hasta 3, o ninguno) ── */}
          {step === 'subtemas' && (
            <>
              <Text style={s.question}>¿Algo más en concreto?</Text>
              <Text style={s.questionHint}>
                Hasta {MAX_SUBTEMAS}. Si no lo tenés claro, seguí sin marcar nada.
              </Text>
              <View style={s.chipsRow}>
                {subtemasPosibles.map(t => {
                  const activo = subtemas.includes(t);
                  const bloqueado = !activo && subtemas.length >= MAX_SUBTEMAS;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.chip, activo && s.optionActive, bloqueado && s.optionBlocked]}
                      onPress={() => toggleSubtema(t)}
                      activeOpacity={0.8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: activo, disabled: bloqueado }}>
                      <Text style={[s.chipText, activo && s.optionTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Q2 ── */}
          {step === 'tipo' && (
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

          {/* ── Presupuesto: barra deslizable (21/09/2026) ── */}
          {step === 'presupuesto' && (
            <>
              <Text style={s.question}>¿Cuánto querés gastar por sesión?</Text>
              <Text style={s.questionHint}>Mové la barra hasta tu tope. Al final no hay límite.</Text>
              <PriceSlider
                value={presupuesto}
                onValueChange={setPresupuesto}
                min={PRESUPUESTO_MIN}
                max={PRESUPUESTO_TOPE}
                step={PRESUPUESTO_PASO}
                formatLabel={etiquetaPresupuesto}
              />
              {/* Cuántos de los que trabajan lo que eligió entran en ese precio:
                  que vea en el momento qué deja afuera, en vez de enterarse en
                  los resultados. No filtra: los que no entran siguen, marcados. */}
              <Text style={s.sliderCount}>{textoCuantosEntran}</Text>
            </>
          )}

          {/* ── Q4 (M14) ── */}
          {step === 'estilo' && (
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

          {/* ── Q5-Q7 (M14 ampliado, 21/09/2026) ── */}
          {step === 'guia' && (
            <Opciones
              pregunta="¿Cuánto te gustaría que te guíen?"
              opciones={Q5_OPTIONS}
              valor={q5}
              onElegir={setQ5}
            />
          )}
          {step === 'foco' && (
            <Opciones
              pregunta="¿Qué te gustaría trabajar sobre todo?"
              hint="Pensalo como hacia dónde querés mirar."
              opciones={Q6_OPTIONS}
              valor={q6}
              onElegir={setQ6}
            />
          )}
          {step === 'genero' && (
            <Opciones
              pregunta="¿Preferís que sea mujer o varón?"
              hint="Hay cosas que se hablan más fácil con alguien en particular. Si te da igual, también está bien."
              opciones={Q7_OPTIONS}
              valor={q7}
              onElegir={setQ7}
            />
          )}

          {/* ── Resumen ── */}
          {step === 'resumen' && (
            <>
              <Text style={s.question}>Revisá tus respuestas</Text>
              <Text style={s.questionHint}>Tocá una para cambiarla. Con esto te sugerimos profesionales.</Text>
              {resumen.map(r => (
                <TouchableOpacity
                  key={r.paso}
                  style={s.summaryRow}
                  onPress={() => editar(r.paso)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.pregunta}: ${r.respuesta ?? 'sin contestar'}. Tocá para cambiar`}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.summaryQ}>{r.pregunta}</Text>
                    <Text style={s.summaryA}>{r.respuesta ?? 'Sin contestar'}</Text>
                  </View>
                  <Feather name="edit-2" size={15} color={FS} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Results ── */}
          {step === 'resultados' && (
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
          {step !== 'resultados' && (
            <TouchableOpacity
              style={[s.nextBtn, !canAdvance && s.nextBtnDisabled]}
              onPress={() => canAdvance && advance()}
              activeOpacity={canAdvance ? 0.85 : 1}>
              <Text style={[s.nextBtnText, !canAdvance && s.nextBtnTextDisabled]}>
                {editando && step !== 'areas' ? 'Listo' : step === 'resumen' ? 'Ver sugerencias' : 'Siguiente'}
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

/** Una pregunta de opción única, con descripción opcional por opción. */
function Opciones<T extends string>({ pregunta, hint, opciones, valor, onElegir }: {
  pregunta: string;
  hint?: string;
  opciones: { id: T; label: string; desc?: string }[];
  valor: T | null;
  onElegir: (v: T) => void;
}) {
  return (
    <>
      <Text style={s.question}>{pregunta}</Text>
      {!!hint && <Text style={s.questionHint}>{hint}</Text>}
      {opciones.map(opt => {
        const activo = valor === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[s.option, activo && s.optionActive]}
            onPress={() => onElegir(opt.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.optionText, activo && s.optionTextActive]}>{opt.label}</Text>
              {!!opt.desc && <Text style={[s.optionDesc, activo && s.optionDescActive]}>{opt.desc}</Text>}
            </View>
            {activo && <Feather name="check" size={16} color={CR} />}
          </TouchableOpacity>
        );
      })}
    </>
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

  optionBlocked: { opacity: 0.45 },
  sliderCount: { fontFamily: ViveFonts.regular, fontSize: 13, color: FS, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: BG, borderRadius: 20,
    borderWidth: 1.5, borderColor: BD,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 13.5, color: F },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: BG, borderRadius: 18,
    borderWidth: 1.5, borderColor: BD,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryQ: { fontFamily: ViveFonts.regular, fontSize: 12, color: FS },
  summaryA: { fontFamily: ViveFonts.semibold, fontSize: 14, color: F, marginTop: 2 },

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
