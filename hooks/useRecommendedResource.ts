import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Vocabulario de ejes compartido con resource_axes (recursos de coach).
// Es lo que permite puntuar tools de VITA y recursos de coach en el mismo espacio.
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

// El humor de hoy define el EJE objetivo y el tono. La tool primaria preserva
// las elecciones curadas que ya existían; la secundaria es el respaldo si la
// primaria se completó hace poco (anti-repetición).
const MOOD_CFG: Record<number, { primary: string; secondary: string; tone: string }> = {
  1: { primary: 'gratitud',    secondary: 'diario',      tone: 'registrar algo bueno ayuda a salir del bajón' },
  2: { primary: 'escaner',     secondary: 'respiracion', tone: 'reconectar con el cuerpo cuando la energía está baja' },
  3: { primary: 'respiracion', secondary: 'meditacion',  tone: 'centrar la mente y ganar claridad' },
  4: { primary: 'meditacion',  secondary: 'gratitud',    tone: 'buen momento para sostener el hábito' },
  5: { primary: 'meditacion',  secondary: 'gratitud',    tone: 'consolidar el bienestar que ya tenés' },
};

// tool de VITA → ejes. Etiqueta el hueco que hoy no existe en las tools.
const TOOL_AXES: Record<string, Axis[]> = {
  respiracion: ['cuerpo', 'mente'],
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
export function useRecommendedResource(params: {
  userId: string | undefined;
  todayMood: MoodLite | undefined;
  library: CoachResourceLite[];
  recentlyDone: Set<string>;
}): Reco | null {
  const { userId, todayMood, library, recentlyDone } = params;
  const [quizTopic, setQuizTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setQuizTopic(null); return; }
    supabase
      .from('user_quiz_answers')
      .select('topic')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setQuizTopic((data?.topic as string) ?? null));
  }, [userId]);

  return useMemo<Reco | null>(() => {
    // 1. ÁNIMO DE HOY (lidera) — recurso de VITA según el estado.
    if (todayMood) {
      const cfg = MOOD_CFG[todayMood.mood_id];
      if (cfg) {
        const toolId = !recentlyDone.has(cfg.primary) ? cfg.primary : cfg.secondary;
        return {
          kind: 'tool',
          toolId,
          eyebrow: 'SEGÚN CÓMO TE SENTÍS HOY',
          why: `Te sentiste ${todayMood.mood_label.toLowerCase()} — ${cfg.tone}.`,
        };
      }
    }

    // 2. TEMA DE INTERÉS (sin check-in hoy) — quiz declarado o comportamiento.
    const quiz = quizTopic ? QUIZ_AXIS[quizTopic] : null;
    const axis: Axis | null = quiz ? quiz.axis : dominantAxis([...recentlyDone]);
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
          why: `Un recurso de ${coachRes.coachName} para trabajar ${label}.`,
        };
      }
      const toolId = firstToolInAxis(axis, recentlyDone);
      if (toolId) {
        return {
          kind: 'tool',
          toolId,
          eyebrow: `PORQUE TE INTERESA ${label.toUpperCase()}`,
          why: `Para dedicarle un momento a ${label}.`,
        };
      }
    }

    // 3. Sin señal → null (la UI cae al CTA de check-in de ánimo).
    return null;
  }, [todayMood, quizTopic, library, recentlyDone]);
}
