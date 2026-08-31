// Lo que la persona contesta en el onboarding "guiado" (pantallas 3, 4 y 5).
//
// 🔴 POR QUÉ EXISTE: hasta ahora se tiraba todo. `OnboardingScreen5` terminaba
// con `router.replace('/register')` y descartaba `universo`, `categoria` y los
// temas elegidos. Tres pantallas de preguntas que no dejaban nada, justo en la
// rama para la que existe el producto ("no sé por dónde empezar").
//
// ⚠️ Va a AsyncStorage y no directo a la base porque **en ese momento no hay
// cuenta**: `user_quiz_answers.user_id` es FK a `profiles`. Se guarda local y se
// vuelca cuando aparece la sesión (`AuthContext`). Si la persona abandona el
// registro y vuelve mañana, lo que contestó sigue ahí.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type RespuestasOnboarding = {
  universo: string;
  categoria: string;
  temas: string[];
  /** Ya se escribió en la base. Ver `volcarRespuestas`. */
  volcado?: boolean;
};

const KEY = 'vita_onboarding_respuestas';

/**
 * Categoría del onboarding → `user_quiz_answers.topic`.
 *
 * 🔴 Son DOS TAXONOMÍAS DISTINTAS de lo mismo y no encajan del todo. El
 * onboarding agrupa por universo (cuerpo / mente / alma); el quiz de la app usa
 * cinco `topic` que `hooks/useRecommendedResource.ts` vuelve a mapear a un eje.
 * En tres casos los dos agrupamientos se contradicen:
 *
 *   · `sexualidad` el onboarding la pone en CUERPO; `relaciones` cae en alma.
 *   · `vinculos`   el onboarding la pone en MENTE;  `relaciones` cae en alma.
 *   · `trabajo`    el onboarding la pone en ALMA;   `trabajo` cae en mente.
 *
 * Acá se mapea **por significado**, que es lo que hace que la etiqueta de la
 * recomendación ("tus relaciones", "el trabajo") diga algo cierto. La
 * consecuencia es que en esos tres el eje del recurso sugerido no va a ser el
 * universo que la persona eligió.
 *
 * ⚠️ Eso NO se arregla retocando este mapa: es que las dos taxonomías tienen
 * que reconciliarse, o `user_quiz_answers` necesita una columna para el universo
 * declarado. Decisión de producto, anotada y no tomada acá.
 */
export const CATEGORIA_A_TOPIC: Record<string, string> = {
  energia:      'salud',
  alimentacion: 'salud',
  sexualidad:   'relaciones',
  sentirme:     'emocion',
  entender:     'emocion',
  vinculos:     'relaciones',
  rumbo:        'proposito',
  crecer:       'proposito',
  trabajo:      'trabajo',
};

export function topicDeCategoria(categoria: string): string | null {
  return CATEGORIA_A_TOPIC[categoria] ?? null;
}

export async function guardarRespuestas(r: RespuestasOnboarding): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(r));
}

export async function leerRespuestas(): Promise<RespuestasOnboarding | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RespuestasOnboarding;
  } catch {
    // Storage corrupto no puede romper el arranque de la app.
    return null;
  }
}

/**
 * Vuelca a `user_quiz_answers` lo que se había guardado sin cuenta.
 *
 * 🔴 UNA SOLA VEZ, y el flag es lo que lo garantiza. Sin eso, cada login
 * volvería a escribir la respuesta del onboarding y **pisaría el quiz que la
 * persona hizo después adentro de la app** — que es más nuevo y más deliberado.
 *
 * 📝 Solo viaja `topic`: `universo` y los `temas` no tienen columna donde ir y
 * se quedan guardados local. No es que se descarten — es que todavía no hay
 * dónde ponerlos, y esa es la misma decisión de producto de arriba.
 */
export async function volcarRespuestas(userId: string): Promise<void> {
  const r = await leerRespuestas();
  if (!r || r.volcado) return;

  const topic = topicDeCategoria(r.categoria);
  if (!topic) return;

  const { error } = await supabase
    .from('user_quiz_answers')
    .upsert(
      { user_id: userId, topic, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    // Sin marcar: se reintenta en el próximo login en vez de perderse.
    console.warn('[onboarding] no se pudo volcar el quiz:', error.message);
    return;
  }

  await guardarRespuestas({ ...r, volcado: true });
}
