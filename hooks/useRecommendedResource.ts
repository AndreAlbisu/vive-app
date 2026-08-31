import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOOD_RESOURCES } from '@/constants/moodResources';

// Vocabulario de ejes compartido con resource_axes (recursos de coach).
// Es lo que permite puntuar tools de Vita y recursos de coach en el mismo espacio.
export type Axis = 'cuerpo' | 'mente' | 'alma';

// Recurso de coach ya cargado en la pantalla, con sus ejes (resource_axes).
export type CoachResourceLite = {
  id: string;
  type: string;
  title: string;
  coachName: string;
  axes: string[];
};

export type MoodLite = { mood_id: number; mood_label: string };

// tool de Vita → ejes. Etiqueta el hueco que hoy no existe en las tools.
const TOOL_AXES: Record<string, Axis[]> = {
  respiracion: ['cuerpo', 'mente'],
  anclaje:     ['cuerpo', 'mente'],
  escaner:     ['cuerpo'],
  ruido:       ['cuerpo'],
  sueno:       ['cuerpo'],
  relajacion:  ['cuerpo', 'mente'],
  meditacion:  ['mente', 'alma'],
  lecturas:    ['mente', 'alma'],
  diario:      ['alma', 'mente'],
  gratitud:    ['alma'],
};

// Tema declarado en el quiz (user_quiz_answers.topic) → eje + etiqueta legible.
const QUIZ_AXIS: Record<string, { axis: Axis; label: string }> = {
  emocion:    { axis: 'mente',  label: 'tus emociones' },
  relaciones: { axis: 'alma',   label: 'tus relaciones' },
  trabajo:    { axis: 'mente',  label: 'el trabajo' },
  salud:      { axis: 'cuerpo', label: 'tu salud' },
  proposito:  { axis: 'alma',   label: 'tu propósito' },
};

const AXIS_LABEL: Record<Axis, string> = {
  cuerpo: 'el cuerpo',
  mente:  'la mente',
  alma:   'lo interior',
};

export type Reco =
  | { kind: 'tool';  eyebrow: string; toolId: string;               why: string }
  | { kind: 'coach'; eyebrow: string; resource: CoachResourceLite;  why: string };

