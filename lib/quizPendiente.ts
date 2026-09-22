// Respuestas de quiz dadas SIN cuenta, esperando a que haya una.
//
// 🔴 POR QUÉ EXISTE: `user_quiz_answers.user_id` es FK a `profiles`, así que no
// se puede escribir hasta que la persona se registre. Y los dos lugares donde se
// contesta permiten hacerlo sin cuenta:
//   · el onboarding guiado (pantallas 3-4-5), que terminaba tirando todo;
//   · `QuizScreen`, cuyo upsert hacía `if (!uid) return;` y seguía de largo en
//     silencio — escribía `vive_quiz_topic` en AsyncStorage, una clave que NO
//     LEE NADIE, así que la respuesta se perdía igual.
//
// Acá se guardan hasta que aparezca la sesión; `AuthContext` las vuelca.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type QuizPendiente = {
  topic?: string | null;
  /**
   * El universo que la persona eligió en el onboarding (cuerpo/mente/alma).
   * `QuizScreen` no lo pregunta, así que ahí viaja vacío y el eje se sigue
   * deduciendo del topic. Ver `scripts/add-quiz-declared-axis.sql`.
   */
  axis?: string | null;
  professionalType?: string | null;
  budget?: string | null;
  /** Tope de la barra de presupuesto, en pesos (21/09/2026). */
  budgetMax?: number | null;
  /** M14 ampliado (21/09/2026): cómo quiere que la acompañen. Hasta esa fecha
   *  el estilo se perdía al salir del quiz. `'any'` también se guarda: "no
   *  sabría decir" es una respuesta, y al volver tiene que aparecer marcada. */
  estilo?: string | null;
  /** Hasta 2 áreas y hasta 3 temas concretos (21/09/2026). `topic` se sigue
   *  escribiendo con la primera área. Un array vacío en `subtemas` es una
   *  respuesta ("cualquiera de estos") y sí viaja, para borrar la anterior. */
  areas?: string[] | null;
  subtemas?: string[] | null;
  guia?: string | null;
  foco?: string | null;
  generoPref?: string | null;
  /** Ya se escribió en la base. Ver `volcarPendiente`. */
  volcado?: boolean;
};

const KEY = 'vita_quiz_pendiente';

async function leerCrudo(): Promise<QuizPendiente | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuizPendiente;
  } catch {
    // Storage corrupto no puede romper el arranque de la app.
    return null;
  }
}

export const leerPendiente = leerCrudo;

/**
 * Guarda respuestas nuevas sobre las que hubiera.
 *
 * 📝 Merge y no reemplazo: el onboarding solo produce `topic`, y `QuizScreen`
 * los tres campos. Pisar el registro entero haría que hacer el quiz después del
 * onboarding borrara lo que ya había, o al revés.
 *
 * 🔴 `volcado` vuelve a false. Son respuestas nuevas: si quedaran marcadas como
 * ya escritas, no llegarían nunca a la base.
 */
export async function guardarPendiente(parcial: QuizPendiente): Promise<void> {
  const previo = (await leerCrudo()) ?? {};
  const limpio = Object.fromEntries(
    Object.entries(parcial).filter(([, v]) => v !== null && v !== undefined),
  );
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...previo, ...limpio, volcado: false }));
}

/**
 * Vuelca a `user_quiz_answers` lo que se había contestado sin cuenta.
 *
 * 🔴 UNA SOLA VEZ, y el flag es lo que lo garantiza. Sin eso, cada login
 * volvería a escribir una respuesta vieja y **pisaría un quiz más nuevo**.
 *
 * 📝 Solo viajan los campos que existen: el onboarding no pregunta tipo de
 * profesional ni presupuesto, y el upsert de PostgREST solo toca las columnas
 * que van en el payload, así que un volcado parcial no borra lo que ya había.
 */
export async function volcarPendiente(userId: string): Promise<void> {
  const p = await leerCrudo();
  if (!p || p.volcado) return;

  const fila: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (p.topic)            fila.topic = p.topic;
  if (p.axis)             fila.axis = p.axis;
  if (p.professionalType) fila.professional_type = p.professionalType;
  if (p.budget)           fila.budget = p.budget;
  if (typeof p.budgetMax === 'number') fila.budget_max = p.budgetMax;
  if (p.areas && p.areas.length > 0) fila.areas = p.areas;
  if (Array.isArray(p.subtemas))     fila.subtemas = p.subtemas;
  if (p.estilo)           fila.estilo = p.estilo;
  if (p.guia)             fila.guia = p.guia;
  if (p.foco)             fila.foco = p.foco;
  if (p.generoPref)       fila.genero_pref = p.generoPref;

  // Solo `user_id` y `updated_at`: no hay ninguna respuesta que escribir.
  if (Object.keys(fila).length <= 2) return;

  const { error } = await supabase
    .from('user_quiz_answers')
    .upsert(fila, { onConflict: 'user_id' });

  if (error) {
    // Sin marcar: se reintenta en el próximo login en vez de perderse.
    console.warn('[quiz] no se pudo volcar:', error.message);
    return;
  }

  await AsyncStorage.setItem(KEY, JSON.stringify({ ...p, volcado: true }));
}

/**
 * Las últimas respuestas del quiz de esta persona, vengan de donde vengan.
 *
 * Primero lo local (vale también sin cuenta y es lo más nuevo en este
 * teléfono); si no hay nada y hay sesión, la fila de la base, que es lo que
 * tiene quien hizo el quiz en otro teléfono. null = nunca lo hizo.
 *
 * Lo leen el quiz (para volver con todo marcado) y Profesionales (para que el
 * mazo sortee primero entre los que encajan). No valida contra las opciones:
 * cada consumidor descarta lo que no reconoce.
 */
export async function leerRespuestasGuardadas(): Promise<QuizPendiente | null> {
  const local = await leerCrudo();
  if (local) return local;
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from('user_quiz_answers').select('*').eq('user_id', uid).maybeSingle();
  if (!data) return null;
  return {
    topic: data.topic, areas: data.areas, subtemas: data.subtemas,
    professionalType: data.professional_type, budget: data.budget, budgetMax: data.budget_max,
    estilo: data.estilo, guia: data.guia, foco: data.foco, generoPref: data.genero_pref,
  };
}