function dominantAxis(toolIds: string[]): Axis | null {
  const count: Partial<Record<Axis, number>> = {};
  for (const id of toolIds) {
    for (const ax of TOOL_AXES[id] ?? []) count[ax] = (count[ax] ?? 0) + 1;
  }
  const entries = Object.entries(count) as [Axis, number][];
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function firstToolInAxis(axis: Axis, exclude: Set<string>): string | null {
  const inAxis = Object.keys(TOOL_AXES).filter(id => TOOL_AXES[id].includes(axis));
  return inAxis.find(id => !exclude.has(id)) ?? inAxis[0] ?? null;
}

/**
 * Recomendación única para la pantalla de Recursos.
 * Cascada explicable: el ánimo de hoy manda (inmediatez) y define el eje;
 * sin check-in de hoy, manda el interés temático (quiz + comportamiento),
 * prefiriendo un recurso de coach real cuando existe para ese eje.
 * Devuelve null cuando no hay ninguna señal → la UI muestra el CTA de check-in.
 */
export type RecommendationResult = {
  reco: Reco | null;
  interestAxes: Set<Axis>;   // ejes que le interesan al usuario (para rankear la biblioteca)
  excludeId: string | null;  // id del recurso ya mostrado en la card (no repetir en el carrusel)
};

export function useRecommendedResource(params: {
  userId: string | undefined;
  todayMood: MoodLite | undefined;
  library: CoachResourceLite[];
  recentlyDone: Set<string>;
}): RecommendationResult {
  const { userId, todayMood, library, recentlyDone } = params;
  const [quizTopic, setQuizTopic] = useState<string | null>(null);
  const [quizAxis, setQuizAxis] = useState<Axis | null>(null);

  useEffect(() => {
    if (!userId) { setQuizTopic(null); setQuizAxis(null); return; }
    supabase
      .from('user_quiz_answers')
      // ⚠️ `*` y no `'topic, axis'` a propósito: `axis` la agrega
      // `scripts/add-quiz-declared-axis.sql`, y pedir por nombre una columna que
      // todavía no existe devuelve error y `data` en null — o sea que un OTA que
      // llegue antes de correr el script dejaría de leer el topic también, y la
      // recomendación se apagaría entera. Con `*` la app anda igual antes y
      // después de la migración.
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setQuizTopic((data?.topic as string) ?? null);
        const a = data?.axis as Axis | undefined;
        setQuizAxis(a === 'cuerpo' || a === 'mente' || a === 'alma' ? a : null);
      });
  }, [userId]);

  const reco = useMemo<Reco | null>(() => {
    // 1. ÁNIMO DE HOY (lidera) — recurso de Vita según el estado.
    if (todayMood) {
      const cfg = MOOD_RESOURCES[todayMood.mood_id];
      if (cfg) {
        const toolId = !recentlyDone.has(cfg.primary) ? cfg.primary : cfg.secondary;
        return {
          kind: 'tool',
          toolId,
          eyebrow: 'SEGÚN CÓMO TE SENTÍS HOY',
          why: `Te sentiste ${todayMood.mood_label.toLowerCase()} — ${cfg.tone}`,
        };
      }
    }

    // 2. TEMA DE INTERÉS (sin check-in hoy) — quiz declarado o comportamiento.
    //
    // 🔴 El eje DECLARADO gana sobre el que se deduce del topic, y ahí está el
    // punto: son dos agrupamientos distintos de los mismos temas y en tres
    // categorías se contradicen (sexualidad, vínculos, trabajo). El eje decide
    // QUÉ recomendarle —es lo que la persona eligió con su nombre— y el topic
    // decide CÓMO nombrárselo, que es la palabra que describe bien el tema.
    // Antes había que sacrificar uno de los dos.
    //
    // 📝 `quizAxis` es null para quien hizo el quiz de la app, que no pregunta
    // universo: ahí sigue mandando el topic, igual que antes.
    const quiz = quizTopic ? QUIZ_AXIS[quizTopic] : null;
    const axis: Axis | null = quizAxis ?? (quiz ? quiz.axis : dominantAxis([...recentlyDone]));
    if (axis) {
      const label = quiz ? quiz.label : AXIS_LABEL[axis];
      // Preferimos contenido de coach real para este eje (reemplaza la vieja
      // tarjeta falsa "De tu coach" con algo verdadero cuando existe).
      const coachRes = library.find(r => r.axes.includes(axis));
      if (coachRes) {
        return {
          kind: 'coach',
          resource: coachRes,
          eyebrow: `PORQUE TE INTERESA ${label.toUpperCase()}`,
          why: `Un recurso de ${coachRes.coachName} para trabajar ${label}`,
        };
      }
      const toolId = firstToolInAxis(axis, recentlyDone);
      if (toolId) {
        return {
          kind: 'tool',
          toolId,
          eyebrow: `PORQUE TE INTERESA ${label.toUpperCase()}`,
          why: `Para dedicarle un momento a ${label}`,
        };
      }
    }

    // 3. Sin señal → null (la UI cae al CTA de check-in de ánimo).
    return null;
  }, [todayMood, quizTopic, quizAxis, library, recentlyDone]);

  // Ejes de interés del usuario (quiz + comportamiento). Se exponen para rankear
  // la biblioteca de coaches por tema (no solo por recencia).
  const interestAxes = useMemo<Set<Axis>>(() => {
    const s = new Set<Axis>();
    const quiz = quizTopic ? QUIZ_AXIS[quizTopic] : null;
    // Los dos: acá no hay que elegir uno, es el conjunto de lo que le interesa.
    if (quizAxis) s.add(quizAxis);
    if (quiz) s.add(quiz.axis);
    const dom = dominantAxis([...recentlyDone]);
    if (dom) s.add(dom);
    return s;
  }, [quizTopic, quizAxis, recentlyDone]);

  return {
    reco,
    interestAxes,
    // el recurso de coach que ya muestra la card no se repite en el carrusel
    excludeId: reco?.kind === 'coach' ? reco.resource.id : null,
  };
}
